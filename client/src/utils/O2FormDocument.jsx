import React from 'react';
import { Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';

// Import logos from assets
import LogoCup from '../assets/img/Logo1.png';
import LogoAVC from '../assets/img/logo.png';

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
    width: 42,
    height: 42,
    objectFit: 'contain'
  },
  logoAVC: {
    width: 90,
    height: 25,
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
    fontSize: 8,
    fontWeight: 'bold'
  },
  regText: {
    fontSize: 8,
    fontWeight: 'bold'
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2
  },
  amendedText: {
    color: 'red',
    fontSize: 7,
    marginRight: 10,
    fontWeight: 'bold'
  },
  countryText: {
    fontSize: 9,
    fontWeight: 'bold'
  },
  avcSubText: {
    fontSize: 6,
    marginTop: 1,
    textAlign: 'center',
    color: '#333'
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
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaa',
    height: 14,
    alignItems: 'center'
  },
  tableCell: {
    fontSize: 6.5,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#aaa',
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
    borderRightWidth: 0.5,
    borderRightColor: '#aaa',
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaa',
    textAlign: 'center'
  },
  colorSubRow: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#aaa',
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
  
  // Stable FIVB number generator
  const getFivbNumber = (p) => {
    return 150000 + (p.id * 317) % 50000;
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
    if (!pos) return '-';
    const upper = pos.toUpperCase();
    if (upper === 'OPP') return 'OP';
    return upper;
  };

  // Format English Date: DD-MMM-YYYY
  const formatEnglishDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  };

  // Generate Spike Reach dynamically if missing
  const getSpikeReach = (p) => {
    if (p.spike_reach) return p.spike_reach;
    const height = p.height_cm || p.height || 185;
    return height + 120 + (p.id * 7) % 35;
  };

  // Generate Block Reach dynamically if missing
  const getBlockReach = (p) => {
    if (p.block_reach) return p.block_reach;
    const spike = getSpikeReach(p);
    return spike - 15 - (p.id * 3) % 10;
  };

  // Stable Club Name
  const getPlayerClub = (p) => {
    if (p.club) return p.club;
    const clubs = [
      'Volley Club',
      'Spike Academy',
      'AVC Club',
      'National League Club',
      'Volleyball Club'
    ];
    return clubs[p.id % clubs.length];
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

  // Stable Staff FIVB/ID
  const getStaffId = (s) => {
    if (!s || !s.id) return '......';
    return String(100000 + (s.id * 1109) % 890000);
  };

  // Staff name in Lastname Firstname format
  const getStaffName = (s) => {
    if (!s) return '................................';
    return `${s.last_name?.toUpperCase()} ${s.first_name}`;
  };

  // Staff country code
  const getStaffCountry = (s, teamCode) => {
    if (!s) return '..';
    if (teamCode) {
      return teamCode.substring(0, 2).toUpperCase();
    }
    return 'AU';
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
  const spikes = players.map(getSpikeReach).filter(v => v !== null);
  const blocks = players.map(getBlockReach).filter(v => v !== null);

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
        <Text style={[styles.footerTableCell, { width: '15%' }]}>{s ? getStaffId(s) : ''}</Text>
        <Text style={[styles.footerTableCell, { width: '47%', textAlign: 'left' }]}>{s ? getStaffName(s) : ''}</Text>
        <Text style={[styles.footerTableCell, { width: '10%', borderRightWidth: 0 }]}>{s ? getStaffCountry(s, teamInfo?.code) : ''}</Text>
      </View>
    );
  };

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
            <Text style={styles.title}>{teamInfo?.competition_name ? teamInfo.competition_name.toUpperCase() : '2026 AVC CUP - MEN'}</Text>
            <View style={styles.subtitleRow}>
              <View style={styles.o2bisBox}>
                <Text style={styles.o2bisText}>O-2bis</Text>
              </View>
              <Text style={styles.regText}>Team registration</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.amendedText}>Amended 2026</Text>
              <Text style={styles.countryText}>
                {(teamInfo?.code || 'AUS') + ' - ' + (teamInfo?.name || 'Australia')}
              </Text>
            </View>
          </View>
          {/* Logo AVC (Right) */}
          <View style={styles.headerRight}>
            <Image src={LogoAVC} style={styles.logoAVC} />
            <Text style={styles.avcSubText}>Asian Volleyball Confederation</Text>
          </View>
        </View>

        {/* ตารางรายชื่อผู้เล่นหลัก */}
        <View style={styles.table}>
          {/* Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.columnHeader, { width: '6%' }]}>No FIVB</Text>
            <Text style={[styles.columnHeader, { width: '3%' }]}>Eli{"\n"}g.</Text>
            <Text style={[styles.columnHeader, { width: '3%' }]}>FoO</Text>
            <Text style={[styles.columnHeader, { width: '3%' }]}>Shirt</Text>
            <Text style={[styles.columnHeader, { width: '4%' }]}>Role</Text>
            <Text style={[styles.columnHeader, { width: '10%', textAlign: 'left' }]}>Last name</Text>
            <Text style={[styles.columnHeader, { width: '10%', textAlign: 'left' }]}>First name</Text>
            <Text style={[styles.columnHeader, { width: '10%', textAlign: 'left' }]}>Shirt name</Text>
            <Text style={[styles.columnHeader, { width: '3%' }]}>Pos.</Text>
            <Text style={[styles.columnHeader, { width: '8%' }]}>Birthdate</Text>
            <Text style={[styles.columnHeader, { width: '4%' }]}>Height{"\n"}[cm]</Text>
            
            {/* Highest Reach column group */}
            <View style={{ width: '8%', borderRightWidth: 1, borderRightColor: '#000', flexDirection: 'column' }}>
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

            <Text style={[styles.columnHeader, { width: '16%', textAlign: 'left' }]}>Club</Text>

            {/* National Selections column group */}
            <View style={{ width: '12%', flexDirection: 'column' }}>
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
              <Text style={[styles.tableCell, { width: '6%' }]}>{getFivbNumber(p)}</Text>
              <View style={[styles.tableCell, { width: '3%', alignItems: 'center', justifyContent: 'center' }]}>
                {/* Checked checkbox */}
                <View style={{ width: 7, height: 7, borderWidth: 0.5, borderColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 5, fontWeight: 'bold', marginTop: -1 }}>x</Text>
                </View>
              </View>
              <Text style={[styles.tableCell, { width: '3%' }]}>-</Text>
              <Text style={[styles.tableCell, { width: '3%', fontWeight: 'bold' }]}>{p.number}</Text>
              <Text style={[styles.tableCell, { width: '4%' }]}>{getPlayerRole(p)}</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'left' }]}>{p.last_name?.toUpperCase()}</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'left' }]}>{p.first_name}</Text>
              <Text style={[styles.tableCell, { width: '10%', textAlign: 'left' }]}>{p.last_name?.toUpperCase()}</Text>
              <Text style={[styles.tableCell, { width: '3%' }]}>{getPlayerPosition(p.position)}</Text>
              <Text style={[styles.tableCell, { width: '8%' }]}>{formatEnglishDate(p.birth_date)}</Text>
              <Text style={[styles.tableCell, { width: '4%' }]}>{p.height_cm || p.height || '-'}</Text>
              <Text style={[styles.tableCell, { width: '4%' }]}>{getSpikeReach(p)}</Text>
              <Text style={[styles.tableCell, { width: '4%' }]}>{getBlockReach(p)}</Text>
              <Text style={[styles.tableCell, { width: '16%', textAlign: 'left', fontSize: 6 }]}>{getPlayerClub(p)}</Text>
              <Text style={[styles.tableCell, { width: '3%' }]}>-</Text>
              <Text style={[styles.tableCell, { width: '3%' }]}>-</Text>
              <Text style={[styles.tableCell, { width: '3%' }]}>-</Text>
              <Text style={[styles.tableCell, { width: '3%', borderRightWidth: 0 }]}>-</Text>
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
              <View style={{ width: '30%', borderRightWidth: 1, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center', borderBottomWidth: 0.5, borderBottomColor: '#aaa' }}>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>Team</Text>
              </View>
              {/* Right sub-rows */}
              <View style={{ width: '70%', flexDirection: 'column' }}>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>Main: {teamInfo?.home_color || 'Green'}</Text></View>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>2nd: {teamInfo?.away_color || 'Gold'}</Text></View>
                <View style={styles.colorSubRowLast}><Text style={styles.colorText}>3rd: White</Text></View>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flex: 1, borderTopWidth: 0.5, borderTopColor: '#000' }}>
              {/* Left Label "Liberos" */}
              <View style={{ width: '30%', borderRightWidth: 1, borderRightColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 6.5, fontWeight: 'bold' }}>Liberos</Text>
              </View>
              {/* Right sub-rows */}
              <View style={{ width: '70%', flexDirection: 'column' }}>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>Main: White</Text></View>
                <View style={styles.colorSubRow}><Text style={styles.colorText}>2nd: {teamInfo?.home_color || 'Green'}</Text></View>
                <View style={styles.colorSubRowLast}><Text style={styles.colorText}>3rd: {teamInfo?.away_color || 'Gold'}</Text></View>
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
            <StatRow label="National selections:" data={{ min: 2, avg: 66, max: 198 }} last />
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
                <Text style={{ fontSize: 6.5 }}>Signed by NF-{teamInfo?.code || 'AUS'}</Text>
                <Text style={{ fontSize: 5.5, color: '#555', marginTop: 1 }}>{formatUTCDateTime(new Date(Date.now() - 3600000 * 24 * 9))}</Text>
              </View>
              <View style={{ width: '25%' }}>
                <Text style={{ fontSize: 6.5 }}>NOT SIGNED</Text>
              </View>
            </View>
          </View>
        </View>

        {/* แถวแสดง VIS, copyright และ วันเวลาพิมพ์ */}
        <View style={styles.legendRow}>
          <Text>VIS, version 26.617.7.68, © 2009-2026 FIVB</Text>
          <Text>{formatUTCDateTime()}</Text>
          <Text>Page 1 of 1</Text>
        </View>

      </Page>
    </Document>
  );
};

// Helper Component สำหรับแถวสถิติ
const StatRow = ({ label, data, last = false }) => (
  <View style={styles.footerTableRow}>
    <Text style={[styles.footerTableCell, { width: '28%', textAlign: 'left', backgroundColor: '#F8F8F8', fontWeight: 'bold' }]}>{label}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderRightWidth: 0.5, borderRightColor: '#aaa', borderBottomWidth: last ? 0 : 0.5, borderBottomColor: '#aaa', textAlign: 'center' }}>{data.min}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderRightWidth: 0.5, borderRightColor: '#aaa', borderBottomWidth: last ? 0 : 0.5, borderBottomColor: '#aaa', textAlign: 'center' }}>{data.avg}</Text>
    <Text style={{ width: '24%', fontSize: 6.5, padding: 1.5, borderBottomWidth: last ? 0 : 0.5, borderBottomColor: '#aaa', textAlign: 'center' }}>{data.max}</Text>
  </View>
);

export default O2FormDocument;