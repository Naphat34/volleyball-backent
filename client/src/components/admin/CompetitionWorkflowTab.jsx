import WorkflowScheduleEditor from './WorkflowScheduleEditor';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useSearchParams,Link} from 'react-router-dom';
import {api} from '../../api';
import {getStoredUser} from '../../auth/authStorage';
import {useLanguage} from '../../context/LanguageContext';
import useDisplayNames from '../../hooks/useDisplayNames';
import {GuardedButton} from '../ui/GuardedAction';
import './CompetitionWorkflowTab.css';

const emptyFormat={teamCount:8,poolCount:2,qualifiersPerPool:2,thirdPlace:true,groupRoundName:'Preliminary'};
const poolName=index=>index<26?String.fromCharCode(65+index):`G${index+1}`;
const ratio=(won,lost)=>lost?(won/lost).toFixed(3):won?'MAX':'0.000';
export default function CompetitionWorkflowTab(){
    const {language}=useLanguage(),th=language==='THA',t=(a,b)=>th?a:b,names=useDisplayNames();
    const [params,setParams]=useSearchParams(),competitionId=params.get('competitionId')||'';
    const [catalog,setCatalog]=useState([]),[data,setData]=useState(null),[format,setFormat]=useState(emptyFormat),[groups,setGroups]=useState([]),[pairs,setPairs]=useState([]),[drawRanks,setDrawRanks]=useState({});
    const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false);
    const [rulingMatch,setRulingMatch]=useState(''),[losingTeam,setLosingTeam]=useState(''),[reason,setReason]=useState(''),[withdrawTeam,setWithdrawTeam]=useState(''),[resetReason,setResetReason]=useState('');
    const [confirmBronzeRemoval,setConfirmBronzeRemoval]=useState(false);
    const system=getStoredUser()?.role==='super_admin';
    const loadVersion=useRef(0),activeCompetition=useRef(competitionId);
    useEffect(()=>{let active=true;api.getAllCompetitions().then(response=>{if(active)setCatalog(response.data);}).catch(()=>{if(active)setError(th?'โหลดรายการแข่งขันไม่สำเร็จ':'Unable to load competitions');});return()=>{active=false;};},[th]);
    const load=useCallback(async()=>{
        if(activeCompetition.current!==competitionId)return;
        const version=++loadVersion.current;
        if(!competitionId){setData(null);return;}setLoading(true);
        try{
            const response=await api.getCompetitionWorkflow(competitionId),value=response.data;
            if(version!==loadVersion.current||activeCompetition.current!==competitionId)return;
            setData(value);setFormat(value.workflow?.state.format||{...emptyFormat,teamCount:Math.max(4,value.teams.length)});
            setGroups(value.workflow?.state.groups||[]);setPairs([]);setDrawRanks({});setError('');setConfirmBronzeRemoval(false);
        }catch(failure){if(version===loadVersion.current){setData(null);setError(failure.response?.data?.error||failure.message);}}finally{if(version===loadVersion.current)setLoading(false);}
    },[competitionId]);
    useEffect(()=>{activeCompetition.current=competitionId;void load();return()=>{loadVersion.current++;activeCompetition.current=null;};},[load,competitionId]);
    const command=async(action,payload={})=>{
        if(busy)return;setBusy(true);setError('');setNotice('');
        try{await api.updateCompetitionWorkflow(competitionId,action,{revision:data?.workflow?.revision||0,...payload});await load();setNotice(t('บันทึกและตรวจสอบเรียบร้อย','Saved and validated'));setReason('');setRulingMatch('');setLosingTeam('');}
        catch(failure){setError(failure.response?.data?.error||failure.message);}finally{setBusy(false);}
    };
    const state=data?.workflow?.state,revision=data?.workflow?.revision||0,teams=data?.teams||[],workflowMatches=data?.matches||[];
    const teamName=id=>{const team=teams.find(item=>String(item.id)===String(id));return team?names.teamName(team):t('รอทีมเข้ารอบ','Awaiting qualifier');};
    const slots=workflowMatches.filter(match=>match.phase==='knockout');
    const qualifiers=state?.qualification?.qualifiers||[];
    const rankPools=state?.qualification?.ranking||data?.preview?.ranking||[];
    const draft=state?.status==='draft',dirty=JSON.stringify(groups)!==JSON.stringify(state?.groups||[]);
    const changeGroup=(index,teamIds)=>setGroups(previous=>previous.map((group,i)=>i===index?{...group,teamIds}:group));
    const initializeGroups=()=>setGroups(Array.from({length:Number(format.poolCount)},(_,index)=>({name:poolName(index),teamIds:['','']})));
    const importGroups=()=>{
        const pools=new Map();for(const match of data.existing){if(!pools.has(match.pool_name))pools.set(match.pool_name,new Set());for(const id of [match.home_team_id,match.away_team_id])if(id)pools.get(match.pool_name).add(id);}
        setGroups([...pools].map(([name,ids])=>({name:name||'',teamIds:[...ids]})));
    };
    const submitRanking=()=>{
        for(const pool of rankPools)for(const tie of pool.ties||[]){
            const positions=tie.map(id=>drawRanks[pool.pool]?.[id]);
            if(positions.some(value=>!value)||new Set(positions).size!==tie.length){setError(t('กรุณากรอกลำดับจับสลากของทีมที่เสมอให้ครบและไม่ซ้ำ','Complete unique draw positions for every tied group'));return;}
        }
        const rankDraws=Object.fromEntries(Object.entries(drawRanks).map(([pool,positions])=>[pool,Object.entries(positions).filter(([,value])=>value).sort((a,b)=>Number(a[1])-Number(b[1])).map(([id])=>Number(id))]));
        void command('qualify',{rankDraws});
    };
    const effectivePairs=state?.format.drawMode==='cross'&&qualifiers.length===4?[
        {home:qualifiers.find(team=>team.pool===state.groups[0].name&&team.rank===1)?.teamId,away:qualifiers.find(team=>team.pool===state.groups[1].name&&team.rank===2)?.teamId},
        {home:qualifiers.find(team=>team.pool===state.groups[1].name&&team.rank===1)?.teamId,away:qualifiers.find(team=>team.pool===state.groups[0].name&&team.rank===2)?.teamId},
    ]:Array.from({length:qualifiers.length/2},(_,index)=>pairs[index]||{home:'',away:''});
    const pairOption=(index,side)=>qualifiers.filter(team=>team.rank===(side==='home'?1:2)).map(team=>{
        const other=qualifiers.find(item=>String(item.teamId)===String(effectivePairs[index]?.[side==='home'?'away':'home']));
        const duplicate=effectivePairs.some((pair,i)=>i!==index&&String(pair[side])===String(team.teamId));
        return <option key={team.teamId} value={team.teamId} disabled={duplicate||other?.pool===team.pool}>{team.pool}{team.rank} · {teamName(team.teamId)}</option>;
    });
    const selectedMatch=workflowMatches.find(match=>String(match.id)===rulingMatch);
    const slotLabel=source=>{try{const value=typeof source==='string'?JSON.parse(source):source;if(value?.type==='pool')return t('อันดับ ','Rank ')+value.rank+t(' สาย ',' Pool ')+value.pool;if(value?.type==='draw')return t('รอผลจับสลากคู่ ','Awaiting draw ')+value.position;return value?.type==='team'?teamName(value.teamId):`${value?.type==='loser'?t('ผู้แพ้คู่ที่','Loser of match'):t('ผู้ชนะคู่ที่','Winner of match')} ${slots.find(match=>match.slot_key===value?.slot)?.match_number||value?.slot||''}`;}catch{return '—';}};
    return <div className="cw-page">
        <div className="cw-toolbar"><label>{t('รายการ / ประเภท','Competition / category')}<select disabled={busy||loading} value={competitionId} onChange={event=>setParams({view:'workflow',competitionId:event.target.value})}><option value="">{t('เลือกรายการแข่งขัน','Select competition')}</option>{catalog.map(item=><option key={item.id} value={item.id}>{names.competitionName(item)} · {item.gender} · {names.referenceName({name:item.age_group_name,name_th:item.age_group_name_th,name_en:item.age_group_name_en})}</option>)}</select></label><GuardedButton disabled={busy||loading||!competitionId} onClick={load}>{t('โหลดใหม่','Refresh')}</GuardedButton></div>
        {error&&<p role="alert" className="cw-error">{error}</p>}{notice&&<p role="status" className="cw-success">{notice}</p>}
        {loading&&!data&&<p role="status">{t('กำลังโหลด…','Loading…')}</p>}
        {data&&<>
            <p className="cw-summary">{t('ทีมอนุมัติ','Approved teams')}: {teams.length} · {t('ฉบับ','Revision')}: {revision} · {t('ขั้นตอน','Phase')}: {state?.status||t('ยังไม่ตั้งค่า','Not configured')}</p>
            {state?.invalidated&&<p className="cw-error" role="alert">{t('ผลต้นทางถูกเปิดแก้ไข ผังถูกระงับ ต้องยกเลิกผังที่ยังไม่เริ่มและยืนยันอันดับใหม่','Source results were reopened. The bracket is suspended; reset unstarted fixtures and confirm rankings again.')}</p>}
            <section className="cw-panel"><h2>{t('1. รูปแบบรายการ','1. Competition format')}</h2>
                <p>{t('คัดอันดับ 1–2 ตามคะแนนสะสม → จำนวนชนะ → อัตราส่วนเซต → อัตราส่วนแต้ม → จับสลากจริงเมื่อทุกเกณฑ์เสมอ','Qualify ranks 1–2: points → wins → set ratio → point ratio → recorded physical draw if all criteria tie.')}</p>
                <div className="cw-fields"><label>{t('จำนวนทีม','Teams')}<input type="number" min="4" max="128" disabled={!system||state&&!draft} value={format.teamCount} onChange={event=>setFormat({...format,teamCount:Number(event.target.value)})}/></label><label>{t('จำนวนสาย','Pools')}<input type="number" min="2" max="32" disabled={!system||state&&!draft} value={format.poolCount} onChange={event=>setFormat({...format,poolCount:Number(event.target.value)})}/></label><label>{t('ชื่อรอบแรก','Group stage name')}<input maxLength="100" disabled={!system||state&&!draft} value={format.groupRoundName} onChange={event=>setFormat({...format,groupRoundName:event.target.value})}/></label></div>
                <div className="cw-fields"><label><span>{t('แข่งขันชิงอันดับ 3','Bronze medal match')}</span><input aria-label={t('แข่งขันชิงอันดับ 3','Bronze medal match')} type="checkbox" checked={format.thirdPlace!==false} disabled={!system||busy||state?.status==='completed'} onChange={event=>{setFormat({...format,thirdPlace:event.target.checked});setConfirmBronzeRemoval(false);}}/></label>
                {state&&(format.thirdPlace!==false)!==(state.format.thirdPlace!==false)&&<>{format.thirdPlace===false&&slots.some(match=>match.slot_key==='BRONZE-1')&&<label><input type="checkbox" checked={confirmBronzeRemoval} onChange={event=>setConfirmBronzeRemoval(event.target.checked)}/>{t('ยืนยันยกเลิกคู่ชิงอันดับ 3 และตารางของคู่นี้ โดยคงเลขคู่อื่นไว้','Confirm removal of the bronze fixture and its schedule; other match numbers remain unchanged')}</label>}<GuardedButton disabled={busy||(!format.thirdPlace&&slots.some(match=>match.slot_key==='BRONZE-1')&&!confirmBronzeRemoval)} onClick={()=>command('third-place',{enabled:format.thirdPlace!==false,confirmRemoval:confirmBronzeRemoval})}>{t('บันทึกกติกาชิงอันดับ 3','Save bronze medal rule')}</GuardedButton></>}</div>
                <p>{t('เข้ารอบ','Qualifiers')}: {Number(format.poolCount)*2} · {format.thirdPlace!==false?t('มีชิงอันดับ 3 จากผู้แพ้รอบรองฯ ทั้งสองคู่','Bronze match between both semifinal losers'):t('ไม่มีชิงอันดับ 3 ผู้แพ้รอบรองฯ ได้อันดับ 3 ร่วม','No bronze match; semifinal losers share third place')}. {t('รอบ 4 ทีมไขว้ A1–B2 / B1–A2; ตั้งแต่ 8 ทีมเข้ารอบขึ้นไป ผู้จัดกรอกผลจับสลากจริง','Four qualifiers cross A1–B2 / B1–A2; larger brackets use the organizer’s physical draw.')}</p>
                {system&&(!state||draft)&&<GuardedButton disabled={busy} onClick={()=>command('configure',{format,resetGroups:true})}>{groups.length?t('ยืนยันเปลี่ยนรูปแบบและเริ่มจัดสายฉบับร่างใหม่','Confirm format change and reset draft pools'):t('บันทึกรูปแบบ (Super Admin)','Save format (Super Admin)')}</GuardedButton>}
                {!system&&!state&&<p>{t('ให้ Super Admin ตั้งค่ารูปแบบก่อน','Ask Super Admin to configure the format first.')}</p>}
            </section>
            {state&&<section className="cw-panel"><h2>{t('2. ทีมในแต่ละสายและตารางรอบแรก','2. Pool membership and group fixtures')}</h2>
                {draft&&<div className="cw-actions"><GuardedButton disabled={busy} onClick={initializeGroups}>{t('เตรียมสายว่างตามรูปแบบ','Prepare empty pools')}</GuardedButton>{data.existing.length>0&&<GuardedButton disabled={busy} onClick={importGroups}>{t('อ่านทีมและสายจากแมตช์เดิม','Read pools from existing fixtures')}</GuardedButton>}</div>}
                <p>{t('เลือกทีมตามตำแหน่ง A1, A2, A3 ระบบบันทึกตามตำแหน่ง ไม่เรียงตามชื่อ และไม่ใช่อันดับผลการแข่งขัน','Select teams by position: A1, A2, A3. Positions are saved in this order, not alphabetically, and are not competition rankings.')}</p>
                <div className="cw-pools">{groups.map((group,index)=>{
                    const count=group.teamIds.filter(Boolean).length;
                    return <article key={index}>
                        <label>{t('สาย','Pool')}<input aria-label={t('ชื่อสาย','Pool name')+' '+(index+1)} disabled={!draft||busy} value={group.name} maxLength="50" onChange={event=>setGroups(previous=>previous.map((item,i)=>i===index?{...item,name:event.target.value}:item))}/></label>
                        <small>{count} {t('ทีม','teams')} · {count*(count-1)/2} {t('แมตช์','matches')}</small>
                        {draft?<>
                            <div className="cw-team-slots">{group.teamIds.map((id,position)=>{
                                const label=group.name+(position+1);
                                return <div className="cw-team-slot" key={position}>
                                    <label>{label}<select aria-label={t('ทีมตำแหน่ง','Team position')+' '+label} disabled={busy} value={id} onChange={event=>changeGroup(index,group.teamIds.map((value,i)=>i===position?(event.target.value?Number(event.target.value):''):value))}>
                                        <option value="">{t('เลือกทีม','Select team')}</option>
                                        {teams.map(team=><option key={team.id} value={team.id} disabled={groups.some((other,i)=>other.teamIds.some((value,j)=>(i!==index||j!==position)&&String(value)===String(team.id)))}>{names.teamName(team)}</option>)}
                                    </select></label>
                                    <button type="button" disabled={busy} aria-label={t('ลบตำแหน่ง','Remove position')+' '+label} onClick={()=>changeGroup(index,group.teamIds.filter((_,i)=>i!==position))}>{t('ลบ','Remove')}</button>
                                </div>;
                            })}</div>
                            <button type="button" disabled={busy||group.teamIds.length>=teams.length} onClick={()=>changeGroup(index,[...group.teamIds,''])}>{t('เพิ่มตำแหน่ง','Add position')}</button>
                        </>:<ol>{group.teamIds.map((id,position)=><li key={id}><strong>{group.name}{position+1}</strong> · {teamName(id)} {state.withdrawn?.[id]&&<b>{t('ถอนตัว','Withdrawn')}</b>}</li>)}</ol>}
                    </article>;
                })}</div>
                {draft&&<div className="cw-actions"><GuardedButton disabled={busy||!groups.length||groups.some(group=>group.teamIds.length<2||group.teamIds.some(id=>!id))} onClick={()=>command('groups',{groups})}>{t('บันทึกทีมลงสาย','Save pool membership')}</GuardedButton><GuardedButton disabled={busy||dirty||!groups.length} onClick={()=>command('publish',{adopt:data.existing.length>0})}>{data.existing.length?t('ตรวจและยืนยันเชื่อมแมตช์เดิม','Validate and adopt existing fixtures'):t('ยืนยันสร้างแมตช์พบกันหมดในสาย','Confirm round-robin fixtures')}</GuardedButton></div>}
                {draft&&<p>{t('บันทึกทีมลงสายก่อนยืนยัน ตารางจะสร้างเมื่อทีมครบตามรูปแบบเท่านั้น แมตช์เดิมจะไม่ถูกลบหรือเปลี่ยนผล','Save membership first. Publishing requires the configured team count. Existing fixtures and results are preserved.')}</p>}
            </section>}
            {state&&state.status!=='draft'&&<WorkflowScheduleEditor key={competitionId+':'+revision} state={state} matches={workflowMatches} existing={data.existing} busy={busy} command={command} th={th} teamName={teamName}/>}
            {state&&state.status!=='draft'&&<section className="cw-panel"><h2>{t('3. อันดับและยืนยันทีมเข้ารอบ','3. Rankings and qualification')}</h2>
                {!!data.preview?.blocked.length&&<p className="cw-warning">{t('ยังรอผลตรวจรับหรือคำตัดสินของแมตช์','Awaiting confirmed results or rulings for matches')}: {data.preview.blocked.map(id=>workflowMatches.find(match=>match.id===id)?.match_number||id).join(', ')}</p>}
                {rankPools.map(pool=><article key={pool.pool}><h3>{t('สาย','Pool')} {pool.pool} · {pool.complete?t('ผลครบ','Results complete'):t('อันดับชั่วคราว','Provisional')}</h3><div className="cw-scroll"><table><thead><tr>{[t('อันดับ','Rank'),t('ทีม','Team'),t('แข่ง','Played'),t('ชนะ','Wins'),t('คะแนน','Points'),t('อัตราเซต','Set ratio'),t('อัตราแต้ม','Point ratio')].map(label=><th key={label}>{label}</th>)}</tr></thead><tbody>{pool.ranks.map((team,index)=><tr key={team.teamId}><td>{team.rank||(pool.ties?.some(tie=>tie.includes(team.teamId))?t('เสมอ','Tied'):index+1)}</td><td>{teamName(team.teamId)} {state.withdrawn?.[team.teamId]&&<b>{t('ถอนตัว','Withdrawn')}</b>}</td><td>{team.played}</td><td>{team.won}</td><td>{team.points}</td><td>{ratio(team.setsWon,team.setsLost)}</td><td>{ratio(team.pointsWon,team.pointsLost)}</td></tr>)}</tbody></table></div>
                    {state.status==='groups'&&pool.complete&&pool.ties?.map((tie,index)=><fieldset key={index}><legend>{t('เท่ากันทุกเกณฑ์: กรอกลำดับผลจับสลากจริงของทีมกลุ่มนี้','All criteria tied: enter physical draw positions for this tied group')}</legend>{tie.map(id=><label key={id}>{teamName(id)}<select aria-label={`${t('ผลจับสลากอันดับ','Rank draw')} ${pool.pool} ${teamName(id)}`} value={drawRanks[pool.pool]?.[id]||''} onChange={event=>setDrawRanks(previous=>({...previous,[pool.pool]:{...previous[pool.pool],[id]:event.target.value}}))}><option value="">—</option>{Array.from({length:pool.ranks.length},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>)}</fieldset>)}
                </article>)}
                {state.status==='groups'&&<GuardedButton disabled={busy||!!data.preview?.blocked.length||state.invalidated} onClick={submitRanking}>{t('ตรวจและยืนยันอันดับ 1–2 ทุกสาย','Validate and confirm top two from each pool')}</GuardedButton>}
                {!!qualifiers.length&&<p className="cw-success">{t('ยืนยันทีมเข้ารอบแล้ว','Qualification confirmed')}: {qualifiers.map(team=>`${team.pool}${team.rank} ${teamName(team.teamId)}`).join(' · ')}</p>}
            </section>}
            {state?.status==='qualified'&&<section className="cw-panel"><h2>{t('4. กรอกผลจับสลากจริงและตรวจผัง','4. Enter physical draw and review bracket')}</h2><p>{t('อันดับ 1 พบอันดับ 2 ห้ามสายเดียวกันในรอบแรก และห้ามทีมซ้ำ หลังยืนยันจะเดินตามผังเดิม','First-place teams face second-place teams, with no same-pool pairing or duplicate teams. The bracket is fixed after confirmation.')}</p>
                {effectivePairs.map((pair,index)=><div className="cw-pair" key={index}><b>{t('คู่','Match')} {index+1}</b>{['home','away'].map(side=>state.format.drawMode==='cross'?<span key={side}>{teamName(pair[side])}</span>:<select key={side} aria-label={`${t('คู่','Draw match')} ${index+1} ${side}`} value={pair[side]} onChange={event=>setPairs(previous=>effectivePairs.map((item,i)=>i===index?{...item,[side]:Number(event.target.value)}:previous[i]||item))}><option value="">{side==='home'?t('เลือกอันดับ 1','Select pool winner'):t('เลือกอันดับ 2','Select runner-up')}</option>{pairOption(index,side)}</select>)}</div>)}
                <p>{t('ผังรอบถัดไป: ผู้ชนะคู่ติดกันพบกันในรอบถัดไปจนถึงรอบชิงฯ การชิงอันดับ 3 เป็นไปตามตัวเลือกในรูปแบบรายการ','Winners of adjacent matches meet through the final. Bronze follows the competition format setting.')}</p>
                <GuardedButton disabled={busy||effectivePairs.some(pair=>!pair.home||!pair.away)} onClick={()=>command('draw',{pairs:effectivePairs})}>{t('ยืนยันผังและสร้างแมตช์รอบถัดไป','Confirm bracket and create knockout fixtures')}</GuardedButton>
            </section>}
            {!!slots.length&&<section className="cw-panel"><h2>{t('ผังแพ้คัดออก','Knockout bracket')}</h2><p>{t('ผู้ชนะ/ผู้แพ้จะเติมในคู่ถัดไปเมื่อผลคะแนนผ่านการตรวจรับแล้ว','Winners and losers populate downstream fixtures after score review confirmation.')}</p><div className="cw-scroll"><table><thead><tr><th>{t('ช่องผัง','Slot')}</th><th>{t('แหล่งทีมแรก','Home source')}</th><th>{t('ทีม','Team')}</th><th>{t('แหล่งทีมสอง','Away source')}</th><th>{t('ทีม','Team')}</th><th>{t('ผล','Result')}</th></tr></thead><tbody>{slots.map(match=><tr key={match.id}><td>{match.slot_key}</td><td>{slotLabel(match.home_source)}</td><td>{teamName(match.home_team_id)}</td><td>{slotLabel(match.away_source)}</td><td>{teamName(match.away_team_id)}</td><td>{match.home_set_score}–{match.away_set_score} {match.result_type==='forfeit'&&<b>Forfeit</b>}</td></tr>)}</tbody></table></div><div className="cw-actions"><GuardedButton disabled={busy||state.invalidated||state.status!=='bracket'} onClick={()=>command('advance')}>{t('ตรวจรับผลและเติมทีมในผังอีกครั้ง','Refresh confirmed bracket results')}</GuardedButton><Link to={`/admin?view=matches&competitionId=${competitionId}`}>{t('จัดวัน เวลา สนามในตารางแข่งขัน','Manage fixture dates and venues')}</Link></div></section>}
            {state&&state.status!=='draft'&&<section className="cw-panel"><h2>{t('คำตัดสินปรับแพ้ / ระงับ / ถอนทีม','Forfeit rulings / holds / withdrawals')}</h2><p>{t('ปรับแพ้เฉพาะแมตช์ที่ยังไม่เริ่ม: 3–0 หรือ 2–0 ตาม Best set เซตละ 25–0 คะแนนสะสม 3–0 หากทั้งสองทีมไม่มาให้ระงับเพื่อพิจารณา','For unstarted fixtures: 3–0 or 2–0 according to best-of setting, 25–0 each set and 3–0 match points. Hold both-absent fixtures for a ruling.')}</p><div className="cw-fields"><label>{t('แมตช์','Match')}<select aria-label={t('แมตช์คำตัดสิน','Ruling match')} value={rulingMatch} onChange={event=>{setRulingMatch(event.target.value);setLosingTeam('');}}><option value="">—</option>{workflowMatches.map(match=><option key={match.id} value={match.id}>#{match.match_number} {teamName(match.home_team_id)} / {teamName(match.away_team_id)} {match.result_type==='forfeit'?'Forfeit':''}</option>)}</select></label><label>{t('ทีมที่ปรับแพ้','Losing team')}<select aria-label={t('ทีมที่ปรับแพ้','Losing team')} value={losingTeam} onChange={event=>setLosingTeam(event.target.value)}><option value="">—</option>{selectedMatch&&[selectedMatch.home_team_id,selectedMatch.away_team_id].filter(Boolean).map(id=><option key={id} value={id}>{teamName(id)}</option>)}<option value="hold">{t('ไม่มาทั้งสองทีม / ระงับไว้','Both absent / hold')}</option></select></label><label>{t('เหตุผลคำตัดสิน','Ruling reason')}<input aria-label={t('เหตุผลคำตัดสิน','Ruling reason')} value={reason} maxLength="2000" onChange={event=>setReason(event.target.value)}/></label></div><div className="cw-actions"><GuardedButton disabled={busy||!rulingMatch||!losingTeam||reason.trim().length<3} onClick={()=>command(losingTeam==='hold'?'hold':'forfeit',{matchId:Number(rulingMatch),losingTeamId:Number(losingTeam),reason})}>{t('ยืนยันคำตัดสิน','Confirm ruling')}</GuardedButton>{state.forfeits?.[rulingMatch]&&<GuardedButton disabled={busy||reason.trim().length<3} onClick={()=>command('clear-forfeit',{matchId:Number(rulingMatch),reason})}>{t('ยกเลิกผลปรับแพ้พร้อมเหตุผล','Reverse forfeit with reason')}</GuardedButton>}{state.holds?.[rulingMatch]&&<GuardedButton disabled={busy||reason.trim().length<3} onClick={()=>command('unhold',{matchId:Number(rulingMatch),reason})}>{t('ยกเลิกการระงับตามคำตัดสิน','Resolve hold with reason')}</GuardedButton>}</div>
                {Object.entries(state.holds||{}).map(([id,hold])=><p key={id} className="cw-warning">#{workflowMatches.find(match=>String(match.id)===id)?.match_number||id} · {hold.reason}</p>)}
                {state.status==='groups'&&<><h3>{t('ถอนทีม','Withdraw team')}</h3><p>{t('คงผลแมตช์ที่แข่งแล้ว ปรับแพ้แมตช์ที่เหลือ หากทีมถอนตัวยังติดอันดับเข้ารอบ ระบบจะระงับไว้ให้ผู้จัดตัดสิน','Played results remain. Remaining fixtures are forfeited. A withdrawn qualifier blocks advancement for organizer adjudication.')}</p><div className="cw-actions"><select aria-label={t('ทีมถอนตัว','Withdrawn team')} value={withdrawTeam} onChange={event=>setWithdrawTeam(event.target.value)}><option value="">—</option>{state.groups.flatMap(group=>group.teamIds).map(id=><option key={id} value={id} disabled={!!state.withdrawn?.[id]}>{teamName(id)}</option>)}</select><GuardedButton disabled={busy||!withdrawTeam||reason.trim().length<3} onClick={()=>command('withdraw',{teamId:Number(withdrawTeam),reason})}>{t('ยืนยันถอนทีมด้วยเหตุผลด้านบน','Confirm withdrawal with the reason above')}</GuardedButton></div></>}
            </section>}
            {state&&(state.plannedBracket||['qualified','bracket'].includes(state.status))&&<section className="cw-panel"><h2>{t('แก้ไขผังก่อนเริ่มรอบถัดไป','Reset an unstarted bracket')}</h2><p>{t('ยกเลิกผังและแมตช์แพ้คัดออกเพื่อยืนยันอันดับใหม่ ใช้ไม่ได้หากมีการบันทึก รายชื่อไลน์อัป หรือเริ่มแข่งขันแล้ว','Removes the knockout bracket and fixtures so rankings can be reconfirmed. Blocked after lineups, recording activity or play begins.')}</p><div className="cw-actions"><input aria-label={t('เหตุผลยกเลิกผัง','Bracket reset reason')} maxLength="2000" value={resetReason} onChange={event=>setResetReason(event.target.value)}/><GuardedButton disabled={busy||resetReason.trim().length<3} onClick={()=>command('reset-bracket',{reason:resetReason})}>{t('ยกเลิกผังที่ยังไม่เริ่มและกลับไปยืนยันอันดับ','Reset unstarted bracket and reconfirm rankings')}</GuardedButton></div></section>}
            {state?.podium&&<section className="cw-panel"><h2>{t('อันดับสรุปรายการ','Final standings')}</h2><p>{t('ชนะเลิศ','Champion')}: {teamName(state.podium.champion)}</p><p>{t('รองชนะเลิศ','Runner-up')}: {teamName(state.podium.runnerUp)}</p>{state.podium.thirdJoint?<p>{t('อันดับ 3 ร่วม','Joint third place')}: {state.podium.thirdJoint.map(teamName).join(' / ')}</p>:<><p>{t('อันดับ 3','Third place')}: {teamName(state.podium.third)}</p><p>{t('อันดับ 4','Fourth place')}: {teamName(state.podium.fourth)}</p></>}</section>}
            {!!data.history.length&&<section className="cw-panel"><h2>{t('ประวัติการดำเนินการ','Audit history')}</h2><ul>{data.history.map(item=><li key={item.id}>{new Date(item.created_at).toLocaleString(th?'th-TH':'en-GB',{timeZone:'Asia/Bangkok'})} · {item.username||item.role} · {item.action}</li>)}</ul></section>}
        </>}
    </div>;
}
