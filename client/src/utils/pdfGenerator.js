import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { cleanCompetitionTitle } from '../utils';

/**
 * Helper function: จัดการการส่งออกไฟล์ (ดาวน์โหลด หรือ คืนค่า Data URL)
 */
const handleOutput = async (pdfDoc, filename, save, returnDataUrl) => {
    if (returnDataUrl) {
        const pdfBase64 = await pdfDoc.saveAsBase64({ dataUri: true });
        return pdfBase64;
    }
    
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    
    if (save) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
    }
    
    return pdfBytes; // เผื่อกรณีไม่ได้ระบุอะไร
};

const fetchPdfTemplate = async (url) => {
    // กำหนด headers กรณีที่ไฟล์อยู่ใน API ที่ต้องส่ง Token (ถ้าอยู่ใน public ลบ headers ออกได้ครับ)
    const token = localStorage.getItem('token'); // หรือดึง token ตามระบบของคุณ
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

    const response = await fetch(url, { headers });

    // 1. เช็คว่าดึงไฟล์สำเร็จไหม (Status 200)
    if (!response.ok) {
        throw new Error(`ไม่สามารถโหลดไฟล์ Template ได้: ${url} (Status: ${response.status})`);
    }

    // 2. ป้องกันปัญหาดึงมาแล้วกลายเป็นหน้าเว็บ React/Login (index.html)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
        throw new Error(`เส้นทางไฟล์ ${url} ไม่ถูกต้อง ระบบส่งคืนหน้า HTML/Login กลับมาแทน กรุณาเช็คว่าไฟล์อยู่ในโฟลเดอร์ public จริงๆ`);
    }

    return await response.arrayBuffer();
};

/**
 * 1. Generate FIVB Style Scoresheet PDF (Template Based)
 */
export const generateScoresheetPDF = async (data, options = {}) => {
    const { save = true, returnDataUrl = false } = options;
    const { match, homePlayers = [], awayPlayers = [] } = data;

    try {
        // 1. โหลดไฟล์ Template PDF เปล่า (ต้องวางไฟล์นี้ไว้ในโฟลเดอร์ public)
        const templateBytes = await fetchPdfTemplate('/templates/blank_scoresheet.pdf');
        const pdfDoc = await PDFDocument.load(templateBytes);

        // 2. ฝังฟอนต์ภาษาไทยและอังกฤษ
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = await fetchPdfTemplate('/fonts/Sarabun-Regular.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);

        // 3. เข้าถึงหน้ากระดาษแผ่นแรก
        const page = pdfDoc.getPages()[0];
        const { height } = page.getSize();

        // ฟังก์ชันช่วยเขียนข้อความแบบจัดการสระ/วรรณยุกต์ไทย (Typography Hack without GSUB)
        const drawText = (textStr, startX, y, size = 10) => {
            if (!textStr && textStr !== 0) return;
            const text = String(textStr);
            const zeroAdvanceChars = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ั', '็', '่', '้', '๊', '๋', '์', 'ํ', 'ฺ'];
            const tallConsonants = ['ป', 'ฝ', 'ฟ', 'ฬ'];
            const upperVowels = ['ั', 'ิ', 'ี', 'ึ', 'ื', '็', 'ํ'];
            const toneMarks = ['่', '้', '๊', '๋', '์'];
            const lowerVowels = ['ุ', 'ู'];
            
            let currentX = startX;
            let lastBaseChar = '';
            let hasUpperVowel = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const charWidth = customFont.widthOfTextAtSize(char, size);
                
                let drawX = currentX;
                let drawY = height - y;

                if (zeroAdvanceChars.includes(char)) {
                    // หลบหาง ป ฝ ฟ ฬ
                    if (tallConsonants.includes(lastBaseChar)) {
                        drawX -= size * 0.25; 
                    }
                    // ยกวรรณยุกต์หนีสระบน
                    if (toneMarks.includes(char) && hasUpperVowel) {
                        drawY += size * 0.35; 
                    }
                    // ลดสระล่างหนีหาง ฎ ฏ
                    if (lowerVowels.includes(char) && ['ฎ', 'ฏ'].includes(lastBaseChar)) {
                        drawY -= size * 0.25; 
                    }

                    page.drawText(char, {
                        x: drawX,
                        y: drawY,
                        size: size,
                        font: customFont,
                        color: rgb(0, 0.1, 0.8),
                    });
                    
                    if (upperVowels.includes(char)) {
                         hasUpperVowel = true;
                    }
                } else {
                    lastBaseChar = char;
                    hasUpperVowel = false;

                    page.drawText(char, {
                        x: drawX,
                        y: drawY,
                        size: size,
                        font: customFont,
                        color: rgb(0, 0.1, 0.8),
                    });
                    currentX += charWidth;
                }
            }
        };

        const poolAndRound = [match.pool_name, match.round_name].filter(Boolean).join(' / ');

        // ==========================================
        // --- จัดการ Format วันที่ และ เวลา ก่อนนำไปวาด ---
        // ==========================================
        let displayDate = "";
        let displayTime = "";

        // 1. จัดการวันที่ (DD/MM/YYYY)
        // ใช้ match_date ถ้ามี แต่ถ้าไม่มีให้ดึงจาก start_time
        const rawDate = match.match_date || match.start_time || "";
        if (rawDate) {
            const datePart = rawDate.split('T')[0]; // ตัดเวลาทิ้งเผื่อเป็น ISO String
            const parts = datePart.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                const yearBE = parseInt(year) < 2500 ? parseInt(year) + 543 : year;
                displayDate = `${day}/${month}/${yearBE}`;
            } else {
                displayDate = rawDate; // กันเหนียวกรณีรูปแบบผิดเพี้ยน
            }
        }

        // 2. จัดการเวลา (HH:mm)
        if (match.start_time) {
            if (match.start_time.includes('T')) {
                // ดึงเฉพาะส่วนเวลา (เช่น 17:00) จาก 2026-03-24T17:00:00.000Z
                displayTime = match.start_time.split('T')[1].substring(0, 5);
            } else {
                // ดึงเฉพาะ 5 ตัวแรก (เช่น 10:00) กรณีได้จาก DB มาเป็นเวลาเพียวๆ
                displayTime = match.start_time.substring(0, 5); 
            }
        }

        // ==========================================
        // 4. วางข้อมูลลงบนพิกัด X, Y 
        // ** คุณต้องนำไฟล์ PDF ไปวัดพิกัดแกน X, Y แล้วนำตัวเลขมาใส่ตรงนี้ **
        // ==========================================

        drawText(cleanCompetitionTitle(match.competition_name), 135, 35, 9);
        drawText(match.city, 60, 50, 9);
        drawText(match.country || match.country_code || "THA", 285, 50, 9);
        drawText(displayDate, 350, 50, 9);
        drawText(displayTime, 445, 50, 9);
        drawText(match.home_team_code, 353, 72, 9);
        drawText(match.away_team_code, 430, 72, 9);
        drawText(match.stadium_name || "PAO Phatthalung", 60.5, 61, 9);
        drawText(poolAndRound, 218, 61, 9);
        drawText(match.match_number, 295, 61, 9);

        drawText(match.home_team_code, 683.5, 322.5, 9);
        drawText(match.away_team_code, 752.5, 322.5, 9);
        
        // ตัวอย่างการทำเครื่องหมาย Division / Category
        const genderVal = String(match.competition_gender || match.gender || '').trim().toLowerCase();
        if (genderVal === 'male') drawText('X', 84, 77, 10);
        if (genderVal === 'female') drawText('X', 104, 77, 10);

        const categoryVal = String(match.category || match.competition_category || '').trim().toLowerCase();
        if (categoryVal === 'senior' || categoryVal === '1') drawText('X', 84, 97, 10);
        if (categoryVal === 'youth' || categoryVal === '3') drawText('X', 104, 97, 10);
        if (categoryVal === 'junior' || categoryVal === '2') drawText('X', 124, 97, 10);


        // ------------------------------------------
        // การ Loop ข้อมูลผู้เล่นลงช่อง ROSTER มุมขวาล่าง
        // ------------------------------------------
        const rosterStartY = 342.8;
        const rowHeight = 10.5;

        // 1. แยกพิกัดแกน X ของทีมเหย้า (ซ้าย) และ ทีมเยือน (ขวา)
        // ** หมายเหตุ: คุณอาจจะต้องปรับตัวเลข 750 (awayStartX) ให้ตรงกับช่อง Team B ในไฟล์ PDF ของคุณ **
        const homeStartX = 655;
        const awayStartX = 735; 

        // 2. ฟังก์ชันช่วยจำกัดความยาวชื่อ ป้องกันการล้นทะลุกรอบ
        const formatName = (firstName, lastName, maxLength = 18) => {
            const fullName = `${firstName} ${lastName}`;
            return fullName.length > maxLength ? fullName.substring(0, maxLength) + '...' : fullName;
        };

        // วาดทีมเหย้า (Home)
        homePlayers.forEach((player, index) => {
            if (index >= 12) return; // เกินช่อง
            const currentY = rosterStartY + (index * rowHeight);
            
            // วาดเบอร์เสื้อ (ฟอนต์ขนาด 8)
            drawText(player.number, homeStartX, currentY, 8); 
            // วาดชื่อ (ลดระยะห่างเหลือ +15 และลดฟอนต์ขนาด 7)
            drawText(formatName(player.first_name, player.last_name), homeStartX + 15, currentY, 7); 
        });

        // วาดทีมเยือน (Away)
        awayPlayers.forEach((player, index) => {
            if (index >= 12) return; // เกินช่อง
            const currentY = rosterStartY + (index * rowHeight);
            
            // วาดเบอร์เสื้อ (ฟอนต์ขนาด 8)
            drawText(player.number, awayStartX, currentY, 8); 
            // วาดชื่อ (ลดระยะห่างเหลือ +15 และลดฟอนต์ขนาด 7)
            drawText(formatName(player.first_name, player.last_name), awayStartX + 15, currentY, 7); 
        });
        // 5. บันทึกผลลัพธ์
        const filename = `Scoresheet_Match_${match.match_number || match.id}.pdf`;
        return handleOutput(pdfDoc, filename, save, returnDataUrl);

    } catch (error) {
        console.error("Error generating Scoresheet PDF:", error);
        throw error;
    }

    
};

/**
 * 2. Generate FIVB Style Match Roster PDF (Template Based)
 */
export const generateMatchRosterPDF = async (data, options = {}) => {
    const { save = true, returnDataUrl = false } = options;
    const { match, home, away } = data;

    try {
        // แนะนำให้ทำแบบฟอร์ม Roster เปล่าๆ แล้วโหลดมาใช้เช่นเดียวกันครับ
        const templateBytes = await fetchPdfTemplate('/templates/ROSTER.pdf');
        const pdfDoc = await PDFDocument.load(templateBytes);
        
        pdfDoc.registerFontkit(fontkit);
        const fontBytes = await fetchPdfTemplate('/fonts/Sarabun-Regular.ttf');
        const customFont = await pdfDoc.embedFont(fontBytes);

        const page = pdfDoc.getPages()[0];
        const { height } = page.getSize();

        const drawText = (textStr, startX, y, size = 10) => {
            if (!textStr && textStr !== 0) return;
            const text = String(textStr);
            const zeroAdvanceChars = ['ิ', 'ี', 'ึ', 'ื', 'ุ', 'ู', 'ั', '็', '่', '้', '๊', '๋', '์', 'ํ', 'ฺ'];
            const tallConsonants = ['ป', 'ฝ', 'ฟ', 'ฬ'];
            const upperVowels = ['ั', 'ิ', 'ี', 'ึ', 'ื', '็', 'ํ'];
            const toneMarks = ['่', '้', '๊', '๋', '์'];
            const lowerVowels = ['ุ', 'ู'];
            
            let currentX = startX;
            let lastBaseChar = '';
            let hasUpperVowel = false;

            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                const charWidth = customFont.widthOfTextAtSize(char, size);

                let drawX = currentX;
                let drawY = height - y;

                if (zeroAdvanceChars.includes(char)) {
                    if (tallConsonants.includes(lastBaseChar)) {
                        drawX -= size * 0.25; 
                    }
                    if (toneMarks.includes(char) && hasUpperVowel) {
                        drawY += size * 0.35; 
                    }
                    if (lowerVowels.includes(char) && ['ฎ', 'ฏ'].includes(lastBaseChar)) {
                        drawY -= size * 0.25; 
                    }

                    page.drawText(char, {
                        x: drawX,
                        y: drawY,
                        size: size,
                        font: customFont,
                        color: rgb(0, 0, 0),
                    });
                    
                    if (upperVowels.includes(char)) {
                         hasUpperVowel = true;
                    }
                } else {
                    lastBaseChar = char;
                    hasUpperVowel = false;

                    page.drawText(char, {
                        x: drawX,
                        y: drawY,
                        size: size,
                        font: customFont,
                        color: rgb(0, 0, 0),
                    });
                    currentX += charWidth;
                }
            }
        };
        // ==========================================
        // --- จัดการ Format วันที่ และ เวลา ก่อนนำไปวาด ---
        // ==========================================
        let displayDate = "";
        let displayTime = "";

        // 1. จัดการวันที่ (DD/MM/YYYY)
        // ใช้ match_date ถ้ามี แต่ถ้าไม่มีให้ดึงจาก start_time
        const rawDate = match.match_date || match.start_time || "";
        if (rawDate) {
            const datePart = rawDate.split('T')[0]; // ตัดเวลาทิ้งเผื่อเป็น ISO String
            const parts = datePart.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                const yearBE = parseInt(year) < 2500 ? parseInt(year) + 543 : year;
                displayDate = `${day}/${month}/${yearBE}`;
            } else {
                displayDate = rawDate; // กันเหนียวกรณีรูปแบบผิดเพี้ยน
            }
        }

        // 2. จัดการเวลา (HH:mm)
        if (match.start_time) {
            if (match.start_time.includes('T')) {
                // ดึงเฉพาะส่วนเวลา (เช่น 17:00) จาก 2026-03-24T17:00:00.000Z
                displayTime = match.start_time.split('T')[1].substring(0, 5);
            } else {
                // ดึงเฉพาะ 5 ตัวแรก (เช่น 10:00) กรณีได้จาก DB มาเป็นเวลาเพียวๆ
                displayTime = match.start_time.substring(0, 5); 
            }
        }

        // ==========================================
        // วางข้อมูลลงบนหน้า Roster
        // ** แก้ไขพิกัดให้ตรงกับไฟล์ blank_roster.pdf ของคุณ **
        // ==========================================
        const compName = cleanCompetitionTitle(match.competition_title || match.competition_name || '');
        const maxLength = 50; // ความยาวตัวอักษรคร่าวๆ ก่อนตัดคำ (ปรับได้ตามความกว้างช่อง)
        if (compName.length > maxLength) {
            let splitIndex = compName.lastIndexOf(' ', maxLength);
            if (splitIndex === -1) splitIndex = maxLength; // ถ้าไม่มีเว้นวรรคเลย ให้ตัดคำตรงตัวเลข maxLength เลย
            
            drawText(compName.substring(0, splitIndex), 50, 36.5, 12);
            drawText(compName.substring(splitIndex).trim(), 50, 50.5, 12); // บรรทัดที่ 2 ห่างลงมา 14 px
        } else {
            drawText(compName, 50, 36.5, 12);
        }
        drawText(match.stadium_name || "PAO Phatthalung", 588, 51, 12);
        drawText(match.match_number, 410, 36.9, 12);
        drawText(match.city, 588, 36.5, 12);
        drawText(match.country_code || "THA", 728, 36.5, 12);
        
        drawText(displayDate, 480, 36.5, 12);
        drawText(displayTime, 495, 51, 12);

        drawText(match.home_team_name, 110, 150, 16);
        drawText(match.away_team_name, 490, 150, 16);

        // กรองข้อมูลผู้เล่น
        const homeRegular = home.players.filter(p => p.position !== 'L');
        const startTableY = 190.5;
        const rowH = 20.8;

        homeRegular.forEach((player, i) => {
            if (i >= 12) return;
            const y = startTableY + (i * rowH);
            let pName = `${player.first_name} ${player.last_name}`;
            if (player.is_captain) pName += ' (C)';
            
            drawText(player.number, 75, y, 12);
            drawText(pName, 110, y, 12);
        });

        const awayRegular = away.players.filter(p => p.position !== 'L');
 

        awayRegular.forEach((player, i) => {
            if (i >= 12) return;
            const y = startTableY + (i * rowH);
            let pName = `${player.first_name} ${player.last_name}`;
            if (player.is_captain) pName += ' (C)';
            
            drawText(player.number, 458, y, 12);
            drawText(pName, 490, y, 12);
        });
        

        const filename = `Roster_${match.match_number || 'Match'}.pdf`;
        return handleOutput(pdfDoc, filename, save, returnDataUrl);

    } catch (error) {
        console.error("Error generating Roster PDF:", error);
        throw error;
    }
};
