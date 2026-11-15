export const PRACTICE_ACTIONS=['pass','shoot','through','cross','tackle','slide','keeper'] as const;
export type PracticeAction=typeof PRACTICE_ACTIONS[number];
export type PracticeBindings=Record<PracticeAction,string>;
export const DEFAULT_BINDINGS:PracticeBindings={pass:'j',shoot:'k',through:'l',cross:'i',tackle:'u',slide:'o',keeper:' '};
export const BINDING_KEYS=['j','k','l','i','u','o','h','f','g','r','t','y','z','x','c','v','b','n','m',' '] as const;
export function readBindings(value:unknown):PracticeBindings{
 if(!value||typeof value!=='object')return {...DEFAULT_BINDINGS};
 const b=value as PracticeBindings,keys=PRACTICE_ACTIONS.map(a=>b[a]);
 return keys.every(k=>(BINDING_KEYS as readonly string[]).includes(k))&&new Set(keys).size===keys.length?Object.fromEntries(PRACTICE_ACTIONS.map(a=>[a,b[a]])) as PracticeBindings:{...DEFAULT_BINDINGS};
}
/** Swap conflicting actions, keeping every action reachable with a unique key. */
export function rebind(current:PracticeBindings,action:PracticeAction,key:string):PracticeBindings{
 const next=readBindings(current);if(!(BINDING_KEYS as readonly string[]).includes(key))return next;
 const other=PRACTICE_ACTIONS.find(a=>next[a]===key);if(other)next[other]=next[action];next[action]=key;return next;
}
export const keyLabel=(key:string)=>key===' '?'Space':key.toUpperCase();
