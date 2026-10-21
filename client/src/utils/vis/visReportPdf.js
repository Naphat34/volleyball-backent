import { rgb, beginText, endText, setFontAndSize, setTextMatrix, showText, setFillingRgbColor, PDFHexString } from 'pdf-lib';
import { attempts, buildVisReport, percentage, playerPoints } from './visReportData.js';
import { describeVisEvent, describeVisGrade, eventDetails, getVisEventCode, visSkillNames } from './visPresentation.js';
import { appendMatchResultPages } from './visMatchResultPdf.js';

const ink = rgb(0.12, 0.18, 0.28);
const muted = rgb(0.38, 0.43, 0.5);
const blue = rgb(0.12, 0.22, 0.35);
const red = rgb(0.52, 0.28, 0.29);
const pale = rgb(0.96, 0.97, 0.98);
const rule = rgb(0.82, 0.85, 0.88);
const white = rgb(1, 1, 1);
const A4 = [595.28, 841.89];
const landscape = [841.89, 595.28];

export function visReportFilename(match, exportedAt = new Date()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(exportedAt);
    const part = type => parts.find(item => item.type === type).value;
    const identifier = Array.from(String(match.match_number || match.id || 'Match'), char => char.charCodeAt(0) < 32 ? '_' : char).join('').replace(/[<>:"/\\|?*]/g, '_');
    return `Vis_match_${identifier}_${part('year')}-${part('month')}-${part('day')}.pdf`;
}

/** Render match statistics using a consistent report header, tables and footer. */
export function appendVisReportPages(pdf, font, data, options = {}) {
    const report = buildVisReport(data);
    const exported = options.exportedAt || new Date();
    const stamp = exported.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const matchNumber = report.match.match_number || report.match.id || '-';
    const documentCode = `VIS-${matchNumber}`;
    const added = [];
    const players = report.teams.flatMap(team => team.players);
    let page, width, height, y, title, pageSize;
    const margin = 32;
    const lineHeight = 15;
    const fontKeys = new Map();
    const clean = value => Array.from(String(value ?? '-').replace(/[\r\n\t]+/g, ' ')).filter(char => char.codePointAt(0) >= 32).join('');
    const segments = value => Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(clean(value)), item => item.segment);
    const wrap = (value, maxWidth, size = 10) => {
        const lines = [];
        let line = '';
        for (const char of segments(value)) {
            if (line && font.widthOfTextAtSize(line + char, size) > maxWidth) { lines.push(line); line = ''; }
            line += char;
        }
        lines.push(line || '-');
        return lines;
    };
    const drawText = (target, value, x, baseline, size, color) => {
        if (!options.fontLayout) {
            target.drawText(clean(value), { x, y: baseline, font, size, color });
            return;
        }
        // pdf-lib encodes glyphs but omits GPOS offsets. Apply fontkit positions
        // explicitly so Thai vowels and tone marks stay attached to their bases.
        if (!fontKeys.has(target)) fontKeys.set(target, target.node.newFontDictionary(font.name, font.ref));
        const run = options.fontLayout.layout(clean(value));
        const scale = size / options.fontLayout.unitsPerEm;
        let cursorX = x, cursorY = baseline;
        const operators = [beginText(), setFontAndSize(fontKeys.get(target), size), setFillingRgbColor(color.red, color.green, color.blue)];
        run.glyphs.forEach((glyph, i) => {
            const position = run.positions[i];
            operators.push(setTextMatrix(1, 0, 0, 1, cursorX + position.xOffset * scale, cursorY + position.yOffset * scale), showText(PDFHexString.of(glyph.id.toString(16).padStart(4, '0'))));
            cursorX += position.xAdvance * scale;
            cursorY += position.yAdvance * scale;
        });
        target.pushOperators(...operators, endText());
    };
    const text = (value, x, top, size = 10, color = ink) => drawText(page, value, x, height - top - size, size, color);
    const rect = (x, top, w, h, color) => page.drawRectangle({ x, y: height - top - h, width: w, height: h, color });
    const paragraph = (value, size = 10, color = ink) => {
        for (const line of wrap(value, width - margin * 2, size)) {
            if (y + lineHeight > height - 48) newPage(title, pageSize, true);
            text(line, margin, y, size, color); y += lineHeight;
        }
    };
    function newPage(nextTitle, size = A4, continuation = false) {
        pageSize = size; title = nextTitle;
        page = pdf.addPage(size); added.push(page);
        [width, height] = size;
        rect(margin, 18, 3, 43, blue);
        text('รายงานสถิติการแข่งขันกีฬาวอลเลย์บอล', margin + 12, 17, 11, blue);
        text('VOLLEYBALL MATCH STATISTICS REPORT', margin + 12, 34, 8, muted);
        text(`${nextTitle}${continuation ? ' (ต่อ)' : ''}`, margin + 12, 48, 17);
        y = 75;
        paragraph(`รายการแข่งขัน: ${report.match.competition_name || report.match.competition_title || 'ไม่ระบุ'} | คู่แข่งขันที่ ${matchNumber}`, 10, muted);
        paragraph(`สถานะรายงาน: ${report.completed ? 'สรุปภายหลังการแข่งขัน' : 'ข้อมูล ณ เวลาจัดทำ'} | จัดทำเมื่อ ${stamp} น. (เวลาไทย)`, 9, muted);
        page.drawLine({ start: { x: margin, y: height - y - 2 }, end: { x: width - margin, y: height - y - 2 }, color: rule, thickness: 0.6 });
        y += 8;
    }
    function table(headers, rows, widths, size = 10, compact = false) {
        const leading = compact ? 13 : lineHeight;
        const padding = compact ? 8 : 12;
        const drawRow = (cells, heading, index = 0) => {
            const lines = cells.map((cell, i) => wrap(cell, widths[i] - 12, size));
            const rowHeight = Math.max(...lines.map(item => item.length)) * leading + padding;
            rect(margin, y, widths.reduce((sum, w) => sum + w, 0), rowHeight, heading ? blue : index % 2 ? white : pale);
            const totalRow = !heading && cells.some(cell => cell === 'รวมทีม');
            if (totalRow) rect(margin, y, widths.reduce((sum, w) => sum + w, 0), rowHeight, rgb(0.88, 0.91, 0.94));
            let x = margin;
            lines.forEach((cell, i) => {
                const numeric = !heading && /^[-\d\s./%]+$/.test(String(cells[i] ?? ''));
                cell.forEach((line, j) => text(line, numeric ? x + Math.max(6, (widths[i] - font.widthOfTextAtSize(line, size)) / 2) : x + 6, y + padding / 2 + j * leading, size, heading ? white : ink));
                x += widths[i];
            });
            page.drawLine({ start: { x: margin, y: height - y - rowHeight }, end: { x: x, y: height - y - rowHeight }, color: rule, thickness: 0.35 });
            y += rowHeight;
        };
        drawRow(headers, true);
        rows.forEach((row, index) => {
            const needed = Math.max(...row.map((cell, i) => wrap(cell, widths[i] - 12, size).length)) * leading + padding;
            if (y + needed > height - 52) { newPage(title, pageSize, true); drawRow(headers, true); }
            drawRow(row, false, index);
        });
        y += 12;
    }
    const value = (team, number) => team.count ? number : '-';
    const score = set => report.teams.map(team => set[team.key]).join(' - ');
    const name = player => player.name || [player.first_name, player.last_name].filter(Boolean).join(' ') || `ผู้เล่น ${player.id}`;
    const notes = () => {
        paragraph('หมายเหตุ: ประมวลผลจากรายการสถิติที่บันทึกในระบบ ณ เวลาจัดทำรายงาน', 9, muted);
        paragraph('สัญลักษณ์: - = ไม่มีข้อมูลหรือไม่มีฐานคำนวณ; 0 = มีข้อมูลบันทึก แต่ไม่ปรากฏผลประเภทนั้น', 9, muted);
        if (report.excluded) paragraph(`รายการที่ไม่รวมในการประมวลผล: ${report.excluded} รายการ (ข้อมูลทีมหรือผลการประเมินไม่ครบถ้วน)`, 9, red);
    };

    added.push(...appendMatchResultPages(pdf, font, data, report, drawText));
    newPage('สรุปผลการแข่งขันและสถิติภาพรวม');
    const a = report.teams[0], b = report.teams[1];
    paragraph(`ทีม A: ${a.name}`, 13, blue);
    paragraph(`ทีม B: ${b.name}`, 13, red);
    y += 6;
    rect(margin, y, width - margin * 2, 54, pale);
    text(`${report.wins[a.key]} - ${report.wins[b.key]}`, margin + 16, y + 5, 30, blue);
    text('จำนวนเซตที่ชนะ (ทีม A - ทีม B)', margin + 155, y + 12, 11);
    text('แสดงลำดับทีม A - B อย่างสม่ำเสมอทุกตาราง', margin + 155, y + 30, 9, muted);
    y += 68;
    const gender = report.match.gender || report.match.competition_gender || '';
    const category = { male: 'ทีมชาย', female: 'ทีมหญิง', mixed: 'ทีมผสม' }[String(gender).toLowerCase()] || gender || 'ไม่ระบุ';
    paragraph(`รุ่นการแข่งขัน: ${report.match.age_group_name || report.match.category || 'ไม่ระบุ'} | ประเภท: ${category}`);
    const rawDate = report.match.match_date || report.match.start_time;
    const matchDate = rawDate && !Number.isNaN(new Date(rawDate).getTime()) ? new Date(rawDate).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' }) : 'ไม่ระบุ';
    paragraph(`สถานที่แข่งขัน: ${report.match.venue || report.match.stadium_name || report.match.court || report.match.court_name || report.match.location || 'ไม่ระบุ'} | วันที่แข่งขัน: ${matchDate}`);
    y += 4;
    table(['เซตที่', 'คะแนน (ทีม A - ทีม B)', 'สถานะ'], report.sets.length ? report.sets.map(set => [set.number, score(set), set.finished ? 'สิ้นสุดเซต' : 'ระหว่างการแข่งขัน']) : [['-', '-', 'ไม่ปรากฏข้อมูลคะแนนรายเซต']], [65, 250, width - 64 - 315]);
    table(['รายการสถิติ (คะแนน)', 'ทีม A', 'ทีม B'], [
        ['การรุกได้คะแนน', value(a, a.stats.A['#']), value(b, b.stats.A['#'])],
        ['เสิร์ฟเอซ', value(a, a.stats.S['#']), value(b, b.stats.S['#'])],
        ['การสกัดกั้นได้คะแนน', value(a, a.stats.B['#']), value(b, b.stats.B['#'])],
        ['แต้มจากความผิดพลาดคู่แข่ง', report.hasStats ? a.opponentErrors : '-', report.hasStats ? b.opponentErrors : '-'],
    ], [315, (width - 379) / 2, (width - 379) / 2]);
    paragraph('เปรียบเทียบคะแนนจากทักษะหลัก', 11);
    const max = Math.max(1, ...report.teams.flatMap(team => ['A', 'S', 'B'].map(skill => team.stats[skill]['#'])));
    for (const [skill, label] of [['A', 'รุก'], ['S', 'เอซ'], ['B', 'บล็อก']]) {
        if (y + 36 > height - 52) newPage(title, pageSize, true);
        text(label, margin, y, 10);
        report.teams.forEach((team, index) => {
            const count = team.stats[skill]['#'];
            rect(margin + 55, y + index * 14, (width - 180) * count / max, 10, index ? red : blue);
            text(`${team.label}: ${value(team, count)}`, width - 75, y + index * 14 - 1, 9);
        });
        y += 35;
    }
    notes();

    for (const team of report.teams) {
        newPage(`สถิตินักกีฬารายบุคคล - ทีม ${team.label}`, landscape);
        paragraph(team.name, 14, team.label === 'A' ? blue : red); y += 8;
        const row = player => {
            const s = player.stats;
            const show = n => player.count ? n : '-';
            return [player.number ?? '?', name(player), show(playerPoints(s)), player.count ? `${s.A['#']}/${attempts(s, 'A')}` : '-',
                percentage(s.A['#'] - s.A['='] - (s.A['/'] || 0), attempts(s, 'A')), show(s.S['#']), show(s.S['=']), show(s.B['#']),
                percentage(s.R['#'] + s.R['+'], attempts(s, 'R')), show(attempts(s, 'R'))];
        };
        const rows = [...team.players].sort((p, q) => Number(p.number) - Number(q.number)).map(row);
        rows.push(row({ number: '', name: 'รวมทีม', count: team.count, stats: team.stats }));
        table(['หมายเลข', 'ชื่อ - นามสกุล', 'คะแนนรวม', 'รุกสำเร็จ/ครั้ง', 'รุก EFF (%)', 'เสิร์ฟเอซ', 'เสิร์ฟเสีย', 'บล็อกสำเร็จ', 'รับดี (%)', 'รับทั้งหมด'], rows,
            [36, 265.89, 54, 78, 68, 45, 62, 49, 65, 55], 10, true);
        paragraph('คะแนนรวม = การรุกได้คะแนน + เสิร์ฟเอซ + การสกัดกั้นได้คะแนน (ไม่รวมคะแนนจากความผิดพลาดของคู่แข่ง)', 9, muted);
        paragraph('ประสิทธิภาพการรุก (EFF) = (รุกสำเร็จ # - รุกเสีย = - ตบติดบล็อก /) / จำนวนรุกทั้งหมด x 100', 9, muted);
        paragraph('การรับเสิร์ฟดี (%) = (รับเสิร์ฟสมบูรณ์ # + รับเสิร์ฟดี +) / จำนวนรับเสิร์ฟทั้งหมด x 100', 9, muted);
        notes();
    }

    if (options.includeSets) {
        for (const set of report.sets) {
            newPage(`รายละเอียดเซต ${set.number}`, landscape);
            paragraph(`คะแนนทีม A - B: ${score(set)} | ${set.finished ? 'จบเซต' : 'ระหว่างเซต'}`, 13);
            paragraph(`A: ${a.name} | B: ${b.name}`, 10, muted);
            const inSet = report.events.filter(event => Number(event.set_number ?? event.set_id) === set.number);
            const setActions = (data.visActions || []).filter(action => Number(action.set_number) === set.number);
            const stats = buildVisReport({ ...data, events: inSet, visActions: setActions }).teams;
            y += 8;
            table(['ทีม', 'รุกแต้ม', 'เอซ', 'บล็อก', 'ผิดพลาด (=)', 'เวลานอก', 'เปลี่ยนตัว'], stats.map(team => [
                team.label, value(team, team.stats.A['#']), value(team, team.stats.S['#']), value(team, team.stats.B['#']),
                value(team, Object.values(team.stats).reduce((sum, item) => sum + item['='], 0)),
                inSet.filter(e => String(e.team_id) === String(team.id) && e.skill === 'TIMEOUT').length,
                inSet.filter(e => String(e.team_id) === String(team.id) && ['SUBSTITUTION', 'SUB'].includes(e.skill)).length,
            ]), [197.89, 80, 80, 80, 120, 110, 110]);
            for (const team of report.teams) {
                const lineup = (data.lineups || []).find(item => Number(item.set_number) === set.number && String(item.team_id) === String(team.id));
                const confirmation = inSet.find(e => String(e.team_id) === String(team.id) && e.skill === 'LINEUP_CONFIRM');
                const ids = lineup ? Array.from({ length: 6 }, (_, i) => lineup[`player_id_p${i + 1}`]) : eventDetails(confirmation).players;
                paragraph(`ไลน์อัปเริ่มต้น ${team.label} (P1-P6): ${ids?.length ? ids.map(id => '#' + (team.players.find(p => String(p.id) === String(id))?.number ?? '?')).join(' / ') : 'ไม่มีข้อมูล'}`);
            }
            const rallies = [{ home: 0, away: 0 }];
            for (const event of inSet.filter(item => item.skill === 'POINT' && !eventDetails(item).vis)) {
                if (event.score_home == null || event.score_away == null) continue;
                const current = { home: Number(event.score_home), away: Number(event.score_away) };
                const previous = rallies.at(-1);
                if (current.home !== previous.home || current.away !== previous.away) rallies.push(current);
            }
            if (rallies.length > 1) {
                if (y + 165 > height - 52) newPage(title, pageSize, true);
                paragraph('คะแนนสะสมตามลำดับเหตุการณ์ที่บันทึก (อาจมีช่วงที่ไม่มีข้อมูล)', 10, muted);
                const top = y + 5, chartHeight = 100, chartWidth = width - margin * 2 - 32;
                const maximum = Math.max(1, ...rallies.flatMap(point => [point.home, point.away]));
                page.drawLine({ start: { x: margin + 24, y: height - top }, end: { x: margin + 24, y: height - top - chartHeight }, color: muted, thickness: 0.5 });
                page.drawLine({ start: { x: margin + 24, y: height - top - chartHeight }, end: { x: margin + 24 + chartWidth, y: height - top - chartHeight }, color: muted, thickness: 0.5 });
                text(maximum, margin, top - 4, 9, muted);
                text('0', margin, top + chartHeight - 8, 9, muted);
                report.teams.forEach((team, index) => {
                    for (let i = 1; i < rallies.length; i++) {
                        page.drawLine({ start: { x: margin + 24 + chartWidth * (i - 1) / (rallies.length - 1), y: height - top - chartHeight + chartHeight * rallies[i - 1][team.key] / maximum },
                            end: { x: margin + 24 + chartWidth * i / (rallies.length - 1), y: height - top - chartHeight + chartHeight * rallies[i][team.key] / maximum }, thickness: 1.5, color: index ? red : blue });
                    }
                });
                y = top + chartHeight + 8;
                paragraph('เส้นสีน้ำเงิน = ทีม A | เส้นสีแดง = ทีม B', 9, muted);
            }
            notes();
        }
    }
    if (options.includeHistory) {
        newPage('ทะเบียนรายการบันทึกสถิติ', landscape);
        paragraph(`A: ${a.name} | B: ${b.name} | คะแนนหลังรายการเรียง A - B`, 10, muted);
        const rows = report.events.map((event, index) => {
            const team = report.teams.find(item => String(item.id) === String(event.team_id));
            const scores = { home: event.score_home, away: event.score_away };
            const detail = eventDetails(event);
            const substitution = detail.playerOut ? ` | ออก #${players.find(p => String(p.id) === String(detail.playerOut))?.number ?? '?'} เข้า #${players.find(p => String(p.id) === String(detail.playerIn))?.number ?? '?'}` : '';
            const gradeDescription = visSkillNames[event.skill] && event.grade ? ` | ${describeVisGrade(event.skill, event.grade).label}` : '';
            return [event.set_number ?? event.set_id ?? '-', index + 1, team?.label || '-', getVisEventCode(event, players) || '-', describeVisEvent(event, players) + gradeDescription + substitution,
                report.teams.map(item => scores[item.key] ?? '-').join(' - ')];
        });
        table(['เซต', 'ลำดับ', 'ทีม', 'รหัส VIS', 'เหตุการณ์', 'คะแนน A - B'], rows.length ? rows : [['-', '-', '-', '-', 'ยังไม่มีเหตุการณ์', '-']], [40, 45, 40, 85, 430.89, 137], 10);
    }
    const total = pdf.getPageCount();
    for (const item of added) {
        const size = item.getSize();
        const index = pdf.getPages().indexOf(item) + 1;
        item.drawLine({ start: { x: margin, y: 34 }, end: { x: size.width - margin, y: 34 }, thickness: 0.5, color: muted });
        drawText(item, `${documentCode} | รายงานสถิติการแข่งขัน | จัดทำ ${stamp} น.`, margin, 19, 8, muted);
        drawText(item, `หน้า ${index} / ${total}`, size.width - 83, 19, 8, muted);
    }
    return report;
}
