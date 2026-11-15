import test from 'node:test';
import assert from 'node:assert/strict';
import * as transfers from '../lib/club-transfers.ts';
import {
 SCOUT_CENTRE_CAPS,
 SELL_REFUND_PERCENT,
 availableSignings,
 canSign,
 isAvailable,
 isWorldPlayerOccupied,
 occupiedPlayerIds,
 sellPlayer,
 sellValue,
 signingPrice,
 signingTarget,
 scoutCap,
 signPlayer,
 startingElevenProblem,
 withoutOccupied,
 worldPlayerOvr,
 worldPlayerToClubPlayer,
} from '../lib/club-transfers.ts';
import {FOOTBALL_PLAYERS} from '../lib/football-data.ts';
import type {FootballPosition,FootballRosterPlayer} from '../lib/football-data.ts';
import {overall} from '../lib/football-engine/stats-v1.ts';
import {clubRatings,createClubState} from '../lib/club-state.ts';
import type {ClubState} from '../lib/club-state.ts';

const now=new Date('2026-11-14T04:00:00.000Z');
const at=now.toISOString();

const makeClub=(suffix:string,scoutCentre=1):ClubState=>{
 const club=createClubState({name:`Club ${suffix}`,shortName:suffix.slice(0,3).toUpperCase()},`op-${suffix}`,now);
 return {...club,facilities:{...club.facilities,scoutCentre}};
};
const withScout=(club:ClubState,scoutCentre:number):ClubState=>({...club,facilities:{...club.facilities,scoutCentre}});
const ovrOf=(world:FootballRosterPlayer)=>worldPlayerOvr(world);
const worldByOvr=(min:number,max:number):FootballRosterPlayer=>{
 const world=FOOTBALL_PLAYERS.find(player=>ovrOf(player)>=min&&ovrOf(player)<=max);
 assert(world,`the versioned roster must contain a ${min}-${max} OVR player`);
 return world!;
};
const benchOf=(club:ClubState)=>club.players.find(player=>!club.lineup.includes(player.id))!;
const shirtNumbers=(club:ClubState)=>club.players.map(player=>player.number);

test('PLAN 3.5 signing price formula hits the worked examples and the 300 floor',()=>{
 assert.equal(signingPrice(65),1000);
 assert.equal(signingPrice(80),2700);
 assert.equal(signingPrice(60),500);
 assert.equal(signingPrice(70),1500);
 assert.equal(signingPrice(75),2000);
 assert.equal(signingPrice(76),2108);
 assert.equal(signingPrice(90),5300);
 assert.equal(signingPrice(99),9008);
 assert.equal(signingPrice(1),300);
 assert.equal(signingPrice(50),300);
 assert.equal(signingPrice(58),300);
 assert.equal(signingPrice(59),400);
 assert.equal(signingPrice(65.4),1040);
 assert.equal(signingPrice(65.5),1050);
 let previous=0;
 for(let ovr=1;ovr<=99;ovr+=1){
  const price=signingPrice(ovr);
  assert(Number.isSafeInteger(price)&&price>=previous,`${ovr} OVR should be whole and monotonic`);
  previous=price;
 }
 assert.throws(()=>signingPrice(Number.NaN),/OVR/);
 assert.throws(()=>signingPrice(Number.POSITIVE_INFINITY),/OVR/);
});

test('PLAN 3.5 sale value is 50 % of the paid price rounded down',()=>{
 assert.equal(SELL_REFUND_PERCENT,50);
 assert.equal(sellValue(1000),500);
 assert.equal(sellValue(1001),500);
 assert.equal(sellValue(999),499);
 assert.equal(sellValue(300),150);
 assert.equal(sellValue(0),0);
 assert.throws(()=>sellValue(-1),/signing price/);
 assert.throws(()=>sellValue(1.5),/signing price/);
 assert.throws(()=>sellValue(Number.NaN),/signing price/);
});

test('PLAN 3.5 scout centre L1-L4 signs up to 68/76/84/99 OVR',()=>{
 assert.deepEqual([...SCOUT_CENTRE_CAPS],[68,76,84,99]);
 assert.deepEqual([1,2,3,4].map(scoutCap),[68,76,84,99]);
 assert.equal(scoutCap(0),68);
 assert.equal(scoutCap(9),99);
 assert.equal(scoutCap(2.4),76);
 assert.throws(()=>scoutCap(Number.NaN),/Scout centre level/);
});

test('canSign returns a clear refusal reason for the scout-centre cap and quotes the price',()=>{
 const club=makeClub('scout',1);
 const target=(id:string,ovr:number)=>({id,ovr});
 assert.deepEqual(canSign(target('within',68),club),{ok:true,price:signingPrice(68)});
 const refused=canSign(target('above',69),club);
 assert.equal(refused.ok,false);
 if(!refused.ok){
  assert.match(refused.reason,/scout centre/i);
  assert.match(refused.reason,/68/);
  assert.equal(refused.price,signingPrice(69));
 }
 const overrides=[[2,76],[3,84],[4,99]] as const;
 for(const [level,cap] of overrides){
  const raised=withScout(club,level);
  assert.equal(canSign(target(`ok-${cap}`,cap),raised).ok,true);
  assert.equal(canSign(target(`over-${cap}`,cap+1),raised).ok,false);
 }
 const real=worldByOvr(85,99);
 const realCheck=canSign(real,withScout(club,4));
 assert.equal(realCheck.ok,true);
 assert.equal(realCheck.price,signingPrice(ovrOf(real)));
 assert.equal(canSign(real,club).ok,false);
 assert.throws(()=>canSign({id:'',ovr:60},club),/identity/i);
 assert.throws(()=>canSign({id:'broken',ovr:Number.NaN},club),/OVR/);
});

test('signing a real roster player pays the quote, adds them to the squad and keeps the input intact',()=>{
 const club=makeClub('sign');
 const before=structuredClone(club);
 const world=worldByOvr(55,68);
 const price=signingPrice(ovrOf(world));
 const result=signPlayer(club,world,{at,usedNumbers:shirtNumbers(club)});
 assert.equal(result.price,price);
 assert.equal(result.player.id,world.id);
 assert.equal(result.player.origin,'signed');
 assert.equal(result.player.paidPrice,price);
 assert.equal(result.club.players.length,club.players.length+1);
 const signed=result.club.players[result.club.players.length-1];
 assert.equal(signed.id,world.id);
 assert.equal(signed.origin,'signed');
 assert.deepEqual(signed.attributes,world.attributes);
 assert.equal(signed.position,world.position);
 assert.deepEqual(result.club.lineup,club.lineup);
 assert.equal(startingElevenProblem(result.club),null);
 assert.deepEqual(result.receipt,{id:`signing:${world.id}`,kind:'signing',playerId:world.id,price,at});
 assert.doesNotThrow(()=>clubRatings(result.club));
 assert.deepEqual(club,before);
 // Shirt numbers stay unique even when the caller does not pass usedNumbers.
 const autoNumbered=signPlayer(club,world,{at});
 const numbers=autoNumbered.club.players.map(player=>player.number);
 assert.equal(new Set(numbers).size,numbers.length);
 assert(numbers.every(number=>number>=1&&number<=99));
 assert.throws(()=>signPlayer(result.club,world,{at}),/already in your club/);
 const strong=worldByOvr(85,99);
 assert.throws(()=>signPlayer(club,strong,{at}),/scout centre/);
 assert.deepEqual(club,before);
});

test('signPlayer also accepts an already converted squad player and a caller receipt id',()=>{
 const club=makeClub('convert');
 const world=worldByOvr(55,68);
 const converted=worldPlayerToClubPlayer(world,{number:88,usedNumbers:shirtNumbers(club)});
 assert.equal(converted.number,88);
 const result=signPlayer(club,converted,{at,receiptId:'op-sign-1'});
 assert.equal(result.receipt.id,'op-sign-1');
 assert.equal(result.player.id,world.id);
 assert.equal(result.club.players[result.club.players.length-1].id,world.id);
 assert.equal(result.price,signingPrice(ovrOf(world)));
 assert.throws(()=>signPlayer(club,world,{receiptId:''}),/receipt ID/);
});

test('the gifted initial squad can be released for 0 funds while the XI stays legal',()=>{
 const club=makeClub('gift');
 const bench=benchOf(club);
 const before=structuredClone(club);
 const result=sellPlayer(club,bench.id,{at});
 assert.equal(result.refund,0);
 assert.deepEqual(result.receipt,{id:`sale:${bench.id}`,kind:'sale',playerId:bench.id,paidPrice:0,refund:0,at});
 assert.equal(result.player.origin,'initial');
 assert.equal(result.club.players.length,club.players.length-1);
 assert.equal(result.club.players.some(player=>player.id===bench.id),false);
 assert.deepEqual(result.club.lineup,club.lineup);
 assert.equal(startingElevenProblem(result.club),null);
 assert.deepEqual(club,before);
 assert.throws(()=>sellPlayer(club,'missing-player',{at}),/not in your club/);
});

test('selling a starter is refused with a reason, but a spare keeper can be sold',()=>{
 const club=makeClub('lineup');
 const before=structuredClone(club);
 const starter=club.lineup[0];
 assert.throws(()=>sellPlayer(club,starter,{at}),/starting eleven|substitute/i);
 assert.deepEqual(club,before);
 const keeper=club.lineup
  .map(id=>club.players.find(player=>player.id===id)!)
  .find(player=>player.position==='GK')!;
 assert(keeper,`the initial ${club.formation} lineup must start a keeper`);
 const spareKeeper=club.players.find(player=>player.position==='GK'&&!club.lineup.includes(player.id))!;
 assert(spareKeeper,`the initial squad must carry a spare keeper to sell`);
 const sold=sellPlayer(club,spareKeeper.id,{at});
 assert.equal(sold.club.players.some(player=>player.id===spareKeeper.id),false);
 assert.equal(startingElevenProblem(sold.club),null);
 assert.equal(sold.refund,0);
 assert.throws(()=>sellPlayer(club,keeper.id,{at}),/starting eleven|substitute/i);
});

test('a signed player sells for half the paid price and training never adds a refund',()=>{
 const club=makeClub('resale');
 const world=worldByOvr(55,68);
 const signed=signPlayer(club,world,{at,usedNumbers:shirtNumbers(club)});
 const price=signed.price;
 const before=structuredClone(signed.club);
 const sold=sellPlayer(signed.club,world.id,{at});
 assert.equal(sold.refund,sellValue(price));
 assert.equal(sold.receipt.paidPrice,price);
 assert.equal(sold.receipt.refund,sellValue(price));
 assert.equal(sold.club.players.some(player=>player.id===world.id),false);
 assert.deepEqual(sold.club.lineup,club.lineup);
 assert.equal(startingElevenProblem(sold.club),null);
 assert.deepEqual(signed.club,before);
 // A trained player is worth more on the pitch, not on the balance sheet: only the paid price counts.
 const trained={...signed.club,players:signed.club.players.map(player=>player.id===world.id?{...player,ovr:player.ovr+5}:player)};
 assert.equal(sellPlayer(trained,world.id,{at}).refund,sellValue(price));
 // Older saves may pass the recorded price explicitly.
 const unrecorded={...signed.club,players:signed.club.players.map(player=>player.id===world.id?{...player,paidPrice:undefined}:player)};
 assert.throws(()=>sellPlayer(unrecorded,world.id,{at}),/no recorded signing price/i);
 assert.equal(sellPlayer(unrecorded,world.id,{paidPrice:price,at}).refund,sellValue(price));
});

test('startingElevenProblem names every way the starting XI can be illegal',()=>{
 const player=(id:string,position:FootballPosition)=>({id,position,origin:'initial' as const,ovr:60});
 const outfield=Array.from({length:10},(_,index)=>player(`out-${index}`,'ST'));
 const bench=player('bench','CM');
 const club={players:[player('keeper','GK'),...outfield,bench],lineup:['keeper',...outfield.map(entry=>entry.id)],facilities:{scoutCentre:1}};
 assert.equal(startingElevenProblem(club),null);
 assert.match(startingElevenProblem({...club,lineup:club.lineup.slice(0,10)})!,/eleven/);
 assert.match(startingElevenProblem({...club,lineup:[...club.lineup.slice(0,10),club.lineup[0]]})!,/twice/);
 assert.match(startingElevenProblem({...club,lineup:[...club.lineup.slice(0,10),'ghost']})!,/missing/);
 assert.match(startingElevenProblem({...club,lineup:[...club.lineup.slice(1,11),'bench']})!,/goalkeeper/);
 const secondKeeper=player('second-keeper','GK');
 const twoKeepers={...club,players:[...club.players,secondKeeper],lineup:[club.lineup[0],secondKeeper.id,...club.lineup.slice(2)]};
 assert.match(startingElevenProblem(twoKeepers)!,/goalkeeper/);
 // A sale is refused when the resulting XI would be illegal, even for a substitute.
 assert.throws(()=>sellPlayer({...club,lineup:club.lineup.slice(0,10)},'bench'),/break the starting eleven/);
 assert.throws(()=>sellPlayer(twoKeepers,'bench'),/break the starting eleven/);
 const sold=sellPlayer(club,'bench');
 assert.equal(sold.refund,0);
 assert.equal(sold.club.players.some(entry=>entry.id==='bench'),false);
});

test('one real player identity can only belong to one club and leaves the available list',()=>{
 const alpha=makeClub('alpha');
 const beta=makeClub('beta');
 const world=worldByOvr(55,68);
 const occupied=occupiedPlayerIds(beta.players);
 assert.equal(isAvailable(world.id,alpha,occupied),true);
 assert.equal(isWorldPlayerOccupied(world.id,occupied),false);
 assert.equal(canSign(world,alpha,occupied).ok,true);
 const signed=signPlayer(alpha,world,{at,occupied});
 assert.equal(isAvailable(world.id,signed.club,occupied),false);
 const own=canSign(world,signed.club,occupied);
 assert.equal(own.ok,false);
 if(!own.ok)assert.match(own.reason,/already in your club/i);
 const worldOccupied=occupiedPlayerIds([...beta.players,...signed.club.players]);
 const taken=canSign(world,beta,worldOccupied);
 assert.equal(taken.ok,false);
 if(!taken.ok)assert.match(taken.reason,/another club/);
 assert.equal(isAvailable(world.id,beta,worldOccupied),false);
 assert.equal(isAvailable(world.id,beta),true);
 const candidates=FOOTBALL_PLAYERS.slice(0,80);
 assert(candidates.some(candidate=>candidate.id===world.id));
 assert.equal(availableSignings(candidates,alpha).some(candidate=>candidate.id===world.id),true);
 assert.equal(availableSignings(candidates,signed.club).some(candidate=>candidate.id===world.id),false);
 assert.equal(withoutOccupied(candidates,new Set([world.id])).some(candidate=>candidate.id===world.id),false);
});

test('availableSignings drops club-owned and world-occupied identities',()=>{
 const club=makeClub('list');
 const signedTarget=worldByOvr(55,68);
 const signed=signPlayer(club,signedTarget,{at,usedNumbers:shirtNumbers(club)});
 const occupiedTarget=FOOTBALL_PLAYERS.find(player=>player.id!==signedTarget.id&&player.id!==signed.club.players[0]?.id)!;
 const candidates=[...FOOTBALL_PLAYERS.slice(0,40),signedTarget,occupiedTarget];
 const occupied=new Set([occupiedTarget.id]);
 const available=availableSignings(candidates,signed.club,occupied);
 assert.equal(available.some(candidate=>candidate.id===signedTarget.id),false);
 assert.equal(available.some(candidate=>candidate.id===occupiedTarget.id),false);
 assert(available.every(candidate=>candidate.id.length>0));
 assert.equal(available.length,candidates.filter(candidate=>candidate.id!==signedTarget.id&&candidate.id!==occupiedTarget.id).length);
});

test('world roster conversion keeps the real identity, attributes and a legal shirt number',()=>{
 const world=worldByOvr(55,68);
 const converted=worldPlayerToClubPlayer(world,{usedNumbers:[]});
 assert.equal(converted.id,world.id);
 assert.equal(converted.name,world.name);
 assert.equal(converted.position,world.position);
 assert.equal(converted.origin,'signed');
 assert.equal(converted.ovr,ovrOf(world));
 assert.deepEqual(converted.attributes,world.attributes);
 assert.equal(converted.foot,world.preferredFoot==='left'?'left':'right');
 assert.equal(converted.number,world.number);
 const clash=worldPlayerToClubPlayer(world,{usedNumbers:[world.number]});
 assert.notEqual(clash.number,world.number);
 assert(clash.number>=1&&clash.number<=99);
 assert.equal(worldPlayerToClubPlayer(world,{number:88,usedNumbers:[]}).number,88);
 assert.throws(()=>worldPlayerToClubPlayer(world,{number:88,usedNumbers:[88]}),/taken/);
 assert.throws(()=>worldPlayerToClubPlayer(world,{number:0}),/between 1 and 99/);
 const keeper=FOOTBALL_PLAYERS.find(player=>player.position==='GK')!;
 const keeperConverted=worldPlayerToClubPlayer(keeper);
 assert.deepEqual(keeperConverted.goalkeeper,keeper.goalkeeper);
 assert.equal(ovrOf(keeper),overall('GK',{...keeper.attributes,...keeper.goalkeeper}));
 assert.deepEqual(signingTarget(keeper),{id:keeper.id,name:keeper.name,position:'GK',ovr:ovrOf(keeper)});
});

test('receipt timestamps come from the caller, never from an ambient clock',()=>{
 const club=makeClub('time');
 const world=worldByOvr(55,68);
 const signed=signPlayer(club,world,{at});
 assert.equal(signed.receipt.at,at);
 assert.equal(signPlayer(club,world,{}).receipt.at,'');
 const sold=sellPlayer(signed.club,world.id,{at});
 assert.equal(sold.receipt.at,at);
 const freeRelease=sellPlayer(makeClub('time2'),benchOf(makeClub('time2')).id);
 assert.equal(freeRelease.receipt.at,'');
});

test('transfer rules are pure: no clock, storage or network, and inputs are never mutated',()=>{
 for(const [name,value] of Object.entries(transfers)){
  if(typeof value!=='function')continue;
  const source=Function.prototype.toString.call(value);
  assert.doesNotMatch(source,/Date\.now|new Date\(|localStorage|indexedDB|fetch\s*\(|Math\.random|randomUUID|XMLHttpRequest/,`${name} must stay pure`);
 }
 const club=makeClub('pure');
 const world=worldByOvr(55,68);
 const candidates=FOOTBALL_PLAYERS.slice(0,25);
 const clubBefore=structuredClone(club);
 const worldBefore=structuredClone(world);
 const candidatesBefore=structuredClone(candidates);
 canSign(world,club,[]);
 isAvailable(world.id,club);
 occupiedPlayerIds(club.players);
 availableSignings(candidates,club,[]);
 withoutOccupied(candidates,new Set([world.id]));
 signingTarget(world);
 worldPlayerToClubPlayer(world,{usedNumbers:shirtNumbers(club)});
 const signed=signPlayer(club,world,{at,usedNumbers:shirtNumbers(club)});
 sellPlayer(signed.club,world.id,{at});
 assert.deepEqual(club,clubBefore);
 assert.deepEqual(world,worldBefore);
 assert.deepEqual(candidates,candidatesBefore);
 const next=signPlayer(club,world,{at,usedNumbers:shirtNumbers(club)});
 assert.notEqual(next.club,club);
 assert.notEqual(next.club.players,club.players);
 assert.equal(next.club.lineup,club.lineup);
});
