import test from 'node:test';
import assert from 'node:assert/strict';
import {CLUB_FORMATIONS,autoPick,generateInitialSquad,levelForXp,lineOf,lineRating,lineRatings,positionFit,quoteTraining,trainingCap,trainingPrice,trainPlayer,xpForLevel} from '../lib/club-model.ts';

test('the initial squad is deterministic, twenty players and correctly distributed',()=>{
 const a=generateInitialSquad(),b=generateInitialSquad();
 assert.deepEqual(a,b);
 assert.equal(a.length,20);
 const count=(position:string)=>a.filter(player=>player.position===position).length;
 assert.equal(count('GK'),2);
 assert.equal(a.filter(player=>player.position==='CB'||player.position==='LB'||player.position==='RB').length,7);
 assert.equal(a.filter(player=>['DM','CM','AM'].includes(player.position)).length,7);
 assert.equal(a.filter(player=>['LW','RW','ST'].includes(player.position)).length,4);
 assert.equal(new Set(a.map(player=>player.id)).size,20);
 assert.equal(new Set(a.map(player=>player.number)).size,20);
 for(const player of a){assert(player.ovr>=54&&player.ovr<=64,`${player.name} ${player.ovr}`)}
});

test('line ratings use the PLAN weights and position fit',()=>{
 const squad=generateInitialSquad(),striker=squad.find(player=>player.position==='LW')!;
 assert.equal(lineOf('CB'),'DEF');
 assert.equal(lineOf('CM'),'MID');
 assert.equal(lineOf('ST'),'ATT');
 assert.equal(lineOf('GK'),'GK');
 assert.equal(positionFit('CB','CB'),1);
 assert.equal(positionFit('CB','DM'),.95);
 assert.equal(positionFit('CB','ST'),.85);
 const raw=striker.attributes.sho*.4+striker.attributes.dri*.25+striker.attributes.pac*.15+striker.attributes.pas*.15+striker.attributes.phy*.05;
 assert(Math.abs(lineRating(striker,'ATT')-raw)<.001);
});

test('club overall is DEF/MID/ATT 30% each plus 10% keeper',()=>{
 const squad=generateInitialSquad(),picked=autoPick(squad,'4-3-3'),ratings=lineRatings(picked,'4-3-3');
 assert(ratings.DEF>0&&ratings.MID>0&&ratings.ATT>0&&ratings.GK>0);
 const expected=Math.round((ratings.DEF*.3+ratings.MID*.3+ratings.ATT*.3+ratings.GK*.1)*10)/10;
 assert.equal(ratings.overall,expected);
 assert(Object.values(ratings).every(value=>value>=1&&value<=99));
});

test('auto-pick fills every slot with a legal keeper and no duplicates',()=>{
 const squad=generateInitialSquad(),picked=autoPick(squad,'4-2-3-1');
 assert.equal(picked.length,11);
 assert(picked.every(Boolean));
 assert.equal(new Set(picked.map(player=>player?.id)).size,11);
 assert.equal(picked[0]?.position,'GK');
 for(const slot of CLUB_FORMATIONS['4-2-3-1'])assert(slot.position);
});

test('training prices follow the table and stop at 99 or the centre cap',()=>{
 assert.equal(trainingPrice(55),20);
 assert.equal(trainingPrice(70),40);
 assert.equal(trainingPrice(89),60);
 assert.equal(trainingPrice(94),100);
 assert.equal(trainingPrice(98),160);
 assert.equal(trainingPrice(99),null);
 assert.equal(trainingCap(1),69);assert.equal(trainingCap(3),79);assert.equal(trainingCap(5),99);
 const player={...generateInitialSquad()[5],attributes:{...generateInitialSquad()[5].attributes,pas:88}};
 const capped=quoteTraining(player,'pas',2);
 assert.equal(capped.blocked,'The training centre caps this attribute.');
 const allowed=quoteTraining({...player,attributes:{...player.attributes,pas:60}},'pas',2);
 assert.equal(allowed.blocked,null);assert.equal(allowed.price,20);assert.equal(allowed.to,61);
 const trained=trainPlayer({...player,attributes:{...player.attributes,pas:60}},'pas',2);
 assert.equal(trained.attributes.pas,61);
});

test('club level advances every 100 XP',()=>{
 assert.equal(levelForXp(0),1);assert.equal(levelForXp(99),1);assert.equal(levelForXp(100),2);
 assert.equal(levelForXp(1050),11);assert.equal(xpForLevel(4),300);
});
