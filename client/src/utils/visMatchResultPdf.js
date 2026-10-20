import { rgb } from 'pdf-lib';
import { attempts, playerPoints } from './visReportData.js';
import { buildMatchResult } from './visMatchResult.js';

export function appendMatchResultPages(pdf, font, data, report, drawText) {
    const teams = buildMatchResult(data, report), pages = [];
    const W = 595.28, H = 841.89, M = 26, gap = 8, half = (W - M * 2 - gap) / 2;
    const ink = rgb(0.1, 0.15, 0.22), blue = rgb(0.08, 0.2, 0.55), grey = rgb(0.75, 0.77, 0.8), pale = rgb(0.94, 0.95, 0.97);
    const match = report.match;
    const label = player => player.name || [player.first_name, player.last_name].filter(Boolean).join(' ') || `#${player.number}`;
    const chunks = Math.max(1, ...teams.map(team => Math.ceil(team.roster.length / 14)));
    for (let chunk = 0; chunk < chunks; chunk++) {
        const page = pdf.addPage([W, H]); pages.push(page);
        const text = (value, x, y, size = 8, color = ink, maxWidth) => {
            let content = String(value ?? '-'), fontSize = size;
            if (maxWidth) {
                while (fontSize > 5.5 && font.widthOfTextAtSize(content, fontSize) > maxWidth) fontSize -= 0.25;
                if (font.widthOfTextAtSize(content, fontSize) > maxWidth) {
                    while (content.length && font.widthOfTextAtSize(content + '...', fontSize) > maxWidth) content = content.slice(0, -1);
                    content += '...';
                }
            }
            drawText(page, content, x, H - y - fontSize, fontSize, color);
        };
        const box = (x, y, w, h, fill) => page.drawRectangle({ x, y: H - y - h, width: w, height: h, borderWidth: 0.4, borderColor: grey, ...(fill ? { color: fill } : {}) });
        const cell = (value, x, y, w, h = 14, fill, color = ink, size = 7.5) => { box(x, y, w, h, fill); text(value, x + 3, y + 3, size, color, w - 6); };
        text(`Volleyball - Match Result (P2)${chunk ? ' / Continued' : ''}`, M, 22, 18);
        text(match.competition_name || match.competition_title || '-', M, 48, 11, ink, W - M * 2);
        text([match.round_name, match.pool_name, match.age_group_name, match.gender].filter(Boolean).join(' | ') || '-', M, 66, 9);
        box(M, 88, half, 62); box(M + half + gap, 88, half, 62);
        const date = match.match_date || match.start_time;
        const formattedDate = date && !Number.isNaN(new Date(date).getTime()) ? new Date(date).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' }) : '-';
        text(`Match: ${match.match_number || match.id}    Date: ${formattedDate}`, M + 4, 92, 8);
        text(`City: ${match.city || '-'}    Spectators: ${match.spectators ?? '-'}`, M + 4, 106, 8, ink, half - 8);
        text(`Hall: ${match.stadium_name || match.venue || match.location || '-'}`, M + 4, 120, 8, ink, half - 8);
        text(`Match duration: ${match.duration_minutes != null ? match.duration_minutes + ' min' : '-'}`, M + 4, 134, 8);
        const scoreX = M + half + gap, widths = [84, 30, 25, 25, 25, 25, 25, half - 239];
        let sx = scoreX;
        ['Teams', 'Sets', '1', '2', '3', '4', '5', 'Total'].forEach((v, i) => { cell(v, sx, 88, widths[i], 16, pale); sx += widths[i]; });
        teams.forEach((team, i) => {
            sx = scoreX;
            [match[`${team.key}_team_code`] || team.name, report.wins[team.key], ...Array.from({ length: 5 }, (_, n) => report.sets.find(set => set.number === n + 1)?.[team.key] ?? '-'), team.totalPoints ?? '-'].forEach((v, j) => { cell(v, sx, 104 + i * 15, widths[j], 15); sx += widths[j]; });
        });
        text('Set durations (min): ' + Array.from({ length: 5 }, (_, n) => {
            const set = (data.sets || []).find(set => Number(set.set_number) === n + 1);
            if (set?.duration_minutes != null) return set.duration_minutes;
            const elapsed = new Date(set?.end_time) - new Date(set?.start_time);
            return Number.isFinite(elapsed) && elapsed >= 0 ? Math.round(elapsed / 60000) : '-';
        }).join(' / '), scoreX + 4, 136, 7.5, ink, half - 8);
        box(M, 157, W - M * 2, 18);
        const referee = n => [match[`r${n}_firstname`], match[`r${n}_lastname`]].filter(Boolean).join(' ') || '-';
        text(`Referees: R1 ${referee(1)}    R2 ${referee(2)}`, M + 4, 162, 8, ink, W - M * 2 - 8);
        teams.forEach((team, index) => {
            const x = M + index * (half + gap), start = 184;
            cell(team.name, x, start, half, 18, pale, blue, 10);
            const columns = [15, 20, half - 15 - 20 - 100 - 24, ...Array(10).fill(10), 24];
            let cx = x;
            ['No', 'Pos', 'Name', 'L1', 'L2', 'L3', 'L4', 'L5', 'P1', 'P2', 'P3', 'P4', 'P5', 'Total'].forEach((v, i) => { cell(v, cx, start + 18, columns[i], 16, pale, ink, 6); cx += columns[i]; });
            for (let row = 0; row < 14; row++) {
                const p = team.roster[chunk * 14 + row], yy = start + 34 + row * 15;
                cx = x;
                const values = p ? [p.number, p.position || '-', label(p), ...p.lineup.map(slot => slot.value), ...p.setPoints.map((points, n) => report.sets.some(set => set.number === n + 1) ? points : '-'), p.count ? playerPoints(p.stats) : '-'] : Array(14).fill('');
                values.forEach((v, i) => { const starter = p && i >= 3 && i < 8 && p.lineup[i - 3].starter; cell(v, cx, yy, columns[i], 15, starter ? blue : undefined, starter ? rgb(1, 1, 1) : ink, i >= 3 && i < 13 ? 6.5 : 7); cx += columns[i]; });
            }
            cell(`Coach: ${match[`${team.key}_coach_name`] || '-'}`, x, start + 244, half, 15);
            cell(`Assistants: ${match[`${team.key}_assistant_coach_name`] || '-'}`, x, start + 259, half, 15);
        });
        text('TEAMS AND PLAYERS PERFORMANCES', M + 115, 470, 12);
        const middle = 66, side = (W - M * 2 - middle) / 2;
        teams.forEach((team, index) => {
            const x = index ? M + side + middle : M;
            [31, 38, side - 69].reduce((cx, w, i) => { cell(['Won', 'Attempts', 'No / Name'][i], cx, 490, w, 18, pale); return cx + w; }, x);
            team.performance.forEach((item, n) => {
                const rows = [{ name: 'Total Team', won: team.count ? item.won : '-', count: team.count ? item.attempts : '-' }, ...item.top.map(p => ({ name: `${p.number} ${label(p)}`, won: p.stats[item.skill]['#'], count: attempts(p.stats, item.skill) }))];
                for (let r = 0; r < 4; r++) {
                    const row = rows[r]; let cx = x;
                    [row?.won ?? '', row?.count ?? '', row?.name ?? ''].forEach((v, i) => { const w = [31, 38, side - 69][i]; cell(v, cx, 508 + n * 48 + r * 12, w, 12, undefined, ink, 7); cx += w; });
                }
            });
            cell(team.count ? team.opponentErrors : '-', x, 652, 31, 14); cell('', x + 31, 652, 38, 14); cell('Total Team', x + 69, 652, side - 69, 14);
            cell(team.count ? playerPoints(team.stats) : '-', x, 666, 31, 14); cell(team.count ? team.performance.reduce((sum, item) => sum + item.attempts, 0) : '-', x + 31, 666, 38, 14); cell('Total Team', x + 69, 666, side - 69, 14);
            for (let n = 0; n < 3; n++) {
                const p = team.best[n];
                cell(p ? playerPoints(p.stats) : '', x, 690 + n * 14, 31, 14);
                cell(p ? `A:${p.stats.A['#']} B:${p.stats.B['#']} S:${p.stats.S['#']}` : '', x + 31, 690 + n * 14, 68, 14, undefined, ink, 6.5);
                cell(p ? `${p.number} ${label(p)}` : '', x + 99, 690 + n * 14, side - 99, 14, undefined, ink, 7);
            }
        });
        ['Scoring Skills', 'Spike', 'Block', 'Serve', 'Opp. Error', 'Total', 'Best Scorer'].forEach((v, index) => {
            const ys = [490, 508, 556, 604, 652, 666, 690], hs = [18, 48, 48, 48, 14, 14, 42];
            cell(v, M + side, ys[index], middle, hs[index], pale, ink, 8);
        });
        text('L1-L5: ตำแหน่งเริ่มเซต (ช่องสีน้ำเงิน) / หมายเลขผู้เล่นที่ลงแทน | P1-P5: คะแนนรายเซต', M, 741, 7, ink, W - M * 2);
        text('- = ไม่ปรากฏข้อมูล | ข้อมูลการทำคะแนนและจำนวนครั้งอ้างอิงรายการ VIS ที่บันทึก', M, 753, 7, ink, W - M * 2);
        text(`Game jury president: ${match.jury_president_name || '-'}     Signature: ____________________`, M + 150, 775, 8, ink, W - M * 2 - 150);
    }
    return pages;
}
