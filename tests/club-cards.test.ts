import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState} from '../lib/model.ts';
import {reduceCommand} from '../lib/domain.ts';
import {cardTier,cardTierStyle,playerCard,squadCards,clubCrest,cardSummary,cardAvatar} from '../lib/club-cards.ts';

const stateOf=()=>{const state=structuredClone(initialState());state.economy.sources.push({id:'match:qa',kind:'match',amount:5000,eligible:5000,spent:0,at:new Date().toISOString()});return reduceCommand(state,{type:'club.create',id:'op',name:'Northbridge FC',shortName:'NBR',city:'Northbridge',formation:'4-3-3',colours:{primary:'#2f6f4e',secondary:'#c8f56e'}} as never)};

test('tiers follow the overall thresholds and keep comic ink/paper colours',()=>{
 assert.equal(cardTier(84),'gold');assert.equal(cardTier(75),'silver');assert.equal(cardTier(64),'bronze');
 assert.equal(cardTierStyle(80).tier,'gold');
 for(const ovr of [55,70,90]){const style=cardTierStyle(ovr);assert(style.ink.startsWith('#'));assert(style.paper.startsWith('#'));assert(style.accent.startsWith('#'));}
});

test('every squad player gets a deterministic card with a generated avatar',()=>{
 const state=stateOf(),club=state.club!,cards=squadCards(club);
 assert.equal(cards.length,club.players.length);
 const first=cards[0],again=squadCards(club)[0];
 assert.deepEqual(first,again);
 assert.deepEqual(first.avatar,cardAvatar(club.players.find(player=>player.id===first.id)!));
 assert(first.starter,'the first card is a starter');
 assert.deepEqual(Object.keys(first.attributes).sort(),['def','dri','pac','pas','phy','sho']);
 const seen=new Set(cards.map(card=>`${card.avatar.skin}-${card.avatar.hairStyle}-${card.avatar.hairColour}`));
 assert(seen.size>1,'avatars vary across the squad');
});

test('starters come first in line-up order and the bench is sorted by overall',()=>{
 const state=stateOf(),club=state.club!,cards=squadCards(club);
 const starters=cards.filter(card=>card.starter),bench=cards.filter(card=>!card.starter);
 assert.equal(starters.length,11);
 assert.deepEqual(starters.map(card=>card.id),club.lineup);
 for(let index=1;index<bench.length;index+=1)assert(bench[index-1].ovr>=bench[index].ovr);
 const summary=cardSummary(cards);
 assert.equal(summary.total,club.players.length);
 assert.equal(summary.starters,11);
 assert.equal(summary.gold+summary.silver+summary.bronze,club.players.length);
});

test('the captain flag is explicit and only one card can carry it',()=>{
 const state=stateOf(),club=state.club!,captain=club.lineup[2],cards=squadCards(club,captain);
 assert.equal(cards.filter(card=>card.captain).length,1);
 assert.equal(cards.find(card=>card.captain)!.id,captain);
 assert.equal(playerCard(club,club.players.find(player=>player.id===captain)!,captain).captain,true);
});

test('the crest uses the club identity and trophy stars',()=>{
 const state=stateOf(),crest=clubCrest(state.club!);
 assert.equal(crest.shape,'shield');
 assert.equal(crest.initials,'NBR');
 assert.deepEqual(crest.colours,['#2f6f4e','#c8f56e']);
 assert.equal(crest.stars,0);
 assert(crest.motto.includes('NORTHBRIDGE'));
 const withTrophy={...state.club!,trophies:[{id:'t1',kind:'cup' as const,tier:0,label:'Cup',at:new Date().toISOString()},{id:'t2',kind:'league' as const,tier:0,label:'Title',at:new Date().toISOString()}]};
 assert.equal(clubCrest(withTrophy).stars,2);
});

test('card derivation is pure',()=>{
 const state=stateOf(),snapshot=JSON.stringify(state.club);
 squadCards(state.club!);clubCrest(state.club!);cardSummary(squadCards(state.club!));
 assert.equal(JSON.stringify(state.club),snapshot);
});
