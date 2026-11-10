import { translations } from './translations.js';
import { applicationCopy, remainingCopy } from './applicationCopy.js';
import { additionalCopy } from './additionalCopy.js';
import { normalizeLanguage } from './language.js';
import { visUiEnglish } from '../vis/visUiTranslations.js';
import { translateScorerUi } from '../scorer/scorerUiTranslations.js';

const normalize = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
const dictionary = new Map();
const add = (THA, ENG) => {
    if (typeof THA !== 'string' || typeof ENG !== 'string') return;
    const entry = { THA, ENG };
    dictionary.set(normalize(THA), entry);
    if (!/^\{\d+\}$/.test(ENG.trim())) dictionary.set(normalize(ENG), entry);
};
const addTree = (thai, english) => {
    for (const [key, value] of Object.entries(thai || {})) {
        if (typeof value === 'string') add(value, english?.[key]);
        else if (value && typeof value === 'object') addTree(value, english?.[key]);
    }
};
for (const line of `${applicationCopy}\n${remainingCopy}`.trim().split('\n')) {
    if (line.trim()) add(...line.split('|'));
}
for (const [thai, english] of additionalCopy) add(thai, english);
addTree(translations.THA, translations.ENG);
for (const [thai, english] of Object.entries(visUiEnglish)) add(thai, english);
add('ทีม {0} ขอเวลานอก', 'Team {0} requested a time out.');
add('ออก #{0} -> เข้า #{1}', 'OUT #{0} -> IN #{1}');
add('กำลังรอรายละเอียดการเปลี่ยนตัว', 'Substitution details are pending.');
add('ทีม {0} ขอเปลี่ยนตัว\n{1}', 'Team {0} requested a substitution.\n{1}');
add('ทีม {0} ขอชาลเลนจ์วิดีโอ\nเหตุผล: {1}\nจังหวะ: {2}', 'Team {0} requested a video challenge.\nReason: {1}\nAction: {2}');
add('กำลังรอการเลือกจังหวะ', 'Action selection pending');
add('ไม่ระบุ', 'N/A');
add('ลองโหลดหน้าใหม่แล้วลองอีกครั้ง', 'Please reload and try again.');
const aliases = {
    'กำลังเปิดหน้า / Loading page…': 'Loading page…',
    'เปิดหน้านี้ไม่สำเร็จ / Unable to open this page': 'Unable to open this page',
    'รายชื่อนักกีฬา (Match Rosters)': 'Player roster',
    'เจ้าหน้าที่ทีม (Team Staff)': 'Team Staff',
    'รุ่น/ประเภท:': 'Category:',
    'ประวัติการเปลี่ยนตัวเซตนี้ (Substitutions in this set)': 'Substitutions in this set',
    'Volley Manager || สงวนลิขสิทธิ์ ชมรมกีฬาวอลเลย์บอลแห่งจังหวัดพัทลุง': 'Volley Manager · Copyright Phatthalung Provincial Volleyball Association',
    'กำลังโหลดข้อมูลการตั้งค่าการแข่งขัน / Loading setup details...': 'Loading setup details...',
    'กำลังบันทึกข้อมูลการตั้งค่า / Saving setup details...': 'Saving setup details...',
    'บันทึกข้อมูลการแข่งขันเรียบร้อยแล้ว / Setup details saved successfully.': 'Setup details saved successfully.',
    'Preview O-2 ประเภท': 'Preview O-2 category',
    'คำขอได้รับการอนุมัติ (Approved)': 'Request approved',
    'คำขอถูกปฏิเสธ (Rejected)': 'Request rejected',
    'มีรายชื่อทั้งสองทีม / Rosters available': 'Rosters available',
    'ตรวจรายชื่อก่อนพิมพ์ / Review missing rosters': 'Review missing rosters',
    '{0} {1} (Libero - ไม่สามารถเริ่มเป็นตัวจริงได้)': '{0} {1} (Libero - cannot start)',
    '{0} {1} (Libero - ไม่สามารถเปลี่ยนตัวในโหมดปกติได้)': '{0} {1} (Libero - regular substitution unavailable)',
    'Nom et emblème de la compétition (incluant sexe et catégorie)': 'COMPETITION NAME (INCLUDING SEX AND CATEGORY) + LOGO',
    'Rapport de résultat de match': 'MATCH RESULT REPORT',
    'ลองโหลดหน้าใหม่ / Please reload and try again.': 'Please reload and try again.',
    'ลองใหม่ / Retry': 'Try again',
};

/** Translate authored copy before inserting data. No substring replacement over names. */
export function translateUi(value, language = 'THA', params = []) {
    if (typeof value !== 'string') return value;
    const lang = normalizeLanguage(language);
    const source = aliases[value.trim()] || value;
    if (translateScorerUi(source, 'THA') !== source || translateScorerUi(source, 'ENG') !== source) return translateScorerUi(source, lang, params);
    const indices = [];
    const key = source.replace(/\{(\d+)\}/g, (_, index) => {
        if (!indices.includes(index)) indices.push(index);
        return `{${indices.indexOf(index)}}`;
    });
    const entry = dictionary.get(normalize(key));
    const translated = entry ? entry[lang].replace(/\{(\d+)\}/g, (_, index) => `{${indices[index] ?? index}}`) : source;
    return translated.replace(/\{(\d+)\}/g, (placeholder, index) => index < params.length ? String(params[index] ?? '') : placeholder);
}

export function translateUiMarkup(value, language, params = []) {
    const translated = value.replace(/(^|>)([^<]+)(?=<|$)/g, (_, tag, text) => {
        const key = text.trim();
        return tag + (key ? text.replace(key, translateUi(key, language)) : text);
    });
    return translated.replace(/\{(\d+)\}/g, (placeholder, index) => index < params.length ? String(params[index] ?? '') : placeholder);
}
