import type {PlannerState} from './model.ts';
import {focusAssignments} from './focus-policy.ts';
export type ShopKind='frame'|'backdrop';
export const SHOP_ITEMS=[
 {id:'frame.silver',kind:'frame',name:'Silver finish',price:180,colours:['#d6e2ee','#71859e'],description:'A brushed silver player card.'},
 {id:'frame.emerald',kind:'frame',name:'Emerald finish',price:240,colours:['#a3e4bc','#1e755a'],description:'A deep green player card.'},
 {id:'frame.obsidian',kind:'frame',name:'Obsidian finish',price:300,colours:['#4b5069','#151d30'],description:'A dark player card with bright lettering.'},
 {id:'backdrop.stadium',kind:'backdrop',name:'Floodlight backdrop',price:120,colours:['#173454','#81c9e9'],description:'Floodlight beams behind your player.'},
 {id:'backdrop.sunset',kind:'backdrop',name:'Golden hour backdrop',price:160,colours:['#a95237','#f4d08a'],description:'Warm light behind your player.'},
 {id:'backdrop.tactics',kind:'backdrop',name:'Tactics backdrop',price:200,colours:['#163d36','#72b8a4'],description:'A tactical grid behind your player.'},
] as const;
export type ShopItem=typeof SHOP_ITEMS[number];
export type CreditSource={id:string;kind:'work'|'habit'|'level'|'match'|'grant'|'transfer';amount:number;eligible:number;spent:number;at:string};
// Released price versions remain immutable so future sale prices cannot invalidate old receipts.
export const PURCHASE_PRICES_V1:Readonly<Record<string,number>>=Object.freeze({'frame.silver':180,'frame.emerald':240,'frame.obsidian':300,'backdrop.stadium':120,'backdrop.sunset':160,'backdrop.tactics':200});
export type Purchase={id:string;itemId:string;cost:number;catalogVersion?:1;at:string;funding:{sourceId:string;amount:number}[]};
export type ClubSpend={id:string;cost:number;at:string;funding:{sourceId:string;amount:number}[]};
export type Economy={version:1;enabledAt:string;baselineLevel:number;excludedRewards:string[];excludedSessions:string[];sources:CreditSource[];purchases:Purchase[];clubSpend?:ClubSpend[];equipped:{frame?:string;backdrop?:string};
 /** Forward-only focus bucket rollout (PLAN 2.2). Sessions that ended before `from` keep the old rule. */
 focus?:{from:string;carrySeconds:number}};
const plannerLevel=(s:Pick<PlannerState,'rewards'>)=>1+Math.floor(s.rewards.reduce((sum,r)=>sum+(r.active?r.points:0),0)/100);
export function newEconomy(state?:Pick<PlannerState,'rewards'|'sessions'|'activeSession'>):Economy{return {version:1,enabledAt:'',baselineLevel:state?plannerLevel(state):1,excludedRewards:state?.rewards.map(r=>r.id)||[],excludedSessions:[...(state?.sessions.map(s=>s.id)||[]),...(state?.activeSession?[state.activeSession.id]:[])],sources:[],purchases:[],equipped:{}}}
export const creditBalance=(e:Economy)=>e.sources.reduce((sum,s)=>sum+Math.max(0,s.eligible-s.spent),0);
export const ownsItem=(e:Economy,id:string)=>e.purchases.some(p=>p.itemId===id);
export function reconcileEconomy(state:PlannerState,now=new Date()):PlannerState{
 const e=state.economy;e.enabledAt||=now.toISOString();const wants=new Map<string,{amount:number;kind:CreditSource['kind']}>(),excluded=new Set(e.excludedRewards),sessions=new Set(e.excludedSessions);
 for(const reward of state.rewards){if(excluded.has(reward.id)||!reward.active)continue;if(reward.id.startsWith('task:'))wants.set('work:'+reward.id,{amount:20,kind:'work'});else if(reward.id.startsWith('habit:'))wants.set(reward.id,{amount:20,kind:'habit'})}
 const focusRule=e.focus;
 if(focusRule){
  const cutoff=Date.parse(focusRule.from);
  // Old sessions that ended before the bucket roll-out keep the flat per-session rule.
  const legacy=new Map<string,number>();
  for(const session of state.sessions){
   if(session.kind!=='focus'||session.seconds<1200||sessions.has(session.id))continue;
   if(Date.parse(session.endedAt)>=cutoff)continue;
   const reward=state.rewards.find(r=>r.id==='session:'+session.id);
   if(!reward?.active||excluded.has(reward.id))continue;
   const scope=session.workScope||(session.taskId?'task:'+session.taskId:'session:'+session.id),key='work:'+scope;
   legacy.set(key,(legacy.get(key)||0)+10);
  }
  for(const [id,amount] of legacy)wants.set(id,{kind:'work',amount:Math.max(amount,wants.get(id)?.amount||0)});
  // New sessions accumulate 20-minute buckets with a carried remainder.
  const {assignments,carrySeconds}=focusAssignments(state.sessions.filter(session=>!sessions.has(session.id)),focusRule.from);
  for(const assignment of assignments){
   if(assignment.chunks<=0)continue;
   const firstReward=state.rewards.find(reward=>reward.id==='session:'+assignment.sessionId);
   if(firstReward&&(!firstReward.active||excluded.has(firstReward.id)))continue;
   const id='work:'+assignment.scope;
   wants.set(id,{kind:'work',amount:(wants.get(id)?.amount??0)+assignment.funds});
  }
  e.focus={from:focusRule.from,carrySeconds};
 } else {
  const focused=new Map<string,number>();
  for(const session of state.sessions){if(session.kind!=='focus'||session.seconds<1200||sessions.has(session.id))continue;const reward=state.rewards.find(r=>r.id==='session:'+session.id);if(!reward?.active||excluded.has(reward.id))continue;const scope=session.workScope||(session.taskId?'task:'+session.taskId:'session:'+session.id),key='work:'+scope;focused.set(key,(focused.get(key)||0)+10)}
  for(const [id,amount] of focused)wants.set(id,{kind:'work',amount:Math.max(amount,wants.get(id)?.amount||0)});
 }
 const level=plannerLevel(state);for(let n=e.baselineLevel+1;n<=level;n++)wants.set('level:'+n,{amount:40,kind:'level'});
 for(const source of e.sources)if(!['match','grant','transfer'].includes(source.kind))source.eligible=0;
 for(const [id,want] of wants){let source=e.sources.find(s=>s.id===id);if(!source){source={id,kind:want.kind,amount:0,eligible:0,spent:0,at:now.toISOString()};e.sources.push(source)}source.amount=Math.max(source.amount,want.amount);source.eligible=want.amount}
 return state;
}
export function rewardMatch(e:Economy,careerId:string,fixtureId:string,minutes:number,rating:number,now=new Date()){
 const id='match:'+careerId+':'+fixtureId;if(e.sources.some(s=>s.id===id))return;
 e.enabledAt||=now.toISOString();const amount=minutes>.2?30+Math.round(Math.max(0,Math.min(20,(rating-6)*5))):15;e.sources.push({id,kind:'match',amount,eligible:amount,spent:0,at:now.toISOString()});
}
export function purchaseItem(e:Economy,itemId:string,id:string,now=new Date()){
 const item=SHOP_ITEMS.find(i=>i.id===itemId);if(!item)throw new Error('Choose an available shop item.');if(!id||id.length>128)throw new Error('A valid purchase ID is required.');
 const old=e.purchases.find(p=>p.id===id);if(old){if(old.itemId!==itemId)throw new Error('Purchase ID was already used for another item.');return}if(ownsItem(e,itemId))return;
 if(creditBalance(e)<item.price)throw new Error('Not enough FC Credits. Your balance is unchanged.');let remaining:number=item.price;const funding:Purchase['funding']=[];
 for(const source of e.sources){const amount=Math.min(remaining,Math.max(0,source.eligible-source.spent));if(amount){source.spent+=amount;funding.push({sourceId:source.id,amount});remaining-=amount}if(!remaining)break}
 if(remaining)throw new Error('Credit ledger could not complete this purchase.');e.purchases.push({id,itemId,cost:item.price,catalogVersion:1,funding,at:now.toISOString()});
}
/** Club spending draws from the same FC Credits sources and keeps a permanent receipt. */
export function spendClubFunds(e:Economy,cost:number,id:string,now=new Date()){
 if(!Number.isSafeInteger(cost)||cost<=0)throw new Error('This action has no valid price.');
 if(!id||id.length>128)throw new Error('A valid receipt ID is required.');
 e.clubSpend??=[];
 if(e.clubSpend.some(entry=>entry.id===id))return;
 if(creditBalance(e)<cost)throw new Error('Not enough club funds. Your balance is unchanged.');
 let remaining=cost;const funding:{sourceId:string;amount:number}[]=[];
 for(const source of e.sources){const amount=Math.min(remaining,Math.max(0,source.eligible-source.spent));if(amount){source.spent+=amount;funding.push({sourceId:source.id,amount});remaining-=amount}if(!remaining)break}
 if(remaining)throw new Error('The club ledger could not complete this payment.');
 e.clubSpend.push({id,cost,at:now.toISOString(),funding});
}
export function equipItem(e:Economy,kind:ShopKind,id:string){if(!['frame','backdrop'].includes(kind))throw new Error('Choose a valid appearance category.');if(id){const item=SHOP_ITEMS.find(i=>i.id===id&&i.kind===kind);if(!item||!ownsItem(e,id))throw new Error('Own this item before equipping it.');e.equipped[kind]=id}else delete e.equipped[kind]}
/** Existing purchases/receipts remain authoritative during a same-account planner rollback. */
export function preserveEconomyOnRestore(current:Economy,imported:Economy){return structuredClone(current.sources.length||current.purchases.length?current:imported)}
export function assertEconomy(e:Economy){
 const bad=()=>{throw new Error('Invalid FC Credits ledger.')},integer=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
 if(!e||e.version!==1||typeof e.enabledAt!=='string'||e.enabledAt&&!Number.isFinite(Date.parse(e.enabledAt))||!integer(e.baselineLevel)||e.baselineLevel<1||!Array.isArray(e.sources)||!Array.isArray(e.purchases)||!e.equipped)bad();
 if(e.focus!==undefined){if(typeof e.focus!=='object'||e.focus===null||typeof e.focus.from!=='string'||!Number.isFinite(Date.parse(e.focus.from))||!integer(e.focus.carrySeconds)||e.focus.carrySeconds>=1200)bad()}
 for(const a of [e.excludedRewards,e.excludedSessions])if(!Array.isArray(a)||a.some(k=>typeof k!=='string'))bad();
 if(new Set(e.sources.map(s=>s.id)).size!==e.sources.length||new Set(e.purchases.map(p=>p.id)).size!==e.purchases.length||new Set(e.purchases.map(p=>p.itemId)).size!==e.purchases.length)bad();
 const spent=new Map<string,number>();
 for(const source of e.sources)if(typeof source.id!=='string'||!source.id||!['work','habit','level','match','grant','transfer'].includes(source.kind)||![source.amount,source.eligible,source.spent].every(integer)||source.eligible>source.amount||source.spent>source.amount||!Number.isFinite(Date.parse(source.at)))bad();
 for(const spend of e.clubSpend??[]){if(typeof spend.id!=='string'||!spend.id||!integer(spend.cost)||!spend.cost||!Array.isArray(spend.funding)||spend.funding.reduce((n,f)=>n+f.amount,0)!==spend.cost||!Number.isFinite(Date.parse(spend.at)))bad();for(const f of spend.funding){if(!integer(f.amount)||!e.sources.some(s=>s.id===f.sourceId))bad();spent.set(f.sourceId,(spent.get(f.sourceId)||0)+f.amount)}}
 for(const purchase of e.purchases){const item=SHOP_ITEMS.find(i=>i.id===purchase.itemId);if(typeof purchase.id!=='string'||!purchase.id||purchase.id.length>128||!item||!integer(purchase.cost)||(purchase.catalogVersion!==undefined&&purchase.catalogVersion!==1)||purchase.cost!==PURCHASE_PRICES_V1[purchase.itemId]||!Array.isArray(purchase.funding)||purchase.funding.reduce((n,f)=>n+f.amount,0)!==purchase.cost||!Number.isFinite(Date.parse(purchase.at)))bad();for(const f of purchase.funding){if(!integer(f.amount)||!e.sources.some(s=>s.id===f.sourceId))bad();spent.set(f.sourceId,(spent.get(f.sourceId)||0)+f.amount)}}
 for(const source of e.sources)if(source.spent!==(spent.get(source.id)||0))bad();
 for(const kind of ['frame','backdrop'] as const){const id=e.equipped[kind];if(id&&(!ownsItem(e,id)||!SHOP_ITEMS.some(i=>i.id===id&&i.kind===kind)))bad()}
}

/** A planner rollback cannot introduce previously unknown historical earning identities. */
export function restorePlannerEconomy(current:PlannerState,restored:PlannerState){
 const preserve=current.economy.sources.length>0||current.economy.purchases.length>0;
 restored.economy=preserveEconomyOnRestore(current.economy,restored.economy);
 if(preserve){
  restored.economy.excludedRewards=[...new Set([...restored.economy.excludedRewards,...restored.rewards.filter(r=>!current.rewards.some(old=>old.id===r.id)).map(r=>r.id)])];
  restored.economy.excludedSessions=[...new Set([...restored.economy.excludedSessions,...restored.sessions.filter(s=>!current.sessions.some(old=>old.id===s.id)).map(s=>s.id)])];
 }
 return reconcileEconomy(restored);
}
