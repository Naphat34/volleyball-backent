const db = require('../config/db');

const reportQueries = {
  competitions: {
    title: 'Competitions Report',
    columns: ['id', 'title', 'gender', 'age_group_name', 'status', 'start_date', 'end_date', 'team_count'],
    sql: `
      SELECT c.id, c.title, c.gender, ag.name AS age_group_name, c.status, c.start_date, c.end_date,
        (SELECT COUNT(*) FROM team_entries te WHERE te.competition_id = c.id) AS team_count
      FROM competitions c
      LEFT JOIN age_groups ag ON ag.id = c.age_group_id
      ORDER BY c.start_date DESC, c.id DESC
    `,
  },
  teams: {
    title: 'Teams Report',
    columns: ['id', 'name', 'code', 'coach', 'status', 'category', 'created_at'],
    sql: `
      SELECT id, name, code, coach, status, category, created_at
      FROM teams
      ORDER BY name ASC
    `,
  },
  matches: {
    title: 'Matches Report',
    columns: ['id', 'competition_name', 'round_name', 'match_number', 'home_team', 'away_team', 'status', 'home_set_score', 'away_set_score', 'match_date', 'start_time'],
    sql: `
      SELECT m.id, c.title AS competition_name, m.round_name, m.match_number,
        ht.name AS home_team, at.name AS away_team, m.status, m.home_set_score, m.away_set_score,
        m.match_date, m.start_time
      FROM matches m
      LEFT JOIN competitions c ON c.id = m.competition_id
      LEFT JOIN teams ht ON ht.id = m.home_team_id
      LEFT JOIN teams at ON at.id = m.away_team_id
      ORDER BY m.match_date DESC, m.start_time DESC, m.id DESC
    `,
  },
  audit: {
    title: 'Audit Log Report',
    columns: ['id', 'created_at', 'username', 'role', 'action', 'entity_type', 'entity_id', 'ip_address'],
    sql: `
      SELECT id, created_at, username, role, action, entity_type, entity_id, ip_address
      FROM audit_logs
      ORDER BY created_at DESC, id DESC
      LIMIT 1000
    `,
  },
};

const escapeCsv = (value) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const escapePdfText = (value) => String(value ?? '')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)');

const buildCsv = (report, rows) => [
  report.columns.map(escapeCsv).join(','),
  ...rows.map((row) => report.columns.map((column) => escapeCsv(row[column])).join(',')),
].join('\n');

const buildExcelHtml = (report, rows) => `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title></head>
<body>
<table border="1">
<caption>${escapeHtml(report.title)}</caption>
<thead><tr>${report.columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
<tbody>
${rows.map((row) => `<tr>${report.columns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('\n')}
</tbody>
</table>
</body>
</html>`;

const buildSimplePdf = (report, rows) => {
  const lines = [
    report.title,
    report.columns.join(' | '),
    ...rows.slice(0, 80).map((row) => report.columns.map((column) => row[column] ?? '').join(' | ')),
  ];

  const content = [
    'BT',
    '/F1 10 Tf',
    '40 800 Td',
    ...lines.map((line, index) => `${index === 0 ? '' : '0 -14 Td'}(${escapePdfText(line).slice(0, 150)}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
    `5 0 obj << /Length ${Buffer.byteLength(content)} >> stream\n${content}\nendstream endobj`,
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${object}\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

exports.exportReport = async (req, res) => {
  try {
    const { type, format } = req.params;
    const report = reportQueries[type];
    if (!report) return res.status(404).json({ error: 'Report type not found' });

    const result = await db.query(report.sql);
    const rows = result.rows || [];
    const filename = `${type}-report.${format}`;

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buildCsv(report, rows));
    }

    if (format === 'xls') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buildExcelHtml(report, rows));
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buildSimplePdf(report, rows));
    }

    return res.status(400).json({ error: 'Unsupported report format' });
  } catch (err) {
    console.error('Export Report Error:', err);
    return res.status(500).json({ error: 'Report export failed' });
  }
};
