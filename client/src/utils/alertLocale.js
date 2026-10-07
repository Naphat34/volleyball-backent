import Swal from 'sweetalert2';

const getCurrentLanguage = () => {
  try {
    return localStorage.getItem('language') === 'ENG' ? 'ENG' : 'THA';
  } catch {
    return 'THA';
  }
};

const phrases = [
  ['Success', 'สำเร็จ'],
  ['Error', 'ข้อผิดพลาด'],
  ['Warning', 'คำเตือน'],
  ['OK', 'ตกลง'],
  ['Cancel', 'ยกเลิก'],
  ['Confirm', 'ยืนยัน'],
  ['Updated!', 'อัปเดตเรียบร้อยแล้ว'],
  ['Created!', 'สร้างเรียบร้อยแล้ว'],
  ['Deleted!', 'ลบเรียบร้อยแล้ว'],
  ['Are you sure?', 'ยืนยันการดำเนินการ?'],
  ["You won't be able to revert this!", 'การดำเนินการนี้ไม่สามารถย้อนกลับได้'],
  ['Yes, delete it!', 'ใช่, ลบเลย'],
  ['Delete Match?', 'ลบแมตช์นี้?'],
  ['Deleted successfully', 'ลบเรียบร้อยแล้ว'],
  ['Delete failed', 'ลบไม่สำเร็จ'],
  ['Failed to save', 'บันทึกไม่สำเร็จ'],
  ['Failed to save match', 'บันทึกแมตช์ไม่สำเร็จ'],
  ['Failed to load matches', 'โหลดข้อมูลแมตช์ไม่สำเร็จ'],
  ['Failed to load teams', 'โหลดข้อมูลทีมไม่สำเร็จ'],
  ['Failed to load teams for this competition', 'โหลดทีมของรายการแข่งขันนี้ไม่สำเร็จ'],
  ['No teams to export', 'ไม่มีทีมสำหรับส่งออกข้อมูล'],
  ['Competition updated', 'อัปเดตรายการแข่งขันเรียบร้อยแล้ว'],
  ['Competition created', 'สร้างรายการแข่งขันเรียบร้อยแล้ว'],
  ['Competition Updated!', 'อัปเดตรายการแข่งขันเรียบร้อยแล้ว'],
  ['Competition Created!', 'สร้างรายการแข่งขันเรียบร้อยแล้ว'],
  ['Error saving competition', 'บันทึกรายการแข่งขันไม่สำเร็จ'],
  ['Error deleting', 'ลบข้อมูลไม่สำเร็จ'],
  ['Failed to update status', 'อัปเดตสถานะไม่สำเร็จ'],
  ['Please fill in Name, Gender, and Age Group', 'กรุณากรอกชื่อ เพศ และรุ่นแข่งขัน'],
  ['Image upload failed', 'อัปโหลดรูปภาพไม่สำเร็จ'],
  ['Status changed to open', 'เปลี่ยนสถานะเป็นเปิดรับสมัครแล้ว'],
  ['Status changed to closed', 'เปลี่ยนสถานะเป็นปิดรับสมัครแล้ว'],
  ['Removed from competition', 'นำทีมออกจากรายการแข่งขันแล้ว'],
  ['Failed to remove team', 'นำทีมออกจากรายการแข่งขันไม่สำเร็จ'],
  ['Team deleted successfully', 'ลบทีมเรียบร้อยแล้ว'],
  ['Remove from Competition?', 'นำทีมออกจากรายการแข่งขัน?'],
  ['This will only remove the team from this competition category.', 'การดำเนินการนี้จะนำทีมออกจากรุ่นแข่งขันนี้เท่านั้น'],
  ['Yes, remove them', 'ใช่, นำออก'],
  ['Reject User?', 'ปฏิเสธผู้ใช้นี้?'],
  ['Are you sure you want to reject this user?', 'คุณต้องการปฏิเสธผู้ใช้นี้ใช่หรือไม่?'],
  ['Yes, Reject', 'ใช่, ปฏิเสธ'],
  ['Action failed', 'ดำเนินการไม่สำเร็จ'],
  ['User approved', 'อนุมัติผู้ใช้แล้ว'],
  ['User rejected', 'ปฏิเสธผู้ใช้แล้ว'],
  ['Matches generated!', 'สร้างตารางแข่งขันเรียบร้อยแล้ว'],
  ['กรุณาเลือกรายการแข่งขันก่อน (Please select a competition)', 'Please select a competition first'],
  ['ทีมเหย้าและทีมเยือนต้องไม่ใช่ทีมเดียวกัน', 'Home and away teams must be different'],
  ['อัปเดตข้อมูลการแข่งขันเรียบร้อยแล้ว', 'Match updated successfully'],
  ['สร้างแมตช์การแข่งขันใหม่สำเร็จ', 'Match created successfully'],
  ['Save failed', 'บันทึกไม่สำเร็จ'],
  ['Failed to load match setup data', 'โหลดข้อมูลตั้งค่าแมตช์ไม่สำเร็จ'],
  ['Failed to save match setup details', 'บันทึกข้อมูลตั้งค่าแมตช์ไม่สำเร็จ'],
  ['Please select a competition first', 'กรุณาเลือกรายการแข่งขันก่อน'],
  ['Please select both teams', 'กรุณาเลือกทั้งสองทีม'],
  ['Please select an age group', 'กรุณาเลือกรุ่นแข่งขัน'],
  ['Please select a round', 'กรุณาเลือกรอบการแข่งขัน'],
  ['Teams must be different', 'ทีมแข่งขันต้องไม่ซ้ำกัน'],
  ['Please select teams registered in this competition category', 'กรุณาเลือกทีมที่ลงทะเบียนในรุ่นแข่งขันนี้'],
  ['Match updated', 'อัปเดตแมตช์เรียบร้อยแล้ว'],
  ['Match created', 'สร้างแมตช์เรียบร้อยแล้ว'],
  ['Score saved!', 'บันทึกคะแนนแล้ว'],
  ['Failed to save score', 'บันทึกคะแนนไม่สำเร็จ'],
  ['Failed to load team rosters', 'โหลดรายชื่อนักกีฬาของทีมไม่สำเร็จ'],
  ['Failed', 'ไม่สำเร็จ'],
  ['Failed to save user. Please try again.', 'บันทึกผู้ใช้ไม่สำเร็จ กรุณาลองอีกครั้ง'],
  ['Failed to save officials data. Please try again.', 'บันทึกข้อมูลเจ้าหน้าที่ไม่สำเร็จ กรุณาลองอีกครั้ง'],
  ['Team created successfully.', 'สร้างทีมเรียบร้อยแล้ว'],
  ['Failed to create team', 'สร้างทีมไม่สำเร็จ'],
  ['Failed to save data. Please check console.', 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบรายละเอียด'],
  ['Failed to delete.', 'ลบไม่สำเร็จ'],
  ['Cannot delete (It might be in use)', 'ไม่สามารถลบได้ อาจมีการใช้งานอยู่'],
  ['Stadium has been deleted.', 'ลบสนามเรียบร้อยแล้ว'],
  ['Missing data', 'ข้อมูลไม่ครบ'],
  ['Team name and code are required.', 'กรุณากรอกชื่อทีมและรหัสทีม'],
  ['Missing account', 'ข้อมูลบัญชีไม่ครบ'],
  ['Username and password are required.', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่าน'],
  ['Created', 'สร้างเรียบร้อยแล้ว'],
  ['Team and account were created successfully.', 'สร้างทีมและบัญชีเรียบร้อยแล้ว'],
  ['Could not create team.', 'สร้างทีมไม่สำเร็จ'],
  ['Updated', 'อัปเดตเรียบร้อยแล้ว'],
  ['Could not update registration status.', 'อัปเดตสถานะลงทะเบียนไม่สำเร็จ'],
  ['Could not load team data', 'โหลดข้อมูลทีมไม่สำเร็จ'],
  ['Cannot Undo', 'ย้อนกลับไม่ได้'],
  ['No previous action to undo.', 'ไม่มีรายการก่อนหน้าให้ย้อนกลับ'],
  ['Invalid Substitution', 'การเปลี่ยนตัวไม่ถูกต้อง'],
  ['Please select both players', 'กรุณาเลือกผู้เล่นทั้งสองคน'],
  ['Limit Reached', 'ครบจำนวนที่กำหนดแล้ว'],
  ['Maximum 6 substitutions per set allowed.', 'เปลี่ยนตัวได้สูงสุด 6 ครั้งต่อเซต'],
  ['Maximum 2 timeouts per set.', 'ขอเวลานอกได้สูงสุด 2 ครั้งต่อเซต'],
  ['Invalid Sanction', 'บทลงโทษไม่ถูกต้อง'],
  ['Please select a player', 'กรุณาเลือกผู้เล่น'],
  ['Please Select', 'กรุณาเลือก'],
  ['Choose which team serves first', 'เลือกทีมที่เสิร์ฟก่อน'],
  ['No substitutions selected.', 'ยังไม่ได้เลือกการเปลี่ยนตัว'],
  ['ไม่มีผู้เล่นในสนาม', 'No players on court'],
  ['กรุณาเลือกผู้เล่นตัวจริงให้ครบทั้ง 6 ตำแหน่ง', 'Please select all 6 starting players'],
  ['Timeout limit reached.', 'ครบจำนวนเวลานอกแล้ว'],
  ['ไม่สามารถเลือก Libero ลงเป็นผู้เล่น 6 คนแรกได้', 'Libero cannot be selected as one of the starting 6 players'],
  ['Protest Logged', 'บันทึกการประท้วงแล้ว'],
  ['เหตุการณ์ประท้วงถูกบันทึกแล้ว', 'The protest event has been logged'],
  ['Action Not Allowed', 'ไม่อนุญาตให้ดำเนินการ'],
  ['This Libero cannot be swapped out from here. This might be a formal replacement.', 'ไม่สามารถเปลี่ยน Libero ออกจากจุดนี้ได้ อาจเป็นการเปลี่ยนตัวแบบเป็นทางการ'],
  ['ไม่อนุญาตให้เข้าถึง', 'Access denied'],
  ['ทีมของคุณไม่มีส่วนเกี่ยวข้องกับการแข่งขันนี้', 'Your team is not assigned to this match'],
  ['การแข่งขันจบลงแล้ว', 'Match completed'],
  ['ไม่สามารถใช้งาน Staff Console สำหรับแมตช์ที่จบแล้วได้', 'Staff Console is unavailable for a completed match'],
  ['กรุณาจัดผู้เล่นให้ครบทั้ง 6 ตำแหน่ง', 'Please assign players to all 6 positions'],
  ['ไม่สามารถส่งรายชื่อที่มีผู้เล่นตำแหน่ง Libero อยู่ในสนามได้', 'Lineup cannot include a Libero on court'],
  ['ไม่สามารถส่งคำขอได้: ', 'Could not submit request: '],
  ['ไม่สามารถส่งคำขอชาเลนจ์ได้: ', 'Could not submit challenge request: '],
  ['ไม่สามารถส่งคำขอเปลี่ยนตัวได้: ', 'Could not submit substitution request: '],
  ['ไม่สามารถล้างข้อมูล Lineup ได้: ', 'Could not clear lineup: '],
  ['บันทึก Lineup ลงฐานข้อมูลไม่สำเร็จ (แต่ยังเล่นต่อได้)', 'Failed to save lineup to database, but play can continue'],
  ['ทีมนี้ใช้เวลานอกครบตามกำหนดแล้ว (Limit reached)', 'This team has reached the timeout limit'],
  ['ไม่สามารถอนุมัติคำขอได้', 'Could not approve the request']
];

const reversePhrases = phrases.map(([eng, tha]) => [tha, eng]);

const replaceDynamicPhrases = (value, language) => {
  if (language === 'THA') {
    return value
      .replace(/^Status changed to (open|closed)$/i, (_, status) => `เปลี่ยนสถานะเป็น${status.toLowerCase() === 'open' ? 'เปิดรับสมัคร' : 'ปิดรับสมัคร'}แล้ว`)
      .replace(/^No competition found for gender: (.+)$/i, (_, gender) => `ไม่พบรายการแข่งขันสำหรับเพศ: ${gender}`)
      .replace(/^Registration is now (.+)\.$/i, (_, status) => `สถานะลงทะเบียนเป็น ${status} แล้ว`)
      .replace(/^User (approved|rejected)$/i, (_, status) => status === 'approved' ? 'อนุมัติผู้ใช้แล้ว' : 'ปฏิเสธผู้ใช้แล้ว');
  }

  return value
    .replace(/^ไม่พบรายการแข่งขันสำหรับเพศ: (.+)$/i, (_, gender) => `No competition found for gender: ${gender}`)
    .replace(/^สถานะลงทะเบียนเป็น (.+) แล้ว$/i, (_, status) => `Registration is now ${status}.`);
};

export const localizeAlertText = (value, language = getCurrentLanguage()) => {
  if (typeof value !== 'string') return value;

  let translated = replaceDynamicPhrases(value, language);
  const dictionary = language === 'THA' ? phrases : reversePhrases;

  for (const [from, to] of dictionary) {
    if (translated === from) return to;
    if (translated.includes(from)) translated = translated.replaceAll(from, to);
  }

  return translated;
};

const localizeAlertOptions = (options) => {
  if (!options || typeof options !== 'object') return options;

  const next = { ...options };
  [
    'title',
    'titleText',
    'text',
    'html',
    'footer',
    'confirmButtonText',
    'cancelButtonText',
    'denyButtonText',
    'inputLabel',
    'inputPlaceholder'
  ].forEach((key) => {
    if (typeof next[key] === 'string') {
      next[key] = localizeAlertText(next[key]);
    }
  });

  const language = getCurrentLanguage();
  if (language === 'THA' && next.showConfirmButton !== false && !next.confirmButtonText) {
    next.confirmButtonText = 'ตกลง';
  }
  if (language === 'THA' && next.showCancelButton && !next.cancelButtonText) {
    next.cancelButtonText = 'ยกเลิก';
  }

  return next;
};

const localizeFireArgs = (args) => {
  if (args.length === 1 && args[0] && typeof args[0] === 'object') {
    return [localizeAlertOptions(args[0])];
  }
  return args.map((arg) => localizeAlertText(arg));
};

const patchFire = (target) => {
  if (!target || target.__volleyAlertLocalePatched) return target;

  const originalFire = target.fire.bind(target);
  target.fire = (...args) => originalFire(...localizeFireArgs(args));
  Object.defineProperty(target, '__volleyAlertLocalePatched', { value: true });
  return target;
};

export const installAlertLocalization = () => {
  patchFire(Swal);

  if (!Swal.__volleyAlertMixinPatched) {
    const originalMixin = Swal.mixin.bind(Swal);
    Swal.mixin = (...args) => patchFire(originalMixin(...args));
    Object.defineProperty(Swal, '__volleyAlertMixinPatched', { value: true });
  }

  if (typeof window !== 'undefined' && !window.__volleyAlertLocalePatched) {
    const originalAlert = window.alert.bind(window);
    window.alert = (message) => originalAlert(localizeAlertText(message));
    Object.defineProperty(window, '__volleyAlertLocalePatched', { value: true });
  }
};

installAlertLocalization();
