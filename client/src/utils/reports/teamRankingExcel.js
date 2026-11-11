const navy = '17324D';
const number = value => Number(value) || 0;

export async function buildTeamRankingWorkbook({ competition = {}, title, gender, ageGroup, pool, standings, resultCols, logo, generatedAt = new Date() }) {
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Volley Manager';
    workbook.created = generatedAt;
    const sheet = workbook.addWorksheet('Team Rankings', {
        views: [{ showGridLines: false, state: 'frozen', ySplit: 10, xSplit: 2 }],
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
            margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 } },
    });
    const headers = ['Rank','Team','Played','Won','Lost',...resultCols,'Ranking\npoints','Won','Lost','Ratio','Won','Lost','Ratio'];
    sheet.columns = headers.map((_, index) => ({ width: index === 1 ? 34 : index === 0 ? 8 : 10 }));
    const last = headers.length, rankingPoints = 6 + resultCols.length, sets = rankingPoints + 1, points = sets + 3;
    const merged = (row, from, to, text, options = {}) => {
        if (to > from) sheet.mergeCells(row,from,row,to);
        const cell = sheet.getCell(row,from);
        cell.value = text || '';
        cell.font = { name: 'Arial', size: 11, color: { argb: navy }, ...options };
        cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        return cell;
    };
    // Reserve A:B for the competition mark; text never runs underneath the logo.
    sheet.mergeCells('A1:B4');
    if (logo) {
        const imageId = workbook.addImage(logo);
        sheet.addImage(imageId, { tl: { col: 1.05, row: 0.15 }, ext: { width: 106, height: 106 }, editAs: 'oneCell' });
    }
    const mainTitle = competition.title_en || title || competition.title;
    merged(1,3,last,mainTitle, { size: 17, bold: true });
    merged(2,3,last,competition.title_th !== mainTitle ? competition.title_th : '', { size: 12 });
    merged(3,3,last,'TEAM RANKINGS', { size: 14, bold: true });
    merged(4,3,last,'COMPETITION STANDINGS REPORT', { size: 10, color: { argb: '64748B' } });
    [32,30,24,20,9,24,24,10,25,32].forEach((height,index) => { sheet.getRow(index+1).height=height; });
    for (let col=1;col<=last;col++) sheet.getCell(4,col).border={bottom:{style:'medium',color:{argb:navy}}};
    const split = Math.floor(last/2);
    const meta = (row,from,to,label,value) => {
        merged(row,from,from+1,label,{size:10,bold:true,color:{argb:'64748B'}});
        merged(row,from+2,to,value,{size:11,bold:true});
    };
    const genderLabel = ({Male:'MEN',Female:'WOMEN',Mixed:'MIXED',Mix:'MIXED'})[gender] || gender;
    meta(6,1,split,'CATEGORY',`${genderLabel || '—'} · ${ageGroup || '—'}`);
    meta(6,split+1,last,'POOL',pool || 'All Pools');
    const stamp = new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(generatedAt);
    meta(7,1,split,'ISSUED AT',`${stamp} (UTC+7)`);
    meta(7,split+1,last,'TEAMS',String(standings.length));
    merged(9,1,2,'RANKING'); merged(9,3,5,'MATCHES');
    if(resultCols.length) merged(9,6,rankingPoints-1,'MATCH RESULTS');
    merged(9,rankingPoints,rankingPoints,'RANKING');
    merged(9,sets,sets+2,'SETS'); merged(9,points,points+2,'POINTS');
    sheet.getRow(10).values=headers;
    for(const row of [9,10]) for(let col=1;col<=last;col++) {
        const cell=sheet.getCell(row,col);
        cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:row===9?navy:'E8EEF4'}};
        cell.font={name:'Arial',size:10,bold:true,color:{argb:row===9?'FFFFFF':navy}};
        cell.alignment={horizontal:'center',vertical:'middle',wrapText:true};
        cell.border={bottom:{style:'thin',color:{argb:'CBD5E1'}}};
    }
    standings.forEach((team,index)=>{
        const row=sheet.getRow(11+index);
        row.values=[index+1,`${team.name}${team.code?`\n${team.code}`:''}`,number(team.played),number(team.won),number(team.lost),
            ...resultCols.map(key=>number(team.results?.[key])),number(team.points),number(team.sets_won),number(team.sets_lost),team.setRatio ?? '—',number(team.points_won),number(team.points_lost),team.pointRatio ?? '—'];
        row.height=34;
        for(let col=1;col<=last;col++) {
            const cell=row.getCell(col);
            cell.font={name:'Arial',size:11,color:{argb:navy},bold:col===1||col===rankingPoints};
            cell.alignment={vertical:'middle',horizontal:col===2?'left':'center',wrapText:true};
            cell.fill={type:'pattern',pattern:'solid',fgColor:{argb:index===0?'EAF2F8':index%2?'F5F7FA':'FFFFFF'}};
            cell.border={bottom:{style:'hair',color:{argb:'D8E0E8'}}};
        }
    });
    sheet.pageSetup.printArea=`A1:${sheet.getColumn(last).letter}${10+standings.length}`;
    sheet.pageSetup.printTitlesRow='1:10';
    sheet.headerFooter.oddFooter='&LTeam Rankings&CPage &P of &N&RVolley Manager';
    return workbook;
}

export async function loadRankingLogo(source, origin) {
    if (!source) return null;
    const url=new URL(source,`${origin.replace(/\/$/,'')}/`).href;
    const response=await fetch(url);
    if(!response.ok) throw Error('Could not load competition logo');
    const blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob);
    try {
        const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=objectUrl;});
        const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
        const scale=Math.min(144/image.width,144/image.height);
        canvas.getContext('2d').drawImage(image,(160-image.width*scale)/2,(160-image.height*scale)/2,image.width*scale,image.height*scale);
        return {base64:canvas.toDataURL('image/png'),extension:'png'};
    } finally { URL.revokeObjectURL(objectUrl); }
}
