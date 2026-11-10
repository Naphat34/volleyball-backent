const test = require('node:test');
const assert = require('node:assert/strict');
const { createPayload, commandPayload, view } = require('../utils/customVis');
const { importCustomVis } = require('../utils/importCustomVis');

function ready() {
    const players = Array.from({length:10}, (_, i) => ({number:i+1,first_name:'Player',last_name:String(i+1),position:i===9?'L':'OH'}));
    const payload = createPayload({title:'Batch',maxSets:3,home:{name:'Home',players},away:{name:'Away',players}},'batch-test');
    return commandPayload(payload,{operationId:'batch-lineup-operation',revision:payload.revision,command:{type:'SET_LINEUP',lineups:{home:[1,2,3,4,5,6],away:[1001,1002,1003,1004,1005,1006]},servingTeam:'away',firstSetHomeLeft:true}}).payload;
}
const pairs=[{playerOut:1,playerIn:7},{playerOut:2,playerIn:8}];
test('custom and generated offline batch substitution is atomic, idempotent and undone as one group',async()=>{
    const offline=await import('../../client/src/offline/visEngine.js');
    for(const engine of [{commandPayload,view},offline]) {
        const initial=ready();
        const op={operationId:'batch-substitution-operation',revision:initial.revision,command:{type:'SUBSTITUTIONS',team:'home',pairs}};
        const result=engine.commandPayload(initial,op);
        assert.equal(result.response.state.substitutions.home,2);
        assert.deepEqual(result.response.state.lineups.home,[7,8,3,4,5,6]);
        assert.equal(result.response.events.length,2);
        const restored = importCustomVis(result.payload, 'restored-batch');
        assert.equal(view(restored).state.substitutions.home,2);
        const restoredUndo = commandPayload(restored,{operationId:'restored-undo-operation',revision:restored.revision,command:{type:'UNDO'}});
        assert.equal(restoredUndo.response.deletedEventIds.length,2);
        assert.equal(engine.commandPayload(result.payload,op).response.duplicate,true);
        const undone=engine.commandPayload(result.payload,{operationId:'batch-undo-operation',revision:result.payload.revision,command:{type:'UNDO'}});
        assert.equal(undone.response.deletedEventIds.length,2);
        assert.equal(undone.response.state.substitutions.home,0);
        assert.deepEqual(engine.view(initial).state.lineups.home,[1,2,3,4,5,6]);
    }
});
test('duplicate players, invalid pairs and quota overflow leave the original payload intact',()=>{
    for(const selected of [[pairs[0],pairs[0]],[pairs[0],{playerOut:2,playerIn:10}],[pairs[0],{playerOut:99,playerIn:8}]]) {
        const payload=ready(), before=JSON.stringify(payload);
        assert.throws(()=>commandPayload(payload,{operationId:'invalid-batch-operation',revision:payload.revision,command:{type:'SUBSTITUTIONS',team:'home',pairs:selected}}));
        assert.equal(JSON.stringify(payload),before);
    }
    const payload=ready(); payload.match.vis_state.substitutionLimit=1;
    const before=JSON.stringify(payload);
    assert.throws(()=>commandPayload(payload,{operationId:'quota-batch-operation',revision:payload.revision,command:{type:'SUBSTITUTIONS',team:'home',pairs}}));
    assert.equal(JSON.stringify(payload),before);
});

