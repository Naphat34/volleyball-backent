// Synthetic layout fixtures only. Does not access the API or a database.
import { createServer } from 'vite';
import React from 'react';
import { compositionPlayers, compositionStaff } from '../src/utils/reports/compositionRoster.js';
import { Font, renderToFile } from '@react-pdf/renderer';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
try {
  const { default: Composition } = await server.ssrLoadModule('/src/components/reports/O2FormDocument.jsx');
  delete Font.getRegisteredFonts().CompositionSarabun;
  Font.register({ family: 'CompositionSarabun', fonts: [{ src: fileURLToPath(new URL('../public/fonts/Sarabun-Regular.ttf', import.meta.url)) }, { src: fileURLToPath(new URL('../public/fonts/Sarabun-Bold.ttf', import.meta.url)), fontWeight: 700 }] });
  const image = async name => `data:image/png;base64,${(await readFile(new URL(`../public/reports/p2/${name}.png`, import.meta.url))).toString('base64')}`;
  const assets = { competition: await image('competition-logo'), association: await image('association-logo') };
  const teamInfo = { name_th: 'สโมสรวอลเลย์บอลตัวอย่าง', name_en: 'EXAMPLE VOLLEYBALL CLUB', competition_name_en: 'Volleyball Thailand League 2027 - Men', competition_name_th: 'วอลเลย์บอล ไทยแลนด์ ลีก 2570 · ทีมชาย', leg: 1, revision: 1, reference_date: '2026-11-04', main_color: 'ม่วง / Purple', second_color: 'เหลือง / Yellow', libero_main_color: 'เหลือง / Yellow', libero_second_color: 'ม่วง / Purple', association_name: 'ข้อมูลตัวอย่างตรวจรูปแบบ / Synthetic layout preview' };
  const players = Array.from({ length: 30 }, (_, i) => ({ id: i + 1, number: i + 1, title: 'นาย', first_name_th: 'นักกีฬา', last_name_th: `ตัวอย่าง ${i + 1}`, first_name_en: i === 10 ? 'Maher Adnan Abdul Wahhab' : 'Athiwat', last_name_en: 'EXAMPLE', jersey_name: 'ATHIWAT', position: ['S', 'OPP', 'L', 'OH', 'MB'][i % 5], birthdate: `${2000 + i % 8}-03-08`, height: 173 + i % 24, weight: 60 + i % 32, fivb_id: i % 3 ? '' : '160661', hometown: i % 2 ? 'กรุงเทพมหานคร' : 'ขอนแก่น', nationality: i === 8 ? 'Cuba' : 'Thai', is_captain: i === 7, is_libero1: i === 2 }));
  const staff = ['Head Coach', 'Assistant Coach', 'Assistant Coach 2', 'Assistant Coach 3', 'Therapist/Trainer', 'Doctor', 'Team Manager'].map((role, i) => ({ role, first_name_th: 'เจ้าหน้าที่', last_name_th: `ตัวอย่าง ${i + 1}`, first_name_en: 'Example', last_name_en: 'OFFICIAL' }));
  await mkdir(new URL('../../output/pdf/', import.meta.url), { recursive: true });
  await mkdir(new URL('../../tmp/pdfs/', import.meta.url), { recursive: true });
  for (const [name, roster] of [['../../output/pdf/Team-composition-preview.pdf', players.slice(0, 20)], ['../../tmp/pdfs/Team-composition-30-players.pdf', players], ['../../tmp/pdfs/Team-composition-empty.pdf', []]]) {
    await renderToFile(React.createElement(Composition, { teamInfo, players: compositionPlayers({ team_entry_id: 1 }, { players: roster.map(player => ({ ...player, selected: 1, entry_number: player.number, entry_is_captain: player.is_captain || 0, entry_is_libero1: player.is_libero1 || 0 })) }), staff: compositionStaff({ team_entry_id: 1 }, { staff: staff.map(official => ({ ...official, selected: 1 })) }), printedAt: '2026-11-07T09:37:00Z', assetOverrides: assets }), fileURLToPath(new URL(name, import.meta.url)));
    console.log(`Created ${name}`);
  }
} finally { await server.close(); }


