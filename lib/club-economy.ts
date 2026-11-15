/**
 * Club economy ledger v2 for the manager pivot (PLAN.md 2.2, 2.4, 2.5 and 4.3).
 *
 * Every entry point is a pure value transformation: the module reads no storage,
 * network, clock or randomness, and it never mutates the ledger it is given.
 * Timestamps are supplied by the caller ('' means "not recorded yet").
 *
 * Money is always attached to a stable reward identity. Retries, re-uploads,
 * undo and redo therefore cannot create the same reward twice, and withdrawing
 * a source only takes back the part that was never spent: purchase receipts and
 * their funding history are permanent.
 */

export const CLUB_ECONOMY_VERSION=1 as const;
export const CLUB_FOCUS_CHUNK_SECONDS=20*60;
export const INITIAL_GRANT_IDENTITY='initial:club';
export const LEGACY_CARRYOVER_IDENTITY='migration:carryover';

/** PLAN.md 2.2 reward table. Versioned so a later balance patch keeps old receipts. */
export const CLUB_REWARD_RULES_V1=Object.freeze({
 version:1,
 task:{xp:10,funds:20},
 habit:{xp:10,funds:20},
 focus:{seconds:CLUB_FOCUS_CHUNK_SECONDS,xp:5,funds:10},
 level:{funds:40},
 initial:{funds:150},
 match:{xp:0,funds:0},
} as const);

/** One stable earning identity per reward event; replayed events keep the same kind. */
export type ClubSourceKind='task'|'habit'|'focus'|'level'|'initial'|'migration';

export type ClubSource={
 id:string;
 kind:ClubSourceKind;
 /** Club XP granted when this source is confirmed (0 for level, initial and migration). */
 xp:number;
 /** Funds granted by the source before any withdrawal or purchase. */
 amountEarned:number;
 /** Funds already consumed from this source by purchase receipts. */
 amountSpent:number;
 at:string;
 /** PLAN.md 2.4/4.1: pending offline rewards only become spendable once confirmed. */
 confirmed:boolean;
 /** PLAN.md 2.5: an undone reward keeps its identity and its spent history but pays nothing. */
 reverted:boolean;
};

/** Which source funded each part of a purchase; kept forever so undo cannot rewrite history. */
export type ClubPurchaseFunding={sourceId:string;amount:number};
export type ClubPurchase={id:string;itemId:string;cost:number;at:string;funding:ClubPurchaseFunding[]};

/** Old planner reward/session identities frozen at migration (PLAN.md 4.3). */
export type ClubFrozenBaseline={
 rewardIdentities:string[];
 sessionIdentities:string[];
 activeSession:boolean;
 at:string;
};

export type ClubLedger={
 version:1;
 xp:number;
 sources:ClubSource[];
 spending:ClubPurchase[];
 initialGranted:boolean;
 /** Carried focus time that has not reached a full 20-minute chunk yet. */
 focusRemainderSeconds:number;
 frozenBaseline:ClubFrozenBaseline;
};

export type TaskRewardInput={id:string;occurrence?:string|number;at?:string;confirmed?:boolean};
export type HabitRewardInput={id:string;day:string;at?:string;confirmed?:boolean};
export type FocusRewardInput={at?:string;confirmed?:boolean};
export type SpendInput={itemId:string;cost:number;id?:string;at?:string};
export type LegacyCarryoverInput={
 xp:number;
 funds:number;
 rewardIdentities?:string[];
 sessionIdentities?:string[];
 activeSession?:boolean;
 at?:string;
};

/** Identities are stable and stay compatible with the v1 planner reward ids. */
export const taskRewardIdentity=(id:string,occurrence?:string|number)=>occurrence===undefined||occurrence===null?`task:${id}`:`task:${id}:${occurrence}`;
export const habitRewardIdentity=(id:string,day:string)=>`habit:${id}:${day}`;
export const levelRewardIdentity=(level:number)=>`level:${level}`;

const MAX_CLUB_LEVEL=1000;
const SOURCE_KINDS:readonly ClubSourceKind[]=['task','habit','focus','level','initial','migration'];

const timestamp=(at?:string)=>typeof at==='string'?at:'';
const emptyBaseline=():ClubFrozenBaseline=>({rewardIdentities:[],sessionIdentities:[],activeSession:false,at:''});
const spendable=(source:ClubSource)=>source.confirmed&&!source.reverted?Math.max(0,source.amountEarned-source.amountSpent):0;

export function emptyClubLedger():ClubLedger{
 return {version:CLUB_ECONOMY_VERSION,xp:0,sources:[],spending:[],initialGranted:false,focusRemainderSeconds:0,frozenBaseline:emptyBaseline()};
}

/**
 * Spendable funds: confirmed earnings minus spending. Spent or withdrawn rewards
 * are excluded per source, so the balance can never drop below zero and undoing
 * one reward cannot take back money another reward already paid out.
 */
export function balance(ledger:ClubLedger):number{
 return ledger.sources.reduce((total,source)=>total+spendable(source),0);
}
/** The part of the balance that can be spent right now; equal to balance by construction. */
export function available(ledger:ClubLedger):number{
 return balance(ledger);
}

type RewardGrant={kind:Exclude<ClubSourceKind,'migration'>;id:string;xp:number;amountEarned:number;at:string;confirmed:boolean};

/** Add a reward once. A reverted identity may be re-completed, but only its unspent part returns. */
function grant(ledger:ClubLedger,reward:RewardGrant):ClubLedger{
 if(ledger.frozenBaseline.rewardIdentities.includes(reward.id))return ledger;
 const index=ledger.sources.findIndex(source=>source.id===reward.id);
 if(index>=0){
  const existing=ledger.sources[index];
  if(existing.kind!==reward.kind||!existing.reverted)return ledger;
  const sources=ledger.sources.slice();
  sources[index]={...existing,reverted:false};
  return {...ledger,sources,xp:ledger.xp+(existing.confirmed?existing.xp:0)};
 }
 const source:ClubSource={id:reward.id,kind:reward.kind,xp:reward.xp,amountEarned:reward.amountEarned,amountSpent:0,at:reward.at,confirmed:reward.confirmed,reverted:false};
 return {...ledger,sources:[...ledger.sources,source],xp:ledger.xp+(reward.confirmed?reward.xp:0)};
}

/** PLAN.md 2.2: a completed task pays 10 XP and 20 funds, once per occurrence identity. */
export function applyTaskReward(ledger:ClubLedger,input:TaskRewardInput):ClubLedger{
 if(!input||typeof input.id!=='string'||!input.id)return ledger;
 return grant(ledger,{kind:'task',id:taskRewardIdentity(input.id,input.occurrence),xp:CLUB_REWARD_RULES_V1.task.xp,amountEarned:CLUB_REWARD_RULES_V1.task.funds,at:timestamp(input.at),confirmed:input.confirmed!==false});
}

/** PLAN.md 2.2: a habit record pays 10 XP and 20 funds, once per habit and local day. */
export function applyHabitReward(ledger:ClubLedger,input:HabitRewardInput):ClubLedger{
 if(!input||typeof input.id!=='string'||!input.id||typeof input.day!=='string'||!input.day)return ledger;
 return grant(ledger,{kind:'habit',id:habitRewardIdentity(input.id,input.day),xp:CLUB_REWARD_RULES_V1.habit.xp,amountEarned:CLUB_REWARD_RULES_V1.habit.funds,at:timestamp(input.at),confirmed:input.confirmed!==false});
}

function nextFocusIdentity(ledger:ClubLedger):string{
 let next=1;
 for(const source of ledger.sources){
  if(source.kind!=='focus')continue;
  const match=/^focus:(\d+)$/.exec(source.id);
  if(match)next=Math.max(next,Number(match[1])+1);
 }
 return `focus:${next}`;
}

/**
 * PLAN.md 2.2: every full 20 minutes of valid focus pays 5 XP and 10 funds.
 * Leftover seconds carry forward across sessions, and a split timer cannot pay
 * more than the same total time: 50 minutes equals two 25-minute sessions.
 */
export function applyFocus(ledger:ClubLedger,seconds:number,input:FocusRewardInput={}):ClubLedger{
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<=0)return ledger;
 const whole=Math.floor(seconds);
 if(whole<1)return ledger;
 const total=ledger.focusRemainderSeconds+whole;
 const rewards=Math.floor(total/CLUB_FOCUS_CHUNK_SECONDS);
 const focusRemainderSeconds=total%CLUB_FOCUS_CHUNK_SECONDS;
 if(rewards<1)return focusRemainderSeconds===ledger.focusRemainderSeconds?ledger:{...ledger,focusRemainderSeconds};
 const at=timestamp(input.at),confirmed=input.confirmed!==false;
 let next=ledger;
 for(let index=0;index<rewards;index++){
  next=grant(next,{kind:'focus',id:nextFocusIdentity(next),xp:CLUB_REWARD_RULES_V1.focus.xp,amountEarned:CLUB_REWARD_RULES_V1.focus.funds,at,confirmed});
 }
 return {...next,focusRemainderSeconds};
}

/**
 * PLAN.md 2.2/2.5: each newly reached club level pays 40 funds exactly once.
 * Level 1 is the starting level, and the identity per level survives a later
 * XP correction so the same level can never pay twice.
 */
export function applyLevel(ledger:ClubLedger,level:number,at=''):ClubLedger{
 if(!Number.isSafeInteger(level)||level<2||level>MAX_CLUB_LEVEL)return ledger;
 const claimed=new Set(ledger.sources.map(source=>source.id));
 const frozen=new Set(ledger.frozenBaseline.rewardIdentities);
 const sources=ledger.sources.slice();
 for(let value=2;value<=level;value++){
  const id=levelRewardIdentity(value);
  if(claimed.has(id)||frozen.has(id))continue;
  sources.push({id,kind:'level',xp:0,amountEarned:CLUB_REWARD_RULES_V1.level.funds,amountSpent:0,at:timestamp(at),confirmed:true,reverted:false});
 }
 return sources.length===ledger.sources.length?ledger:{...ledger,sources};
}

/** PLAN.md 2.2/2.5: the first-club grant of 150 funds is recorded once per account. */
export function applyInitialGrant(ledger:ClubLedger,at=''):ClubLedger{
 if(ledger.initialGranted)return ledger;
 if(ledger.sources.some(source=>source.id===INITIAL_GRANT_IDENTITY))return {...ledger,initialGranted:true};
 const source:ClubSource={id:INITIAL_GRANT_IDENTITY,kind:'initial',xp:0,amountEarned:CLUB_REWARD_RULES_V1.initial.funds,amountSpent:0,at:timestamp(at),confirmed:true,reverted:false};
 return {...ledger,initialGranted:true,sources:[...ledger.sources,source]};
}

/** PLAN.md 2.2: formal matches, friendlies and quick simulations pay nothing. */
export function applyMatch(ledger:ClubLedger):ClubLedger{
 return ledger;
}

function revert(ledger:ClubLedger,identity:string,kind?:ClubSourceKind):ClubLedger{
 if(typeof identity!=='string'||!identity)return ledger;
 const index=ledger.sources.findIndex(source=>source.id===identity);
 if(index<0)return ledger;
 const source=ledger.sources[index];
 if(source.reverted||(kind!==undefined&&source.kind!==kind))return ledger;
 const sources=ledger.sources.slice();
 sources[index]={...source,reverted:true};
 return {...ledger,sources,xp:source.confirmed?Math.max(0,ledger.xp-source.xp):ledger.xp};
}

/**
 * PLAN.md 2.5: undo corrects XP and withdraws only the unspent part of the task
 * reward. The receipt history survives, and re-completing the task restores just
 * the unspent part, so funds that were already spent can never be granted again.
 */
export function undoTaskReward(ledger:ClubLedger,identity:string):ClubLedger{
 return revert(ledger,identity,'task');
}
/** Generic undo for any reward identity, such as a habit record. */
export function undoReward(ledger:ClubLedger,identity:string):ClubLedger{
 return revert(ledger,identity);
}

/** PLAN.md 2.4/4.1: a pending offline reward becomes spendable only after confirmation. */
export function confirmSource(ledger:ClubLedger,identity:string):ClubLedger{
 const index=ledger.sources.findIndex(source=>source.id===identity);
 if(index<0)return ledger;
 const source=ledger.sources[index];
 if(source.confirmed||source.reverted)return ledger;
 const sources=ledger.sources.slice();
 sources[index]={...source,confirmed:true};
 return {...ledger,sources,xp:ledger.xp+source.xp};
}

/**
 * Buy something with club funds. The purchase is refused (throws) instead of
 * going negative, and every receipt keeps the exact funding split forever.
 * A supplied receipt id makes the call idempotent for a replayed operation.
 */
export function spend(ledger:ClubLedger,input:SpendInput):ClubLedger{
 const itemId=input?.itemId,cost=input?.cost;
 if(typeof itemId!=='string'||!itemId)throw new Error('Choose an item to buy.');
 if(!Number.isSafeInteger(cost)||cost<0)throw new Error('A whole, non-negative price is required.');
 let receiptId:string;
 if(input.id!==undefined){
  if(typeof input.id!=='string'||!input.id)throw new Error('A valid purchase ID is required.');
  const existing=ledger.spending.find(receipt=>receipt.id===input.id);
  if(existing){if(existing.itemId!==itemId)throw new Error('Purchase ID was already used for another item.');return ledger}
  receiptId=input.id;
 }else{
  const used=new Set(ledger.spending.map(receipt=>receipt.id));
  let next=ledger.spending.length+1;
  while(used.has(`purchase:${next}`))next+=1;
  receiptId=`purchase:${next}`;
 }
 if(balance(ledger)<cost)throw new Error('Not enough club funds. Your balance is unchanged.');
 let remaining=cost;
 const funding:ClubPurchaseFunding[]=[];
 const sources=ledger.sources.map(source=>({...source}));
 for(const source of sources){
  if(!source.confirmed||source.reverted)continue;
  const amount=Math.min(remaining,Math.max(0,source.amountEarned-source.amountSpent));
  if(amount<1)continue;
  source.amountSpent+=amount;
  funding.push({sourceId:source.id,amount});
  remaining-=amount;
  if(remaining<1)break;
 }
 if(remaining!==0)throw new Error('The club ledger could not fund this purchase.');
 const receipt:ClubPurchase={id:receiptId,itemId,cost,at:timestamp(input.at),funding};
 return {...ledger,sources,spending:[...ledger.spending,receipt]};
}

/**
 * PLAN.md 4.3: carry the old planner economy over once. Existing XP is kept one
 * to one, the old balance is carried in full, and every pre-migration reward
 * identity is frozen so history cannot be granted a second time.
 */
export function applyLegacyCarryover(ledger:ClubLedger,input:LegacyCarryoverInput):ClubLedger{
 const xp=input?.xp,funds=input?.funds;
 if(!Number.isSafeInteger(xp)||xp<0||!Number.isSafeInteger(funds)||funds<0)throw new Error('Invalid legacy club totals.');
 if(ledger.sources.some(source=>source.id===LEGACY_CARRYOVER_IDENTITY))return ledger;
 const at=timestamp(input.at);
 const source:ClubSource={id:LEGACY_CARRYOVER_IDENTITY,kind:'migration',xp,amountEarned:funds,amountSpent:0,at,confirmed:true,reverted:false};
 const frozenBaseline:ClubFrozenBaseline={
  rewardIdentities:[...new Set(input.rewardIdentities||[])],
  sessionIdentities:[...new Set(input.sessionIdentities||[])],
  activeSession:!!input.activeSession,
  at,
 };
 return {...ledger,xp:ledger.xp+xp,sources:[...ledger.sources,source],frozenBaseline};
}

const invalidLedger=():never=>{throw new Error('Invalid club ledger.')};
const wholeAmount=(value:number)=>Number.isSafeInteger(value)&&value>=0;
const validTimestamp=(value:string)=>typeof value==='string'&&(value===''||Number.isFinite(Date.parse(value)));

/** Reject corrupted ledgers before they are persisted or synced. */
export function assertClubLedger(ledger:ClubLedger):void{
 if(!ledger||ledger.version!==CLUB_ECONOMY_VERSION)invalidLedger();
 if(!wholeAmount(ledger.xp)||!wholeAmount(ledger.focusRemainderSeconds)||ledger.focusRemainderSeconds>=CLUB_FOCUS_CHUNK_SECONDS)invalidLedger();
 if(!Array.isArray(ledger.sources)||!Array.isArray(ledger.spending)||typeof ledger.initialGranted!=='boolean')invalidLedger();
 const sourceIds=new Set<string>();
 const spentBySource=new Map<string,number>();
 for(const source of ledger.sources){
  if(!source||typeof source.id!=='string'||!source.id||sourceIds.has(source.id)||!SOURCE_KINDS.includes(source.kind))invalidLedger();
  sourceIds.add(source.id);
  if(!wholeAmount(source.xp)||!wholeAmount(source.amountEarned)||!wholeAmount(source.amountSpent)||source.amountSpent>source.amountEarned)invalidLedger();
  if(!validTimestamp(source.at)||typeof source.confirmed!=='boolean'||typeof source.reverted!=='boolean')invalidLedger();
 }
 const receiptIds=new Set<string>();
 for(const receipt of ledger.spending){
  if(!receipt||typeof receipt.id!=='string'||!receipt.id||receiptIds.has(receipt.id))invalidLedger();
  receiptIds.add(receipt.id);
  if(typeof receipt.itemId!=='string'||!receipt.itemId||!wholeAmount(receipt.cost)||!validTimestamp(receipt.at)||!Array.isArray(receipt.funding))invalidLedger();
  let funded=0;
  for(const entry of receipt.funding){
   if(!entry||typeof entry.sourceId!=='string'||!sourceIds.has(entry.sourceId)||!Number.isSafeInteger(entry.amount)||entry.amount<1)invalidLedger();
   funded+=entry.amount;
   spentBySource.set(entry.sourceId,(spentBySource.get(entry.sourceId)||0)+entry.amount);
  }
  if(funded!==receipt.cost)invalidLedger();
 }
 let confirmedXp=0;
 for(const source of ledger.sources){
  if(source.amountSpent!==(spentBySource.get(source.id)||0))invalidLedger();
  if(source.confirmed&&!source.reverted)confirmedXp+=source.xp;
 }
 if(ledger.xp!==confirmedXp)invalidLedger();
 if(ledger.initialGranted!==ledger.sources.some(source=>source.id===INITIAL_GRANT_IDENTITY))invalidLedger();
 const baseline=ledger.frozenBaseline;
 if(!baseline||!Array.isArray(baseline.rewardIdentities)||!Array.isArray(baseline.sessionIdentities)||baseline.rewardIdentities.some(id=>typeof id!=='string')||baseline.sessionIdentities.some(id=>typeof id!=='string')||typeof baseline.activeSession!=='boolean'||!validTimestamp(baseline.at))invalidLedger();
 if(balance(ledger)<0)invalidLedger();
}
