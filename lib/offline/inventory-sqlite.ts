import * as SQLite from "expo-sqlite";

/** Allowed value types for SQL parameter bindings. */
export type InventorySqlValue = string | number | null;

/** SQL statement with optional parameter bindings. */
export type InventorySqlStatement = {
  /** SQL text to execute. */
  sql: string;
  /** Parameters bound to the SQL statement. */
  params?: InventorySqlValue[];
};

/** Row list with the internal array helper available in expo-sqlite. */
export type InventorySqlRowList<T> = SQLite.SQLResultSetRowList & {
  /** Cached array of rows. */
  _array?: T[];
};

/** Database file name for inventory offline storage. */
const INVENTORY_DB_NAME = "inventory.db";

let inventoryDatabase: SQLite.WebSQLDatabase | null = null;
let inventoryInitPromise: Promise<void> | null = null;

/**
 * Open (or reuse) the SQLite database instance.
 */
function openInventoryDatabase(): SQLite.WebSQLDatabase {
  if (!inventoryDatabase) {
    inventoryDatabase = SQLite.openDatabase(INVENTORY_DB_NAME);
  }

  return inventoryDatabase;
}

/**
 * Execute a SQL statement inside a dedicated transaction.
 */
export function runInventorySql(
  sql: string,
  params: InventorySqlValue[] = []
): Promise<SQLite.SQLResultSet> {
  const db = openInventoryDatabase();

  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        tx.executeSql(
          sql,
          params,
          (_, result) => resolve(result),
          (_, error) => {
            reject(error);
            return true;
          }
        );
      },
      (error) => reject(error)
    );
  });
}

/**
 * Execute multiple SQL statements in a single transaction.
 */
export function runInventorySqlBatch(
  statements: InventorySqlStatement[]
): Promise<void> {
  if (statements.length === 0) {
    return Promise.resolve();
  }

  const db = openInventoryDatabase();

  return new Promise((resolve, reject) => {
    db.transaction(
      (tx) => {
        for (const statement of statements) {
          tx.executeSql(statement.sql, statement.params ?? []);
        }
      },
      (error) => reject(error),
      () => resolve()
    );
  });
}

/**
 * Extract a typed array of rows from a SQL result set.
 */
export function getInventorySqlRows<T>(
  result: SQLite.SQLResultSet
): T[] {
  const rows = result.rows as InventorySqlRowList<T>;
  return rows._array ?? [];
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
