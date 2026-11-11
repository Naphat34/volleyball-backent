import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeamRankingWorkbook } from './teamRankingExcel.js';

test('ranking workbook preserves standings, bilingual headings and embedded competition logo after reopening',async()=>{
    const options={competition:{title_en:'International Student Championship 2027',title_th:'การแข่งขันกีฬานักเรียนแห่งชาติ 2570'},gender:'Male',ageGroup:'U18',pool:'A',
        standings:[{name:'Example Team',code:'EXT',played:3,won:2,lost:1,results:{'3-0':2,'0-3':1},points:6,sets_won:6,sets_lost:3,setRatio:'2.000',points_won:225,points_lost:190,pointRatio:'1.184'}],
        resultCols:['3-0','0-3'],generatedAt:new Date('2026-11-11T12:00:00Z'),
        logo:{base64:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==',extension:'png'}};
    const workbook=await buildTeamRankingWorkbook(options);
    const {default:ExcelJS}=await import('exceljs');
    const reopened=new ExcelJS.Workbook();await reopened.xlsx.load(await workbook.xlsx.writeBuffer());
    const sheet=reopened.worksheets[0];
    assert.equal(sheet.getCell('C1').value,options.competition.title_en);
    assert.equal(sheet.getCell('C2').value,options.competition.title_th);
    assert.equal(sheet.getImages().length,1);
    assert.equal(sheet.getCell('B11').value,'Example Team\nEXT');
    assert.deepEqual(sheet.getRow(11).values.slice(3,9),[3,2,1,2,1,6]);
    assert.equal(sheet.pageSetup.orientation,'landscape');
    assert.equal(sheet.views[0].showGridLines,false);
    assert.match(sheet.getCell('C7').value,/2026.*19:00.*UTC\+7/);
});

test('ranking export handles no match-result columns or competition logo',async()=>{
    const workbook=await buildTeamRankingWorkbook({title:'Competition',standings:[],resultCols:[],gender:'Female'});
    const sheet=workbook.worksheets[0];
    assert.equal(sheet.getCell('C1').value,'Competition');
    assert.equal(sheet.getImages().length,0);
    assert.equal(sheet.getCell('F10').value,'Ranking\npoints');
});
