import {initialState} from './model.ts';
import {reduceCommand} from './domain.ts';
import type {PlannerState} from './model.ts';

/**
 * Browser-only demo store for the static GitHub Pages build. It applies the same
 * command reducer the server uses, keeps the document in localStorage and mimics
 * the revision + operation-id guarantees of /api/command. No server involved.
 */
export type DemoEnvelope={state:PlannerState;revision:number;updatedAt:string};
type Stored={revision:number;state:PlannerState;operations:string[]};
const KEY='qfc-demo-document-v2';
const now=()=>new Date().toISOString();
function seeded():PlannerState{
 let state=initialState();
 const apply=(id:string,command:Record<string,unknown>)=>reduceCommand(state,{...command,id} as never);
 state=apply('demo-club',{type:'club.create',name:'Questbound FC',shortName:'QFC',city:'Northbridge',formation:'4-3-3',colours:{primary:'#2f6f4e',secondary:'#c8f56e'}} as never);
 state=apply('demo-match-1',{type:'club.match',tier:1} as never);
 state=apply('demo-match-2',{type:'club.match',tier:0} as never);
 state=apply('demo-season',{type:'club.league.start',tier:0} as never);
 state=apply('demo-round-1',{type:'club.league.play'} as never);
 state=apply('demo-cup',{type:'club.cup.start',tier:0} as never);
 state=apply('demo-cup-semis',{type:'club.cup.play'} as never);
 return state;
}
function read():Stored{
 try{
  const raw=localStorage.getItem(KEY);
  if(raw){const parsed=JSON.parse(raw) as Stored;if(parsed?.state?.schemaVersion===initialState().schemaVersion)return parsed}
 }catch{}
 const state=seeded();
 const stored={revision:1,state,operations:[] as string[]};
 write(stored);
 return stored;
}
function write(stored:Stored){try{localStorage.setItem(KEY,JSON.stringify(stored))}catch{}}
export function resetDemo(){try{localStorage.removeItem(KEY)}catch{}}
export function demoRead():DemoEnvelope{
 const stored=read();
 return {state:stored.state,revision:stored.revision,updatedAt:now()};
}
export function demoSend(command:Record<string,unknown>,revision:number,operationId?:string):DemoEnvelope{
 const stored=read();
 if(operationId&&stored.operations.includes(operationId))return {state:stored.state,revision:stored.revision,updatedAt:now()};
 if(revision!==stored.revision)throw Object.assign(new Error('Your copy is out of date. Reload to continue.'),{status:409});
 const id=operationId??`demo-op-${Date.now()}`;
 const next=reduceCommand(stored.state,{...command,id} as never);
 const storedNext:Stored={revision:stored.revision+1,state:next,operations:[...stored.operations,id].slice(-400)};
 write(storedNext);
 return {state:next,revision:storedNext.revision,updatedAt:now()};
}
export function demoResetToSeed():DemoEnvelope{resetDemo();return demoRead()}
