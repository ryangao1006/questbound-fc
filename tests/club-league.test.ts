import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {createSeason,playSeasonRound,seasonOutcome,sortTable,ownRow,TIER_LABELS} from '../lib/club-league.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const clubOf=()=>stateOf().club!;

test('a season has eight teams, fourteen rounds and four fixtures per round',()=>{
 const season=createSeason(clubOf(),0,42,'season-1');
 assert.equal(season.teams.length,8);
 assert.equal(season.round,0);
 assert.equal(season.fixtures.length,56);
 const rounds=new Set(season.fixtures.map(fixture=>fixture.round));
 assert.equal(rounds.size,14);
 for(const round of rounds)assert.equal(season.fixtures.filter(fixture=>fixture.round===round).length,4);
 for(const team of season.teams)assert.equal(season.fixtures.filter(fixture=>fixture.home===team.id||fixture.away===team.id).length,14);
 assert(TIER_LABELS[season.tier].length>0);
});

test('playing a round updates the table, keeps it sorted and is reproducible',()=>{
 const season=createSeason(clubOf(),1,7,'season-2');
 const first=playSeasonRound(clubOf(),season),again=playSeasonRound(clubOf(),season);
 assert.deepEqual(first.season.table,again.season.table);
 assert.equal(first.season.round,1);
 assert.equal(first.results.length,4);
 for(const row of first.season.table)assert.equal(row.played,1);
 const sorted=sortTable(first.season.table);
 assert.deepEqual(first.season.table.map(row=>row.teamId),sorted.map(row=>row.teamId));
 const totalPoints=first.season.table.reduce((sum,row)=>sum+row.points,0);
 assert(totalPoints>=4&&totalPoints<=12);
 assert(ownRow(first.season));
});

test('a full season finishes after fourteen rounds and only then reads as finished',()=>{
 let season=createSeason(clubOf(),0,11,'season-3');
 for(let round=1;round<=14;round+=1){const played=playSeasonRound(clubOf(),season);season=played.season;assert.equal(season.finished,round===14)}
 for(const row of season.table)assert.equal(row.played,14);
 assert.throws(()=>playSeasonRound(clubOf(),season),/finished/);
});

test('top two are promoted and bottom two relegated, with the lowest tier protected',()=>{
 const season=createSeason(clubOf(),0,3,'season-4');
 const table=season.table.map((row,index)=>({...row,points:(7-index)*3,gf:10,ga:5}));
 const promoted=seasonOutcome({...season,table:sortTable(table)});
 assert.equal(promoted.position,1);assert.equal(promoted.status,'promoted');assert.equal(promoted.nextTier,1);
 const elite=seasonOutcome({...season,tier:3,table:sortTable(table)});
 assert.equal(elite.status,'stayed');
 const bottom=sortTable(table.map((row,index)=>({...row,points:index*2})));
 const relegated=seasonOutcome({...season,tier:2,table:bottom});
 assert.equal(relegated.status,'relegated');assert.equal(relegated.nextTier,1);
 assert.equal(seasonOutcome({...season,tier:0,table:bottom}).status,'stayed');
});

test('the commands persist a season and advance it one round at a time',()=>{
 const started=reduceCommand(stateOf(),{type:'club.league.start',id:'lg-1',tier:1} as never);
 assert.equal(started.club!.season!.tier,1);
 assert.equal(started.club!.season!.round,0);
 const played=reduceCommand(started,{type:'club.league.play',id:'lg-play-1'} as never);
 assert.equal(played.club!.season!.round,1);
 assert.equal(played.club!.season!.fixtures.length,56);
 assert.equal(played.club!.season!.table.find(row=>row.teamId==='club')!.played,1);
 assert.equal(played.economy.sources.reduce((sum,source)=>sum+Math.max(0,source.eligible-source.spent),0),5150);
});

test('finishing a season records one history entry and starting another keeps it',()=>{
 let state=stateOf();
 state=reduceCommand(state,{type:'club.league.start',id:'hist-1',tier:0} as never);
 for(let round=1;round<=14;round+=1)state=reduceCommand(state,{type:'club.league.play',id:`hist-p${round}`} as never);
 const history=state.club!.history??[];
 assert.equal(history.length,1);
 assert.equal(history[0].id,state.club!.season!.id);
 assert.equal(history[0].outcome,history[0].position===1?'champion':history[0].outcome);
 assert.equal(history[0].won+history[0].drawn+history[0].lost,14);
 const next=reduceCommand(state,{type:'club.league.start',id:'hist-2',tier:1} as never);
 assert.equal((next.club!.history??[]).length,1,'starting a new season must not duplicate the archived one');
 assert.equal(next.club!.history![0].tier,0);
});
