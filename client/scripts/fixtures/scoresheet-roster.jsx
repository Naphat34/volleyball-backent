import React from 'react';
import { createRoot } from 'react-dom/client';
import ScoresheetRoster from '../../src/components/reports/ScoresheetRoster';
import { scoresheetRoster } from '../../src/utils/reports/scoresheetRoster';
import '../../src/index.css';
const params = new URLSearchParams(window.location.search);
const capacity = Number(params.get('capacity') || 14);
const empty = params.get('empty') === 'true';
const noLibero = params.get('noLibero') === 'true';
const names = ['นภัทร ศรีรักษ์', 'นักกีฬาทดสอบ นามสกุลภาษาไทยยาวมาก', 'Alexandria Montgomery-Wellington'];
const players = count => Array.from({ length: count }, (_, index) => ({ id: index + 1, number: index + 1, name: names[index % names.length], is_captain: index === 0 }));
const libs = noLibero ? [] : players(2).map((player, index) => ({ ...player, number: capacity - index, is_captain: false }));
const roster = scoresheetRoster({ maxPlayers: capacity, playersA: players(capacity - libs.length), playersB: empty ? [] : players(capacity - libs.length), liberosA: libs, liberosB: empty ? [] : libs });
createRoot(document.getElementById('root')).render(<main className="a3-container w-[1587px] h-[1123px] p-2 pb-4 flex flex-col gap-1 box-border" style={{ transform: params.get('scaled') === 'true' ? 'scale(0.75)' : undefined, transformOrigin: 'top left' }}>
    <div className="h-[13%] min-h-0 shrink-0"/><div className="h-[43%] min-h-0 shrink-0"/>
    <div className="flex flex-1 gap-1 min-h-0 shrink-0"><div className="flex-[3.2]"/><ScoresheetRoster roster={roster} teamA="Phatthalung" teamB="Songkhla" personName={player => player.name} playerNumber={player => player.number}
        officials={['C', 'AC1', 'AC2', 'T', 'M'].map(r => ({ r, nameA: 'เจ้าหน้าที่ ทดสอบรายชื่อ', nameB: empty ? '' : 'Official Long Family Name' }))}/></div>
    <style>{'@media print { @page { size: A3 landscape; margin: 0; } .a3-container { width:420mm!important; height:297mm!important; padding:6mm!important; transform:none!important; } }'}</style>
</main>);
