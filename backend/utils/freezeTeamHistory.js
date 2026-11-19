const {restoreSnapshot}=require('./automaticEntryRoster');
const {teamCompositionStaff}=require('./teamCompositionStaff');
const parse=value=>typeof value==='string'?JSON.parse(value):value||{};
const keys=['id','number','first_name','last_name','first_name_th','last_name_th','first_name_en','last_name_en','position','role','is_captain','is_libero1','is_libero2','is_playing'];
async function freezeEntryHistory(c,entry){
    const matches=(await c.query(`SELECT m.*,co.title AS competition_title,co.gender AS competition_gender,
        h.name AS home_name,h.name_th AS home_name_th,h.name_en AS home_name_en,h.code AS home_code,
        a.name AS away_name,a.name_th AS away_name_th,a.name_en AS away_name_en,a.code AS away_code
        FROM matches m JOIN competitions co ON co.id=m.competition_id
        LEFT JOIN teams h ON h.id=m.home_team_id LEFT JOIN teams a ON a.id=m.away_team_id
        WHERE m.competition_id=? AND (m.home_team_id=? OR m.away_team_id=?) AND m.status<>'scheduled'
        AND COALESCE(m.age_group_id,co.age_group_id,0)=COALESCE(?,co.age_group_id,0) ORDER BY m.id FOR UPDATE OF m`,[entry.competition_id,entry.team_id,entry.team_id,entry.age_group_id])).rows;
    for(const match of matches){
        const setup={title:match.competition_title,gender:match.gender||match.competition_gender,maxSets:match.max_sets||3,pointsPerSet:25,decidingSetPoints:15,...parse(match.match_setup)};
        let changed=false;
        for(const side of ['home','away']){
            const prior=setup[side]||{},teamId=match[`${side}_team_id`];
            const registration=(await c.query(`SELECT te.id FROM team_entries te JOIN competitions co ON co.id=te.competition_id WHERE te.competition_id=? AND te.team_id=?
                AND COALESCE(te.age_group_id,co.age_group_id,0)=COALESCE(?,co.age_group_id,0) ORDER BY te.id LIMIT 1`,[match.competition_id,teamId,match.age_group_id])).rows[0];
            const frozen={name:match[`${side}_name`]||'',name_th:match[`${side}_name_th`],name_en:match[`${side}_name_en`],code:match[`${side}_code`]||'',...prior};
            if(!Array.isArray(prior.players)){
                const players=registration?(await c.query(`SELECT p.*,ep.number,ep.role,ep.is_captain,ep.is_libero1,ep.is_libero2,ep.is_playing,ep.athlete_snapshot FROM team_entry_players ep JOIN players p ON p.id=ep.player_id WHERE ep.team_entry_id=? ORDER BY ep.number,p.id`,[registration.id])).rows.map(restoreSnapshot):[];
                frozen.players=players.map(player=>Object.fromEntries(keys.map(key=>[key,player[key]??null])));changed=true;
            }
            if(!Array.isArray(prior.staff)){frozen.staff=registration?(await teamCompositionStaff(c,registration.id)).staff.map(person=>({id:person.id,first_name:person.first_name,last_name:person.last_name,role:person.role})):[];changed=true;}
            setup[side]=frozen;
        }
        if(changed)await c.query('UPDATE matches SET match_setup=? WHERE id=?',[JSON.stringify(setup),match.id]);
    }
}
async function freezeTeamHistory(c,teamId){for(const entry of (await c.query('SELECT * FROM team_entries WHERE team_id=? ORDER BY id',[teamId])).rows)await freezeEntryHistory(c,entry);}
module.exports={freezeEntryHistory,freezeTeamHistory};
