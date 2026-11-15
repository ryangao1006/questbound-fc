import test from 'node:test';
import assert from 'node:assert/strict';
import * as clubEconomy from '../lib/club-economy.ts';
import {
 CLUB_FOCUS_CHUNK_SECONDS,
 CLUB_REWARD_RULES_V1,
 INITIAL_GRANT_IDENTITY,
 applyFocus,
 applyHabitReward,
 applyInitialGrant,
 applyLevel,
 applyLegacyCarryover,
 applyMatch,
 applyTaskReward,
 assertClubLedger,
 available,
 balance,
 confirmSource,
 emptyClubLedger,
 habitRewardIdentity,
 levelRewardIdentity,
 spend,
 taskRewardIdentity,
 undoTaskReward,
} from '../lib/club-economy.ts';

const at='2026-11-14T04:00:00.000Z';
const day='2026-11-14';
const tasks=(count:number)=>{let ledger=emptyClubLedger();for(let index=0;index<count;index+=1)ledger=applyTaskReward(ledger,{id:`t${index}`,at});return ledger};

test('PLAN 2.2 base rules: a task and a habit record each pay 10 XP and 20 funds',()=>{
 let ledger=emptyClubLedger();
 ledger=applyTaskReward(ledger,{id:'essay',at});
 ledger=applyHabitReward(ledger,{id:'h1',day,at});
 assert.equal(ledger.xp,20);
 assert.equal(balance(ledger),40);
 assert.equal(available(ledger),40);
 assert.deepEqual(CLUB_REWARD_RULES_V1.task,{xp:10,funds:20});
 assert.deepEqual(CLUB_REWARD_RULES_V1.habit,{xp:10,funds:20});
 const task=ledger.sources[0];
 assert.equal(task.id,'task:essay');
 assert.equal(task.kind,'task');
 assert.equal(task.xp,10);
 assert.equal(task.amountEarned,20);
 assert.equal(task.amountSpent,0);
 assert.equal(task.at,at);
 assert.equal(task.confirmed,true);
 assert.equal(task.reverted,false);
 assert.equal(ledger.sources[1].id,'habit:h1:2026-11-14');
 assert.deepEqual(ledger.spending,[]);
 assertClubLedger(ledger);
});

test('PLAN 2.2 focus: 5 XP and 10 funds per full 20 minutes, with the remainder carried across sessions',()=>{
 let ledger=applyFocus(emptyClubLedger(),50*60,{at});
 assert.equal(ledger.xp,10);
 assert.equal(balance(ledger),20);
 assert.equal(ledger.focusRemainderSeconds,10*60);
 assert.deepEqual(ledger.sources.map(source=>source.id),['focus:1','focus:2']);
 assert.deepEqual(ledger.sources.map(source=>[source.xp,source.amountEarned]),[[5,10],[5,10]]);
 const split=applyFocus(applyFocus(emptyClubLedger(),25*60,{at}),25*60,{at});
 assert.deepEqual(split,ledger);
 const short=applyFocus(emptyClubLedger(),19*60,{at});
 assert.equal(short.xp,0);
 assert.equal(balance(short),0);
 assert.equal(short.focusRemainderSeconds,19*60);
 const exact=applyFocus(short,60,{at});
 assert.equal(exact.xp,5);
 assert.equal(balance(exact),10);
 assert.equal(exact.focusRemainderSeconds,0);
 assert.deepEqual(applyFocus(emptyClubLedger(),0,{at}),emptyClubLedger());
 assert.deepEqual(applyFocus(emptyClubLedger(),-60,{at}),emptyClubLedger());
 assert.deepEqual(applyFocus(emptyClubLedger(),Number.NaN,{at}),emptyClubLedger());
 // Saved seconds are consumed once: 50 minutes plus 10 more minutes pays one extra chunk, never two.
 const topped=applyFocus(ledger,10*60,{at});
 assert.equal(topped.xp,15);
 assert.equal(balance(topped),30);
 assert.equal(topped.focusRemainderSeconds,0);
 assert.equal(CLUB_REWARD_RULES_V1.focus.seconds,CLUB_FOCUS_CHUNK_SECONDS);
 assertClubLedger(topped);
});

test('duplicate identities never pay twice; recurring tasks pay once per stable occurrence',()=>{
 const once=applyTaskReward(emptyClubLedger(),{id:'t1',at});
 const replayed=applyTaskReward(once,{id:'t1',at});
 assert.deepEqual(replayed,once);
 assert.equal(replayed.xp,10);
 assert.equal(balance(replayed),20);
 let recurring=applyTaskReward(emptyClubLedger(),{id:'t1',occurrence:'2026-11-14',at});
 recurring=applyTaskReward(recurring,{id:'t1',occurrence:'2026-11-15',at});
 assert.equal(recurring.xp,20);
 assert.equal(balance(recurring),40);
 assert.deepEqual(applyTaskReward(recurring,{id:'t1',occurrence:'2026-11-14',at}),recurring);
 let habit=applyHabitReward(emptyClubLedger(),{id:'h',day,at});
 habit=applyHabitReward(habit,{id:'h',day,at});
 assert.equal(habit.xp,10);
 habit=applyHabitReward(habit,{id:'h',day:'2026-11-15',at});
 assert.equal(habit.xp,20);
 assert.equal(taskRewardIdentity('t1'),'task:t1');
 assert.equal(taskRewardIdentity('t1','2026-11-14'),'task:t1:2026-11-14');
 assert.equal(habitRewardIdentity('h',day),'habit:h:2026-11-14');
 assertClubLedger(recurring);
 assertClubLedger(habit);
});

test('undo corrects XP, withdraws only still-unspent funds and redo cannot re-grant spent funds',()=>{
 let ledger=tasks(2);
 ledger=spend(ledger,{itemId:'training.pas',cost:30,at});
 assert.equal(balance(ledger),10);
 assert.deepEqual(ledger.spending[0].funding,[{sourceId:'task:t0',amount:20},{sourceId:'task:t1',amount:10}]);
 ledger=undoTaskReward(ledger,'task:t1');
 assert.equal(ledger.xp,10);
 assert.equal(balance(ledger),0);
 assert.equal(ledger.spending.length,1);
 const reverted=ledger.sources.find(source=>source.id==='task:t1')!;
 assert.equal(reverted.reverted,true);
 assert.equal(reverted.amountSpent,10);
 ledger=applyTaskReward(ledger,{id:'t1',at});
 assert.equal(ledger.xp,20);
 assert.equal(balance(ledger),10);
 assert.equal(ledger.sources.filter(source=>source.id==='task:t1').length,1);
 assert.deepEqual(undoTaskReward(ledger,'task:missing'),ledger);
 const once=undoTaskReward(ledger,'task:t0');
 assert.deepEqual(undoTaskReward(once,'task:t0'),once);
 assert.deepEqual(undoTaskReward(applyHabitReward(emptyClubLedger(),{id:'h',day,at}),'habit:h:2026-11-14').sources[0].reverted,false);
 assertClubLedger(ledger);
});

test('a fully spent reward can be undone and redone without a negative balance or a double grant',()=>{
 let ledger=tasks(1);
 ledger=spend(ledger,{itemId:'kit',cost:20,at});
 assert.equal(balance(ledger),0);
 const undone=undoTaskReward(ledger,'task:t0');
 assert.equal(undone.xp,0);
 assert.equal(balance(undone),0);
 assert(balance(undone)>=0);
 const redone=applyTaskReward(undone,{id:'t0',at});
 assert.equal(redone.xp,10);
 assert.equal(balance(redone),0);
 assert.equal(redone.spending.length,1);
 assertClubLedger(undone);
 assertClubLedger(redone);
});

test('spending refuses overdrafts and invalid prices without touching the balance, and receipts are permanent',()=>{
 const ledger=applyTaskReward(emptyClubLedger(),{id:'a',at});
 const pristine=structuredClone(ledger);
 assert.throws(()=>spend(ledger,{itemId:'kit',cost:21,at}),/Not enough club funds/);
 assert.throws(()=>spend(ledger,{itemId:'kit',cost:-1,at}),/price/);
 assert.throws(()=>spend(ledger,{itemId:'kit',cost:1.5,at}),/price/);
 assert.throws(()=>spend(ledger,{itemId:'',cost:1,at}),/Choose an item/);
 assert.deepEqual(ledger,pristine);
 const bought=spend(ledger,{itemId:'kit',cost:20,at,id:'op-1'});
 assert.equal(balance(bought),0);
 assert.deepEqual(bought.spending.map(receipt=>receipt.id),['op-1']);
 assert.equal(bought.spending[0].at,at);
 assert.deepEqual(spend(bought,{itemId:'kit',cost:20,id:'op-1'}),bought);
 assert.throws(()=>spend(bought,{itemId:'ball',cost:30,id:'op-1'}),/already used/);
 assert.throws(()=>spend(bought,{itemId:'ball',cost:1,at}),/Not enough club funds/);
 const auto=spend(ledger,{itemId:'kit',cost:6,at});
 assert.equal(balance(auto),14);
 assert.equal(auto.spending[0].id,'purchase:1');
 assert.equal(balance(auto),auto.sources.filter(source=>source.confirmed&&!source.reverted).reduce((total,source)=>total+source.amountEarned-source.amountSpent,0));
 assertClubLedger(bought);
 assertClubLedger(auto);
});

test('the first-club grant is 150 funds once and leaves a permanent receipt',()=>{
 const ledger=applyInitialGrant(emptyClubLedger(),at);
 assert.equal(ledger.xp,0);
 assert.equal(balance(ledger),150);
 assert.equal(ledger.initialGranted,true);
 assert.equal(ledger.sources.length,1);
 assert.equal(ledger.sources[0].id,INITIAL_GRANT_IDENTITY);
 assert.equal(ledger.sources[0].kind,'initial');
 assert.equal(ledger.sources[0].amountEarned,150);
 assert.equal(ledger.sources[0].at,at);
 const replay=applyInitialGrant(ledger,at);
 assert.deepEqual(replay,ledger);
 assert.equal(balance(replay),150);
 assert.equal(replay.sources.length,1);
 assertClubLedger(replay);
});

test('each newly reached level pays 40 funds exactly once',()=>{
 let ledger=applyLevel(emptyClubLedger(),2,at);
 assert.equal(ledger.xp,0);
 assert.equal(balance(ledger),40);
 assert.deepEqual(ledger.sources.map(source=>source.id),['level:2']);
 assert.deepEqual(applyLevel(ledger,2,at),ledger);
 ledger=applyLevel(ledger,4,at);
 assert.equal(balance(ledger),120);
 assert.deepEqual(ledger.sources.map(source=>source.id),['level:2','level:3','level:4']);
 assert.deepEqual(applyLevel(ledger,1,at),ledger);
 assert.deepEqual(applyLevel(ledger,0,at),ledger);
 assert.equal(levelRewardIdentity(3),'level:3');
 assert.equal(CLUB_REWARD_RULES_V1.level.funds,40);
 assertClubLedger(ledger);
});

test('matches pay nothing, including friendlies and quick simulations',()=>{
 const ledger=applyTaskReward(emptyClubLedger(),{id:'a',at});
 assert.deepEqual(applyMatch(ledger),ledger);
 assert.equal(balance(ledger),20);
 assert.equal(applyMatch(emptyClubLedger()).sources.length,0);
 assert.equal(CLUB_REWARD_RULES_V1.match.xp,0);
 assert.equal(CLUB_REWARD_RULES_V1.match.funds,0);
 assert.equal(CLUB_REWARD_RULES_V1.initial.funds,150);
});

test('skip, subtasks, priority, estimate and deadline have no reward path',()=>{
 const ledger=applyInitialGrant(emptyClubLedger(),at);
 const plain=applyTaskReward(ledger,{id:'a',at});
 const noisy=applyTaskReward(ledger,{id:'a',at,skip:true,subtasks:[{id:'step',done:true}],priority:'high',estimateMinutes:180,deadline:'2026-11-15T00:00:00.000Z'} as never);
 assert.deepEqual(noisy,plain);
 assert.equal((clubEconomy as Record<string,unknown>).applySkip,undefined);
 assert.equal((clubEconomy as Record<string,unknown>).applySubtaskReward,undefined);
 for(const [name,value] of Object.entries(clubEconomy)){
  if(typeof value!=='function')continue;
  const source=Function.prototype.toString.call(value);
  assert.doesNotMatch(source,/\b(skip|subtask|priority|estimate|deadline|dueDate)\b/i,`${name} must not read non-reward metadata`);
  assert.doesNotMatch(source,/localStorage|indexedDB|fetch\s*\(|Date\.now|Math\.random|randomUUID|XMLHttpRequest/,`${name} must stay pure`);
 }
});

test('every operation is a pure value transformation and never mutates its input',()=>{
 let ledger=applyInitialGrant(emptyClubLedger(),at);
 ledger=applyTaskReward(ledger,{id:'a',at});
 ledger=applyHabitReward(ledger,{id:'h',day,at});
 ledger=applyFocus(ledger,25*60,{at});
 ledger=applyLevel(ledger,2,at);
 ledger=spend(ledger,{itemId:'kit',cost:50,at});
 assertClubLedger(ledger);
 const snapshot=structuredClone(ledger);
 const operations:[string,()=>unknown][]=[
  ['task reward',()=>applyTaskReward(ledger,{id:'b',at})],
  ['task undo',()=>undoTaskReward(ledger,'task:a')],
  ['habit reward',()=>applyHabitReward(ledger,{id:'h2',day,at})],
  ['focus reward',()=>applyFocus(ledger,10*60,{at})],
  ['level bounty',()=>applyLevel(ledger,3,at)],
  ['initial grant replay',()=>applyInitialGrant(ledger,at)],
  ['match',()=>applyMatch(ledger)],
  ['confirmation',()=>confirmSource(ledger,'task:a')],
  ['legacy carryover',()=>applyLegacyCarryover(ledger,{xp:0,funds:0,at})],
 ];
 for(const [name,operation] of operations){
  operation();
  assert.deepEqual(ledger,snapshot,`${name} mutated its input ledger`);
 }
 const next=applyTaskReward(ledger,{id:'b',at});
 assert.notEqual(next,ledger);
 assert.notEqual(next.sources,ledger.sources);
 assert.deepEqual(structuredClone(ledger),snapshot);
});

test('PLAN 4.1: pending offline rewards are recorded but stay out of the spendable balance until confirmed',()=>{
 let ledger=applyTaskReward(emptyClubLedger(),{id:'a',at,confirmed:false});
 assert.equal(ledger.xp,0);
 assert.equal(balance(ledger),0);
 assert.equal(ledger.sources.length,1);
 assert.equal(ledger.sources[0].confirmed,false);
 assert.throws(()=>spend(ledger,{itemId:'kit',cost:1,at}),/Not enough club funds/);
 ledger=confirmSource(ledger,'task:a');
 assert.equal(ledger.xp,10);
 assert.equal(balance(ledger),20);
 assert.deepEqual(confirmSource(ledger,'task:a'),ledger);
 assert.deepEqual(confirmSource(ledger,'task:missing'),ledger);
 const pending=applyFocus(emptyClubLedger(),CLUB_FOCUS_CHUNK_SECONDS,{at,confirmed:false});
 assert.equal(pending.xp,0);
 assert.equal(balance(pending),0);
 assert.equal(pending.focusRemainderSeconds,0);
 const undone=undoTaskReward(applyTaskReward(emptyClubLedger(),{id:'p',confirmed:false}),'task:p');
 assert.equal(undone.xp,0);
 assert.equal(balance(undone),0);
 assert.equal(undone.sources[0].reverted,true);
 assert.deepEqual(confirmSource(undone,'task:p'),undone);
 assertClubLedger(ledger);
});

test('PLAN 4.3 legacy carryover is one-off and freezes old reward identities',()=>{
 let ledger=applyLegacyCarryover(emptyClubLedger(),{xp:420,funds:360,rewardIdentities:['task:old','habit:h:2026-11-13','session:s1'],sessionIdentities:['s1'],activeSession:true,at});
 assert.equal(ledger.xp,420);
 assert.equal(balance(ledger),360);
 assert.deepEqual(ledger.frozenBaseline.rewardIdentities,['task:old','habit:h:2026-11-13','session:s1']);
 assert.deepEqual(ledger.frozenBaseline.sessionIdentities,['s1']);
 assert.equal(ledger.frozenBaseline.activeSession,true);
 assert.equal(ledger.frozenBaseline.at,at);
 assert.deepEqual(applyTaskReward(ledger,{id:'old',at}),ledger);
 assert.deepEqual(applyHabitReward(ledger,{id:'h',day:'2026-11-13',at}),ledger);
 ledger=applyTaskReward(ledger,{id:'new',at});
 assert.equal(ledger.xp,430);
 assert.equal(balance(ledger),380);
 assert.deepEqual(applyLegacyCarryover(ledger,{xp:1,funds:1,at}),ledger);
 assertClubLedger(ledger);
});

test('assertClubLedger rejects corrupted ledgers',()=>{
 const good=spend(applyTaskReward(emptyClubLedger(),{id:'a',at}),{itemId:'kit',cost:20,at});
 assert.doesNotThrow(()=>assertClubLedger(good));
 const cases:[string,unknown][]=[];
 const xp=structuredClone(good);xp.xp=0;cases.push(['xp total',xp]);
 const spent=structuredClone(good);spent.sources[0].amountSpent=1;cases.push(['spent history',spent]);
 const duplicate=structuredClone(good);duplicate.sources.push({...duplicate.sources[0]});cases.push(['duplicate identity',duplicate]);
 const remainder=structuredClone(good);remainder.focusRemainderSeconds=CLUB_FOCUS_CHUNK_SECONDS;cases.push(['focus remainder',remainder]);
 const grant=structuredClone(good);grant.initialGranted=true;cases.push(['initial receipt',grant]);
 const funding=structuredClone(good);funding.spending[0].funding[0].amount=1;cases.push(['purchase funding',funding]);
 const cost=structuredClone(good);cost.spending[0].cost=21;cases.push(['purchase cost',cost]);
 const baseline=structuredClone(good);(baseline.frozenBaseline.rewardIdentities as unknown[])=[1];cases.push(['baseline identity',baseline]);
 for(const [name,corrupt] of cases)assert.throws(()=>assertClubLedger(corrupt as never),/Invalid club ledger/,name);
});
