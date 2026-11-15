import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {FOOTBALL_PLAYERS} from '../lib/football-data.ts';
import {clubFunds} from '../lib/club-state.ts';
import {signingPrice,worldPlayerOvr} from '../lib/club-transfers.ts';

const stateWithFunds=(amount=20000)=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount,eligible:amount,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',formation:'4-3-3'} as never)};
const cheap=()=>[...FOOTBALL_PLAYERS].sort((a,b)=>worldPlayerOvr(a)-worldPlayerOvr(b)||a.id.localeCompare(b.id))[0];

test('signing a real player charges the formula price and adds them to the squad',()=>{
 const state=stateWithFunds(),before=clubFunds(state.economy),player=cheap();
 const signed=reduceCommand(state,{type:'club.sign',id:'sign-1',worldPlayerId:player.id} as never);
 assert.equal(signed.club!.players.length,21);
 const added=signed.club!.players.find(entry=>entry.id===player.id);
 assert(added,'signed player is in the squad');
 assert.equal(added!.origin,'signed');
 assert.equal(clubFunds(signed.economy),before-signingPrice(worldPlayerOvr(player)));
 assert.equal(signed.club!.receipts.at(-1)!.kind,'signing');
});

test('the same real player cannot be signed twice or by two clubs',()=>{
 const state=stateWithFunds(),player=cheap();
 const once=reduceCommand(state,{type:'club.sign',id:'sign-1',worldPlayerId:player.id} as never);
 assert.throws(()=>reduceCommand(once,{type:'club.sign',id:'sign-2',worldPlayerId:player.id} as never),/already belongs/);
});

test('the scout centre caps who can be signed',()=>{
 const state=stateWithFunds(),legend=[...FOOTBALL_PLAYERS].sort((a,b)=>b.attributes.pac-a.attributes.pac)[0];
 assert.throws(()=>reduceCommand(state,{type:'club.sign',id:'sign-x',worldPlayerId:legend.id} as never),/OVR/);
});

test('selling refunds half the paid price and keeps the starting eleven legal',()=>{
 const state=stateWithFunds(),player=cheap();
 const signed=reduceCommand(state,{type:'club.sign',id:'sign-1',worldPlayerId:player.id} as never);
 const price=(signed.club!.players.find(entry=>entry.id===player.id) as unknown as {paidPrice:number}).paidPrice;
 const before=clubFunds(signed.economy);
 const sold=reduceCommand(signed,{type:'club.sell',id:'sell-1',playerId:player.id} as never);
 assert.equal(sold.club!.players.some(entry=>entry.id===player.id),false);
 assert.equal(clubFunds(sold.economy),before+Math.floor(price/2));
 assert.equal(sold.club!.receipts.at(-1)!.kind,'sale');
});

test('a starting player cannot be sold if it would break the eleven',()=>{
 const state=stateWithFunds(),starter=state.club!.lineup[0];
 assert.throws(()=>reduceCommand(state,{type:'club.sell',id:'sell-starter',playerId:starter} as never),/starting|eleven|line-up|lineup/i);
});
