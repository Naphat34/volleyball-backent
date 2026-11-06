// Local fixture preview only; never reads or updates a live match.
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { appendVisReportPages } from '../src/utils/vis/visReportPdf.js';

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const regular = await readFile(new URL('../public/fonts/Sarabun-Regular.ttf', import.meta.url));
const bold = await readFile(new URL('../public/fonts/Sarabun-Bold.ttf', import.meta.url));
const font = await pdf.embedFont(regular), boldFont = await pdf.embedFont(bold);
const assets = {};
for (const [key, name] of [['competition', 'competition-logo'], ['association', 'association-logo'], ['partners', 'partners']]) {
    assets[key] = await pdf.embedPng(await readFile(new URL(`../public/reports/p2/${name}.png`, import.meta.url)));
}
const roster = (base, count) => Array.from({ length: count }, (_, i) => ({ id: base + i, number: i + 1, first_name: 'นักกีฬา', last_name: `ทดสอบ ${i + 1}`, position: i === 0 ? 'MB' : i === 5 ? 'OH' : '', is_captain: i === 5 }));
const homePlayers = roster(100, 12), awayPlayers = roster(200, 10), events = [];
for (let set = 1; set <= 3; set++) {
    for (const [teamId, players] of [[10, homePlayers], [20, awayPlayers]]) {
        for (const skill of ['A', 'B', 'S']) {
            for (let i = 0; i < 12; i++) events.push({ id: events.length + 1, team_id: teamId, player_id: players[i % 6].id, set_id: set, skill, grade: i % (skill === 'B' ? 3 : 4) === 0 ? '#' : '+' });
        }
    }
}
events.push({ id: events.length + 1, team_id: 10, set_id: 2, skill: 'SUBSTITUTION', details: { playerOut: 100, playerIn: 106 } });
const data = {
    match: { id: 2, match_number: 2, competition_name: "Prime Minister's Youth CUP Volleyball U15", region_name: 'ระดับภูมิภาค', zone_name: 'โซน 12 ภาคใต้ 2', round_name: 'รอบแบ่งสาย A', pool_name: 'A', city: 'จ.พัทลุง',
        home_team_id: 10, away_team_id: 20, home_team_name: 'โรงเรียนอนุบาลท่าแพพัฒนา', away_team_name: 'โรงเรียนอามานะวิทยานุสรณ์ สังกัด เอกชน', home_team_code: 'ANBM', away_team_code: 'AWNM',
        match_date: '2026-10-25', start_time: '12:31:00', end_time: '13:29:00', duration_minutes: 58, location: 'โรงยิม 1000 ที่นั่งสนามกีฬากลาง องค์การบริหารส่วนจังหวัดพัทลุง',
        status: 'completed', home_set_score: 3, away_set_score: 0, home_coach_name: 'ผู้ฝึกสอน ทดสอบ', home_assistant_coach_name: 'ผู้ช่วย ทดสอบ', away_coach_name: 'ผู้ฝึกสอน ทดสอบ' },
    homePlayers, awayPlayers, events,
    sets: [23, 14, 12].map((score, i) => ({ set_number: i + 1, home_score: 25, away_score: score, duration_minutes: [21, 14, 13][i], end_time: '2026-10-25T06:29:00Z' })),
    lineups: [1, 2, 3].flatMap(set => [[10, homePlayers], [20, awayPlayers]].map(([team, players]) => ({ team_id: team, set_number: set, ...Object.fromEntries(players.slice(0, 6).map((player, i) => [`player_id_p${i + 1}`, player.id])) }))),
};
appendVisReportPages(pdf, font, data, { resultOnly: true, fontLayout: fontkit.create(regular), boldFont, boldLayout: fontkit.create(bold), p2Assets: assets, exportedAt: new Date('2026-10-27T04:48:00+07:00'), p2Footer: 'VOLLEY VIS - Layout preview / ข้อมูลตัวอย่างตรวจรูปแบบ' });
const directory = new URL('../../output/pdf/', import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL('P-2-layout-preview.pdf', directory), await pdf.save());
console.log('Created output/pdf/P-2-layout-preview.pdf');
