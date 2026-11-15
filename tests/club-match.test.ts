import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {simulateClubMatch,summarizeMatch,teamFromClub,opponentFor,createLiveMatch,advanceLiveMatch,setLiveTactic,liveMatchReport,type ClubTeam} from '../lib/club-match.ts';

const club=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never).club!};
const team=(over:Partial<ClubTeam['lines']>={},tactic:ClubTeam['tactic']='balanced'):ClubTeam=>({name:'Test FC',shortName:'TST',lines:{DEF:60,MID:60,ATT:60,GK:60,...over},tactic,scorers:{ATT:['Striker'],MID:['Mid'],DEF:['Back']}});
const avg=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;

test('the same lineup, tactic and seed always produce the same match',()=>{
 const home=team(),away=team();const a=simulateClubMatch(home,away,1234),b=simulateClubMatch(home,away,1234);
 assert.deepEqual(a,b);
 assert.notDeepEqual(simulateClubMatch(home,away,1234),simulateClubMatch(home,away,999));
});

test('a match report is internally consistent',()=>{
 const report=simulateClubMatch(team(),team({DEF:66}),77);
 assert.equal(report.possession[0]+report.possession[1],100);
 assert(report.score[0]>=0&&report.score[1]<=12);
 assert(report.shots[0]>=report.onTarget[0]&&report.shots[1]>=report.onTarget[1]);
 assert(report.shots[0]>=report.score[0]&&report.shots[1]>=report.score[1]);
 for(const event of report.events){assert(event.minute>=1&&event.minute<=90);assert(['goal','chance','save'].includes(event.kind))}
 assert.equal(report.events.filter(event=>event.kind==='goal'&&event.side==='home').length,report.score[0]);
 assert.equal(report.events.filter(event=>event.kind==='goal'&&event.side==='away').length,report.score[1]);
 for(const key of ['dominantLine','dominantSide','chancesFrom','concededBecause','tacticNote','nextStep'] as const)assert(report.explanation[key].length>0);
});

test('a stronger attack scores more across seeds',()=>{
 const strong=team({ATT:82}),weak=team({ATT:52}),opponent=team();
 const strongGoals=Array.from({length:120},(_,index)=>simulateClubMatch(strong,opponent,1000+index).score[0]);
 const weakGoals=Array.from({length:120},(_,index)=>simulateClubMatch(weak,opponent,1000+index).score[0]);
 assert(avg(strongGoals)>avg(weakGoals)+0.5,`${avg(strongGoals)} vs ${avg(weakGoals)}`);
});

test('home advantage shows up over many matches',()=>{
 let homeGoals=0,awayGoals=0;
 for(let seed=1;seed<=200;seed+=1){const report=simulateClubMatch(team(),team(),seed);homeGoals+=report.score[0];awayGoals+=report.score[1]}
 assert(homeGoals>awayGoals,`${homeGoals} vs ${awayGoals}`);
});

test('tactics change the shape of the result',()=>{
 const press=team({DEF:64,MID:64,ATT:64},'press'),possession=team({DEF:64,MID:64,ATT:64},'possession');
 let pressConceded=0,possessionConceded=0;
 for(let seed=1;seed<=150;seed+=1){
  pressConceded+=simulateClubMatch(team({ATT:70}),press,seed).score[0];
  possessionConceded+=simulateClubMatch(team({ATT:70}),possession,seed).score[0];
 }
 assert(pressConceded>possessionConceded,`${pressConceded} vs ${possessionConceded}`);
});

test('the club team is built from the saved lineup and its active tactic',()=>{
 const state=reduceCommand((()=>{const s=structuredClone(initialState());s.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return s})(),{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never);
 const funded={...state,economy:state.economy};
 const trained=reduceCommand(reduceCommand(funded,{type:'club.tactic.train',id:'tt',tactic:'press'} as never),{type:'club.tactic',id:'t',tactic:'press'} as never);
 const before=teamFromClub(funded.club!),after=teamFromClub(trained.club!);
 assert.equal(after.tactic,'press');
 assert.equal(after.name,'Northbridge FC');
 assert.equal(after.scorers.ATT.length>0,true);
 assert(after.lines.DEF!==before.lines.DEF||after.lines.MID!==before.lines.MID||after.lines.ATT!==before.lines.ATT);
});

test('opponents are deterministic per tier and get stronger with the tier',()=>{
 const low=opponentFor(0,42),high=opponentFor(3,42);
 assert.deepEqual(low,opponentFor(0,42));
 const avgLine=(opponent:ClubTeam)=>avg([opponent.lines.DEF,opponent.lines.MID,opponent.lines.ATT]);
 assert(avgLine(high)>avgLine(low)+5,`${avgLine(high)} vs ${avgLine(low)}`);
});

test('simulating never mutates the club or the opponent',()=>{
 const saved=club(),snapshot=JSON.stringify(saved),home=teamFromClub(saved),away=opponentFor(1,5);
 simulateClubMatch(home,away,11);
 assert.equal(JSON.stringify(saved),snapshot);
 assert.deepEqual(home,teamFromClub(saved));
});

test('the summary names the winner and the stat lines',()=>{
 const report=simulateClubMatch(team({ATT:85}),team({ATT:45,DEF:45}),3);
 const summary=summarizeMatch(report);
 assert(summary.headline.length>0);
 assert.match(summary.possessionReport,/%/);
 assert.match(summary.shotsReport,/on target/);
 assert(summary.headline.includes('–'));
});

const fullState=()=>{const base=structuredClone(initialState());base.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(base,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
test('playing a match through the command stores a reproducible result and pays nothing',()=>{
 const state=fullState(),fundsBefore=state.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0);
 const played=reduceCommand(state,{type:'club.match',id:'match-op-1',tier:1} as never,new Date('2026-11-14T00:00:00Z'));
 const record=played.club!.matches![0];
 assert.equal(played.club!.matches!.length,1);
 assert.equal(record.tier,1);
 assert(record.opponent.name.length>0);
 assert(record.score[0]>=0);
 const again=reduceCommand(state,{type:'club.match',id:'match-op-1',tier:1} as never,new Date('2026-11-14T00:00:00Z'));
 assert.deepEqual(again.club!.matches![0],record);
 assert.equal(played.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),fundsBefore);
 const second=reduceCommand(played,{type:'club.match',id:'match-op-2',tier:1} as never);
 assert.equal(second.club!.matches!.length,2);
 assert.equal(second.club!.matches![0].id,'match-op-2');
});

test('player ratings list every outfield starter and reward goals',()=>{
 const report=simulateClubMatch(team({ATT:90}),team({DEF:40}),5);
 assert(report.playerRatings.home.length>0);
 for(const rating of report.playerRatings.home){assert(rating.rating>=3&&rating.rating<=10);assert(['DEF','MID','ATT'].includes(rating.line))}
 const goals=report.events.filter(event=>event.side==='home'&&event.kind==='goal'&&event.scorer);
 if(goals.length){const scorer=goals[0].scorer!;const row=report.playerRatings.home.find(entry=>entry.name===scorer);assert(row);assert(row!.goals>=1);assert(row!.rating>=6)}
});

test('a saved match keeps only the final score and the teams',()=>{
 const state=fullState();
 const played=reduceCommand(state,{type:'club.match',id:'score-op',tier:2} as never,new Date('2026-11-14T00:00:00Z'));
 const record=played.club!.matches![0];
 assert.equal(record.score.length,2);
 assert(record.teams.home.length>0&&record.teams.away.length>0);
 assert(record.opponent.name.length>0);
 assert(!('events' in record)&&!('timeline' in record)&&!('ballTrack' in record));
 assert.equal(record.tier,2);
});

test('playing block by block without decisions equals the quick simulation exactly',()=>{
 const home=team({ATT:72,MID:66}),away=team({DEF:58,GK:61});
 const quick=simulateClubMatch(home,away,2024);
 let live=createLiveMatch(home,away,2024);
 while(!live.finished)live=advanceLiveMatch(live);
 const replay=liveMatchReport(live);
 assert.deepEqual(replay.score,quick.score);
 assert.deepEqual(replay.events,quick.events);
 assert.deepEqual(replay.shots,quick.shots);
 assert.deepEqual(replay.onTarget,quick.onTarget);
 assert.deepEqual(replay.possession,quick.possession);
});

test('a live session survives JSON and resumes to the same final score',()=>{
 const home=team({ATT:70}),away=team({MID:64});
 const quick=simulateClubMatch(home,away,55);
 let live=createLiveMatch(home,away,55);
 for(let block=0;block<9;block+=1)live=advanceLiveMatch(live);
 const restored=JSON.parse(JSON.stringify(live));
 let resumed=restored;
 while(!resumed.finished)resumed=advanceLiveMatch(resumed);
 assert.deepEqual(liveMatchReport(resumed).score,quick.score);
});

test('a mid-match tactic change is allowed between blocks and changes the remaining play',()=>{
 const home=team({ATT:66,MID:66,DEF:66}),away=team({ATT:66,MID:66,DEF:66});
 let live=createLiveMatch(home,away,77);
 for(let block=0;block<9;block+=1)live=advanceLiveMatch(live);
 const before=live.events.length;
 live=setLiveTactic(live,'home','press');
 assert.equal(live.home.tactic,'press');
 for(let block=0;block<9;block+=1)live=advanceLiveMatch(live);
 assert(live.finished);
 assert(live.events.length>=before);
 assert.throws(()=>setLiveTactic(live,'home','balanced'),/finished/);
});

test('the model emits a spatial path and event coordinates inside the pitch',()=>{
 const report=simulateClubMatch(team({ATT:74}),team({MID:64}),314);
 assert.equal(report.path.length,54,'three frames per five-minute block');
 for(const frame of report.path){
  assert(frame.minute>=1&&frame.minute<=90);
  assert(frame.x>=6&&frame.x<=99);
  assert(frame.y>=8&&frame.y<=60);
  assert(frame.side==='home'||frame.side==='away');
 }
 for(const event of report.events){
  assert(typeof event.x==='number'&&typeof event.y==='number',`${event.kind} at ${event.minute} has coordinates`);
  assert(event.x!>=0&&event.x!<=105&&event.y!>=0&&event.y!<=68);
 }
 assert(report.events.every(event=>event.kind!=='goal'||event.x!>90||event.x!<15));
});

test('the spatial path is part of the live/quick parity and survives JSON',()=>{
 const home=team({ATT:70}),away=team({DEF:60});
 const quick=simulateClubMatch(home,away,808);
 let live=createLiveMatch(home,away,808);
 while(!live.finished)live=advanceLiveMatch(live);
 assert.deepEqual(live.path,quick.path);
 const restored=JSON.parse(JSON.stringify(live));
 assert.deepEqual(restored.path,quick.path);
});
