import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {nextClubActions,clubHomeSummary} from '../lib/club-actions.ts';

const base=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return state};
const withClub=(srcd=base())=>reduceCommand(srcd,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never);

test('without a club the only suggestion is creating one',()=>{
 const actions=nextClubActions(base());
 assert.equal(actions.length,1);
 assert.equal(actions[0].id,'create');
 assert.equal(actions[0].urgent,true);
});

test('a fresh club is nudged to start a season and enter the cup',()=>{
 const actions=nextClubActions(withClub());
 const ids=actions.map(action=>action.id);
 assert(ids.includes('league'));
 assert(ids.includes('cup'));
 assert.equal(actions.length<=3,true);
 assert(actions[0].titleZh.length>0);
});

test('a paused live match is the first urgent action',()=>{
 const live=reduceCommand(withClub(),{type:'club.live.start',id:'live-a',tier:0} as never);
 const actions=nextClubActions(live);
 assert.equal(actions[0].id,'live');
 assert.equal(actions[0].urgent,true);
 assert(actions.length<=3);
});

test('a season in progress suggests the next round, and a missing cup suggests entering',()=>{
 let state=withClub();
 state=reduceCommand(state,{type:'club.league.start',id:'lg-a',tier:0} as never);
 const actions=nextClubActions(state).map(action=>action.id);
 assert(actions.includes('league'));
 const cupActions=nextClubActions(state).map(action=>action.id);
 assert(cupActions.includes('cup'));
});

test('affordable training and signings show up, and the list stays capped',()=>{
 const rich=withClub();
 rich.economy.sources.push({id:'match:rich',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});
 const actions=nextClubActions(rich);
 assert.equal(actions.length,3);
 assert(actions.some(action=>['train','sign','friendly','league','cup'].includes(action.id)));
 for(const action of actions){assert(action.title.length>0);assert(action.titleZh.length>0);assert(action.href.startsWith('/club'))}
});

test('the home summary reports the club, overall and next step without mutating state',()=>{
 const state=withClub(),snapshot=JSON.stringify(state),summary=clubHomeSummary(state);
 assert(summary.headline.includes('Northbridge FC'));
 assert(summary.headlineZh.includes('总评'));
 assert(summary.detail.includes('FC'));
 assert(summary.next.length>0);
 assert.equal(JSON.stringify(state),snapshot);
 assert.equal(clubHomeSummary(base()).headline,'');
});
