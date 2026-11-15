import type {Task} from './model.ts';
const priorities=[{number:4,label:'Normal',colour:'#a8a7c4'},{number:3,label:'Worth doing soon',colour:'#55c9ff'},{number:2,label:'Important',colour:'#ffc866'},{number:1,label:'Highest priority',colour:'#ff7196'}] as const;
export function taskPriority(value:number){return priorities[Number.isInteger(value)&&value>=0&&value<=3?value:0]}
export function taskSummaryDates(task:Pick<Task,'plannedOn'|'deadline'|'deadlineConfirmed'>){const dates:{kind:'work'|'deadline';value:string}[]=[];if(task.plannedOn)dates.push({kind:'work',value:task.plannedOn});if(task.deadline&&task.deadlineConfirmed)dates.push({kind:'deadline',value:task.deadline});return dates}

/** Display-only labels. Never use these as subject IDs or provider names. */
export function subjectShortName(title:string):string{
 const name=title.trim();
 const rules:[RegExp,string][]=[
  [/^(?:(?:igcse|gcse|as\/a[- ]?level|as|a[- ]?level|cambridge)\s+)*(?:english\s+literature|英语文学|英文文学|英国文学)(?:\s*\([^)]*\))?$/i,'ENG LIT'],
  [/^(?:(?:igcse|gcse|as\/a[- ]?level|as|a[- ]?level|cambridge)\s+)*(?:english\s+language|英语语言|英文语言)(?:\s*\([^)]*\))?$/i,'LAN'],
  [/^(?:(?:igcse|gcse|as\/a[- ]?level|as|a[- ]?level|cambridge)\s+)*(?:mathematics|maths?|数学)(?:\s*\([^)]*\))?$/i,'MAT'],
  [/^(?:igcse\s+)?(?:physics|物理)$/i,'PHY'],
  [/^(?:igcse\s+)?(?:chemistry|化学)$/i,'CHEM'],
  [/^(?:igcse\s+)?(?:biology|生物)$/i,'BIO'],
  [/^(?:nec\s+)?(?:economics|经济学|经济)(?:\s*\(NEC\))?$/i,'ECON'],
  [/^(?:computer\s+science|computing|计算机科学|计算机)$/i,'CS'],
  [/^(?:chinese|中文|语文)$/i,'CHI'],
 ];
 return rules.find(([pattern])=>pattern.test(name))?.[1]||title;
}
