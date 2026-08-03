# การอ่านเอกสารภาษาไทยและไฟล์ UTF-8

ไฟล์ข้อความใน repository นี้ควรบันทึกเป็น UTF-8 เสมอ โดยเฉพาะ `.md`, `.js`, `.jsx`, `.sql`, `.json`, `.css` และ `.html`

บน Windows terminal บางตัวอาจแสดงภาษาไทยเป็น mojibake แม้ไฟล์จริงเป็น UTF-8 ให้ใช้วิธีใดวิธีหนึ่งก่อนอ่านไฟล์:

```powershell
chcp 65001
Get-Content -Encoding utf8 .\PROJECT_DOCUMENTATION_TH.md
```

หรือใน PowerShell 7 ขึ้นไป:

```powershell
Get-Content -Encoding utf8NoBOM .\PROJECT_DOCUMENTATION_TH.md
```

กติกาของ repository:

- `.editorconfig` กำหนด charset เป็น UTF-8 สำหรับ editor ที่รองรับ
- `.gitattributes` กำหนดไฟล์ข้อความให้ normalize เป็น UTF-8/LF และกันไฟล์ binary เช่น `.docx`, `.pdf`, รูปภาพ และ font ไม่ให้ Git treat เป็น text
- ถ้าต้องตรวจ encoding ให้ดูผ่าน editor ที่รองรับ UTF-8 หรือใช้ `Get-Content -Encoding utf8`
