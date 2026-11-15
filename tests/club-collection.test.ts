import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {collectibleKits,canSelectKit,kitForTrophy} from '../lib/club-collection.ts';
import {canSelectDisplay} from '../lib/club-display.ts';
import {createCup,playCupRound} from '../lib/club-cup.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};

test('base kits are always available and nothing is selected by default',()=>{
 const state=stateOf(),kits=collectibleKits(state.club!);
 assert.equal(kits.filter(kit=>kit.kind==='base').length,2);
 assert(kits.every(kit=>!kit.selected));
 assert.equal(canSelectKit(state.club!,'kit.home').ok,true);
 assert.equal(canSelectKit(state.club!,'kit.away').ok,true);
 assert.equal(canSelectKit(state.club!,'kit.cup:missing').ok,false);
});

test('a cup win records a commemorative kit that can be displayed but not charged',()=>{
 const state=stateOf(),started=reduceCommand(state,{type:'club.cup.start',id:'cup-k',tier:1} as never);
 let current=reduceCommand(started,{type:'club.cup.play',id:'cup-k1'} as never);
 current=reduceCommand(current,{type:'club.cup.play',id:'cup-k2'} as never);
 const trophy=current.club!.trophies?.find(entry=>entry.kind==='cup');
 if(!trophy||current.club!.cup!.winner!=='club'){assert.equal(current.club!.trophies?.some(entry=>entry.kitId),false);return}
 assert(trophy.kitId);
 const kit=kitForTrophy(trophy)!;
 assert.equal(kit.kind,'cup');
 assert.equal(canSelectKit(current.club!,kit.id).ok,true);
 const shown=collectibleKits(current.club!).find(entry=>entry.id===kit.id)!;
 assert.equal(shown.owned,true);
 assert.equal(canSelectDisplay(current,'kit',kit.id).ok,true);
 assert.equal(canSelectDisplay(current,'kit','kit.cup:unknown').ok,false);
 const before=current.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 const selected=reduceCommand(current,{type:'club.display',id:'display-kit',kit:kit.id} as never);
 assert.equal(selected.club!.display!.kit,kit.id);
 assert.equal(selected.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),before);
});

test('a league title records a champions kit',()=>{
 let state=stateOf();
 state=reduceCommand(state,{type:'club.league.start',id:'lg-k',tier:0} as never);
 for(let round=1;round<=14;round+=1)state=reduceCommand(state,{type:'club.league.play',id:`lg-k${round}`} as never);
 const position=state.club!.season!.table.findIndex(row=>row.teamId==='club')+1;
 const trophy=state.club!.trophies?.find(entry=>entry.kind==='league');
 if(position===1){assert(trophy,'a league trophy exists for the champion');assert(trophy!.kitId);const kits=collectibleKits(state.club!).filter(kit=>kit.kind==='league');assert.equal(kits.length,1);assert.equal(kits[0].owned,true);assert.equal(canSelectKit(state.club!,kits[0].id).ok,true)}
 else {assert.equal(trophy,undefined,'no league trophy without the title')}
 const synthetic=kitForTrophy({id:'league:synthetic',kind:'league',tier:2,label:'League title',at:new Date().toISOString(),kitId:'kit:league:synthetic'});
 assert(synthetic);assert.equal(synthetic!.kind,'league');assert.equal(synthetic!.colours.length,2);
});

test('season history stores an eleven-player lineup snapshot',()=>{
 let state=stateOf();
 state=reduceCommand(state,{type:'club.league.start',id:'lg-h',tier:0} as never);
 for(let round=0;round<14;round+=1)state=reduceCommand(state,{type:'club.league.play',id:`lg-h${round}`} as never);
 const entry=state.club!.history!.at(-1)!;
 assert(entry.lineup,'history carries a lineup snapshot');
 assert.equal(entry.lineup!.length,11);
 assert.equal(new Set(entry.lineup!.map(player=>player.id)).size,11);
 for(const player of entry.lineup!){assert(player.name.length>0);assert(player.ovr>0);assert(player.position.length>0)}
});

test('displaying a collected kit persists and clears like frames',()=>{
 const state=stateOf(),selected=reduceCommand(state,{type:'club.display',id:'kit-d1',kit:'kit.home'} as never);
 assert.equal(selected.club!.display!.kit,'kit.home');
 assert.equal(collectibleKits(selected.club!).find(kit=>kit.id==='kit.home')!.selected,true);
 const cleared=reduceCommand(selected,{type:'club.display',id:'kit-d2',kit:'none'} as never);
 assert.equal(cleared.club!.display!.kit,undefined);
});
