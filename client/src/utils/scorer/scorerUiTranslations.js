// UI copy only. Match identifiers, event payloads and entered names stay in their original form.
const copy = `
ไม่สามารถเปลี่ยนโหมดเต็มหน้าจอได้|Unable to change fullscreen mode
กรุณาลองอีกครั้ง หรือตรวจสอบว่าเบราว์เซอร์รองรับโหมดเต็มหน้าจอ|Please try again or check whether your browser supports fullscreen mode.
เปลี่ยนแดน|Switch sides
ผู้ตัดสินให้เล่นคะแนนใหม่|The referee has called for a replay.
ไม่สามารถบันทึกผลเซตลงฐานข้อมูลได้ กรุณาลองใหม่อีกครั้ง|Unable to save the set result. Please try again.
ยังไม่พบผลการแข่งขันของเซตนี้|No result recorded for this set
ต้องบันทึกผลเซต {0} ให้เรียบร้อยก่อน จึงจะเริ่มเซตถัดไปได้|Save the result of Set {0} before starting the next set.
ย้อนรายการไม่สำเร็จ|Undo failed
ไม่สามารถบันทึกรายชื่อนักกีฬาได้|Unable to save the roster
ระบบไม่สามารถอัปเดตรายชื่อได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง|Unable to update the roster. Please check the details and try again.
บันทึกข้อมูลนักกีฬาเรียบร้อย|Player details saved
บันทึกข้อมูลการตั้งค่าทีมและผู้ตัดสินเรียบร้อยแล้ว|Team and match official settings saved
บันทึกการลงทะเบียนนักกีฬาสำเร็จ|Match roster saved
ดำเนินการต่อ|Continue
ขั้นตอนต่อไป: ส่งรายชื่อผู้เล่นตัวจริงในสนาม|Next: Submit the starting lineup
กรุณาเลือกผู้เล่นตัวจริงให้ครบทั้ง 6 ตำแหน่ง|Please select starting players for all six positions.
บันทึกไลน์อัปลงฐานข้อมูลไม่สำเร็จ แต่ยังเล่นต่อได้|Unable to save the lineup to the server. You can continue the match.
✅ บันทึกไลน์อัปตัวจริงสำเร็จ|✅ Starting lineup saved
การตั้งค่าในเซตนี้เรียบร้อยแล้ว แมตช์พร้อมสำหรับการเริ่มแข่งขัน|Set setup is complete. The match is ready to start.
หยุดเวลานอกก่อนเวลา|End timeout early
ไม่สามารถเลือก Libero ลงเป็นผู้เล่น 6 คนแรกได้|A libero cannot be selected in the starting six.
เลือกการกระทำที่ผู้ตัดสินสั่ง|Select the procedure requested by the referee.
ประท้วง|Protest
ริบสิทธิ์|Forfeit
เหตุการณ์ประท้วงถูกบันทึกแล้ว|The protest has been recorded.
ยืนยันการริบสิทธิ์?|Confirm forfeit?
การริบสิทธิ์จะทำให้แมตช์สิ้นสุดลงทันที|Forfeiting will end the match immediately.
ทีมนี้ใช้เวลานอกครบตามกำหนดแล้ว|This team has used all its timeouts.
ดำเนินการตามคำขอแล้ว|Request processed
ไม่สามารถอนุมัติคำขอได้|Unable to approve the request
ไม่มี Libero ลงทะเบียน|No libero registered
กรุณาตั้งค่า Libero ในขั้นตอนการตั้งค่าทีมก่อน|Please register a libero in team setup first.
ไม่มีผู้เล่นในสนาม|No players on court
⚠️ แจ้งเตือนโควต้า|⚠️ Substitution quota warning
ทีม {0} เปลี่ยนตัวไปแล้ว 7 ครั้ง (เหลือโควต้าอีก 1 ครั้ง)|Team {0} has used 7 substitutions (1 remaining).
รับทราบ|Acknowledge
กำลังโหลดหน้าบันทึกคะแนน...|Loading Console...
หน้าบันทึกคะแนน|Scorer Console
ถ่ายทอดสด|LIVE
ออกจากเต็มหน้าจอ|Exit fullscreen
เต็มหน้าจอ|Fullscreen
ออฟไลน์ · เครื่องหลัก|Offline · Primary device
เชื่อมต่อเซิร์ฟเวอร์แล้ว|Connected to server
ยังไม่เชื่อมต่อเซิร์ฟเวอร์ · กำลังเชื่อมต่อใหม่|Disconnected · Reconnecting
บันทึกไม่สำเร็จ|Save failed
บันทึกในเครื่อง · ซิงค์ที่แดชบอร์ด Scorer|Saved locally · Sync from the Scorer dashboard
บันทึกแล้ว|Saved
รอบันทึก ({0})|Pending save ({0})
ยังไม่มีการซิงค์กับเซิร์ฟเวอร์สำเร็จในครั้งนี้|No successful server sync in this session
ซิงค์ล่าสุด|Sync Last
ลองบันทึกอีกครั้ง|Retry save
ประท้วง / ริบสิทธิ์|Protest / Forfeit
บันทึกเหตุการณ์|Match Log
ออก|Exit
เซต|Set
จำนวนเซต|Sets
คลิกเพื่อแก้ไขคะแนนด้วยตนเอง|Click to manually edit score
— รายชื่อและการดำเนินการ|— Roster & Actions
ไม่สามารถสลับฝั่งสนามระหว่างเล่นคะแนน|Cannot swap court side during rally
สลับฝั่งสนาม|Swap court side
กำลังโหลดข้อมูลผู้เล่น...|Loading players...
ตัวรับอิสระที่ถูกเปลี่ยนตัวออกหมายเลข #{0}|Replaced libero #{0}
ลง|Down
สนามวอลเลย์บอล|Volleyball Court
ลูกบอล|ball
ลิเบอโร|Libero
✓ ตัวจริง|✓ Starter
ตัวจริง|Starter
✓ ลิเบอโร|✓ Libero
ตัวจริง:|Starters:
ลิเบอโร:|Libero:
ไม่มี|None
ยืนยัน|Confirm
เปลี่ยนตัวผู้เล่น ·|Substitutions ·
ใช้ไป|Used
/ 8 ครั้ง · รอบันทึก|/ 8 substitutions · Pending
คู่|pairs
ปิดการเปลี่ยนตัว|Close substitutions
1. ผู้เล่นในสนาม · ออก|1. On court · OUT
2. ม้านั่งสำรอง · เข้า|2. Bench · IN
เลือกหมายเลขผู้เล่นในสนามก่อน|Select an on-court player first.
เลือกผู้เล่นเข้าแทน #|Select a replacement for #
ไม่มีผู้เล่นที่เปลี่ยนเข้าได้ หรือใช้โควตาครบแล้ว|No eligible replacements, or substitution quota reached.
เพิ่ม · #|Add · #
3. รายการเปลี่ยนตัว (|3. Substitution pairs (
เลือกผู้เล่นออกและเข้า แล้วกด Add|Select a player out and a player in, then press Add.
ลบคู่ที่ {0}|Remove pair {0}
กำลังบันทึก…|Saving…
บันทึก {0} คู่|Save {0} pairs
เลื่อนการชาลเลนจ์|Postpone Challenge
ยืนยันการชาลเลนจ์|Video Challenge Confirmation
ทีม:|Team:
1. ตรวจสอบเหตุผลการชาลเลนจ์|1. Verify Challenge Reason
2. จังหวะที่ขอชาลเลนจ์|2. Challenged Action
ชาลเลนจ์จังหวะล่าสุด (ใช่)|Challenging Last Action (YES)
ชาลเลนจ์จังหวะก่อนหน้า (ไม่ใช่)|Challenging Previous Action (NO)
กลับ|Back
ยืนยันและเริ่มตรวจสอบ|Confirm & Start Review
บอลลงใน / ออก|Ball In/Out
สัมผัสบล็อก|Touch Block
สัมผัสตาข่าย|Net Touch
สัมผัสเสาอากาศ|Antenna Touch
เท้าผิดกติกา (เสิร์ฟ / เส้น)|Foot Fault (Serve/Line)
ชาลเลนจ์วิดีโอ|Video Challenge
คงเหลือ:|LEFT:
เหตุผลการชาลเลนจ์|Challenge Reason
ผลการตัดสิน|Final Decision
สำเร็จ|Successful
คงสิทธิ์ไว้|Keep Quota
ไม่สำเร็จ|Unsuccessful
เสียสิทธิ์ 1 ครั้ง|Lose 1 Quota
ยกเลิกคำขอ|Cancel Request
ทีมชนะการเสี่ยงเหรียญ|Coin Toss Winner
เลือกทีมที่ชนะการเสี่ยงเหรียญเพื่อเริ่มการแข่งขัน|Choose which team won the toss to start the match.
ผู้ชนะ|Winner
เลือกแล้ว|Selected
หากไม่แน่ใจ ให้ผู้ตัดสินยืนยันทีมที่ชนะการเสี่ยงเหรียญก่อนดำเนินการต่อ|If you are unsure, ask the referee to confirm the toss winner before continuing.
เลือกฝั่งสนาม|Court Side Selection
{0} ชนะการเสี่ยงเหรียญ|{0} won the toss.
เลือกทีมที่อยู่สนาม A (ซ้าย)|Select the team on Court A (Left).
สนาม A|Court A
ฝั่งซ้ายสำหรับเซต|Left side for set
ซ้าย|Left
บันทึกฝั่งสนามที่ผู้ตัดสินและกัปตันทั้งสองทีมตกลงกัน|Record the court sides agreed by the referee and both captains.
ทีมเสิร์ฟก่อน|First Serve
เลือกทีมที่จะเสิร์ฟในคะแนนแรก|Choose which team will serve first in the opening rally.
เสิร์ฟก่อน|Serve First
พร้อม|Ready
ยืนยันทีมเสิร์ฟก่อนเพื่อเริ่มการแข่งขัน|Finalize the opening serve so the match can begin with a clear starting team.
ขั้นตอน|Step
จาก 3|of 3
เสี่ยงเหรียญ|Coin Toss
ทีมชนะเสี่ยงเหรียญ:|Toss winner:
ซ้าย:|Left:
ขวา:|Right:
ทีมเสิร์ฟก่อน:|First serve:
กรุณาเลือก|Please select
ถัดไป|Next
กำลังบันทึก...|Saving...
ลิเบอโรเข้า —|Libero In —
เลือกผู้เล่นออก (แถวหลัง)|Select player out (back row)
ไม่มีผู้เล่นแถวหลังที่สามารถสลับตัวได้ในขณะนี้|No eligible back-row players are available.
เลือกลิเบอโรเข้า|Select Libero In
ผู้เล่นออก:|Player Out:
ไม่มี Libero ที่พร้อมลงสนามในขณะนี้|No libero is available to enter the court.
ตัวหลัก|Primary
{0} ตำแหน่ง {1}{2}|{0} position {1}{2}
นำผู้เล่น {0} ออกจาก {1} ตำแหน่ง {2}|Remove player {0} from {1} position {2}
สีเสื้อ|Shirt color
ล็อกแล้ว|Locked
เลือกสีเสื้อ|Select shirt color
เลือกสีเสื้อ {0}|Select {0} shirt color
กำหนดสีเอง|Custom color
เลือกสีเสื้อเอง|Choose custom shirt color
รายชื่อผู้เล่นตัวจริง|Starting lineup
ไม่มีข้อมูลรายชื่อ|No roster data
จัดรายชื่อ|Set roster
อนุมัติรายชื่อนักกีฬา|Approvals - Roster
กัปตัน|Captain
✓ ลงนามแล้ว · ล็อก|✓ Signed · Locked
ผู้ฝึกสอน|Coach
ล้างรายชื่อผู้เล่นตัวจริง|Clear Lineup
ยกเลิก|Cancel
บันทึก|Save
ลายเซ็น —|Signature —
ปรับแก้ด้วยตนเอง|MANUAL ADJUSTMENT
หน้าปรับแก้ข้อมูลการแข่งขัน|Manual Override Console
ปรับคะแนนปัจจุบัน|Adjust Current Score
หมายเลขเซต|Set Number
เหตุผลการปรับแก้ (รายงาน)|Reason for Adjustment (Report)
เช่น ให้คะแนนผิดทีม...|e.g., Wrong point assigned to wrong team...
การปรับแก้นี้จะถูกบันทึกในรายงานอย่างเป็นทางการ|This adjustment will be logged in the official report.
นำการเปลี่ยนแปลงไปใช้|Apply Changes
ข้อมูลแมตช์|Match info
หมายเลขแมตช์|Match no.
วันที่ของการแข่งขัน|Day no.
รอบ|Phase
วันที่|Date
เวลาตามกำหนด|Scheduled time
เวลาเริ่มจริง|Real Starting Time
ประเทศ|Country
เมือง|City
สนาม|Hall
ผู้ชม|Spectators
รายรับ|Receipts
โควิด|COVID
อนุญาตให้เปลี่ยนแดน|CHANGE COURT ENABLED
นามสกุล|Family name
ชื่อ|First name
เมือง / ภูมิภาค|City/Region
สัญชาติ|Nat
รหัสถ่ายทอดสด|Webcast Id
รหัสเกม|GameKey
ผู้ควบคุมการแข่งขัน|Supervisor
ฝ่ายสนับสนุนคะแนนสดต้องการเบอร์โทรศัพท์|Live Score Support wants to communicate with you: indicate a phone
ของผู้ที่สามารถติดต่อได้ในกรณีเร่งด่วน|number of a person who could be contacted for urgent communications.
โทรศัพท์|PHONE
หมายเหตุ|Comments
ตกลง|OK
บันทึกเหตุการณ์การแข่งขัน|MATCH LOG
ลำดับเหตุการณ์การแข่งขันแบบเรียลไทม์|Real-time Match Events Timeline
ยังไม่มีเหตุการณ์ที่บันทึกไว้|No events recorded yet
เวลาอ้างอิง|Ref Time
คะแนน:|Score:
ปิดบันทึกเหตุการณ์|Close Log Console
เลือกผู้เล่น|Select player
ปิดหน้าต่างเลือกผู้เล่น|Close player picker
ผู้เล่น|Player
เฉพาะลิเบอโร|Libero only
ไม่มีผู้เล่นที่พร้อมใช้งาน|No active players
ไม่สามารถเลือกผู้เล่นที่จัดตำแหน่งไว้แล้ว หรือไม่มีสิทธิ์เล่นในตำแหน่งนี้|Players already assigned, or ineligible for the selected position, are unavailable.
-- เลือกเจ้าหน้าที่ --|-- Select official --
กรุณาเพิ่มนักกีฬาอย่างน้อย 6 คนใน Roster ของทีมนี้|Please add at least six players to this team's roster.
กรุณาเพิ่มนักกีฬาอย่างน้อยทีมละ 6 คนใน Roster|Please add at least six players to each team's roster.
ตั้งค่าแมตช์และผู้ตัดสิน|Match Officials & Setup
หญิง|Female
ชาย|Male
แก้ไขข้อมูลผู้เล่น|Edit player details
เพิ่มผู้เล่นให้ {0}|Add player to {0}
หมายเลข|Number
เพิ่มผู้เล่น|Add player
เลือก|Select
ชื่อผู้เล่น|Name
บทบาท|Role
แก้ไข|Edit
กัปตัน (C)|Captain (C)
ลิเบอโร (L1)|Libero (L1)
ลิเบอโร (L2)|Libero (L2)
ลิเบอโร (L1) และกัปตัน (C)|Libero (L1) & Captain (C)
ลิเบอโร (L2) และกัปตัน (C)|Libero (L2) & Captain (C)
กำลังจัดการ|Currently Managing
รวม|Total
กัปตัน|Cap
ลิเบอโร|Lib
จัดรายชื่อ: เลือกเฉพาะผู้เล่นที่มาแข่งขันจริง (นำเครื่องหมายออกหากไม่มา)|Roster Management: Check players attending the match (uncheck absent players).
ผู้เล่นที่เลือกได้|Available Players
รายชื่อสำหรับแมตช์นี้|Selected Match Roster
รายชื่อ:|Roster:
รหัส|ID
ข้อมูลทั่วไปของแมตช์|General Match Info
ข้อมูลการแข่งขันและสถานที่|Match Info & Location
รุ่นแข่งขัน|Category
เลือกรุ่นแข่งขัน|Select category
เพศ|Gender
รอบการแข่งขัน|Phase / Round
เวลา|Time
ทีมเจ้าบ้าน|Home Team
ทีมเยือน|Away Team
สาย|Pool
จำนวนเซตที่ต้องชนะ|Sets to Win
2 เซต (แข่งสูงสุด 3 เซต)|2 Sets (Best of 3)
3 เซต (แข่งสูงสุด 5 เซต)|3 Sets (Best of 5)
สถานที่|Location
สนาม / โรงยิม|Stadium / Hall
ผู้ตัดสินและเจ้าหน้าที่|Match Officials
ผู้ตัดสินที่ 1|1st Referee
ชื่อผู้บันทึกคะแนน|Scorer Name
ผู้ตัดสินที่ 2|2nd Referee
รหัสประเทศผู้บันทึกคะแนน|Scorer Country Code
ชื่อผู้ช่วยผู้บันทึกคะแนน|Assistant Scorer Name
รหัสประเทศผู้ช่วยผู้บันทึกคะแนน|Assistant Scorer Country Code
ผู้กำกับเส้น 1|Line Judge 1
ผู้กำกับเส้น 2|Line Judge 2
ผู้กำกับเส้น 3|Line Judge 3
ผู้กำกับเส้น 4|Line Judge 4
ชื่อผู้ควบคุมผู้ตัดสิน|Referee Delegate Name
ประเทศผู้ควบคุมผู้ตัดสิน|Referee Delegate Country
รหัสผู้ควบคุมผู้ตัดสิน|Referee Delegate Code
ชื่อผู้อำนวยการฝ่ายเทคนิค|Technical Director Name
ประเทศผู้อำนวยการฝ่ายเทคนิค|Technical Director Country
รหัสผู้อำนวยการฝ่ายเทคนิค|Technical Director Code
ชื่อผู้ฝึกสอนผู้ตัดสิน|Referee Coach Name
ประเทศผู้ฝึกสอนผู้ตัดสิน|Referee Coach Country
รหัสผู้ฝึกสอนผู้ตัดสิน|Referee Coach Code
ชื่อผู้แทนผู้ตัดสิน|Referee Representative Name
ประเทศผู้แทนผู้ตัดสิน|Referee Representative Country
รหัสผู้แทนผู้ตัดสิน|Referee Representative Code
คำแนะนำ|Quick Instructions
ดับเบิลคลิกชื่อเพื่อเพิ่มอย่างรวดเร็ว กำหนดลิเบอโรได้ไม่เกินทีมละ 2 คน|Double-click a name to add quickly. Libero roles are limited to 2 players per team.
ตรวจสอบและแก้ไขข้อมูลรายการแข่งขันรวมถึงรายชื่อผู้ตัดสินประจำแมตช์การแข่งขันให้เรียบร้อยก่อนกดยืนยัน|Check the match details and match officials before confirming.
ยืนยันการตั้งค่า|Confirm Setup
ยืนยันรายชื่อ|Confirm Roster
ไปยังรายชื่อทีมเยือน|Go to Away Roster
ไปยังผู้ตัดสิน|Go to Officials
ทีม|Team
การถ่วงเวลา / คำขอไม่ถูกต้อง|Delays, improper requests
การประพฤติผิดของนักกีฬา|Athlete misconduct
เจ้าหน้าที่|Staff
ผู้ฝึกสอนและเจ้าหน้าที่ทีม|Coaches and team officials
ใบเหลือง|Yellow card
ใบแดง|Red card
เสียคะแนน|Penalty point
ให้ออกจากการแข่งขันในเซต|Expulsion
ใบแดงและใบเหลืองคู่กัน|Red + yellow together
ให้ออกจากการแข่งขันทั้งแมตช์|Disqualification
ใบแดงและใบเหลืองแยกกัน|Red + yellow separately
เตือนการถ่วงเวลา|Delay warning
เตือนทีมเรื่องการถ่วงเวลา|Team delay warning
ลงโทษการถ่วงเวลา|Delay penalty
คำขอไม่ถูกต้อง|Improper request
บันทึกคำขอไม่ถูกต้อง|IR recorded
ออกบทลงโทษ|Issue Sanction
เลือกผู้รับโทษ ทีม และประเภทบทลงโทษ แล้วกดยืนยัน|Select receiver, team, sanction type, then submit.
ผู้รับบทลงโทษ|Receiver of sanction
ผู้เล่นที่ถูกลงโทษ|Penalized player
เจ้าหน้าที่ที่ถูกลงโทษ|Penalized staff
ประเภทบทลงโทษ|Sanction type
ยืนยันบทลงโทษ|Submit Sanction
แก้ไขลายเซ็น|Edit signature
คลิกเพื่อลงชื่อ|Click to sign
ลงนามท้ายแมตช์|FINAL MATCH SIGNATURES
ลงนามก่อนแข่ง|OFFICIAL SIGNATURES
กัปตันและผู้ตัดสินลงนามรับรองใบบันทึกคะแนนฉบับสมบูรณ์|Captains and Referees sign to verify final scoresheet
ลงนามก่อนการแข่งขัน (ไม่บังคับ)|Sign before the match (Optional)
กัปตันทีม|Captains
กัปตันทีม {0}|{0} Captain
ผู้ตัดสิน|Referees
ผู้ฝึกสอนทีมเจ้าบ้าน|Home Coach
กัปตันทีมเจ้าบ้าน|Home Captain
ผู้ฝึกสอนทีมเยือน|Away Coach
กัปตันทีมเยือน|Away Captain
กลับหน้าหลัก|Back to dashboard
⚠️ กรุณาลงนามกัปตันทั้งสองทีม และผู้ตัดสินที่ 1-2 ให้ครบเพื่อเปิดปุ่มกลับหน้าหลัก|⚠️ Both captains and both referees must sign before returning to the dashboard.
ข้าม / ถัดไป|SKIP / NEXT
บันทึกและดำเนินการต่อ|SAVE & CONTINUE
ลงลายมือชื่อ —|Sign —
คำขอชาลเลนจ์วิดีโอ|Video Challenge Request
คำขอชาลเลนจ์หมดเวลา|Challenge Request Expired
หมดเวลา 7 วินาทีสำหรับส่งเหตุผลแล้ว|The 7-second period to submit a reason has passed.
ส่งช้า (ใช้ประกอบข้อมูลเท่านั้น)|Late Submission (For Info Only)
จังหวะที่ชาลเลนจ์:|Challenging:
จังหวะล่าสุด|Last Rally Action
จังหวะก่อนหน้า|Previous Action
ยังไม่ได้เลือกเหตุผลการชาลเลนจ์บนแท็บเล็ต|No challenge reason was selected on the tablet.
วินาที|s
กำลังรอเหตุผลการชาลเลนจ์...|Waiting for challenge reason...
ทีมมีเวลา 7 วินาทีเพื่อเลือกเหตุผลบนแท็บเล็ต|The team has 7 seconds to select the reason on their tablet.
ได้รับเหตุผลภายในเวลา|Reason Received On Time
จังหวะล่าสุด (ใช่)|Last Rally Action (YES)
จังหวะก่อนหน้า (ไม่ใช่)|Previous Action (NO)
ไม่ถูกต้อง|Invalid
เลื่อนออกไป|Postpone
ยอมรับ|Accept
ขอ|requested a
เวลานอก|time out
เปลี่ยนตัว|substitution
จัดตัวผู้เล่น|lineup
คำขอ|request
ปฏิเสธ|Reject
หมดโควต้าเปลี่ยนตัวปกติ 8 ครั้งแล้ว|All 8 regular substitutions have been used.
ตำแหน่งนี้ไม่สามารถเปลี่ยนตัวได้อีก|No further substitutions are allowed for this position.
ไม่พบผู้เล่นตัวจริงในม้านั่งสำรอง|The starting player was not found on the bench.
ยืนยันการเปลี่ยนตัว|Confirm Substitution
ผู้เล่นออก|Player Out
ผู้เล่นเข้า|Player In
เปลี่ยนตัวกรณีพิเศษ|Exceptional Substitution
การเปลี่ยนตัว|Substitution
เลือกทีม|Select Team
ออก|Out
ผู้เล่นในสนาม|Players on Court
เข้า|In
กรณีพิเศษ|Exceptional
ผิดกติกา|Rule Violation
ไม่มีผู้เล่น|No Players
ต้องการความช่วยเหลือ?|Need assistance?
เลือกผู้เล่นในสนามทางซ้าย และผู้เล่นสำรองที่จะเข้าแทนทางขวา|Select an active player on the left and a replacement from the bench on the right.
ตรวจสอบก่อนยืนยัน|Proceed to Preview
ยังไม่ได้เลือกการเปลี่ยนตัว|No substitutions selected.
คำขอเปลี่ยนตัว|Substitution Request
ขอเปลี่ยนตัว|requested a substitution
พัก|PAUSE
ดำเนินการต่อ|RESUME
คะแนนถึงเกณฑ์จบเซต|SET POINT REACHED
กำลังจบเซต...|ENDING...
จบเซต|END SET
สิ้นสุดแล้ว|Concluded
กำลังเริ่ม...|STARTING...
เริ่มเซตถัดไป|START NEXT SET
สิ้นสุดการแข่งขัน|End off match
ลายเซ็น|SIGNATURES
การบาดเจ็บ|Injury
เปลี่ยนตัวพิเศษ / บาดเจ็บ|Exceptional sub. / Injury
ตรวจสอบชาลเลนจ์|Challenge Review
จังหวะล่าสุด|Last Action
ยอมรับว่าทำผิด|Fault Admission
ดับเบิลคลิกหากผู้เล่นยอมรับว่าทำผิด|Double-click if player admits fault
ไม่สามารถสรุปผล|Inconclusive
เริ่มการแข่งขัน|START MATCH
หลังสัญญาณนกหวีดจากผู้ตัดสิน|After referee whistle
เสิร์ฟ|Serve
กำลังเล่นคะแนน...|Rally in progress...
ใช้แผงด้านข้างเพื่อให้คะแนนหรือจัดการคำขอ|Use side panels to score or manage actions
เริ่มจัดตัวผู้เล่น|Start Line Up
ยืนยันผู้เล่นตัวจริง|Complete Lineup
เล่นคะแนนใหม่|Replay rally
บทลงโทษ|Sanction
เปลี่ยนตัวกรณีพิเศษ / บาดเจ็บ|Exceptional Substitution / Injury
เลือกทีมก่อนเปิดหน้าต่างเปลี่ยนตัวกรณีบาดเจ็บ|Select the team before opening injury substitution.
พักการควบคุมการแข่งขัน|Game Controls Paused
ตั้งค่าแมตช์|Match settings
การเชื่อมต่อเจ้าหน้าที่|Staff connections
เจ้าหน้าที่ทีม {0}|{0} Staff
ประวัติการแข่งขัน|Match history
ปัจจุบัน|Current
เซต {0}: {1}-{2}|Set {0}: {1}-{2}
เซต {0}|Set {0}
ยังไม่มีเหตุการณ์|No events yet
· การเปลี่ยนตัว (|· Substitutions (
ออก #|OUT #
→ เข้า #|→ IN #
คะแนน|Point
เวลานอก|Timeout
ชาลเลนจ์ที่เลื่อนไว้|Postponed Challenges
ชาลเลนจ์:|Challenge:
ย้อนรายการล่าสุด|Undo last action
ปิดแผงทีม|Close team panel
ลิเบอโรเข้า|Libero in
ไม่ได้เปิดใช้ชาลเลนจ์สำหรับแมตช์นี้|Challenge system is not enabled for this match
ชาลเลนจ์|Video chall.
ได้คะแนน|Point scored
ลงลายมือชื่อที่นี่|Sign Here
ล้างลายเซ็น|Clear Signature
ในสนาม|On court
ม้านั่งสำรอง|On bench
สลับลิเบอโร|Libero exchange
ลิเบอโรใหม่|New libero
เตือนลิเบอโรหมุนไปแดนหน้า|Libero Rotation Warning
ลิเบอโร #{0} กำลังหมุนไปแดนหน้า (P4) ต้องเปลี่ยนตัวออก!|Libero #{0} is rotating to the front row (P4). They must be replaced!
เซต {0} สิ้นสุดแล้ว|SET {0} FINISHED
ชนะเซตนี้|WINS THE SET
ข้อผิดพลาด|Error
ไม่มีข้อมูลผู้ชนะเซต|Missing set winner data
คะแนนเซตยังไม่พร้อม กรุณาตรวจสอบกระดานคะแนนแล้วลองใหม่|The set score is not ready yet. Please check the scoreboard and try again.
ยืนยันการย้อนรายการ?|Confirm Undo?
ต้องการย้อนกลับการกระทำล่าสุดหรือไม่?|You want to undo the last action?
ใช่ ย้อนรายการ|Yes, Undo
ย้อนรายการแล้ว|Undone
กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่|Check your connection and try again.
ถัดไป: จัดตัวผู้เล่น|Next: Starting Lineup
เสี่ยงเหรียญเสร็จแล้ว|Coin toss completed
เลือกผู้เล่นและการเปลี่ยนตัว|Select Players and Substitutions
ถัดไป: เสี่ยงเหรียญ|Next: Coin Toss
ถัดไป: เสี่ยงเหรียญ แล้วจัดตัวผู้เล่น|Next: Coin Toss, then Starting Lineup
คำเตือน|Warning
ใช้เวลานอกครบแล้ว|Timeout limit reached
แต่ละทีมขอเวลานอกได้ไม่เกิน 2 ครั้งต่อเซต|Each team can request only 2 timeouts per set.
เวลานอก - {0}|Timeout - {0}
ขั้นตอนพิเศษ|Special Procedures
บันทึกการประท้วงแล้ว|Protest Logged
ปิดใช้ชาลเลนจ์|Challenge disabled
แมตช์นี้ไม่ได้ตั้งค่าให้ใช้ระบบชาลเลนจ์|This match was not configured to use the challenge system.
กรุณาเริ่มเซตถัดไปก่อน|Start next set first
รายชื่อนี้ส่งมาสำหรับเซต {0} แต่หน้าบันทึกคะแนนยังอยู่เซต {1} กรุณาเริ่มขั้นตอนเซตถัดไป แล้วให้ทีมส่งรายชื่ออีกครั้ง|This lineup was submitted for Set {0}, but the scorer console is still on Set {1}. Please start the next set workflow and ask the team to submit again.
ลิเบอโรในสนาม|Libero in court
ไม่อนุญาตให้ดำเนินการ|Action Not Allowed
ไม่สามารถสลับลิเบอโรออกจากจุดนี้ได้ อาจต้องใช้การเปลี่ยนตัวอย่างเป็นทางการ|This Libero cannot be swapped out from here. This might be a formal replacement.
หมายเลขเข้า|Number In
หมายเลขออก|Number Out
ผู้เล่นในตำแหน่ง 4|Player in Zone 4
ผู้เล่นหมายเลข {0} ต้องลงแทนลิเบอโรในสนาม|Player n. {0} must replace the libero on the court
ทีม|Team
ทำคะแนนถึง 8 แต้มก่อนในเซตตัดสิน|reached 8 points first in the deciding set
เปลี่ยนฝั่งแดนการเล่น!|Switch court sides!
คะแนนปัจจุบัน: {0} - {1}|Current score: {0} - {1}
กำลังนับถอยหลังการขอเวลานอก|Timeout countdown
วินาที|seconds
ผู้จัดการทีม|Team Manager
ผู้ฝึกสอนหลัก|Head Coach
ผู้ช่วยผู้ฝึกสอน|Assistant Coach
ผู้ช่วยผู้ฝึกสอน 1|Assistant Coach 1
ผู้ช่วยผู้ฝึกสอน 2|Assistant Coach 2
แพทย์ประจำทีม|Medical Doctor
นักกายภาพ/เทรนเนอร์|Therapist/Trainer
รหัสการชาลเลนจ์|Challenge code
ภาษาแสดงผล|Interface language
ฝั่งสนาม A (ซ้าย)|Court Side A (Left)
สัมผัสบล็อก|Block touch
สัมผัสพื้น|Floor touch
เท้าผิดกติกา|Foot fault
ล้ำเหนือตาข่าย|Reaching beyond the net
สัมผัสบอลครั้งสุดท้าย|Last touch
คำขอเวลานอก|Timeout request
คำขอจัดตัวผู้เล่น|Lineup request
คำขอจากเจ้าหน้าที่|Staff request
ยังไม่กำหนด|Not assigned
ผู้ควบคุมชาลเลนจ์|Challenge Operator
การเลือกทั่วไป|General selection
ไม่สามารถระบุแมตช์หรือทีมได้|Unable to determine the match or team.
ไม่พบช่องทางอัปเดตผู้เล่น กรุณาอัปเดตเซิร์ฟเวอร์แล้วลองอีกครั้ง|Player update endpoint was not found. Please deploy the latest backend, then try again.
ไม่สามารถบันทึกข้อมูลผู้เล่นได้|Unable to save player details.
ไม่สามารถเปลี่ยนตัวในขั้นตอนนี้ได้|Substitutions are unavailable during this phase.
รายชื่อที่ส่งมายังไม่ครบ กรุณาให้ทีมส่งผู้เล่นทั้งหกคนอีกครั้ง|The submitted lineup is incomplete. Ask the team to submit all six players again.
เริ่มการแข่งขันแล้ว|Match Started
สิ้นสุดการแข่งขันแล้ว|Match Finished
ยืนยันผู้เล่นตัวจริงแล้ว|Lineup Confirmed
เปลี่ยนตัว|Sub
ปิด|Close
เริ่มการแข่งขัน (เซต {0})|Match started (Set {0})
เริ่มเซต {0}|Set {0} started
มีการประท้วงการแข่งขัน|Match protested
มีการริบสิทธิ์การแข่งขัน|Match forfeited
{0}: เข้า #{1} / ออก #{2} ({3})|{0}: IN #{1} / OUT #{2} ({3})
เล่นคะแนนใหม่ ({0} เสิร์ฟ)|Replay rally ({0} served)
ให้คะแนนแก่ {0}|Point awarded to {0}
เลือกการเปลี่ยนตัวอย่างน้อยหนึ่งคู่|Select at least one substitution pair.
เปลี่ยนตัวได้สูงสุด 8 ครั้งต่อเซต|Maximum 8 substitutions per set.
ตำแหน่งนี้ใช้สิทธิ์เปลี่ยนกลับแล้ว|This position has already used its return substitution.
เฉพาะผู้เล่นตัวจริงเดิมเท่านั้นที่กลับตำแหน่งนี้ได้|Only the original starter can return to this position.
เลือกคู่เปลี่ยนตัวตั้งแต่ 1 ถึง 6 คู่|Select between 1 and 6 pairs.
เกินโควต้าการเปลี่ยนตัว|Substitution limit exceeded.
รายชื่อในสนามเปลี่ยนไปแล้ว กรุณาตรวจสอบคู่เปลี่ยนตัว|The on-court lineup has changed. Review the pairs.
ผู้เล่นเข้าไม่พร้อมใช้งาน หรือถูกเลือกซ้ำ|A replacement is unavailable or selected twice.
กรุณาใช้การสลับลิเบอโรสำหรับผู้เล่นลิเบอโร|Use Libero replacement for Libero players.
ผู้เล่นเข้าคนนี้เคยลงในการเปลี่ยนตัวตำแหน่งอื่นแล้ว|This replacement has already played in another substitution.
ผู้บันทึกคะแนน|Scorer
ผู้ช่วย|Assistant
ผู้กำกับเส้น|Line Judges
ผู้แทนผู้ตัดสิน|Referee Delegate
ผู้อำนวยการฝ่ายเทคนิค|Technical Director
ผู้ฝึกสอนผู้ตัดสิน|Referee Coach
ผู้แทนผู้ตัดสิน|Referee Representative
ผู้เล่นยอมรับว่าทำผิด - ให้คะแนนแก่ {0}|Player fault admission - Point awarded to {0}
การแข่งขันวอลเลย์บอล|Volleyball Competition
ยังไม่ระบุ|Unspecified
ผสม|Mixed
ชาย|Men's
สโมสรชาย|Club Male
ใช้ปุ่มควบคุมทีมเพื่อให้คะแนนหรือจัดการคำขอ|Use team controls to score or manage actions
`;

const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const dictionary = new Map();
for (const line of copy.trim().split('\n')) {
  const [THA, ENG] = line.split('|');
  const entry = { THA, ENG };
  // Keep the first Thai-to-English spelling when several English aliases share Thai copy.
  if (!dictionary.has(normalize(THA))) dictionary.set(normalize(THA), entry);
  dictionary.set(normalize(ENG), entry);
}

const aliases = {
  'เปลี่ยนแดน (Switch Sides)': 'Switch sides',
  'ผู้ตัดสินให้เล่นคะแนนใหม่ (Replay)': 'The referee has called for a replay.',
  'ต้องบันทึกผล Set {0} ให้เรียบร้อยก่อน จึงจะเริ่มเซตถัดไปได้': 'Save the result of Set {0} before starting the next set.',
  'ขั้นตอนต่อไป: ส่งรายชื่อผู้เล่นตัวจริงในสนาม (Starting Lineup)': 'Next: Submit the starting lineup',
  'บันทึก Lineup ลงฐานข้อมูลไม่สำเร็จ (แต่ยังเล่นต่อได้)': 'Unable to save the lineup to the server. You can continue the match.',
  'ยกเลิกเวลานอกก่อนเวลา (Stop)': 'End timeout early',
  'ประท้วง (Protest)': 'Protest',
  'ริบสิทธิ์ (Forfeit)': 'Forfeit',
  'ยืนยันการริบสิทธิ์ (Forfeit)?': 'Confirm forfeit?',
  'ทีมนี้ใช้เวลานอกครบตามกำหนดแล้ว (Limit reached)': 'This team has used all its timeouts.',
  'Offline · เครื่องหลัก': 'Offline · Primary device',
  'เชื่อมต่อเซิร์ฟเวอร์แล้ว / Live': 'Connected to server',
  'ยังไม่เชื่อมต่อเซิร์ฟเวอร์ · กำลังเชื่อมต่อใหม่ / Reconnecting': 'Disconnected · Reconnecting',
  'บันทึกไม่สำเร็จ / Save failed': 'Save failed',
  'บันทึกแล้ว / Saved': 'Saved',
  'รอบันทึก / Pending ({0})': 'Pending save ({0})',
  'ลองบันทึกอีกครั้ง / Retry': 'Retry save',
  '1. ผู้เล่นในสนาม · OUT': '1. On court · OUT',
  '2. ม้านั่งสำรอง · IN': '2. Bench · IN',
  'Select Player Out (แถวหลัง)': 'Select player out (back row)',
  'Last name': 'Family name',
  'Lastname': 'Family name',
  'Match No.': 'Match no.',
  'หญิง / Female': 'Female',
  'ชาย / Male': 'Male',
  'Roster Management: เช็กชื่อผู้เล่นที่มาแข่งจริง (ใครไม่มาให้ติ๊กออก)': 'Roster Management: Check players attending the match (uncheck absent players).',
  'ข้อมูลการแข่งขันและสถานที่ / Match Info & Location': 'Match Info & Location',
  'ผู้ตัดสินและเจ้าหน้าที่ประจำแมตช์ / Match Officials': 'Match Officials',
  'FINAL MATCH SIGNATURES (ลงนามท้ายแมตช์)': 'FINAL MATCH SIGNATURES',
  'OFFICIAL SIGNATURES (ลงนามก่อนแข่ง)': 'OFFICIAL SIGNATURES',
  'Captains (กัปตันทีม)': 'Captains',
  'Referees (ผู้ตัดสิน)': 'Referees',
  '1st Referee (ผู้ตัดสินที่ 1)': '1st Referee',
  '2nd Referee (ผู้ตัดสินที่ 2)': '2nd Referee',
  'บันทึก (Save)': 'Save',
  'ลงลายมือชื่อที่นี่ (Sign Here)': 'Sign Here',
  'เวลานอก (TIMEOUT) - {0}': 'Timeout - {0}',
  'Timeout limit reached.': 'Timeout limit reached',
  'Resume': 'RESUME',
  '| Toss winner:': 'Toss winner:',
  '| Right:': 'Right:',
  '-- เลือกเจ้าหน้าที่ / Select --': '-- Select official --',
  'BALL_IN_OUT': 'Ball In/Out',
  'BALL_IN/OUT': 'Ball In/Out',
  'TOUCH_BLOCK': 'Touch Block',
  'NET_TOUCH': 'Net Touch',
  'ANTENNA': 'Antenna Touch',
  'FOOT_FAULT': 'Foot Fault (Serve/Line)',
  'Line Judge # 1': 'Line Judge 1',
  'Line Judge # 2': 'Line Judge 2',
  'Line Judge # 3': 'Line Judge 3',
  'Line Judge # 4': 'Line Judge 4',
};
for (const [alias, target] of Object.entries(aliases)) dictionary.set(normalize(alias), dictionary.get(normalize(target)));

/** Translate authored UI copy; interpolation values are inserted afterwards, untouched. */
export function translateScorerUi(value, language = 'THA', params = []) {
  if (typeof value !== 'string') return value;
  const indices = [];
  const key = value.replace(/\{(\d+)\}/g, (_, index) => {
    if (!indices.includes(index)) indices.push(index);
    return `{${indices.indexOf(index)}}`;
  });
  const entry = dictionary.get(normalize(key));
  const translated = entry
    ? entry[language === 'ENG' ? 'ENG' : 'THA'].replace(/\{(\d+)\}/g, (_, index) => `{${indices[index] ?? index}}`)
    : value;
  return translated.replace(/\{(\d+)\}/g, (placeholder, index) => (
    index < params.length ? String(params[index] ?? '') : placeholder
  ));
}

/** Only translate authored text nodes, never HTML attributes or interpolated names. */
export function translateScorerMarkup(markup, language, params = []) {
  const translated = markup.replace(/(^|>)([^<]+)(?=<|$)/g, (_, start, text) => {
    const trimmed = text.trim();
    return start + (trimmed ? text.replace(trimmed, translateScorerUi(trimmed, language)) : text);
  });
  return translated.replace(/\{(\d+)\}/g, (placeholder, index) => (
    index < params.length ? String(params[index] ?? '') : placeholder
  ));
}

export function formatScorerDateTime(value, language = 'THA') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(language === 'ENG' ? 'en-GB' : 'th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(date);
}

// Older events store a Buddhist-calendar display string instead of an ISO timestamp.
// Convert it for display only; keep the offline event and its original time intact.
export function formatScorerEventTime(value, language = 'THA') {
  if (!value || language !== 'ENG') return value;
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const match = String(value).match(/^(\d{1,2})\s+(\S+)\s+(\d{4})\s+เวลา\s+(\d{2}):(\d{2}):(\d{2})\s+น\.$/);
  if (!match || !months.includes(match[2])) return value;
  const date = new Date(Number(match[3]) - 543, months.indexOf(match[2]), Number(match[1]), Number(match[4]), Number(match[5]), Number(match[6]));
  return formatScorerDateTime(date, language);
}
