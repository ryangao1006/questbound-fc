import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {clubRatings} from '../lib/club-state.ts';
import {compareLines,matchBriefing,suggestTactic,briefingSummary,tacticName} from '../lib/match-briefing.ts';
import type {ClubTeam} from '../lib/club-match.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const opponent=(lines:Partial<Record<'DEF'|'MID'|'ATT'|'GK',number>>={},tactic:ClubTeam['tactic']='balanced'):ClubTeam=>({name:'Vale Athletic',shortName:'VLA',lines:{DEF:60,MID:60,ATT:60,GK:60,...lines},tactic,scorers:{ATT:['VLA forward'],MID:['VLA midfielder'],DEF:['VLA defender']}});

test('line comparisons use the saved club ratings and mark the edge',()=>{
 const state=stateOf(),ratings=clubRatings(state.club!),rows=compareLines(state.club!,opponent({DEF:40,MID:70}));
 assert.equal(rows.length,4);
 const def=rows.find(row=>row.line==='DEF')!,mid=rows.find(row=>row.line==='MID')!;
 assert.equal(def.ours,Math.round(ratings.DEF*10)/10);
 assert.equal(def.theirs,40);
 assert.equal(def.edge,'ours');
 assert.equal(mid.edge,'theirs');
 assert.equal(rows.find(row=>row.line==='GK')!.theirs,60);
});

test('the tactics react to their weak defence, strong midfield and strong attack',()=>{
 const state=stateOf();
 assert.equal(suggestTactic(compareLines(state.club!,opponent({DEF:50})),'balanced').tactic,'press');
 assert.equal(suggestTactic(compareLines(state.club!,opponent({MID:85})),'possession').tactic,'counter');
 assert.equal(suggestTactic(compareLines(state.club!,opponent({ATT:85})),'counter').tactic,'possession');
 assert.equal(suggestTactic(compareLines(state.club!,opponent({},'press')),'press').tactic,'wide');
 assert.equal(suggestTactic(compareLines(state.club!,opponent({},'wide')),'wide').tactic,'counter');
 const reason=suggestTactic(compareLines(state.club!,opponent({DEF:50})),'balanced').reason;
 assert(reason.length>10);
});

test('the briefing names the strongest and weakest line and a headline',()=>{
 const state=stateOf(),briefing=matchBriefing(state.club!,opponent({ATT:85,DEF:50}));
 assert.equal(briefing.opponent.name,'Vale Athletic');
 assert.equal(briefing.comparison.length,4);
 assert(briefing.strongest.diff>=briefing.weakest.diff);
 assert.equal(briefing.weakest.line,'ATT');
 assert(['You have the edge across the pitch.','Evenly matched — the midfield may decide it.','They look stronger on paper — be compact.'].includes(briefing.headline));
 assert(briefing.caution.includes('ATT'));
 assert(tacticName(briefing.suggestedTactic).length>0);
});

test('suggestions favour our weak lines as the caution and stay deterministic',()=>{
 const state=stateOf(),opp=opponent({MID:82,ATT:80});
 const first=matchBriefing(state.club!,opp),again=matchBriefing(state.club!,opp);
 assert.deepEqual(first,again);
 const summary=briefingSummary(first);
 assert(summary.headline===first.headline);
 assert(summary.suggestion.startsWith(tacticName(first.suggestedTactic)));
 assert(summary.weakest.includes('vs'));
});

test('the briefing is a pure report',()=>{
 const state=stateOf(),snapshot=JSON.stringify(state.club!);
 matchBriefing(state.club!,opponent());briefingSummary(matchBriefing(state.club!,opponent()));
 assert.equal(JSON.stringify(state.club!),snapshot);
});
