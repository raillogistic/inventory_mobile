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
let inventoryBatchQueue: Promise<void> = Promise.resolve();

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

  const db = await openInventoryDatabase();

  const executeBatch = async () => {
    await db.withTransactionAsync(async () => {
      for (const statement of statements) {
        await db.runAsync(statement.sql, statement.params ?? []);
      }
    });
  };

  inventoryBatchQueue = inventoryBatchQueue.then(executeBatch, executeBatch);
  await inventoryBatchQueue;
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
        "desc TEXT" +
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
        "observation TEXT, " +
        "serial_number TEXT, " +
        "etat TEXT, " +
        "capture_le TEXT NOT NULL, " +
        "source_scan TEXT, " +
        "image_uri TEXT, " +
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
 * Ensure the inventory database is initialized before use.
 */
export async function ensureInventoryDatabase(): Promise<void> {
  if (!inventoryInitPromise) {
    inventoryInitPromise = initializeInventoryDatabase();
  }

  await inventoryInitPromise;
}
