import { rgb } from 'pdf-lib';
import { attempts, playerPoints } from './visReportData.js';
import { buildMatchResult } from './visMatchResult.js';

const BLACK = rgb(0, 0, 0), WHITE = rgb(1, 1, 1), GREY = rgb(.89, .89, .89), LIGHT = rgb(.76, .76, .76);
const clean = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ');
const playerName = p => p.name_th || p.name || [p.first_name, p.last_name].filter(Boolean).join(' ') || `#${p.number}`;
const duration = minutes => Number.isFinite(minutes) && minutes >= 0 ? `${Math.floor(Math.round(minutes) / 60)}:${String(Math.round(minutes) % 60).padStart(2, '0')}` : '';
const elapsed = set => set?.duration_minutes != null ? Number(set.duration_minutes) : set?.start_time && set?.end_time ? Math.round((new Date(set.end_time) - new Date(set.start_time)) / 60000) : NaN;
const clock = value => !value ? '' : /^\d{1,2}:\d{2}/.test(String(value)) ? String(value).slice(0, 5) : Number.isNaN(new Date(value).getTime()) ? '' : new Date(value).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

export function appendMatchResultPages(pdf, font, data, report, drawText, options = {}) {
    const teams = buildMatchResult(data, report), match = report.match, pages = [];
    const W = 595.28, H = 841.89, M = 23, width = W - M * 2, gap = 9, half = (width - gap) / 2;
    const chunks = Math.max(1, ...teams.map(team => Math.ceil(team.roster.length / 14)));
    const rowCount = Math.max(12, Math.min(14, Math.max(...teams.map(team => team.roster.length))));
    const stamp = (options.exportedAt || new Date()).toLocaleString('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    for (let chunk = 0; chunk < chunks; chunk++) {
        const page = pdf.addPage([W, H]); pages.push(page);
        const line = (x1, y1, x2, y2, thickness = .8, color = BLACK, dashArray) => page.drawLine({ start: { x: x1, y: H - y1 }, end: { x: x2, y: H - y2 }, thickness, color, ...(dashArray ? { dashArray } : {}) });
        const box = (x, y, w, h, fill, stroke = .8, color = BLACK) => page.drawRectangle({ x, y: H - y - h, width: w, height: h, borderWidth: stroke, borderColor: color, ...(fill ? { color: fill } : {}) });
        const text = (value, x, y, size = 8, bold = false, maxWidth = width, align = 'left', color = BLACK) => {
            let content = clean(value), fs = size;
            const face = bold && options.boldFont ? options.boldFont : font;
            while (fs > 5.5 && face.widthOfTextAtSize(content, fs) > maxWidth) fs -= .2;
            const parts = Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(content), part => part.segment);
            while (parts.length && face.widthOfTextAtSize(parts.join(''), fs) > maxWidth) { parts.pop(); content = parts.join('') + '...'; if (face.widthOfTextAtSize(content, fs) <= maxWidth) break; }
            const tw = face.widthOfTextAtSize(content, fs);
            drawText(page, content, x + (align === 'center' ? (maxWidth - tw) / 2 : align === 'right' ? maxWidth - tw : 0), H - y - fs, fs, color, bold);
        };
        const centered = (value, x, y, w, size = 8, bold = false, color = BLACK) => text(value, x, y, size, bold, w, 'center', color);
        const image = (asset, x, y, w, h) => { if (asset) page.drawImage(asset, { x, y: H - y - h, width: w, height: h }); };
        image(options.p2Assets?.competition, M, 24, 100, 50);
        image(options.p2Assets?.association, W - M - 46, 25, 46, 47);
        centered(match.competition_name || match.competition_title || 'VOLLEYBALL', M + 90, 24, width - 180, 13.5, true);
        box(W / 2 - 37, 45, 22, 12);
        centered('P-2', W / 2 - 37, 45.5, 22, 8.5, true);
        text('Match result', W / 2 - 9, 45, 9);
        centered(['ใบบันทึกผลการแข่งขัน', match.region_name || match.division || match.age_group_name, match.zone_name, match.round_name].filter(Boolean).join(' · ') + (chunk ? ` (ต่อ ${chunk + 1})` : ''), M + 55, 60, width - 110, 8);

        const infoW = 285, scoreX = M + infoW + 5, scoreW = width - infoW - 5;
        box(M, 78, infoW, 56);
        const day = match.match_date && !Number.isNaN(new Date(match.match_date).getTime()) ? new Date(match.match_date).toLocaleDateString('en-GB', { timeZone: 'Asia/Bangkok' }) : '-';
        text(`Match: ${match.match_number || match.id || '-'}   Date: ${day}`, M + 4, 80, 8, true, 175);
        text(`Spectators: ${match.spectators ?? ''}`, M + 180, 80, 8, true, 101);
        text(`Pool: ${match.pool_name || '-'}`, M + 4, 94, 8, true, 170);
        text(`Round: ${match.round_name || '-'}`, M + 180, 94, 8, false, 101);
        text(`City: ${match.city || '-'}   Hall: ${match.stadium_name || match.venue || match.location || '-'}`, M + 4, 108, 8, false, infoW - 8);
        const timedSets = (data.sets || []).filter(set => set.start_time && set.end_time);
        const savedTimes = report.visTiming?.sets || [];
        const start = savedTimes[0]?.startedAt || match.actual_start_time || timedSets[0]?.start_time || match.start_time;
        const end = savedTimes.at(-1)?.endedAt || match.actual_end_time || match.end_time || timedSets.at(-1)?.end_time;
        const setMinutes = number => {
            const saved = savedTimes.find(set => set.set === number);
            return saved?.durationSeconds != null ? saved.durationSeconds / 60 : elapsed((data.sets || []).find(set => Number(set.set_number) === number));
        };
        const finishedSets = report.sets.filter(set => set.finished);
        const allTimed = finishedSets.length && finishedSets.every(set => Number.isFinite(setMinutes(set.number)));
        const restMinutes = finishedSets.filter(set => set.number + 1 !== Number(match.max_sets || 5) && finishedSets.some(next => next.number === set.number + 1)).length * 3;
        const totalDuration = allTimed ? finishedSets.reduce((sum, set) => sum + setMinutes(set.number), 0) + restMinutes
            : match.duration_minutes != null ? Number(match.duration_minutes) : NaN;
        text(`Match duration: Start: ${clock(start) || '-'}  End: ${clock(end) || '-'}  Total: ${duration(totalDuration) || '-'}`, M + 4, 122, 8, true, infoW - 8);
        const sw = [58, 27, ...Array(5).fill(28), scoreW - 225], sx = [scoreX];
        sw.forEach(w => sx.push(sx.at(-1) + w));
        box(scoreX, 78, scoreW, 56);
        for (let r = 1; r < 4; r++) line(scoreX, 78 + r * 14, scoreX + scoreW, 78 + r * 14);
        for (let c = 1; c < sw.length; c++) line(sx[c], 78, sx[c], c === 1 ? 120 : 134, .6);
        ['Teams', 'Sets', '1', '2', '3', '4', '5', 'Total'].forEach((v, c) => centered(v, sx[c], 80, sw[c], 8, true));
        teams.forEach((team, r) => [match[`${team.key}_team_code`] || team.name, report.wins[team.key], ...Array.from({ length: 5 }, (_, i) => report.sets.find(set => set.number === i + 1)?.[team.key] ?? ''), team.totalPoints ?? ''].forEach((v, c) => {
            if (!c) text(v, sx[c] + 3, 94 + r * 14, 8, true, sw[c] - 6);
            else centered(v, sx[c], 94 + r * 14, sw[c], 8, c >= 2 && c <= 6 && Number(v) > Number(report.sets.find(set => set.number === c - 1)?.[teams[1 - r].key]));
        }));
        text('Duration:', scoreX + 3, 122, 8, true, 75);
        Array.from({ length: 5 }, (_, i) => centered(duration(setMinutes(i + 1)), sx[i + 2], 122, sw[i + 2], 8));
        const minutes = Array.from({ length: 5 }, (_, i) => setMinutes(i + 1)).filter(Number.isFinite);
        centered(minutes.length ? duration(minutes.reduce((sum, v) => sum + v, 0)) : '', sx[7], 122, sw[7], 8, true);
        box(M, 139, width, 14); line(M + 71, 139, M + 71, 153);
        text('Referees:', M + 4, 141, 8, true);
        const referee = n => [match[`r${n}_firstname`], match[`r${n}_lastname`]].filter(Boolean).join(' ');
        text(`1st: ${referee(1)}    2nd: ${referee(2)}`, M + 75, 141, 8, true, width - 80);

        teams.forEach((team, index) => {
            const x = M + index * (half + gap), top = 159, rowsTop = 201, rowH = 150 / rowCount, staffTop = 351;
            const nameW = half - 148, posW = 18, slotW = 11.2, totalW = 18;
            box(x, top, half, 227);
            centered([match[`${team.key}_team_code`], team.name].filter(Boolean).join(' - '), x + 3, top + 4, half - 6, 10.5, true);
            line(x, 180, x + half, 180); line(x, rowsTop, x + half, rowsTop); line(x, staffTop, x + half, staffTop);
            const lineX = x + nameW + posW, pointsX = lineX + 5 * slotW;
            [lineX, pointsX, pointsX + 5 * slotW].forEach(cx => line(cx, 180, cx, staffTop));
            text('No Name', x + 4, 185, 7.5, true, nameW - 4); centered('Pos.', x + nameW, 185, posW, 7, true);
            centered('Line-up', lineX, 180, 5 * slotW, 7.5, true); centered('Points by set', pointsX, 180, 5 * slotW, 7.5, true);
            centered('T.', pointsX + 5 * slotW, 185, totalW, 7.5, true);
            line(lineX, 190.5, pointsX + 5 * slotW, 190.5, .4);
            for (let i = 0; i < 5; i++) {
                centered(i + 1, lineX + i * slotW, 191, slotW, 7, true); centered(i + 1, pointsX + i * slotW, 191, slotW, 7, true);
                if (i) { line(lineX + i * slotW, 190.5, lineX + i * slotW, staffTop, .25, LIGHT, [1, 1]); line(pointsX + i * slotW, 190.5, pointsX + i * slotW, staffTop, .25, LIGHT, [1, 1]); }
            }
            for (let row = 0; row < rowCount; row++) {
                const player = team.roster[chunk * 14 + row], yy = rowsTop + row * rowH;
                if (row) line(x, yy, x + half, yy, .25, LIGHT, [1, 1]);
                if (!player) continue;
                const captain = player.is_captain ? ' (C)' : '';
                text(`${player.number}  ${playerName(player)}${captain}`, x + 4, yy + 1, 7.5, false, nameW - 5);
                centered(player.position || '', x + nameW, yy + 1, posW, 7);
                player.lineup.forEach((slot, i) => {
                    const xx = lineX + i * slotW;
                    if (slot.starter) { box(xx, yy, slotW, rowH, BLACK, 0); centered(slot.value, xx, yy + 1, slotW, 7, true, WHITE); }
                    else if (slot.value !== '-') { box(xx + 1.3, yy + 1.3, slotW - 2.6, rowH - 2.6, WHITE, .65); centered(slot.value, xx, yy + 1, slotW, 7, true); }
                });
                player.setPoints.forEach((points, i) => { if (points) centered(points, pointsX + i * slotW, yy + 1, slotW, 7); });
                if (playerPoints(player.stats)) centered(playerPoints(player.stats), pointsX + 5 * slotW, yy + 1, totalW, 7.5, true);
            }
            [['Head Coach:', match[`${team.key}_coach_name`]], ['Assistant:', match[`${team.key}_assistant_coach_name`]], ['2nd Assistant:', match[`${team.key}_second_assistant_coach_name`]]].forEach(([label, value], i) => {text(label, x + 4, staffTop + 2 + i * 10, 7.5, true, 70);text(value || '', x + 73, staffTop + 2 + i * 10, 7.5, false, half - 77);});
        });
        centered('TEAMS AND PLAYERS PERFORMANCES', M, 394, width, 12, true);
        const centerW = 72, sideW = (width - centerW) / 2, headY = 413, headerH = 21;
        const perfCols = [44, 44, sideW - 88];
        const sideXs = [M, M + sideW + centerW], midX = M + sideW;
        box(M, headY, width, headerH, GREY);
        sideXs.forEach(x => {line(x + 44, headY, x + 44, headY + headerH);line(x + 88, headY, x + 88, headY + headerH);centered('Won', x, headY + 1, 44, 7.5, true);centered('Points', x, headY + 10, 44, 7.5, true);centered('Total', x + 44, headY + 1, 44, 7.5, true);centered('Atts', x + 44, headY + 10, 44, 7.5, true);text('No Name', x + 90, headY + 6, 7.5, true);});
        line(midX, headY, midX, headY + headerH);line(midX + centerW, headY, midX + centerW, headY + headerH);
        centered('Scoring', midX, headY + 1, centerW, 7.5, true);centered('Skills', midX, headY + 10, centerW, 7.5, true);
        const perfRow = (team, x, yy, won, count, name, bold = false) => {centered(won, x, yy + 1, perfCols[0], 7.5, bold);centered(count, x + 44, yy + 1, perfCols[1], 7.5, bold);text(name, x + 90, yy + 1, 7.5, bold, perfCols[2] - 4);};
        let yy = headY + headerH;
        ['Attack', 'Block', 'Serve'].forEach((label, skillIndex) => {
            const rowN = Math.max(skillIndex === 1 ? 3 : 4, ...teams.map(team => team.performance[skillIndex].top.length + 1)), h = rowN * 11;
            box(M, yy, width, h);[M + 44, M + 88, midX, midX + centerW, sideXs[1] + 44, sideXs[1] + 88].forEach(cx => line(cx, yy, cx, yy + h));
            centered(label, midX, yy + h / 2 - 5, centerW, 8.5, true);
            teams.forEach((team, i) => {const item = team.performance[skillIndex];perfRow(team, sideXs[i], yy, team.count ? item.won : '', team.count ? item.attempts : '', 'Total Team', true);item.top.forEach((p, r) => perfRow(team, sideXs[i], yy + (r + 1) * 11, p.stats[item.skill]['#'], attempts(p.stats, item.skill), `${p.number}  ${playerName(p)}`));});
            yy += h;
        });
        for (const [label, total] of [['Opp. error', false], ['Total', true]]) {
            box(M, yy, width, 13);[M + 44, M + 88, midX, midX + centerW, sideXs[1] + 44, sideXs[1] + 88].forEach(cx => line(cx, yy, cx, yy + 13));centered(label, midX, yy + 1, centerW, 8, true);
            teams.forEach((team, i) => perfRow(team, sideXs[i], yy, total ? team.totalPoints ?? (team.count ? playerPoints(team.stats) + team.opponentErrors : '') : team.count ? team.opponentErrors : '', total && team.count ? team.performance.reduce((sum, item) => sum + item.attempts, 0) : '', 'Total Team', true));yy += 13;
        }
        yy += 4;
        box(M, yy, width, 33);[M + 44, M + 88, midX, midX + centerW, sideXs[1] + 44, sideXs[1] + 88].forEach(cx => line(cx, yy, cx, yy + 33));centered('Best scorers', midX, yy + 11, centerW, 8.5, true);
        teams.forEach((team, i) => team.best.forEach((p, r) => perfRow(team, sideXs[i], yy + r * 11, playerPoints(p.stats), ['A', 'B', 'S'].reduce((sum, skill) => sum + attempts(p.stats, skill), 0), `${p.number}  ${playerName(p)}`)));
        yy += 39;
        box(M, yy + 1, 4, 4, BLACK, .4);text('Starting line-up with position', M + 6, yy, 6.5);
        box(M, yy + 11, 4, 4, WHITE, .4);text('Substitute with shirt number', M + 6, yy + 10, 6.5);
        [['Atts = Attempts', 'Opp. = Opponent'], ['(C) = Captain', '(L) / L = Libero'], ['MB = Middle blocker', 'OP = Opposite'], ['S = Setter', 'OH = Outside Hitter']].forEach((items, i) => items.forEach((v, r) => text(v, M + [137, 236, 329, 450][i], yy + r * 10, 6.3)));
        image(options.p2Assets?.partners, W / 2 - 126, 764, 252, 42.56);
        line(M, 816, W - M, 816, .7);
        text(options.p2Footer || 'VOLLEY VIS', M, 818, 6.5);
        centered(stamp, W / 2 - 90, 818, 180, 6.5);
        text(`Page ${chunk + 1} of ${chunks}`, W - M - 65, 818, 6.5, false, 65, 'right');
    }
    return pages;
}
