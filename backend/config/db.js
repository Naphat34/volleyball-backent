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
    ssl: process.env.DB_SSL === "true"
        ? {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false"
          }
        : undefined
});

/**
 * แปลง SQL Syntax จาก PostgreSQL เป็น MySQL
 */
function normalizeSql(sql) {
    if (typeof sql !== "string") return sql;

    let normalized = sql.trim();

    // 1. แปลง $1, $2 เป็น ? (เฉพาะตัวระบุ Parameter)
    normalized = normalized.replace(/\$(\d+)/g, "?");

    // 2. ลบ RETURNING clause ออกก่อนส่งให้ MySQL
    normalized = normalized.replace(/\s+RETURNING\s+[\s\S]*$/i, "");

    // 3. แปลง Dialect Specific Keywords
    normalized = normalized.replace(/\bNOW\(\)/gi, "CURRENT_TIMESTAMP");
    normalized = normalized.replace(/\bNULLS\s+LAST\b/gi, "");
    normalized = normalized.replace(/\bILIKE\b/gi, "LIKE");
    normalized = normalized.replace(/\bSELECT\s+DISTINCT\s+ON\s*\([^)]*\)\s+/gi, "SELECT DISTINCT ");
    normalized = normalized.replace(/\bCOUNT\s*\(\s*\*\s*\)\s+FILTER\s*\(\s*WHERE\s+([^)]*)\)/gi, "SUM(CASE WHEN $1 THEN 1 ELSE 0 END)");
    normalized = normalized.replace(/table_schema\s*=\s*'public'/gi, "table_schema = DATABASE()");

    return normalized;
}

/**
 * จำลองคืนค่าแบบ RETURNING (สำหรับ INSERT 单行)
 */
function buildReturnedRows(originalSql, params, rows, metadata) {
    if (!/\bRETURNING\b/i.test(originalSql)) {
        return Array.isArray(rows) ? rows : [];
    }

    const returningMatch = originalSql.match(/\bRETURNING\b\s+(.+)$/i);
    if (!returningMatch) return Array.isArray(rows) ? rows : [];

    const returnedColumns = returningMatch[1]
        .split(",")
        .map((col) => col.trim().replace(/`/g, "").split(/\s+/)[0]);

    const row = {};
    returnedColumns.forEach((col) => {
        if (col.toLowerCase() === "id") {
            row[col] = metadata.insertId || null;
        } else {
            row[col] = null; // คืนค่า default null สำหรับ column อื่นหากไม่ได้ parse เพิ่ม
        }
    });

    return [row];
}

/**
 * ปรับโครงสร้าง Result ให้รองรับโครงสร้างแบบ pg/node-postgres
 */
function normalizeResult(rows, fields, metadata = {}, originalSql, params) {
    const isSelect = Array.isArray(rows);
    const resultRows = isSelect ? rows : buildReturnedRows(originalSql, params, rows, metadata);

    const result = [resultRows];
    result.rows = resultRows;
    result.rowCount = isSelect ? resultRows.length : (metadata.affectedRows || 0);
    result.insertId = metadata.insertId || null;
    result.affectedRows = metadata.affectedRows || 0;
    result.changedRows = metadata.changedRows || null;
    result.fields = fields || null;
    result.meta = metadata;

    return result;
}

/**
 * ฟังก์ชัน Wrapping Connection เพื่อให้รองรับ query ที่แปลแล้ว
 */
function wrapConnection(connection) {
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
    return wrapConnection(connection);
}

// ผูกฟังก์ชัน connect ให้ pool
pool.connect = connect;

// ทดสอบการเชื่อมต่อเมื่อเริ่มต้นใช้งาน
(async () => {
    try {
        const conn = await connect();
        console.log("Connected to MySQL successfully.");
        conn.release();
    } catch (err) {
        console.error("MySQL Connection Error:", err);
    }
})();

module.exports = {
    query,
    pool,
    connect,
};
