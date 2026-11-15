import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {baseVisuals,baseRoom,baseSceneBounds} from '../lib/club-base.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3',colours:{primary:'#2f6f4e',secondary:'#c8f56e'}} as never)};

test('the base exposes eight rooms inside the scene bounds',()=>{
 const visuals=baseVisuals(stateOf().club!),bounds=baseSceneBounds();
 assert.equal(visuals.rooms.length,8);
 const ids=new Set(visuals.rooms.map(room=>room.id));
 assert.deepEqual([...ids].sort(),['cup','dressing','league','stadium','tactics','training','transfers','trophies'].sort());
 for(const room of visuals.rooms){
  assert(room.x>=bounds.minX&&room.x<=bounds.maxX);
  assert(room.z>=bounds.minZ&&room.z<=bounds.maxZ);
  assert(room.label.length>0&&room.labelZh.length>0);
  assert(room.href.startsWith('/club#'));
  assert(room.accent.length===2);
 }
});

test('facility levels drive the stadium, training and scout visuals',()=>{
 const state=stateOf();
 const base=baseVisuals(state.club!);
 assert.equal(base.stadium.level,1);
 assert.equal(base.stadium.capacity,4200);
 assert.equal(base.stadium.floodlights,false);
 assert.equal(base.training.cap,69);
 assert.equal(base.scout.cap,68);

});

test('rooms report the real squad, season and trophy state',()=>{
 const state=stateOf(),visuals=baseVisuals(state.club!);
 assert.equal(baseRoom(visuals,'dressing')!.status.includes(String(state.club!.players.length)),true);
 assert.equal(baseRoom(visuals,'league')!.status,'no season yet');
 assert.equal(baseRoom(visuals,'cup')!.status,'no cup yet');
 assert.equal(visuals.trophyRoom.trophies,0);
 assert.equal(visuals.squad.starters,11);
 assert.equal(baseRoom(visuals,'tactics')!.status.startsWith(state.club!.tactics.active),true);
});

test('the base derivation is pure and uses the club colours',()=>{
 const state=stateOf(),snapshot=JSON.stringify(state.club!);
 const visuals=baseVisuals(state.club!);
 assert.equal(JSON.stringify(state.club!),snapshot);
 assert.equal(visuals.theme.primary,'#2f6f4e');
 assert.equal(visuals.theme.secondary,'#c8f56e');
 assert.equal(baseVisuals(state.club!).rooms[0].id,'training');
});
