import React from 'react';
import { Page, Text as PdfText, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { compositionModel, personNames, value, dateLabel } from '../../utils/reports/teamComposition';
import '../../utils/reports/reactPdfBrowserCompat';

Font.register({ family: 'CompositionSarabun', fonts: [{ src: '/fonts/Sarabun-Regular.ttf' }, { src: '/fonts/Sarabun-Bold.ttf', fontWeight: 700 }] });
Font.registerHyphenationCallback(word => [word]);
const Text = ({ children, ...props }) => <PdfText {...props}>{React.Children.map(children, child => typeof child === 'string' ? child.replace(/ำ/g, '\u0E4D\u0E32') : child)}</PdfText>;
const navy = '#102f50';
const styles = StyleSheet.create({
  page: { padding: 22.5, minHeight: 595.28, fontFamily: 'CompositionSarabun', fontSize: 6.7, lineHeight: 1.15, color: '#20272d' },
  header: { minHeight: 80, border: '0.7pt solid #22313b', flexDirection: 'row', padding: 7, alignItems: 'center' },
  competitionLogo: { width: 126, height: 57, objectFit: 'contain', marginRight: 10 },
  headerContent: { flex: 1 },
  title: { color: navy, fontSize: 12, lineHeight: 1.3, fontWeight: 700 },
  subtitle: { color: '#667078', fontSize: 8, lineHeight: 1.3 },
  competitionSubtitle: { marginTop: 3, flexShrink: 0 },
  rule: { borderBottom: '0.8pt solid #c9274b', paddingBottom: 4, marginBottom: 7, flexShrink: 0 },
  details: { flexDirection: 'row', alignItems: 'center' },
  teamLogo: { width: 30, height: 29, objectFit: 'contain', marginRight: 9 },
  teamName: { fontSize: 12, lineHeight: 1.3, fontWeight: 700 },
  associationLogo: { width: 57, height: 57, objectFit: 'contain', marginLeft: 15 },
  section: { color: navy, fontSize: 9, fontWeight: 700, textAlign: 'center', marginTop: 8, marginBottom: 4 },
  row: { flexDirection: 'row', borderLeft: '0.5pt solid #949da6', borderBottom: '0.5pt solid #949da6', minHeight: 11.5 },
  cell: { borderRight: '0.5pt solid #949da6', paddingHorizontal: 3, paddingVertical: 1, justifyContent: 'center' },
  tableHead: { backgroundColor: '#e9eef3', borderTop: '0.5pt solid #949da6', height: 21, fontWeight: 700 },
  bottom: { flexDirection: 'row', gap: 16, marginTop: 4 },
  subhead: { backgroundColor: '#e9eef3', border: '0.5pt solid #949da6', paddingHorizontal: 4, paddingVertical: 1, color: navy, fontWeight: 700 },
  footer: { position: 'absolute', bottom: 23, left: 22.5, right: 22.5, borderTop: '0.7pt solid #22313b', paddingTop: 3, flexDirection: 'row', color: '#68717a', fontSize: 6.5 },
});
const imageUrl = raw => {
  if (!raw) return null;
  if (/^(https?:|data:|blob:)/.test(raw)) return raw;
  const server = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/api\/?$/, '');
  return `${server}${raw.startsWith('/') ? raw : `/uploads/${raw}`}`;
};
const Cell = ({ width, children, center = false, style }) => {
  const units = typeof children === 'string' ? Array.from(children).reduce((sum, c) => sum + (/[A-Z]/.test(c) ? 0.7 : /\s/.test(c) ? 0.3 : 0.57), 0) : 0;
  const fontSize = typeof children === 'string' && !children.includes('\n') ? Math.min(6.7, (797 * width / 100 - 7) / Math.max(units, 1)) : 6.7;
  return <View style={[styles.cell, { width: `${width}%`, textAlign: center ? 'center' : 'left' }, style]}><Text style={{ fontSize, lineHeight: 1.15 }}>{children === '' || children === null || children === undefined ? '-' : children}</Text></View>;
};
const officialRoles = [
  ['Head Coach', 'ผู้ฝึกสอน'], ['Assistant Coach 1', 'ผู้ช่วยผู้ฝึกสอน 1'], ['Assistant Coach 2', 'ผู้ช่วยผู้ฝึกสอน 2'], ['Assistant Coach 3', 'ผู้ช่วยผู้ฝึกสอน 3'], ['Physiotherapist', 'นักกายภาพบำบัด'], ['Doctor', 'แพทย์'],
];
function Officials({ staff }) {
  const used = new Set();
  const group = (role, label) => {
    const aliases = role === 'Assistant Coach 1' ? ['Assistant Coach', role] : role === 'Physiotherapist' ? ['Physiotherapist', 'Therapist/Trainer'] : [role];
    const index = staff.findIndex((s, i) => !used.has(i) && aliases.some(alias => String(s.role || '').toLowerCase() === alias.toLowerCase()));
    if (index >= 0) used.add(index);
    const names = personNames(staff[index] || {});
    return <View style={styles.row} key={role}><Cell width={32}>{`${role}  ${label}`}</Cell><Cell width={32}>{names.th}</Cell><Cell width={36}>{names.en}</Cell></View>;
  };
  const bench = officialRoles.map(([role, label]) => group(role, label));
  const manager = group('Team Manager', 'ผู้จัดการทีม');
  const extra = staff.filter((_, index) => !used.has(index));
  return <View style={{ width: '51%' }}><Text style={styles.section}>OFFICIALS  เจ้าหน้าที่ทีม</Text><Text style={styles.subhead}>Sitting on the Bench</Text>{bench}<Text style={[styles.subhead, { marginTop: 5 }]}>Not on the Bench</Text>{manager}{extra.map((s, i) => { const names = personNames(s); return <View style={styles.row} key={i}><Cell width={32}>{s.role}</Cell><Cell width={32}>{names.th}</Cell><Cell width={36}>{names.en}</Cell></View>; })}</View>;
}
function Uniforms({ team }) {
  const colorLabels = { '#ffffff': 'ขาว / White', '#000000': 'ดำ / Black', '#111827': 'ดำ / Black', '#1f2937': 'เทาเข้ม / Charcoal', '#d1d5db': 'เทา / Gray', '#facc15': 'เหลือง / Yellow', '#ff0000': 'แดง / Red', '#0000ff': 'น้ำเงิน / Blue', '#008000': 'เขียว / Green', '#800080': 'ม่วง / Purple' };
  const colorCell = color => /^#[a-f\d]{6}$/i.test(color || '') ? <View style={[styles.cell, { width: '75%', flexDirection: 'row', alignItems: 'center', gap: 3 }]}><View style={{ width: 5, height: 5, backgroundColor: color, border: '0.3pt solid #949da6' }} /><Text style={{ fontSize: 6 }}>{colorLabels[color.toLowerCase()] || color.toUpperCase()}</Text></View> : <Cell width={75}>{color}</Cell>;
  return <View style={{ width: '22%' }}><Text style={styles.section}>UNIFORM COLORS  สีเสื้อ</Text>{['Team', 'Liberos'].map((label, index) => {
    const colors = index ? [team.libero_main_color, team.libero_second_color, team.libero_third_color] : [value(team.main_color, team.home_color), value(team.second_color, team.away_color), team.third_color];
    return <View style={{ flexDirection: 'row', marginBottom: 6 }} key={label}><Text style={{ width: '21%', paddingTop: 2, color: '#68717a' }}>{label}</Text><View style={{ width: '79%', borderTop: '0.5pt solid #949da6' }}>{colors.map((color, i) => <View style={styles.row} key={i}><Cell width={25} style={{ fontWeight: 700 }}>{['Main:', '2nd:', '3rd:'][i]}</Cell>{colorCell(color)}</View>)}</View></View>;
  })}</View>;
}

// Kept as the existing entry point so saved routes and imports remain compatible.
export default function O2FormDocument({ teamInfo = {}, players = [], staff = [], printedAt, assetOverrides = {} }) {
  const printed = new Date(printedAt || teamInfo.printed_at || Date.now());
  const reference = new Date(teamInfo.reference_date || printed);
  const model = compositionModel(players, reference);
  const legacyName = teamInfo.name || '';
  const teamTh = value(teamInfo.name_th, /[\u0E00-\u0E7F]/.test(legacyName) ? legacyName : '');
  const teamEn = value(teamInfo.name_en, !/[\u0E00-\u0E7F]/.test(legacyName) ? legacyName : '');
  const competitionLogo = assetOverrides.competition || imageUrl(value(teamInfo.competition_logo_url, teamInfo.competition_logo));
  const teamLogo = assetOverrides.team || imageUrl(value(teamInfo.logo_url, teamInfo.logo));
  const associationLogo = assetOverrides.association || imageUrl(value(teamInfo.association_logo_url, teamInfo.federation_logo_url));
  const timestamp = `${new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(printed).replaceAll(' ', '-')} ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(printed)} (UTC+7)`;
  return <Document title={`Team composition - ${teamEn || teamTh}`} author="Volley Manager">{model.pages.map((pageRows, pageIndex) => <Page key={pageIndex} size="A4" orientation="landscape" style={styles.page} wrap={false}>
    <View style={styles.header}>
      {competitionLogo && <Image src={competitionLogo} style={styles.competitionLogo} />}
      <View style={styles.headerContent}><View style={styles.rule}><Text style={styles.title}>{value(teamInfo.competition_name_en, teamInfo.competition_name, 'Volleyball competition')}</Text>{teamInfo.competition_name_th && <Text style={[styles.subtitle, styles.competitionSubtitle]}>{teamInfo.competition_name_th}</Text>}</View><View style={styles.details}><View style={{ width: 120 }}><Text style={{ fontSize: 9, lineHeight: 1.3 }}>Team composition</Text><Text style={{ color: '#68717a', fontSize: 6.5 }}>{[teamInfo.show_leg !== false ? `Leg ${teamInfo.leg || 1}` : '', `Revision ${teamInfo.revision || 1}`, dateLabel(reference)].filter(Boolean).join(' · ')}</Text></View>{teamLogo && <Image src={teamLogo} style={styles.teamLogo} />}<View style={{ flex: 1 }}><Text style={styles.teamName}>{teamTh || teamEn || '-'}</Text>{teamTh && teamEn && <Text style={styles.subtitle}>{teamEn}</Text>}</View></View></View>
      {associationLogo && <Image src={associationLogo} style={styles.associationLogo} />}
    </View>
    <Text style={styles.section}>PLAYERS</Text>
    <View style={[styles.row, styles.tableHead]}>{[[6.4, 'Shirt no'], [10.7, 'Last name'], [9.3, 'First name'], [16.4, 'ชื่อ - นามสกุล'], [10.7, 'Shirt name'], [3.8, 'Pos.'], [7.5, 'Birthdate'], [3.2, 'Age'], [4.6, 'Height\n[cm]'], [4.6, 'Weight\n[kg]'], [5.4, 'FIVB ID'], [17.4, 'ภูมิลำเนา / Domicile']].map(([width, label]) => <Cell key={label} width={width} center={width < 8}>{label}</Cell>)}</View>
    {pageRows.map(p => <View style={[styles.row, { height: 11.5 }]} key={p.key}>
      <View style={[styles.cell, { width: '4%', flexDirection: 'row', alignItems: 'center', gap: 2 }]}><Text>{p ? p.number || '-' : ' '}</Text></View><Cell width={2.4} center style={{ fontWeight: 700 }}>{p?.role || ' '}</Cell><Cell width={10.7}>{p ? String(p.last || '-').toUpperCase() : ' '}</Cell><Cell width={9.3}>{p ? p.first || '-' : ' '}</Cell><Cell width={16.4}>{p ? p.th || '-' : ' '}</Cell><Cell width={10.7}>{p ? String(p.shirt || '-').toUpperCase() : ' '}</Cell><Cell width={3.8} center>{p ? p.position || '-' : ' '}</Cell><Cell width={7.5} center>{p ? p.birth || '-' : ' '}</Cell><Cell width={3.2} center>{p ? p.age ?? '-' : ' '}</Cell><Cell width={4.6} center>{p ? p.height ?? '-' : ' '}</Cell><Cell width={4.6} center>{p ? p.weight ?? '-' : ' '}</Cell><Cell width={5.4} center>{p ? p.fivb || '-' : ' '}</Cell><Cell width={17.4}>{p ? p.domicile || '-' : ' '}</Cell>
    </View>)}
    <View style={styles.bottom}><Officials staff={staff} /><Uniforms team={teamInfo} /><View style={{ flex: 1 }}><Text style={styles.section}>STATISTICS  สถิติ</Text><View style={[styles.row, styles.tableHead, { height: 12 }]}>{['Data', 'Minimum', 'Average', 'Maximum'].map(label => <Cell key={label} width={label === 'Data' ? 34 : 22} center>{label}</Cell>)}</View>{model.stats.map(stat => <View key={stat.key} style={styles.row}><Cell width={34} style={{ fontWeight: 700 }}>{({ age: 'Age:', height: 'Height [cm]:', weight: 'Weight [kg]:' })[stat.key]}</Cell>{[stat.min, stat.average, stat.max].map((v, i) => <Cell key={i} width={22} center>{v}</Cell>)}</View>)}</View></View>
    <View style={styles.footer}><Text style={{ width: '42%' }}>{value(teamInfo.association_name, teamInfo.federation_name, 'Volley Manager')}</Text><Text style={{ width: '30%', textAlign: 'center' }}>{timestamp}</Text><Text style={{ width: '28%', textAlign: 'right' }}>{`Page ${pageIndex + 1} of ${model.pages.length}`}</Text></View>
  </Page>)}</Document>;
}
