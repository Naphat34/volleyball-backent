export const visStatuses = {
    idle: ['ยังไม่บันทึก', 'Not recorded'], ready: ['จัดไลน์อัปแล้ว', 'Lineup ready'],
    recording: ['กำลังบันทึก', 'Recording'], review: ['รอตรวจสอบสถิติ', 'Review statistics'],
    confirmed: ['ยืนยันสถิติแล้ว', 'Confirmed'], cancelled: ['ยกเลิก', 'Cancelled'],
};
export const visStatusLabel = (match, th = true) => visStatuses[match.vis_summary?.status]?.[th ? 0 : 1] || (th ? 'ยังไม่มีข้อมูล' : 'No data');
