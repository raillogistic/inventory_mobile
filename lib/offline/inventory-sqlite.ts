import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

/** Allowed value types for SQL parameter bindings. */
export type InventorySqlValue = string | number | null;

/** Result payload returned by SQL helpers. */
export type InventorySqlResult<T> = {
  /** Rows returned from a SELECT query. */
  rows: T[];
  /** Number of rows changed for write operations. */
  changes: number;
  /** Last inserted row id when available. */
  lastInsertRowId: number | null;
};

/** SQL statement with optional parameter bindings. */
export type InventorySqlStatement = {
  /** SQL text to execute. */
  sql: string;
  /** Parameters bound to the SQL statement. */
  params?: InventorySqlValue[];
};

/** Database file name for inventory offline storage. */
const INVENTORY_DB_NAME = "inventory.db";

let inventoryDatabase: SQLiteDatabase | null = null;
let inventoryDatabasePromise: Promise<SQLiteDatabase> | null = null;
let inventoryInitPromise: Promise<void> | null = null;
let inventoryOperationQueue: Promise<void> = Promise.resolve();
let inventoryDatabaseConfigured = false;

/**
 * Serialize SQLite operations to prevent nested transactions.
 */
function enqueueInventoryOperation<T>(
  operation: () => Promise<T>
): Promise<T> {
  const run = inventoryOperationQueue.then(operation, operation);
  inventoryOperationQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * Open (or reuse) the SQLite database instance.
 */
async function openInventoryDatabase(): Promise<SQLiteDatabase> {
  if (inventoryDatabase) {
    return inventoryDatabase;
  }

  if (!inventoryDatabasePromise) {
    inventoryDatabasePromise = openDatabaseAsync(INVENTORY_DB_NAME);
  }

  inventoryDatabase = await inventoryDatabasePromise;

  if (!inventoryDatabaseConfigured) {
    try {
      await inventoryDatabase.execAsync("PRAGMA journal_mode = WAL;");
    } catch {
      // Ignore WAL configuration errors on unsupported platforms.
    }
    try {
      await inventoryDatabase.execAsync("PRAGMA busy_timeout = 5000;");
    } catch {
      // Ignore busy timeout configuration errors.
    }
    inventoryDatabaseConfigured = true;
  }

  return inventoryDatabase;
}

/**
 * Determine whether a SQL statement should return rows.
 */
function isSelectStatement(sql: string): boolean {
  const normalized = sql.trim().toUpperCase();
  return (
    normalized.startsWith("SELECT") ||
    normalized.startsWith("WITH") ||
    normalized.startsWith("PRAGMA")
  );
}

/**
 * Execute a SQL statement and return rows or metadata.
 */
export async function runInventorySql<T>(
  sql: string,
  params: InventorySqlValue[] = []
): Promise<InventorySqlResult<T>> {
  return enqueueInventoryOperation(async () => {
    const db = await openInventoryDatabase();

    if (isSelectStatement(sql)) {
      const rows = await db.getAllAsync<T>(sql, params);
      return { rows, changes: 0, lastInsertRowId: null };
    }

    const result = await db.runAsync(sql, params);
    return {
      rows: [],
      changes: result.changes ?? 0,
      lastInsertRowId: result.lastInsertRowId ?? null,
    };
  });
}

/**
 * Execute multiple SQL statements in a single transaction.
 */
export async function runInventorySqlBatch(
  statements: InventorySqlStatement[]
): Promise<void> {
  if (statements.length === 0) {
    return;
  }

  await enqueueInventoryOperation(async () => {
    const db = await openInventoryDatabase();

    await db.withTransactionAsync(async () => {
      for (const statement of statements) {
        await db.runAsync(statement.sql, statement.params ?? []);
      }
    });
  });
}

/**
 * Extract a typed array of rows from a SQL result set.
 */
export function getInventorySqlRows<T>(result: InventorySqlResult<T>): T[] {
  return result.rows ?? [];
}

/**
 * Initialize the inventory SQLite schema if needed.
 */
async function initializeInventoryDatabase(): Promise<void> {
  const statements: InventorySqlStatement[] = [
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_campaigns (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "code_campagne TEXT NOT NULL, " +
        "nom TEXT NOT NULL, " +
        "date_debut TEXT, " +
        "date_fin TEXT" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_locations (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "locationname TEXT NOT NULL, " +
        "desc TEXT, " +
        "barcode TEXT, " +
        "parent_id TEXT, " +
        "parent_locationname TEXT" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_groups (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "nom TEXT NOT NULL, " +
        "appareil_identifiant TEXT NOT NULL, " +
        "pin_code TEXT NOT NULL, " +
        "role TEXT NOT NULL, " +
        "utilisateur_id TEXT NOT NULL, " +
        "utilisateur_username TEXT NOT NULL, " +
        "campagne_id TEXT NOT NULL, " +
        "campagne_nom TEXT" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_group_locations (" +
        "group_id TEXT NOT NULL, " +
        "location_id TEXT NOT NULL, " +
        "PRIMARY KEY (group_id, location_id)" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_articles (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "code TEXT NOT NULL, " +
        "desc TEXT, " +
        "serialnumber TEXT, " +
        "current_location_id TEXT, " +
        "current_location_name TEXT" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_article_locations (" +
        "article_id TEXT NOT NULL, " +
        "location_id TEXT NOT NULL, " +
        "locationname TEXT NOT NULL, " +
        "PRIMARY KEY (article_id, location_id)" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_metadata (" +
        "key TEXT PRIMARY KEY NOT NULL, " +
        "value TEXT" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_scans (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "remote_id TEXT, " +
        "code_article TEXT NOT NULL, " +
        "article_id TEXT, " +
        "article_desc TEXT, " +
        "campagne_id TEXT NOT NULL, " +
        "groupe_id TEXT NOT NULL, " +
        "lieu_id TEXT NOT NULL, " +
        "lieu_name TEXT NOT NULL, " +
        "commentaire TEXT, " +
        "custom_desc TEXT, " +
        "observation TEXT, " +
        "serial_number TEXT, " +
        "etat TEXT, " +
        "capture_le TEXT NOT NULL, " +
        "source_scan TEXT, " +
        "image_uri TEXT, " +
        "image_uri2 TEXT, " +
        "image_uri3 TEXT, " +
        "status TEXT NOT NULL, " +
        "status_label TEXT NOT NULL, " +
        "is_synced INTEGER NOT NULL, " +
        "updated_at TEXT NOT NULL" +
        ")",
    },
    {
      sql:
        "CREATE TABLE IF NOT EXISTS inventory_scan_history (" +
        "id TEXT PRIMARY KEY NOT NULL, " +
        "code TEXT NOT NULL, " +
        "description TEXT, " +
        "image_uri TEXT, " +
        "status TEXT NOT NULL, " +
        "status_label TEXT NOT NULL, " +
        "captured_at TEXT NOT NULL, " +
        "location_id TEXT, " +
        "location_name TEXT NOT NULL, " +
        "etat TEXT, " +
        "observation TEXT, " +
        "serial_number TEXT" +
        ")",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_locations_parent " +
        "ON inventory_locations(parent_id)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_locations_barcode " +
        "ON inventory_locations(barcode)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_groups_campaign " +
        "ON inventory_groups(campagne_id)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_groups_nom " +
        "ON inventory_groups(nom)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_campaigns_nom " +
        "ON inventory_campaigns(nom)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_articles_code " +
        "ON inventory_articles(code)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scans_campaign " +
        "ON inventory_scans(campagne_id)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scans_group " +
        "ON inventory_scans(groupe_id)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scans_location " +
        "ON inventory_scans(lieu_id)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scans_capture " +
        "ON inventory_scans(capture_le)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scans_sync " +
        "ON inventory_scans(is_synced)",
    },
    {
      sql:
        "CREATE INDEX IF NOT EXISTS idx_inventory_scan_history_capture " +
        "ON inventory_scan_history(captured_at)",
    },
  ];

  await runInventorySqlBatch(statements);
}

/**
 * Apply schema migrations for existing inventories.
 */
async function migrateInventoryDatabase(): Promise<void> {
  const columnsResult = await runInventorySql<{ name: string }>(
    "PRAGMA table_info(inventory_articles)"
  );
  const columnNames = new Set(columnsResult.rows.map((row) => row.name));

  if (!columnNames.has("current_location_id")) {
    await runInventorySql(
      "ALTER TABLE inventory_articles ADD COLUMN current_location_id TEXT"
    );
  }

  if (!columnNames.has("current_location_name")) {
    await runInventorySql(
      "ALTER TABLE inventory_articles ADD COLUMN current_location_name TEXT"
    );
  }

  if (!columnNames.has("serialnumber")) {
    await runInventorySql(
      "ALTER TABLE inventory_articles ADD COLUMN serialnumber TEXT"
    );
  }

  const scanColumnsResult = await runInventorySql<{ name: string }>(
    "PRAGMA table_info(inventory_scans)"
  );
  const scanColumnNames = new Set(
    scanColumnsResult.rows.map((row) => row.name)
  );

  if (!scanColumnNames.has("commentaire")) {
    await runInventorySql(
      "ALTER TABLE inventory_scans ADD COLUMN commentaire TEXT"
    );
  }

  if (!scanColumnNames.has("custom_desc")) {
    await runInventorySql(
      "ALTER TABLE inventory_scans ADD COLUMN custom_desc TEXT"
    );
  }

  if (!scanColumnNames.has("image_uri2")) {
    await runInventorySql(
      "ALTER TABLE inventory_scans ADD COLUMN image_uri2 TEXT"
    );
  }

  if (!scanColumnNames.has("image_uri3")) {
    await runInventorySql(
      "ALTER TABLE inventory_scans ADD COLUMN image_uri3 TEXT"
    );
  }
}

/**
 * Ensure the inventory database is initialized before use.
 */
export async function ensureInventoryDatabase(): Promise<void> {
  if (!inventoryInitPromise) {
    inventoryInitPromise = initializeInventoryDatabase().then(
      migrateInventoryDatabase
    );
  }

  await inventoryInitPromise;
}
