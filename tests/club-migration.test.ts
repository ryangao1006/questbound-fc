import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {previewClubMigration,initialGrantEligible} from '../lib/club-migration.ts';
import {buildClubPreview,squadLineCounts,FORMATION_OPTIONS} from '../lib/club-preview.ts';

test('migration preview carries XP and funds and keeps the one-off grant',()=>{
 const state=initialState();
 state.rewards.push({id:'task:a',points:10,active:true,at:new Date().toISOString(),kind:'task'} as never);
 const preview=previewClubMigration(state);
 assert.equal(preview.xp,10);
 assert.equal(preview.funds,0);
 assert.equal(preview.initialGrant,150);
 assert.equal(initialGrantEligible({}),true);
 assert.equal(initialGrantEligible({initialGranted:true}),false);
 assert.equal(preview.frozen.personalAttributes,true);
 assert.equal(preview.frozen.skillPoints,null);
 assert.equal(preview.baseline.rewardIdentities,1);
});

test('purchased cosmetics become display rights and are never re-charged',()=>{
 const state=initialState();
 state.economy.purchases.push({id:'p1',itemId:'frame.silver',cost:180,at:new Date().toISOString(),funding:[]});
 state.economy.purchases.push({id:'p2',itemId:'backdrop.stadium',cost:120,at:new Date().toISOString(),funding:[]});
 state.economy.sources.push({id:'work:task:a',kind:'work',amount:180,eligible:180,spent:180,at:new Date().toISOString()});
 const preview=previewClubMigration(state);
 assert.deepEqual(preview.displayRights.frames,['frame.silver']);
 assert.deepEqual(preview.displayRights.backdrops,['backdrop.stadium']);
 assert.equal(preview.funds,0);
});

test('the preview club is deterministic and matches the PLAN squad shape',()=>{
 const a=buildClubPreview(),b=buildClubPreview();
 assert.deepEqual(a,b);
 assert.equal(a.squad.length,20);
 assert.deepEqual(squadLineCounts(a),{GK:2,DEF:7,MID:7,ATT:4});
 assert.equal(a.starters.length,11);
 assert.equal(a.bench.length,9);
 assert(a.ratings.overall>1);
 assert(['4-4-2','4-3-3','4-2-3-1'].every(formation=>FORMATION_OPTIONS.includes(formation as never)));
 for(const player of a.squad){assert(player.ovr>=54&&player.ovr<=64);assert(player.fit>=.85&&player.fit<=1);assert(player.training.price>=20)}
});

test('starters are unique and keep the keeper slot legal',()=>{
 const preview=buildClubPreview();
 assert.equal(new Set(preview.starters).size,11);
 const keeper=preview.squad.find(player=>player.id===preview.starters[0])!;
 assert.equal(keeper.position,'GK');
});
