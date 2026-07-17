const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    

    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    
    charset: "utf8mb4",

    ssl: {
    rejectUnauthorized: false
  }
});

function normalizeSql(sql) {
    if (typeof sql !== "string") return sql;

    let normalized = sql.trim();

    normalized = normalized.replace(/\$(\d+)/g, "?");
    normalized = normalized.replace(/\bRETURNING\b[\s\S]*$/i, "");
    normalized = normalized.replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP");
    normalized = normalized.replace(/\bNULLS\s+LAST\b/gi, "");
    normalized = normalized.replace(/\bILIKE\b/gi, "LIKE");
    normalized = normalized.replace(/\bSELECT\s+DISTINCT\s+ON\s*\([^)]*\)\s+/gi, "SELECT DISTINCT ");
    normalized = normalized.replace(/\bCOUNT\s*\(\s*\*\s*\)\s+FILTER\s*\(\s*WHERE\s+([^)]*)\)/gi, "SUM(CASE WHEN $1 THEN 1 ELSE 0 END)");
    normalized = normalized.replace(/table_schema\s*=\s*'public'/gi, "table_schema = DATABASE()");

    return normalized;
}

function buildReturnedRows(originalSql, params, rows, metadata) {
    if (!/\bRETURNING\b/i.test(originalSql)) {
        return rows;
    }

    const insertMatch = originalSql.match(/\binsert\s+into\s+([^\s(]+)\s*\(([^)]*)\)\s*values\s*\(([^)]*)\)/i);
    if (!insertMatch) {
        return rows;
    }

    const returningMatch = originalSql.match(/\bRETURNING\b\s+(.+)$/i);
    if (!returningMatch) {
        return rows;
    }

    const insertColumns = insertMatch[2]
        .split(',')
        .map((column) => column.trim().replace(/`/g, ""));
    const insertedValues = Array.isArray(params) ? params : [];
    const returnedColumns = returningMatch[1]
        .split(',')
        .map((column) => column.trim().replace(/`/g, ""));

    const row = {};
    returnedColumns.forEach((column) => {
        const normalizedColumn = column.split(/\s+/)[0];
        if (normalizedColumn === "id") {
            row[normalizedColumn] = metadata.insertId || null;
            return;
        }

        const columnIndex = insertColumns.indexOf(normalizedColumn);
        if (columnIndex >= 0 && insertedValues[columnIndex] !== undefined) {
            row[normalizedColumn] = insertedValues[columnIndex];
            return;
        }

        row[normalizedColumn] = null;
    });

    return [row];
}

function normalizeResult(rows, fields, metadata = {}, originalSql, params) {
    const resultRows = Array.isArray(rows) ? rows : [];
    const normalizedRows = buildReturnedRows(originalSql, params, resultRows, metadata);
    const result = [normalizedRows];

    result.rows = normalizedRows;
    result.rowCount = Array.isArray(rows) ? normalizedRows.length : (metadata.affectedRows || 0);
    result.insertId = metadata.insertId || null;
    result.affectedRows = metadata.affectedRows || 0;
    result.changedRows = metadata.changedRows || null;
    result.fields = fields || null;
    result.meta = metadata;
    return result;
}

async function query(sql, params) {
    const normalizedSql = normalizeSql(sql);
    const [rows, fields] = await pool.query(normalizedSql, params);
    const metadata = {
        sql: normalizedSql,
        affectedRows: rows && typeof rows === "object" && "affectedRows" in rows ? rows.affectedRows : undefined,
        insertId: rows && typeof rows === "object" && "insertId" in rows ? rows.insertId : undefined,
        changedRows: rows && typeof rows === "object" && "changedRows" in rows ? rows.changedRows : undefined,
    };
    return normalizeResult(rows, fields, metadata, sql, params);
}

async function connect() {
    const connection = await pool.getConnection();
    const originalQuery = connection.query.bind(connection);

    connection.query = async (sql, params) => {
        const normalizedSql = normalizeSql(sql);
        const [rows, fields] = await originalQuery(normalizedSql, params);
        const metadata = {
            sql: normalizedSql,
            affectedRows: rows && typeof rows === "object" && "affectedRows" in rows ? rows.affectedRows : undefined,
            insertId: rows && typeof rows === "object" && "insertId" in rows ? rows.insertId : undefined,
            changedRows: rows && typeof rows === "object" && "changedRows" in rows ? rows.changedRows : undefined,
        };
        return normalizeResult(rows, fields, metadata, sql, params);
    };

    return connection;
}

(async () => {
    try {
        const conn = await connect();
        console.log("Connected to MySQL");
        conn.release();
    } catch (err) {
        console.error("MySQL Connection Error");
        console.error(err);
    }
})();

pool.connect = async () => {
    const connection = await pool.getConnection();
    const originalQuery = connection.query.bind(connection);

    connection.query = async (sql, params) => {
        const normalizedSql = normalizeSql(sql);
        const [rows, fields] = await originalQuery(normalizedSql, params);
        const metadata = {
            sql: normalizedSql,
            affectedRows: rows && typeof rows === "object" && "affectedRows" in rows ? rows.affectedRows : undefined,
            insertId: rows && typeof rows === "object" && "insertId" in rows ? rows.insertId : undefined,
            changedRows: rows && typeof rows === "object" && "changedRows" in rows ? rows.changedRows : undefined,
        };
        return normalizeResult(rows, fields, metadata, sql, params);
    };

    return connection;
};

module.exports = {
    query,
    pool,
    connect,
};