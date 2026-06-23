import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font } from '@react-pdf/renderer';
import { formatThaiDate } from '../utils';

// ลงทะเบียน Font ภาษาไทย
Font.register({
  family: 'Sarabun',
  src: '/fonts/Sarabun-Regular.ttf'
});

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 9, fontFamily: 'Sarabun' }, // ใช้ Font ที่ลงทะเบียน
  headerArea: { textAlign: 'center', marginBottom: 15 },
  title: { fontSize: 14, fontWeight: 'bold' },
  subTitle: { fontSize: 12, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, fontWeight: 'bold', fontSize: 12 },
  table: { display: 'table', width: 'auto', borderStyle: 'solid', borderWidth: 1, marginBottom: 15 },
  tableRow: { flexDirection: 'row' },
  tableHeader: { backgroundColor: '#e4e4e4ce', fontWeight: 'bold', padding: 3, borderRightWidth: 1, borderBottomWidth: 1, textAlign: 'center' },
  tableCell: { padding: 3, borderRightWidth: 1, borderBottomWidth: 1, textAlign: 'center' },
  footerContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  staffTable: { width: '38%', borderStyle: 'solid', borderWidth: 1 },
  colorsTable: { width: '18%', borderStyle: 'solid', borderWidth: 1 },
  circle: { borderWidth: 1, borderColor: '#000', borderRadius: 50, width: 18, height: 18, alignItems: 'center', justifyContent: 'center', margin: 'auto' },
  statsTable: { width: '42%', borderStyle: 'solid', borderWidth: 1 },
  legend: { fontSize: 8, marginTop: 10 }
});

const O2FormDocument = ({ teamInfo, players, staff }) => {
  // ฟังก์ชันช่วยดึงชื่อสตาฟฟ์ตามตำแหน่งและลำดับ
  const getStaffNameByRole = (role, index = 0) => {
    if (!staff || !Array.isArray(staff)) return '................................';

    // Role mapping เพื่อจัดการความแตกต่างของชื่อตำแหน่งในระบบกับแบบฟอร์ม O-2
    const roleMapping = {
      'Assistant Coach': ['Assistant Coach', 'Assistant coach', 'Asst Coach', 'Assistant Coach 1'],
      'Assistant Coach 2': ['Assistant Coach 2', 'Assistant coach 2', 'Asst Coach 2'],
      'Therapist/Trainer': ['Physiotherapist', 'Therapist', 'Trainer', 'Therapist/Trainer'],
      'Doctor': ['Doctor', 'Physician', 'Medical Doctor'],
      // สามารถเพิ่มการ Mapping อื่นๆ ได้ที่นี่
    };

    const targetRoles = roleMapping[role] || [role];

    const list = staff.filter(member =>
      targetRoles.some(r => member.role?.toLowerCase().trim() === r.toLowerCase().trim())
    );

    const s = list[index];
    return s ? `${s.first_name} ${s.last_name}` : '................................';
  };

  // คำนวณสถิติ
  const getNumValue = (p, field) => {
    const val = parseFloat(p[field]);
    return isNaN(val) ? null : val;
  };

  const getAgeValue = (p) => {
    if (!p.birth_date) return null;
    const birthYear = new Date(p.birth_date).getFullYear();
    const currentYear = new Date().getFullYear();
    return currentYear - birthYear;
  };

  const computeStats = (dataArr) => {
    if (!dataArr || dataArr.length === 0) return { min: '-', avg: '-', max: '-' };
    const sum = dataArr.reduce((a, b) => a + b, 0);
    return {
      min: Math.min(...dataArr).toFixed(0),
      avg: (sum / dataArr.length).toFixed(1),
      max: Math.max(...dataArr).toFixed(0)
    };
  };

  const ages = players.map(getAgeValue).filter(v => v !== null);
  const heights = players.map(p => getNumValue(p, 'height_cm') || getNumValue(p, 'height')).filter(v => v !== null);
  const spikes = players.map(p => getNumValue(p, 'spike_reach')).filter(v => v !== null);
  const blocks = players.map(p => getNumValue(p, 'block_reach')).filter(v => v !== null);

  const stats = {
    age: computeStats(ages),
    height: computeStats(heights),
    spike: computeStats(spikes),
    block: computeStats(blocks)
  };

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header ส่วนบน แสดงชื่อรายการแข่งขัน */}
        <View style={styles.headerArea}>
          <Text style={styles.title}>{teamInfo?.competition_name || 'Asian Volleyball Confederation'}</Text>
          <Text style={styles.subTitle}>0-2 bis | TEAM REGISTRATION</Text>
        </View>

        {/* ข้อมูลทีมและโค้ดทีม */}
        <View style={styles.metaRow}>
          <Text>TEAM: {teamInfo?.name || '................................'}   CODE: {teamInfo?.code || '........'}</Text>
        </View>

        {/* ตารางรายชื่อผู้เล่นตามหัวข้อในตัวอย่าง */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeader, { width: '6%' }]}>Shirt No.</Text>
            <Text style={[styles.tableHeader, { width: '16%' }]}>Last Name</Text>
            <Text style={[styles.tableHeader, { width: '16%' }]}>First Name</Text>
            <Text style={[styles.tableHeader, { width: '8%' }]}>Position</Text>
            <Text style={[styles.tableHeader, { width: '10%' }]}>Birthdate</Text>
            <Text style={[styles.tableHeader, { width: '10%' }]}>Nationality</Text>
            <Text style={[styles.tableHeader, { width: '8%' }]}>Weight</Text>
            <Text style={[styles.tableHeader, { width: '8%' }]}>Height</Text>
            <Text style={[styles.tableHeader, { width: '9%' }]}>Spike</Text>
            <Text style={[styles.tableHeader, { width: '9%' }]}>Block</Text>
          </View>

          {players.map((p, i) => (
            <View style={styles.tableRow} key={i}>
              <View style={[styles.tableCell, { width: '6%', padding: 0, justifyContent: 'center', alignItems: 'center' }]}>
                {p.is_captain ? (
                  <View style={styles.circle}>
                    <Text style={{ fontSize: 8 }}>{p.number}</Text>
                  </View>
                ) : (
                  <Text>{p.number}</Text>
                )}
              </View>
              <Text style={[styles.tableCell, { width: '16%', textAlign: 'left' }]}>{p.last_name?.toUpperCase()}</Text>
              <Text style={[styles.tableCell, { width: '16%', textAlign: 'left' }]}>{p.first_name?.toUpperCase()}</Text>
              <Text style={[styles.tableCell, { width: '8%' }]}>{p.position}</Text>
              <Text style={[styles.tableCell, { width: '10%' }]}>{formatThaiDate(p.birth_date)}</Text>
              <Text style={[styles.tableCell, { width: '10%' }]}>{p.nationality || '-'}</Text>
              <Text style={[styles.tableCell, { width: '8%' }]}>{p.weight_kg || p.weight || '-'}</Text>
              <Text style={[styles.tableCell, { width: '8%' }]}>{p.height_cm || p.height || '-'}</Text>
              <Text style={[styles.tableCell, { width: '9%' }]}>{p.spike_reach || '-'}</Text>
              <Text style={[styles.tableCell, { width: '9%' }]}>{p.block_reach || '-'}</Text>
            </View>
          ))}
        </View>

        {/* ส่วนท้าย: Official Staff, Colors, Statistics */}
        <View style={styles.footerContainer}>
          {/* ส่วน OFFICIAL STAFF */}
          <View style={styles.staffTable}>
            <Text style={{ backgroundColor: '#EEE', padding: 2, textAlign: 'center', borderBottomWidth: 1, fontWeight: 'bold' }}>OFFICIAL STAFF</Text>
            <View style={{ padding: 4, gap: 2 }}>
              <Text>1. Team manager: {getStaffNameByRole('Team Manager')}</Text>
              <Text>2. Head coach: {getStaffNameByRole('Head Coach')}</Text>
              <Text>3. Assistant coach: {getStaffNameByRole('Assistant Coach', 0)}</Text>
              <Text>4. Assistant coach 2: {
                getStaffNameByRole('Assistant Coach 2', 0) !== '................................'
                  ? getStaffNameByRole('Assistant Coach 2', 0)
                  : getStaffNameByRole('Assistant Coach', 1)
              }</Text>
              <Text>5. Doctor: {getStaffNameByRole('Doctor')}</Text>
              <Text>6. Therapist/Trainer: {getStaffNameByRole('Therapist/Trainer')}</Text>
            </View>
          </View>

          {/* ส่วน COLORS */}
          <View style={styles.colorsTable}>
            <Text style={{ backgroundColor: '#EEE', padding: 2, textAlign: 'center', borderBottomWidth: 1, fontWeight: 'bold' }}>COLORS</Text>
            <View style={{ padding: 4, gap: 2 }}>
              <Text>1. Main: {teamInfo?.home_color || '-'}</Text>
              <Text>2. 2nd: {teamInfo?.away_color || '-'}</Text>
              <Text>3. 3rd: -</Text>
              <Text>4. 4th: -</Text>
            </View>
          </View>

          {/* ส่วน STATISTICS */}
          <View style={styles.statsTable}>
            <Text style={{ backgroundColor: '#EEE', padding: 2, textAlign: 'center', borderBottomWidth: 1, fontWeight: 'bold' }}>STATISTICS</Text>
            <View style={styles.tableRow}>
              <Text style={{ width: '28%', padding: 2, borderRightWidth: 1, borderBottomWidth: 1, backgroundColor: '#F8F8F8' }}>Data</Text>
              <Text style={{ width: '24%', padding: 2, borderRightWidth: 1, borderBottomWidth: 1, textAlign: 'center' }}>Minimum</Text>
              <Text style={{ width: '24%', padding: 2, borderRightWidth: 1, borderBottomWidth: 1, textAlign: 'center' }}>Average</Text>
              <Text style={{ width: '24%', padding: 2, borderBottomWidth: 1, textAlign: 'center' }}>Maximum</Text>
            </View>
            <StatRow label="Age" data={stats.age} />
            <StatRow label="Height" data={stats.height} />
            <StatRow label="Spike" data={stats.spike} />
            <StatRow label="Block" data={stats.block} />
            <StatRow label="NT Select" data={{ min: '-', avg: '-', max: '-' }} last />
          </View>
        </View>

        {/* คำอธิบายตัวย่อ */}
        <Text style={styles.legend}>
          L=Libero, S=Setter, OP=Opposite, MB=Middle Blocker, OH=Outside Hitter
        </Text>
      </Page>
    </Document>
  );
};

// Helper Component สำหรับแถวสถิติ
const StatRow = ({ label, data, last = false }) => (
  <View style={styles.tableRow}>
    <Text style={{ width: '28%', padding: 2, borderRightWidth: 1, borderBottomWidth: last ? 0 : 1, backgroundColor: '#F8F8F8' }}>{label}</Text>
    <Text style={{ width: '24%', padding: 2, borderRightWidth: 1, borderBottomWidth: last ? 0 : 1, textAlign: 'center' }}>{data.min}</Text>
    <Text style={{ width: '24%', padding: 2, borderRightWidth: 1, borderBottomWidth: last ? 0 : 1, textAlign: 'center' }}>{data.avg}</Text>
    <Text style={{ width: '24%', padding: 2, borderBottomWidth: last ? 0 : 1, textAlign: 'center' }}>{data.max}</Text>
  </View>
);

export default O2FormDocument;