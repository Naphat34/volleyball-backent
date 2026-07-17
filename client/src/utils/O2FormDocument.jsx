import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Import logos from assets
import LogoCup from '../assets/img/logo.png';
import LogoAVC from '../assets/img/AVC_Logo.png';

// ลงทะเบียน Font ภาษาไทย
Font.register({
  family: 'Sarabun',
  src: '/fonts/Sarabun-Regular.ttf'
});

const styles = StyleSheet.create({
  page: { 
    paddingHorizontal: 20, 
    paddingVertical: 15, 
    fontSize: 7, 
    fontFamily: 'Sarabun',
    flexDirection: 'column',
    justifyContent: 'between',
    height: '100%'
  },
  
  // Header Box
  headerBox: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    padding: 6,
    marginBottom: 8,
    alignItems: 'center',
    height: 62
  },
  headerLeft: {
    width: '12%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerCenter: {
    width: '68%',
    paddingLeft: 10,
    flexDirection: 'column',
    justifyContent: 'center'
  },
  headerRight: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoCup: {
    width: 90,
    height: 50,
    objectFit: 'contain'
  },
  logoAVC: {
    width: 90,
    height: 50,
    objectFit: 'contain'
  },
  title: {
    fontSize: 12,
    fontWeight: 'bold'
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  o2bisBox: {
    borderWidth: 1,
    borderColor: '#000',
    paddingHorizontal: 4,
    paddingVertical: 0.5,
    marginRight: 6,
    borderRadius: 2
  },
  o2bisText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  regText: {
    fontSize: 10,
    fontWeight: 'bold'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  countryText: {
    fontSize: 9,
    fontWeight: 'bold'
  },

  // Main table section
  table: {
    display: 'table',
    width: '100%',
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 8
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    height: 26
  },
  columnHeader: {
    fontWeight: 'bold',
    fontSize: 7,
    padding: 2,
    borderRightWidth: 1,
    borderRightColor: '#000',
    textAlign: 'center',
    justifyContent: 'center',
    alignItems: 'center'
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.8,
    borderBottomColor: '#000',
    height: 14,
    alignItems: 'center'
  },
  tableCell: {
    fontSize: 6.5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRightWidth: 0.8,
    borderRightColor: '#000',
    textAlign: 'center'
  },

  // Footer sections
  footerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2
  },
  staffTable: {
    width: '34%',
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column'
  },
  colorsTable: {
    width: '20%',
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column'
  },
  statsTable: {
    width: '24%',
    borderWidth: 1,
    borderColor: '#000',
    flexDirection: 'column'
  },
  footerSectionHeader: {
    backgroundColor: '#EAEAEA',
    paddingVertical: 2,
    textAlign: 'center',
    fontSize: 7,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: '#000'
  },
  footerTableRow: {
    flexDirection: 'row',
    height: 12,
    alignItems: 'center'
  },
  footerTableCell: {
    fontSize: 6.5,
    paddingHorizontal: 2,
    paddingVertical: 1,
    borderRightWidth: 0.8,
    borderRightColor: '#000',
    borderBottomWidth: 0.8,
    borderBottomColor: '#000',
    textAlign: 'center'
  },
  colorSubRow: {
    borderBottomWidth: 0.8,
    borderBottomColor: '#000',
    paddingVertical: 1,
    paddingHorizontal: 3,
    height: 12,
    justifyContent: 'center'
  },
  colorSubRowLast: {
    paddingVertical: 1,
    paddingHorizontal: 3,
    height: 12,
    justifyContent: 'center'
  },
  colorText: {
    fontSize: 6.5
  },

  organiserNoticeBox: {
    width: '34%',
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 6,
    flexDirection: 'row',
    height: 25
  },

  // Legend / bottom bar
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#000',
    marginTop: 10,
    paddingTop: 3,
    fontSize: 6,
    color: '#333'
  }
});

const O2FormDocument = ({ teamInfo, players = [], staff = [] }) => {
  const valueOrBlank = (value) => {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return text && text !== '-' && text !== '0' ? text : '';
  };

  const getFirstAvailable = (source, fields) => {
    for (const field of fields) {
      const value = valueOrBlank(source?.[field]);
      if (value) return value;
    }
    return '';
  };

  // Get Player Role (C for captain, L for Libero, C L for both)
  const getPlayerRole = (p) => {
    const roles = [];
    if (p.is_captain) roles.push('C');
    if (p.position === 'L' || p.is_libero1 || p.is_libero2) roles.push('L');
    return roles.join(' ');
  };

  // Normalise positions to match standard
  const getPlayerPosition = (pos) => {
    if (!pos) return '';
    const upper = pos.toUpperCase();
    if (upper === 'OPP') return 'OP';
    return upper;
  };

  // Format English Date: DD-MMM-YYYY
  const formatEnglishDate = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Get Staff Member by Role
  const getStaffMember = (role, index = 0) => {
    if (!staff || !Array.isArray(staff)) return null;
    
    const roleMapping = {
      'Team Manager': ['Team Manager', 'Manager', 'Team manager'],
      'Head Coach': ['Head Coach', 'Coach', 'Head coach'],
      'Assistant Coach': ['Assistant Coach', 'Assistant coach', 'Asst Coach', 'Assistant Coach 1'],
      'Assistant Coach 2': ['Assistant Coach 2', 'Assistant coach 2', 'Asst Coach 2'],
      'Physiotherapist': ['Physiotherapist', 'Therapist', 'Trainer', 'Therapist/Trainer', 'Physio'],
      'Statistician': ['Statistician', 'Stats']
    };

    const targetRoles = roleMapping[role] || [role];

    const list = staff.filter(member =>
      targetRoles.some(r => member.role?.toLowerCase().trim() === r.toLowerCase().trim())
    );

    // Fall back to second Assistant Coach if explicitly looking for Assistant Coach 2
    if (role === 'Assistant Coach 2' && list.length === 0) {
      const asstList = staff.filter(member =>
        roleMapping['Assistant Coach'].some(r => member.role?.toLowerCase().trim() === r.toLowerCase().trim())
      );
      return asstList[1] || null;
    }

    return list[index] || null;
  };

  // Staff name in Lastname Firstname format
  const getStaffName = (s) => {
    if (!s) return '';
    return [valueOrBlank(s.first_name), valueOrBlank(s.last_name)].filter(Boolean).join(' ');
  };

  // Staff country code
  const getStaffCountry = (s) => {
    if (!s) return '';
    return getFirstAvailable(s, ['country', 'nationality']);
  };

  // Current UTC DateTime
  const formatUTCDateTime = (date) => {
    const d = date || new Date();
    const day = String(d.getUTCDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const year = d.getUTCFullYear();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    const seconds = String(d.getUTCSeconds()).padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}:${seconds} UTC`;
  };

  const formatThailandDateTime = (date) => {
    const d = date || new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Bangkok',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(d);

    const getPart = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${getPart('day')}-${getPart('month')}-${getPart('year')} ${getPart('hour')}:${getPart('minute')}:${getPart('second')} THA`;
  };

  // Statistics calculation helpers
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
    if (!dataArr || dataArr.length === 0) return { min: '', avg: '', max: '' };
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

  // Helper row renderer for Staff Table
  const renderStaffRow = (label, roleName, index = 0) => {
    const s = getStaffMember(roleName, index);
    return (
      <View style={styles.footerTableRow}>
        <Text style={[styles.footerTableCell, { width: '28%', textAlign: 'left', fontWeight: 'bold' }]}>{label}</Text>
        <Text style={[styles.footerTableCell, { width: '62%', textAlign: 'left' }]}>{s ? getStaffName(s) : ''}</Text>
        <Text style={[styles.footerTableCell, { width: '10%', borderRightWidth: 0 }]}>{s ? getStaffCountry(s) : ''}</Text>
      </View>
    );
  };

  const teamCode = valueOrBlank(teamInfo?.code);
  const teamName = valueOrBlank(teamInfo?.name);
  const countryText = [teamCode, teamName].filter(Boolean).join(' - ');
  const mainColor = getFirstAvailable(teamInfo, ['main_color', 'home_color']);
  const secondColor = getFirstAvailable(teamInfo, ['second_color', 'away_color']);
  const thirdColor = getFirstAvailable(teamInfo, ['third_color']);
  const liberoMainColor = getFirstAvailable(teamInfo, ['libero_main_color']);
  const liberoSecondColor = getFirstAvailable(teamInfo, ['libero_second_color']);
  const liberoThirdColor = getFirstAvailable(teamInfo, ['libero_third_color']);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        
        {/* Header ส่วนบน แสดงชื่อรายการแข่งขันและโลโก้ */}
        <View style={styles.headerBox}>
          {/* Logo Cup (Left) */}
          <View style={styles.headerLeft}>
            <Image src={LogoCup} style={styles.logoCup} />
          </View>
          {/* Title (Center) */}
          <View style={styles.headerCenter}>
            <Text style={styles.title}>{valueOrBlank(teamInfo?.competition_name).toUpperCase()}</Text>
            <View style={styles.subtitleRow}>
              <View style={styles.o2bisBox}>
                <Text style={styles.o2bisText}>O-2bis</Text>
              </View>
              <Text style={styles.regText}>Team registration</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.countryText}>
                {countryText}
              </Text>
            </View>
          </View>
          {/* Logo AVC (Right) */}
          <View style={styles.headerRight}>
            <Image src={LogoAVC} style={styles.logoAVC} />
          </View>
        </View>

        {/* ตารางรายชื่อผู้เล่นหลัก */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.columnHeader, { width: '4%' }]}>Shirt</Text>
            <Text style={[styles.columnHeader, { width: '5%' }]}>Role</Text>
            <Text style={[styles.columnHeader, { width: '13%', textAlign: 'left' }]}>First name</Text>
            <Text style={[styles.columnHeader, { width: '13%', textAlign: 'left' }]}>Last name</Text>
            <Text style={[styles.columnHeader, { width: '13%', textAlign: 'left' }]}>Shirt name</Text>
            <Text style={[styles.columnHeader, { width: '4%' }]}>Pos.</Text>
            <Text style={[styles.columnHeader, { width: '9%' }]}>Birthdate</Text>
            <Text style={[styles.columnHeader, { width: '5%' }]}>Height{"\n"}[cm]</Text>
            
            {/* Highest Reach column group */}
            <View style={{ width: '9%', borderRightWidth: 1, borderRightColor: '#000', flexDirection: 'column' }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, fontWeight: 'bold' }}>Highest reach [cm]</Text>
              </View>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <View style={{ width: '50%', borderRightWidth: 1, borderRightColor: '#000', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 6, fontWeight: 'bold' }}>Spike</Text>
                </View>
                <View style={{ width: '50%', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 6, fontWeight: 'bold' }}>Block</Text>
                </View>
              </View>
            </View>

            <Text style={[styles.columnHeader, { width: '17%', textAlign: 'left' }]}>Club</Text>

            {/* National Selections column group */}
            <View style={{ width: '8%', flexDirection: 'column' }}>
              <View style={{ borderBottomWidth: 1, borderBottomColor: '#000', paddingVertical: 1, alignItems: 'center' }}>
                <Text style={{ fontSize: 6, fontWeight: 'bold' }}>National selections</Text>
              </View>
              <View style={{ flexDirection: 'row', flex: 1 }}>
                <View style={{ width: '25%', borderRightWidth: 1, borderRightColor: '#000', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontWeight: 'bold' }}>WC</Text>
                </View>
                <View style={{ width: '25%', borderRightWidth: 1, borderRightColor: '#000', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontWeight: 'bold' }}>OG</Text>
                </View>
                <View style={{ width: '25%', borderRightWidth: 1, borderRightColor: '#000', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontWeight: 'bold' }}>Oth.</Text>
                </View>
                <View style={{ width: '25%', paddingVertical: 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontWeight: 'bold' }}>Tot.</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Player Rows */}
          {players.map((p, i) => (
            <View style={styles.tableRow} key={i}>
              <Text style={[styles.tableCell, { width: '4%', fontWeight: 'bold' }]}>{valueOrBlank(p.number)}</Text>
              <Text style={[styles.tableCell, { width: '5%' }]}>{getPlayerRole(p)}</Text>
              <Text style={[styles.tableCell, { width: '13%', textAlign: 'left' }]}>{valueOrBlank(p.first_name)}</Text>
              <Text style={[styles.tableCell, { width: '13%', textAlign: 'left' }]}>{valueOrBlank(p.last_name)}</Text>
              <Text style={[styles.tableCell, { width: '13%', textAlign: 'left' }]}>{getFirstAvailable(p, ['shirt_name', 'nickname']).toUpperCase()}</Text>
              <Text style={[styles.tableCell, { width: '4%' }]}>{getPlayerPosition(p.position)}</Text>
              <Text style={[styles.tableCell, { width: '9%' }]}>{formatEnglishDate(p.birth_date)}</Text>
              <Text style={[styles.tableCell, { width: '5%' }]}>{getFirstAvailable(p, ['height_cm', 'height'])}</Text>
              <Text style={[styles.tableCell, { width: '4.5%' }]}>{getFirstAvailable(p, ['spike_reach'])}</Text>
              <Text style={[styles.tableCell, { width: '4.5%' }]}>{getFirstAvailable(p, ['block_reach'])}</Text>
              <Text style={[styles.tableCell, { width: '17%', textAlign: 'left', fontSize: 6 }]}>{getFirstAvailable(p, ['club', 'club_name'])}</Text>
              <Text style={[styles.tableCell, { width: '2%' }]}>{getFirstAvailable(p, ['national_wc'])}</Text>
              <Text style={[styles.tableCell, { width: '2%' }]}>{getFirstAvailable(p, ['national_og'])}</Text>
              <Text style={[styles.tableCell, { width: '2%' }]}>{getFirstAvailable(p, ['national_other'])}</Text>
              <Text style={[styles.tableCell, { width: '2%', borderRightWidth: 0 }]}>{getFirstAvailable(p, ['national_total'])}</Text>
            </View>
          ))}
        </View>

        {/* ส่วนท้าย: Official Staff, Colors, Statistics, e-Signatures */}
        <View style={styles.footerContainer}>
          {/* ส่วน OFFICIAL STAFF */}
          <View style={styles.staffTable}>
            <Text style={styles.footerSectionHeader}>OFFICIALS</Text>
            {renderStaffRow('Team Manager:', 'Team Manager')}
            {renderStaffRow('Head Coach:', 'Head Coach')}
            {renderStaffRow('Assistant Coach:', 'Assistant Coach', 0)}
            {renderStaffRow('2nd Assistant Coach:', 'Assistant Coach 2')}
            {renderStaffRow('Physiotherapist:', 'Physiotherapist')}
            {renderStaffRow('Statistician:', 'Statistician')}
          </View>

          {/* ส่วน UNIFORM COLORS */}
          <View style={styles.colorsTable}>
            <Text style={styles.footerSectionHeader}>UNIFORM COLORS</Text>
            <View style={{ flexDirection: 'row', flex: 1 }}>
              {/* Left Label "Team" */}
              <View style={{ width: '30%', borderRightWidth: 1, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 0.8, borderBottomColor: '#000' }}>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>Team</Text>
              </View>
              {/* Right sub-rows */}
              <View style={{ width: '70%', flexDirection: 'column' }}>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>Main: {mainColor}</Text></View>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>2nd: {secondColor}</Text></View>
                <View style={styles.colorSubRowLast}><Text style={styles.colorText}>3rd: {thirdColor}</Text></View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flex: 1, borderTopWidth: 0.8, borderTopColor: '#000' }}>
              {/* Left Label "Liberos" */}
              <View style={{ width: '30%', borderRightWidth: 1, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>Liberos</Text>
              </View>
              {/* Right sub-rows */}
              <View style={{ width: '70%', flexDirection: 'column' }}>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>Main: {liberoMainColor}</Text></View>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>2nd: {liberoSecondColor}</Text></View>
                <View style={styles.colorSubRowLast}><Text style={styles.colorText}>3rd: {liberoThirdColor}</Text></View>
              </View>
            </View>
          </View>

          {/* ส่วน STATISTICS */}
          <View style={styles.statsTable}>
            <Text style={styles.footerSectionHeader}>STATISTICS</Text>
            <View style={styles.footerTableRow}>
              <Text style={[styles.footerTableCell, { width: '28%', textAlign: 'left', backgroundColor: '#F8F8F8', fontWeight: 'bold' }]}>Data</Text>
              <Text style={[styles.footerTableCell, { width: '24%', fontWeight: 'bold' }]}>Minimum</Text>
              <Text style={[styles.footerTableCell, { width: '24%', fontWeight: 'bold' }]}>Average</Text>
              <Text style={[styles.footerTableCell, { width: '24%', borderRightWidth: 0, fontWeight: 'bold' }]}>Maximum</Text>
            </View>
            <StatRow label="Age" data={stats.age} />
            <StatRow label="Height" data={stats.height} />
            <StatRow label="Spike" data={stats.spike} />
            <StatRow label="2-hand block:" data={stats.block} />
            <StatRow label="National selections:" data={computeStats(players.map(p => getNumValue(p, 'national_total')).filter(v => v !== null))} last />
          </View>
        </View>

        {/* แถวล่างสุดของ Footer: organiser notice + e-signatures */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, alignItems: 'flex-start' }}>
          {/* Organiser notice */}
          <View style={styles.organiserNoticeBox}>
            <View style={{ width: '60%', padding: 4, borderRightWidth: 1, borderRightColor: '#000', backgroundColor: '#F0F0F0', justifyContent: 'center' }}>
              <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>THIS FORM MUST BE RECEIVED</Text>
              <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>BY THE ORGANISER NOT LATER THAN:</Text>
            </View>
            <View style={{ width: '40%', backgroundColor: '#E0E0E0' }} />
          </View>

          {/* e-signatures */}
          <View style={{ width: '60%', borderLeftWidth: 1, borderLeftColor: '#000', paddingLeft: 10, marginTop: 4 }}>
            <Text style={{ fontSize: 7, fontWeight: 'bold', marginBottom: 2 }}>e-SIGNATURES</Text>
            <View style={{ borderTopWidth: 1, borderTopColor: '#000', paddingTop: 3, flexDirection: 'row' }}>
              <View style={{ width: '38%' }}>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>NATIONAL FEDERATION /</Text>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>CLUB</Text>
              </View>
              <View style={{ width: '37%' }}>
                <Text style={{ fontSize: 6.5 }}>{getFirstAvailable(teamInfo, ['signed_by'])}</Text>
                <Text style={{ fontSize: 5.5, color: '#555', marginTop: 1 }}>{teamInfo?.signed_at ? formatUTCDateTime(new Date(teamInfo.signed_at)) : ''}</Text>
              </View>
              <View style={{ width: '25%' }}>
                <Text style={{ fontSize: 6.5 }}>{getFirstAvailable(teamInfo, ['signature_status'])}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* แถวแสดง VIS, copyright และ วันเวลาพิมพ์ */}
        <View style={styles.legendRow}>
          <Text>E-scorer Version DEMO 2026.06.11 PLG Volleyball Club</Text>
          <Text></Text>
          <Text>Printed: {formatThailandDateTime()}</Text>
        </View>

      </Page>
    </Document>
  );
};

// Helper Component สำหรับแถวสถิติ
const StatRow = ({ label, data, last = false }) => (
  <View style={styles.footerTableRow}>
    <Text style={[styles.footerTableCell, { width: '28%', textAlign: 'left', backgroundColor: '#F8F8F8', fontWeight: 'bold' }]}>{label}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderRightWidth: 0.8, borderRightColor: '#000', borderBottomWidth: last ? 0 : 0.8, borderBottomColor: '#000', textAlign: 'center' }}>{data.min}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderRightWidth: 0.8, borderRightColor: '#000', borderBottomWidth: last ? 0 : 0.8, borderBottomColor: '#000', textAlign: 'center' }}>{data.avg}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderBottomWidth: last ? 0 : 0.8, borderBottomColor: '#000', textAlign: 'center' }}>{data.max}</Text>
  </View>
);

export default O2FormDocument;
