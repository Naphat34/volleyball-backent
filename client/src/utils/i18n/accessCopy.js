// Access, review and workspace copy. Data entered by users is never translated.
import { normalizeLanguage } from './language.js';
import { translateUi } from './uiTranslations.js';
export const accessCopy = `
จบการแข่งขันก่อนส่งตรวจสถิติ|Complete the match before submitting statistics
ยกเลิกการแก้ไข|Cancel
ค้นหาบัญชีและจัดการสิทธิ์ทีละบัญชีจากแผงด้านขวา|Find accounts and manage their access in the side panel.
ค้นหาบัญชี|Search accounts
ค้นหาชื่อบัญชี ชื่อผู้ใช้ หรือบทบาท|Search by username, name or role
ทุกบทบาท|All roles
ล้างตัวกรอง|Clear filters
รายการแข่งขันด้านบนใช้กรองบัญชีที่แสดง การมอบสิทธิ์ทำในปุ่มจัดการ|The competition filter above controls which accounts appear. Use Manage to change access.
เข้าถึงทุกรายการ|All competitions
+{0} รายการ|+{0} more
ยังไม่มอบสิทธิ์รายการ|No competitions assigned
จัดการบัญชี {0}|Manage account {0}
จัดการ|Manage
ไม่พบบัญชีตามตัวกรองที่เลือก|No accounts match the selected filters.
แสดง {0}–{1} จาก {2} บัญชี|Showing {0}–{1} of {2} accounts
ต่อหน้า|Per page
หน้าก่อนหน้า|Previous page
หน้าถัดไป|Next page
จัดการบัญชี|Manage account
สร้างบัญชีใหม่|Create a new account
ข้อมูลบัญชี|Account details
สิทธิ์การแข่งขัน|Competition access
บัญชีผู้ดูแลระบบกลางเข้าถึงทุกรายการโดยอัตโนมัติ|System administrators automatically have access to all competitions.
ค้นหารายการแข่งขัน|Search competitions
เลือกแล้ว {0} รายการ|{0} competitions selected
ไม่พบรายการแข่งขัน|No competitions found.
สถานะใหม่|New status
การปิดใช้งานหรือระงับบัญชีจะทำให้บัญชีเข้าใช้งานไม่ได้|Deactivating or suspending an account prevents it from signing in.
บันทึกสถานะบัญชี|Save account status
สถานะบัญชีและสิทธิ์รายการบันทึกแยกกัน|Account status and competition access are saved separately.
เฉพาะผู้ดูแลระบบกลางเท่านั้นที่เปลี่ยนสถานะบัญชีได้|Only a system administrator can change account status.
มีการเปลี่ยนแปลงที่ยังไม่บันทึก|You have unsaved changes.
กำลังบันทึก…|Saving…
ทิ้งการเปลี่ยนแปลงที่ยังไม่บันทึกหรือไม่?|Discard unsaved changes?
ยืนยันเปลี่ยนสถานะบัญชี {0} เป็น {1}?|Change account {0} to {1}?
บันทึกแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณากดโหลดข้อมูล|Saved, but the list could not be refreshed. Please refresh the data.
รหัสรายการแข่งขันต้องเป็นรายการจำนวนเต็มบวก|Competition IDs must be a list of positive integers
ประเภทแมตช์ไม่ถูกต้อง|Invalid match kind
คำสั่งตรวจรับไม่ถูกต้อง|Invalid review action
ไม่สามารถตรวจรับงานของตนเองได้|Cannot review your own work
ยืนยันฉบับนี้ก่อน|Confirm this revision first
การตรวจรับ VIMS ไม่สามารถเผยแพร่คะแนนส่วนตัวได้|VIMS review cannot publish private score data
ไม่สามารถเปลี่ยนสถานะตรวจรับตามคำสั่งนี้ได้|Invalid review transition
ข้อมูลบันทึกเปลี่ยนแปลง กรุณาส่งฉบับนี้กลับแก้ไข|Recorded data changed; return this revision for correction
ส่งตรวจคะแนน|Submit scores for review
ส่งตรวจสถิติ|Submit statistics for review
พื้นที่ทำงาน|Workspace
ผู้ดูแลส่วนคะแนน|Scorer Admin
ผู้ดูแลส่วนสถิติ|VIMS Admin
ผู้ดูแลระบบกลาง|Super Admin
ไม่มีสิทธิ์ดำเนินการ|Access denied
สิทธิ์บัญชีเปลี่ยนแปลง กรุณาเข้าสู่ระบบใหม่|Account permissions changed
ไม่สามารถสร้างบทบาทนี้ได้|Cannot create this role
ต้องระบุชื่อบัญชีและรหัสผ่านอย่างน้อย 8 ตัว|Username and a password of at least 8 characters are required
เลือกรายการที่ดูแลอย่างน้อย 1 รายการ|Select at least one managed competition
ต้องระบุชื่อจริงและนามสกุลของเจ้าหน้าที่|First and last name are required for officials
เฉพาะผู้ดูแลระบบกลางเท่านั้นที่เปลี่ยนบทบาท สถานะ หรือรหัสผ่านได้|Only super_admin can change account role, status or password
บทบาทไม่ถูกต้อง|Invalid role
สถานะไม่ถูกต้อง|Invalid status
รหัสผ่านต้องมีอย่างน้อย 8 ตัว|Password must contain at least 8 characters
ไม่พบบัญชีผู้ใช้|User not found
ไม่สามารถปิดบัญชีผู้ดูแลระบบกลางที่ใช้งานอยู่คนสุดท้ายได้|Cannot disable the last active super_admin
ไม่มีการเปลี่ยนแปลงบัญชี|No account changes supplied
ไม่สามารถจัดการบัญชีนี้ได้|Cannot manage this account
เฉพาะเจ้าของแมตช์ส่วนตัวเท่านั้นที่ผูกรายการได้|Only the private match owner can link this match
ไม่สามารถเปลี่ยนรายการหลังส่งตรวจครั้งแรกได้|Competition link is fixed after the first review submission
เลือกสถานะการเผยแพร่|Select a publication status
กรุณาระบุเหตุผล|A reason is required
ไม่พบแมตช์|Match not found
ผลปรับแพ้จัดการและยืนยันจาก workflow เท่านั้น|Manage and confirm forfeits through the competition workflow only.
เฉพาะเจ้าของหรือผู้บันทึกสถิติที่ได้รับมอบหมายเท่านั้นที่ส่งตรวจแมตช์ส่วนตัวนี้ได้|Only the owner or assigned statistics writer can submit this private match
ฉบับนี้ส่งตรวจหรือยืนยันแล้ว|This revision is already submitted or confirmed
จบการแข่งขันก่อนส่งตรวจคะแนน|Complete the match before submitting scores
จบแมตช์สถิติก่อนส่งตรวจ|Complete the statistics match before submission
ไม่มีสถิติให้ส่งตรวจ|No statistics to submit
คืนสิทธิ์บันทึกสถิติออฟไลน์ก่อน|Release the offline statistics lease first
ซิงก์ข้อมูลและคืนสิทธิ์ออฟไลน์ก่อน|Sync and release the offline lease first
ฉบับตรวจรับเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่|Review revision changed; reload first
ผู้ดูแลระบบ|System administrator
ผู้ดูแล Scorer|Scorer administrator
ผู้ดูแล VIMS|VIMS administrator
ผู้จัดการแข่งขัน|Organizer
ผู้บันทึกคะแนน|Scorer
ผู้บันทึก VIMS|VIMS operator
เจ้าหน้าที่ทีม|Team staff
ผู้ตัดสิน|Referee
ภาพรวมส่วนงาน|Workspace overview
แมตช์ในขอบเขต|Matches in scope
คิวตรวจรับ|Review queue
ประวัติการตรวจรับ|Review history
ผู้ใช้และสิทธิ์รายการ|Users and competition access
เมนู|Menu
ภาพรวม|Overview
จัดการแข่งขัน|Competition management
จัดการข้อมูลและการแข่งขัน|Manage data and competitions
หน้าสาธารณะ|Public site
จัดการส่วนงาน|Workspace management
ระบบกลาง|System administration
รายการที่ได้รับสิทธิ์|Assigned competitions
รายการแข่งขัน|Competitions
ทุกรายการที่ได้รับสิทธิ์|All assigned competitions
รอตรวจรับ|Awaiting review
ยืนยันแล้ว|Confirmed
ส่งกลับแก้ไข|Returned for correction
เปิดแก้ไข|Reopened
ยังไม่เริ่ม|Not started
กำลังแข่งขัน|Live
จบแล้ว|Completed
ยกเลิก|Cancelled
ศูนย์งานและสิทธิ์|Access and review center
· หนึ่งบัญชีหนึ่งบทบาท|· One role per account
จัดการระบบ|Manage system
หน้าบันทึก|Recording console
ออกจากระบบ|Sign out
โหลดข้อมูลแล้ว|Data refreshed.
โหลดข้อมูล|Refresh data
รวมชายและหญิงของรายการเดียวกัน|Includes men's and women's categories of the same competition
รายการแข่งขันที่ได้รับสิทธิ์|Assigned competitions
แมตช์ที่รอดำเนินการแข่งขัน|Matches awaiting play
จบการแข่งขัน|Finished fixtures
แมตช์ที่แข่งขันเสร็จแล้ว|Completed matches
ติดตามและจัดการแข่งขัน|Monitor and manage competitions
ดูแมตช์ในขอบเขต|View matches in scope
ติดตามตารางและผลการแข่งขัน หรือเปิดพื้นที่จัดการรายการ ทีม และตารางแข่งขันที่คุณได้รับสิทธิ์|Monitor fixtures and results, or manage competitions, teams and fixtures within your assigned scope.
จัดการข้อมูลและการแข่งขัน →|Manage data and competitions →
แมตช์ในขอบเขตของคุณ|Your matches in scope
ติดตามแมตช์และผลการแข่งขันในรายการที่ได้รับสิทธิ์ จัดการตารางได้จากเมนูจัดการข้อมูลและการแข่งขัน|Monitor matches and results in your assigned competitions. Use Manage data and competitions to edit fixtures.
ผู้ดูแลตรวจรับงาน ส่วนผู้บันทึกส่งตรวจหลังบันทึกครบ แมตช์สร้างเองต้องผูกรายการก่อนส่ง|Administrators review completed work. Recorders submit it when recording is complete. Link custom matches to a competition before submitting.
ค้นหาแมตช์|Search matches
ชื่อทีม รายการ หรือหมายเลขแมตช์|Team, competition or match number
ไม่พบแมตช์ในขอบเขตและตัวกรองนี้|No matches within this scope and filter.
กำลังโหลดแมตช์…|Loading matches…
แมตช์|Match
รายการ|Competition
สถานะ|Status
การดำเนินการ|Actions
แมตช์ {0}|Match {0}
ยังไม่ผูกรายการ|No competition linked
ยังไม่มีลิงก์สาธารณะ|Public link unavailable
ดูรายละเอียด|View details
VIMS · สรุปแมตช์|VIMS · Match summary
ผูกรายการแล้ว|Competition linked.
ผูกรายการ|Link competition
ส่งตรวจแล้ว|Submitted for review.
ส่งตรวจ|Submit for review
คะแนน|Scores
สถิติ|Statistics
เปิดประวัติสำหรับแก้ไขแล้ว|Event history opened for correction.
แก้เหตุการณ์ย้อนหลัง|Correct past events
ประวัติทุกฉบับ|All review revisions
คิวตรวจรับฉบับล่าสุด|Latest revision review queue
สถานะงาน|Review status
สถานะงานตรวจรับ|Review status filter
ทุกสถานะ|All statuses
ไม่พบงานในขอบเขตและสถานะที่เลือก|No work within the selected scope and status.
กำลังโหลดคิวงาน…|Loading review queue…
เหตุผลสำหรับส่งกลับหรือเปิดแก้|Reason for returning or reopening
แมตช์ / ส่วนงาน|Match / Domain
ฉบับ|Revision
ผู้ส่ง|Submitted by
เหตุผล / การดำเนินการ|Reason / Actions
เปิดข้อมูลสำหรับตรวจแล้ว|Review details opened.
ตรวจข้อมูล|Inspect data
แก้เหตุการณ์|Correct events
ดำเนินการแล้ว|Action completed.
ยืนยัน|Confirm
ส่งกลับ|Return
เปิดแก้|Reopen
เผยแพร่|Publish
หยุดเผยแพร่|Unpublish
ตรวจข้อมูลแมตช์|Review match
ปิดรายละเอียด|Close details
เซต|Set
นักกีฬา|Player
ทักษะ|Skill
ผล|Result
รหัส|Code
· แมตช์|· Match
· ฉบับ|· Revision
สถานะการแข่งขันคงเป็นจบแล้ว ระบบคำนวณใหม่จากเหตุการณ์ทั้งหมด หากผลไม่ครบหรือขัดกับไลน์อัปจะไม่บันทึก หลังแก้ไขต้องส่งตรวจฉบับใหม่|The match remains completed. Results are recalculated from all events. Incomplete results or lineup conflicts prevent saving. Submit a new revision after correcting events.
เหตุผลการแก้ไข|Correction reason
เหตุการณ์ / เซต|Event / Set
คะแนนเดิม|Original score
ทีม|Team
ทีมเหตุการณ์ {0}|Team for event {0}
เจ้าบ้าน|Home
ทีมเยือน|Away
นักกีฬาเหตุการณ์ {0}|Player for event {0}
ผลของทีม|Team result
ทักษะเหตุการณ์ {0}|Skill for event {0}
ผลเหตุการณ์ {0}|Result for event {0}
ไม่มี|None
คำนวณและบันทึกแล้ว กรุณาส่งตรวจฉบับใหม่|Recalculated and saved. Submit a new revision for review.
คำนวณใหม่และบันทึก|Recalculate and save
ปิดการแก้ไข|Close correction
บัญชีและสิทธิ์รายการ|Accounts and competition access
ผู้ดูแลส่วนงานเปลี่ยนสิทธิ์ได้เฉพาะรายการของตน การระงับทั้งบัญชีและเปลี่ยนบทบาทใช้ super_admin|Workspace administrators can change access only for their assigned competitions. Account suspension and role changes require a system administrator.
เลือกชื่อรายการครั้งเดียว ครอบคลุมทั้งประเภทชายและหญิงของรายการเดียวกัน|Select a competition once to include both its men's and women's categories.
บัญชีผู้ใช้ บทบาท สถานะ และสิทธิ์รายการแข่งขัน|User accounts, roles, status and competition access
บัญชีผู้ใช้|User account
บทบาท|Role
สถานะบัญชี|Account status
การจัดการ|Management
สถานะ {0}|Status for {0}
เปลี่ยนสถานะแล้ว|Status updated.
รออนุมัติ|Pending approval
ใช้งาน|Active
ไม่ใช้งาน|Inactive
ระงับบัญชี|Suspended
ไม่อนุมัติ|Rejected
บันทึกสิทธิ์ {0}|Save access for {0}
บันทึกสิทธิ์แล้ว|Access saved.
บันทึกสิทธิ์|Save access
ยังไม่มีบัญชีผู้ใช้ในขอบเขตของคุณ|No user accounts in your scope.
กำลังโหลดบัญชีผู้ใช้…|Loading user accounts…
สร้างบัญชีแล้ว|Account created.
เพิ่มบัญชี|Add account
ชื่อบัญชี|Username
รหัสผ่านอย่างน้อย 8 ตัว|Password (at least 8 characters)
ชื่อจริง|First name
นามสกุล|Last name
บทบาทเดียวของบัญชี|Account role
เลือกบทบาท|Select role
สร้างบัญชี|Create account
เลือกอย่างน้อย 1 รายการที่คุณดูแลก่อนสร้างบัญชีผู้บันทึก|Select at least one competition you manage before creating a recorder account.
งานรอตรวจรับ|Awaiting review
นับเฉพาะฉบับล่าสุด|Latest revisions only
ผลตรวจรับฉบับล่าสุด|Latest review results
บัญชีในขอบเขต|Accounts in scope
ผู้บันทึกในขอบเขต|Recorders in scope
บัญชีที่มองเห็นในพื้นที่นี้|Accounts visible in this workspace
คิวงานที่ต้องติดตาม|Work to follow up
ดูคิวทั้งหมด →|View full queue →
กำลังโหลดงานในขอบเขตของคุณ…|Loading work in your scope…
ยังไม่มีงานรอตรวจรับในขอบเขตนี้|No work awaiting review in this scope.
งานจะปรากฏเมื่อผู้บันทึกส่งตรวจฉบับใหม่|Work appears when a recorder submits a new revision.
ขั้นตอนการทำงาน|Workflow
ดูแลระบบกลางและมอบสิทธิ์ให้ผู้ดูแลแต่ละส่วน|Manage the system and grant access to workspace administrators.
ดูแล{0}เฉพาะรายการที่ได้รับสิทธิ์|Manage {0} within assigned competitions only.
สถิติ VIMS|VIMS statistics
เตรียมข้อมูลกลางและรายการแข่งขัน|Prepare master data and competitions
สร้างผู้ดูแล Scorer / VIMS แล้วมอบสิทธิ์รายการ|Create Scorer / VIMS administrators and assign competitions
ติดตามภาพรวมและประวัติการตรวจรับ|Monitor the overview and review history
มอบสิทธิ์รายการให้ผู้บันทึกในส่วนงาน|Assign competitions to workspace recorders
ตรวจข้อมูลฉบับที่ผู้บันทึกส่งเข้าคิว|Inspect revisions submitted by recorders
ยืนยันผล หรือส่งกลับพร้อมเหตุผล|Confirm results or return them with a reason
ผู้ดูแลไม่มีสิทธิ์บันทึกคะแนนหรือสถิติ|Administrators cannot record scores or statistics.
ข้ามไปเนื้อหา|Skip to content
ปิดเมนู|Close menu
เมนู {0}|Menu {0}
เปิดเมนู|Open menu
ออนไลน์|Online
ออฟไลน์|Offline
ภาษา|Language
ใช้ธีมสว่าง|Switch to light theme
ใช้ธีมมืด|Switch to dark theme
ภาพรวมการแข่งขันของคุณ|Your competition overview
จัดการและติดตามการแข่งขันเฉพาะรายการที่ได้รับสิทธิ์|Manage and monitor your assigned competitions.
ดูแลภาพรวมทั้งระบบ|System overview
จัดการรายการแข่งขัน ข้อมูลกลาง และสิทธิ์ของผู้ใช้งาน|Manage competitions, master data and user access.
ศูนย์ดูแลคะแนนการแข่งขัน|Scoring administration
ติดตามแมตช์ ตรวจรับคะแนน และดูแลผู้บันทึกในรายการที่ได้รับสิทธิ์|Monitor matches, review scores and manage recorders in assigned competitions.
ศูนย์ดูแลสถิติการแข่งขัน|Statistics administration
ติดตามสถิติ ตรวจรับข้อมูล และดูแลผู้บันทึก VIMS ในรายการที่ได้รับสิทธิ์|Monitor statistics, review data and manage VIMS operators in assigned competitions.
`.trim().split('\n').map(line => line.split('|'));

const copy = new Map(accessCopy.flatMap(([thai, english]) => [[thai, [thai, english]], [english, [thai, english]]]));
export function translateAccess(value, language, params = []) {
    if (typeof value !== 'string') return value;
    const pair = copy.get(value.trim());
    const text = pair ? pair[normalizeLanguage(language) === 'ENG' ? 1 : 0] : translateUi(value, language);
    return text.replace(/\{(\d+)\}/g, (placeholder, index) => index < params.length ? String(params[index] ?? '') : placeholder);
}
