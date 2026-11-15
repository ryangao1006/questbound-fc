import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {pendingCelebration,allCelebrations,celebrationFor,celebrationStars} from '../lib/club-celebration.ts';
import type {ClubTrophy} from '../lib/club-state.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const trophy=(over:Partial<ClubTrophy>={}):ClubTrophy=>({id:'cup:t1',kind:'cup',tier:1,label:'Challenge Cup',at:'2026-11-15T10:00:00Z',kitId:'kit:cup:t1',...over});

test('a new trophy starts a pending celebration with its kit and stars',()=>{
 const base=stateOf();
 const state={...base,club:{...base.club!,trophies:[trophy()]}};
 const pending=pendingCelebration(state.club);
 assert(pending);
 assert.equal(pending!.trophyId,'cup:t1');
 assert.equal(pending!.title,'Challenge Cup winners');
 assert.equal(pending!.titleZh,'挑战杯冠军');
 assert.equal(pending!.kit!.id,'kit:cup:t1');
 assert.equal(pending!.seen,false);
 assert.equal(pending!.stars,1);
 assert.equal(pendingCelebration({...state.club!,trophies:[]}),null);
});

test('the celebrate command marks the trophy once and is idempotent',()=>{
 const base=stateOf();
 const withTrophy={...base,club:{...base.club!,trophies:[trophy()]}};
 const first=reduceCommand(withTrophy,{type:'club.celebrate',id:'c1',trophyId:'cup:t1'} as never);
 const marked=first.club!.trophies![0];
 assert(marked.celebratedAt);
 assert.equal(pendingCelebration(first.club),null);
 const again=reduceCommand(first,{type:'club.celebrate',id:'c2',trophyId:'cup:t1'} as never);
 assert.equal(again.club!.trophies![0].celebratedAt,marked.celebratedAt);
 assert.throws(()=>reduceCommand(first,{type:'club.celebrate',id:'c3',trophyId:'cup:nope'} as never),/trophy you have won/);
});

test('old trophies without a kit still celebrate honestly',()=>{
 const base=stateOf();
 const legacy={...base,club:{...base.club!,trophies:[trophy({id:'league:old',kind:'league',tier:0,kitId:undefined})]}};
 const celebration=celebrationFor(legacy.club!,legacy.club!.trophies![0]);
 assert.equal(celebration.kit,null);
 assert.equal(celebration.title,'League champions');
 assert.equal(celebration.subtitle,'Rookie · Northbridge FC');
});

test('celebrations are listed newest first and deterministic',()=>{
 const base=stateOf();
 const trophies=[trophy({id:'cup:a',at:'2026-11-01T10:00:00Z'}),trophy({id:'league:b',kind:'league',at:'2026-11-10T10:00:00Z'})];
 const club={...base.club!,trophies};
 const list=allCelebrations(club);
 assert.deepEqual(list.map(entry=>entry.trophyId),['league:b','cup:a']);
 const stars=celebrationStars(42),again=celebrationStars(42);
 assert.deepEqual(stars,again);
 assert.equal(stars.length,14);
 for(const star of stars){assert(star.angle>=0&&star.angle<=360);assert(star.radius>=0.6&&star.radius<=1.1);assert(star.size>=6&&star.size<=16)}
});
