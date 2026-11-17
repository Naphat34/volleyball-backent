import {useState} from 'react';
import {GuardedButton} from '../ui/GuardedAction';

export default function WorkflowScheduleEditor({state,matches,existing,busy,command,th,teamName}) {
    const t=(a,b)=>th?a:b;
    const groups=state.groups;
    const slots=matches.filter(match=>match.phase==='knockout');
    const next=Math.max(0,...existing.map(match=>Number(match.match_number)||0))+1;
    const [mode,setMode]=useState('selected');
    const [start,setStart]=useState(next);
    const [pairs,setPairs]=useState(()=>groups.map((group,index)=>({home:index*2+1,away:((index+1)%groups.length)*2+2})));
    const [edits,setEdits]=useState({});
    const options=groups.flatMap((group,index)=>[1,2].map(rank=>({id:index*2+rank,pool:group.name,rank})));
    const cross=groups.length===2;
    const knockoutCount=groups.length*2-(state.format.thirdPlace===false?1:0);
    const chosen=cross?[{home:1,away:4},{home:3,away:2}]:pairs;
    const preview=[];
    let size=groups.length*2;
    chosen.forEach((pair,index)=>preview.push({key:`R${size}-${index+1}`,round:`R${size}`,...Object.fromEntries(['home','away'].map(side=>[side,mode==='waiting'?{type:'draw',position:index+1,side}:{type:'pool',...options.find(option=>option.id===pair[side])}]))}));
    while(size>2){
        const nextSize=size/2;
        for(let i=1;i<=nextSize/2;i++)preview.push({key:`R${nextSize}-${i}`,round:`R${nextSize}`,home:{type:'winner',slot:`R${size}-${i*2-1}`},away:{type:'winner',slot:`R${size}-${i*2}`}});
        size=nextSize;
    }
    if(state.format.thirdPlace!==false)preview.push({key:'BRONZE-1',round:'BRONZE',home:{type:'loser',slot:'R4-1'},away:{type:'loser',slot:'R4-2'}});
    const finalIndex=preview.findIndex(match=>match.key==='R2-1');
    preview.push(...preview.splice(finalIndex,1));
    const label=source=>{
        const value=typeof source==='string'?JSON.parse(source):source;
        if(!value)return '—';
        if(value.type==='pool')return t('อันดับ ','Rank ')+value.rank+t(' สาย ',' Pool ')+value.pool;
        if(value.type==='draw')return t('รอผลจับสลากคู่ ','Awaiting draw ')+value.position;
        if(value.type==='team')return teamName(value.teamId);
        const from=slots.find(match=>match.slot_key===value.slot);
        const previewIndex=preview.findIndex(match=>match.key===value.slot);
        return (value.type==='winner'?t('ผู้ชนะคู่ที่ ','Winner of match '):t('ผู้แพ้คู่ที่ ','Loser of match '))+(from?.match_number??(previewIndex>=0?Number(start)+previewIndex:value.slot));
    };
    const valueFor=match=>edits[match.id]||{id:match.id,match_number:match.match_number||'',round_name:match.round_name||'',match_date:match.match_date||'',start_time:match.start_time||'',location:match.location||''};
    const change=(match,field,value)=>setEdits(previous=>({...previous,[match.id]:{...valueFor(match),[field]:value}}));
    const duplicate=new Set(chosen.flatMap(pair=>[pair.home,pair.away]).map(String)).size!==groups.length*2;
    const invalid=chosen.some(pair=>!pair.home||!pair.away||options.find(option=>option.id===pair.home)?.pool===options.find(option=>option.id===pair.away)?.pool);
    return <section className="cw-panel">
        <h2>{t('โปรแกรมรอบถัดไปล่วงหน้า','Advance knockout schedule')}</h2>
        <p>{t('สร้างคู่รอผลได้ก่อนรอบแรกจบ เลขคู่และตารางจะคงเดิมเมื่อเติมทีมหลังยืนยันอันดับหรือผลคะแนน','Create waiting fixtures before group play ends. Match numbers and schedules remain when confirmed rankings or scores populate teams.')}</p>
        {!slots.length&&state.status==='groups'&&<>
            <div className="cw-fields"><label>{t('วิธีประกบคู่','Pairing method')}<select aria-label={t('วิธีประกบคู่','Pairing method')} disabled={busy} value={mode} onChange={event=>setMode(event.target.value)}><option value="selected">{t('เลือกคู่จากอันดับสายล่วงหน้า','Choose pool rank pairings now')}</option><option value="waiting">{t('รอผลจับสลาก แล้วเลือกคู่ภายหลัง','Await draw and choose pairings later')}</option></select></label><label>{t('เริ่มเลขคู่ที่','Starting match number')}<input type="number" min={next} max="999999999" disabled={busy} value={start} onChange={event=>setStart(event.target.value)}/></label></div>
            {mode==='selected'&&chosen.map((pair,index)=><div className="cw-pair" key={index}><b>{t('คู่ที่ ','Match ')}{Number(start)+index}</b>{['home','away'].map(side=>cross?<span key={side}>{label({type:'pool',...options.find(option=>option.id===pair[side])})}</span>:<label key={side}>{side==='home'?t('อันดับ 1','Pool winner'):t('อันดับ 2','Runner-up')}<select disabled={busy} aria-label={`${t('คู่ล่วงหน้า','Planned match')} ${index+1} ${side}`} value={pair[side]} onChange={event=>setPairs(previous=>previous.map((item,i)=>i===index?{...item,[side]:Number(event.target.value)}:item))}><option value="">{t('เลือกอันดับสาย','Select pool rank')}</option>{options.filter(option=>option.rank===(side==='home'?1:2)).map(option=><option key={option.id} value={option.id} disabled={chosen.some((item,i)=>i!==index&&item[side]===option.id)||options.find(item=>item.id===pair[side==='home'?'away':'home'])?.pool===option.pool}>{label({type:'pool',...option})}</option>)}</select></label>)}</div>)}
            <p>{t('รอบแพ้คัดออกทั้งหมด','Total knockout fixtures')}: {knockoutCount} · {t('รวมคู่ในรายการ','Total competition fixtures')}: {existing.length+knockoutCount} · {state.format.thirdPlace!==false?t('รวมชิงอันดับ 3 และชิงชนะเลิศ ผู้ชนะคู่ติดกันจะพบกันในรอบถัดไป','Includes bronze and final. Winners of adjacent matches meet in the next round.'):t('ไม่มีชิงอันดับ 3 ผู้แพ้รอบรองฯ ได้อันดับ 3 ร่วม','No bronze match; semifinal losers share third place.')}</p>
            <div className="cw-scroll"><table><caption>{t('ตรวจโปรแกรมก่อนเผยแพร่','Review fixtures before publishing')}</caption><thead><tr>{[t('เลขคู่','Match'),t('รอบ','Round'),t('ทีมแรก','Home'),t('ทีมสอง','Away')].map(text=><th key={text}>{text}</th>)}</tr></thead><tbody>{preview.map((match,index)=><tr key={match.key}><td>{Number(start)+index}</td><td>{match.round}</td><td>{label(match.home)}</td><td>{label(match.away)}</td></tr>)}</tbody></table></div>
            <GuardedButton disabled={busy||!Number.isSafeInteger(Number(start))||Number(start)<next||(mode==='selected'&&(invalid||duplicate))} onClick={()=>command('plan-bracket',{mode,pairs:chosen,startNumber:Number(start)})}>{t('เผยแพร่โปรแกรมรอบถัดไปล่วงหน้า','Publish advance knockout fixtures')}</GuardedButton>
        </>}
        {!!slots.length&&<>
            <p>{t('จำนวนคู่ทั้งหมดในรายการ','Total competition fixtures')}: {existing.length} · {t('รอบแพ้คัดออก','Knockout fixtures')}: {slots.length}</p>
            {state.plannedDrawPending&&<p className="cw-warning">{t('รอผลจับสลาก: เมื่อยืนยันอันดับแล้ว ให้เลือกคู่และยืนยันผังด้านล่าง โปรแกรมเดิมจะได้รับการเติมทีมโดยคงเลขคู่และตารางเดิม','Awaiting draw: after confirming rankings, choose pairings below. Existing fixture numbers and schedules will be preserved.')}</p>}
            <div className="cw-scroll"><table><thead><tr>{[t('เลขคู่','Match'),t('รอบ','Round'),t('ทีมแรก / ที่มา','Home / source'),t('ทีมสอง / ที่มา','Away / source'),t('วันที่','Date'),t('เวลาไทย','Time (Bangkok)'),t('สนาม','Venue'),t('สถานะ','Status')].map(text=><th key={text}>{text}</th>)}</tr></thead><tbody>{slots.map(match=>{
                const value=valueFor(match),locked=busy||match.status!=='scheduled';
                return <tr key={match.id}><td><input aria-label={`${t('เลขคู่','Match number')} ${match.slot_key}`} type="number" min="1" disabled={locked} value={value.match_number} onChange={event=>change(match,'match_number',event.target.value)}/></td><td><input aria-label={`${t('รอบ','Round')} ${match.slot_key}`} maxLength="100" required disabled={locked} value={value.round_name} onChange={event=>change(match,'round_name',event.target.value)}/></td><td>{label(match.home_source)}</td><td>{label(match.away_source)}</td><td><input aria-label={`${t('วันที่','Date')} ${match.slot_key}`} type="date" disabled={locked} value={value.match_date} onChange={event=>change(match,'match_date',event.target.value)}/></td><td><input aria-label={`${t('เวลา','Time')} ${match.slot_key}`} type="time" disabled={locked} value={value.start_time} onChange={event=>change(match,'start_time',event.target.value)}/></td><td><input aria-label={`${t('สนาม','Venue')} ${match.slot_key}`} maxLength="255" disabled={locked} value={value.location} onChange={event=>change(match,'location',event.target.value)}/></td><td>{!match.home_team_id||!match.away_team_id?t('รอทีม / รอผล','Awaiting teams / results'):match.status}</td></tr>;
            })}</tbody></table></div>
            <GuardedButton disabled={busy||!Object.keys(edits).length||Object.values(edits).some(match=>!match.round_name.trim())} onClick={()=>command('schedule',{matches:Object.values(edits)})}>{t('บันทึกเลขคู่ รอบ วัน เวลา และสนาม','Save match numbers, rounds, dates, times and venues')}</GuardedButton>
        </>}
    </section>;
}
