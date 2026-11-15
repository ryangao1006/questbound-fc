import {localDay,zonedTime,type PlannerState,type Subject,type Task} from './model.ts';
import {validDay,shiftDay} from './task-follow-up.ts';

export type SmartToken={id:string;kind:'date'|'duration'|'time'|'priority';raw:string;start:number;end:number;value:string};
export type SmartParse={title:string;patch:Partial<Task>;tokens:SmartToken[];errors:string[];hints:string[]};
export type SubjectMatch={subject:Subject;partTitle:string;score:number};
export type SmartTaskDraft={version:1;id:string;raw:string;fields:Partial<Task>;ignored:string[]};
export function readSmartTaskDraft(raw:string|null,initial:Partial<Task>,id:string,state:PlannerState):SmartTaskDraft{
 const fresh:SmartTaskDraft={version:1,id,raw:initial.title||'',fields:{},ignored:[]};
 try{const saved=JSON.parse(raw||'null');if(saved?.version!==1||typeof saved.id!=='string'||!saved.id||saved.id.length>200||typeof saved.raw!=='string'||!saved.fields||typeof saved.fields!=='object'||Array.isArray(saved.fields)||!Array.isArray(saved.ignored))return fresh;
  const allowed=['listId','subjectId','area','plannedOn','plannedTime','plannedEnd','estimate','priority','main','notes'];const fields=Object.fromEntries(Object.entries(saved.fields).filter(([key])=>allowed.includes(key))) as Partial<Task>;
  if(fields.listId&&!state.lists.some(l=>l.id===fields.listId&&!l.archived)){delete fields.listId;delete fields.subjectId;delete fields.area;}
  if(fields.subjectId&&!state.subjects.some(s=>s.id===fields.subjectId&&!s.archived&&s.listId===(fields.listId||initial.listId))){fields.subjectId='';fields.area='No subject';}
  return {version:1,id:saved.id,raw:saved.raw,fields,ignored:saved.ignored.filter((value:unknown)=>typeof value==='string').slice(0,100)};
 }catch{return fresh;}
}
const aliases:[RegExp,string[]][]=[
 [/english.*language|英语语言|英文语言/i,['eng','english','lang','englang','elanguage','英语','英文','语言','英语语言','英文写作']],
 [/english.*literature|英国文学|英语文学|英文文学/i,['eng','english','lit','englit','literature','英语','英文','文学','英语文学','英文文学']],
 [/english.*extra/i,['eng','english','extra','英语课外']],
 [/mathematics|maths|数学/i,['math','maths','mathematics','as','alevel','数学','高数']],
 [/economics.*nec|nec.*economics/i,['econ','economics','nec','经济','经济竞赛']],
 [/economics|经济/i,['econ','eco','economics','经济','经济学']],
 [/computer science|computing|计算机/i,['cs','comp','computing','computer','计算机','电脑','编程']],
 [/physics|物理/i,['phy','phys','physics','物理']],
 [/chemistry|化学/i,['chem','chemistry','化学']],
 [/biology|生物/i,['bio','biology','生物']],
 [/^chinese$|语文|中文/i,['chi','chinese','中文','语文']],
 [/fitness|gym|健身/i,['gym','fit','fitness','健身','运动','训练']],
 [/reading|阅读/i,['read','reading','阅读']],
 [/wellbeing|health|健康/i,['health','well','wellbeing','健康','身心']],
 ];
const normal=(text:string)=>text.toLocaleLowerCase().replace(/[\s\-_()/]/g,'');
export function matchSubjects(state:PlannerState,query:string,part='All'):SubjectMatch[]{
 const q=normal(query.replace(/^#/,'').trim());if(!q)return [];
 return state.subjects.filter(s=>!s.archived&&(part==='All'||s.listId===part)&&!state.lists.find(l=>l.id===s.listId)?.archived).map(subject=>{
  const title=normal(subject.title),words=subject.title.toLowerCase().split(/[\s/()_-]+/),known=aliases.filter(([pattern])=>pattern.test(subject.title)).flatMap(([,names])=>names);
  let score=title===q?100:known.includes(q)?85:title.startsWith(q)?80:words.some(w=>w.startsWith(q))?70:known.some(a=>normal(a).startsWith(q))?60:title.includes(q)&&(q.length>=3||/[\u3400-\u9fff]/.test(q))?35:0;
  if(/english.*extra/i.test(subject.title)&&['eng','english','英语','英文'].includes(q))score-=20;
  return {subject,partTitle:state.lists.find(l=>l.id===subject.listId)?.title||'',score};
 }).filter(row=>row.score>0).sort((a,b)=>b.score-a.score||a.subject.title.localeCompare(b.subject.title,'en')||a.partTitle.localeCompare(b.partTitle)).slice(0,8);
}
export function subjectFragment(text:string,caret:number){const left=text.slice(0,caret),match=left.match(/(?:^|[\s，,；;])(#?[\p{L}\p{N}_-]+)$/u);if(!match)return null;const query=match[1];if(query.replace(/^#/,'').length<2&&!/[\u3400-\u9fff]/.test(query))return null;return {query,start:caret-query.length,end:caret};}
export function acceptSubject(text:string,fragment:{start:number;end:number}){const before=text.slice(0,fragment.start),after=text.slice(fragment.end);const next=before+after;return {text:next.replace(/^\s+/,''),caret:Math.max(0,before.length-(next.length-next.replace(/^\s+/, '').length))};}
export function subjectSuggestions(state:PlannerState,text:string,caret:number,part='All'){
 let fragment=subjectFragment(text,caret);if(!fragment)return null;
 let matches=matchSubjects(state,fragment.query,part);
 if(!matches.length&&/[\u3400-\u9fff]/.test(fragment.query))for(let length=Math.min(8,fragment.query.length);length>=1;length--){const query=fragment.query.slice(-length),found=matchSubjects(state,query,part);if(found.length){fragment={query,start:caret-query.length,end:caret};matches=found;break;}}
 return matches.length?{fragment,matches}:null;
}

function chineseNumber(value:string):number{if(/^\d+(?:\.\d+)?$/.test(value))return Number(value);const digits:Record<string,number>={'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};let total=0,current=0;for(const c of value.replace(/个/g,'')){if(c in digits)current=digits[c];else if(c==='十'){total+=(current||1)*10;current=0}else if(c==='百'){total+=(current||1)*100;current=0}else return NaN;}return total+current;}
const number='(?:\\d+(?:\\.\\d+)?|[零〇一二两三四五六七八九十百]+)';
const clock='(?:(?:早上|早晨|凌晨|上午|中午|下午|晚上|晚间)\\s*)?(?:\\d{1,2}(?::\\d{2})?|[一二两三四五六七八九十]+)(?:\\s*(?:点|時|时)(?:半|一刻|三刻|[零一二两三四五六七八九十\\d]+分?)?|\\s*(?:am|pm|a\\.m\\.|p\\.m\\.))?';
function meridiem(value:string){if(/下午|晚上|晚间|pm|p\.m\./i.test(value))return 'pm';if(/早上|早晨|凌晨|上午|am|a\.m\./i.test(value))return 'am';if(/中午/.test(value))return 'noon';return '';}
function readClock(raw:string,inherit=''):{time:string;minutes:number}|null{
 const mer=meridiem(raw)||inherit,clean=raw.toLowerCase().replace(/早上|早晨|凌晨|上午|中午|下午|晚上|晚间|a\.m\.|p\.m\.|am|pm|\s/g,'');
 const match=clean.match(/^([\d一二两三四五六七八九十]+)(?::(\d{2})|(?:点|时|時)(半|一刻|三刻|[零一二两三四五六七八九十\d]+分?)?)?$/);if(!match)return null;
 let hour=chineseNumber(match[1]);const tail=match[2]||match[3]||'0';let minute=tail==='半'?30:tail==='一刻'?15:tail==='三刻'?45:chineseNumber(tail.replace(/分$/,''));
 if(!Number.isInteger(hour)||!Number.isInteger(minute)||minute<0||minute>59||hour<0||hour>24||hour===24&&minute!==0)return null;
 if(mer){if(hour>12)return null;if(mer==='pm'&&hour<12)hour+=12;if(mer==='am'&&hour===12)hour=0;if(mer==='noon'&&hour<11)hour+=12;}
 return {time:`${String(hour%24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`,minutes:hour*60+minute};
}
export function parseTaskInput(raw:string,context:{today:string;timezone:string},ignored:string[]=[]):SmartParse{
 // The narrow replacements preserve UTF-16 offsets and all user-authored title content.
 const text=raw.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/：/g,':');
 const tokens:SmartToken[]=[],errors:string[]=[],hints:string[]=[],patch:Partial<Task>={},protectedRanges:[number,number][]=[];
 for(const match of text.matchAll(/https?:\/\/\S+|`[^`]*`|"[^"]*"|“[^”]*”|‘[^’]*’|《[^》]*》/g))protectedRanges.push([match.index!,match.index!+match[0].length]);
 const free=(start:number,end:number)=>!protectedRanges.some(([a,b])=>start<b&&end>a)&&!tokens.some(t=>start<t.end&&end>t.start);
 const add=(kind:SmartToken['kind'],start:number,end:number,value:string)=>{const source=raw.slice(start,end),id=`${kind}:${start}:${source}`;if(!free(start,end)||ignored.includes(id))return false;tokens.push({id,kind,start,end,raw:source,value});return true;};
 const boundary=(start:number,end:number)=>!/[\p{L}\p{N}_/]/u.test(text[start-1]||'')&&!/[\p{L}\p{N}_/]/u.test(text[end]||'');
 let chosenDay='';
 for(const match of text.matchAll(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b|\d{1,2}月\d{1,2}[日号]?|\b(?:today|tomorrow|tonight|day after tomorrow)\b|后天|明天|今天|今晚|(?:(?:下|这|本)周|(?:下|这|本)?星期|周)[一二三四五六日天]|\b(?:(?:next|this)\s+)?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\b|\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:,?\s+\d{4})?\b/gi)){
  const start=match.index!,end=start+match[0].length;if(!free(start,end)||chosenDay)continue;const value=match[0].toLowerCase();let day='';
  if(/^\d{4}/.test(value)){const [y,m,d]=value.split(/[-/]/);day=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;if(!boundary(start,end))continue;}
  else if(/月/.test(value)){const m=value.match(/(\d+)月(\d+)/)!;day=`${context.today.slice(0,4)}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;if(validDay(day)&&day<context.today)day=String(Number(day.slice(0,4))+1)+day.slice(4);}
  else if(/after tomorrow|后天/.test(value))day=shiftDay(context.today,2);
  else if(/tomorrow|明天/.test(value))day=shiftDay(context.today,1);
  else if(/today|tonight|今天|今晚/.test(value))day=context.today;
  else {const zh=value.match(/[一二三四五六日天]$/),names=['sun','mon','tue','wed','thu','fri','sat'],weekday=zh?{'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'日':0,'天':0}[zh[0]]!:names.indexOf(value.replace(/^(next|this)\s+/,'').slice(0,3));
   if(weekday>=0){const current=new Date(context.today+'T12:00:00Z').getUTCDay();let delta=(weekday-current+7)%7;if(/下周|下星期/.test(value))delta=-((current+6)%7)+7+((weekday+6)%7);else if(/^(this)|这周|本周|这星期|本星期/.test(value))delta=-((current+6)%7)+((weekday+6)%7);else if(/^next/.test(value)&&delta===0)delta=7;day=shiftDay(context.today,delta);}
   else {const date=value.match(/^([a-z]+)\s+(\d+)(?:,?\s+(\d{4}))?$/);if(date){const months=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];day=`${date[3]||context.today.slice(0,4)}-${String(months.indexOf(date[1].slice(0,3))+1).padStart(2,'0')}-${date[2].padStart(2,'0')}`;if(!date[3]&&validDay(day)&&day<context.today)day=String(Number(day.slice(0,4))+1)+day.slice(4);}}
  }
  if(!validDay(day)){const id=`date:${start}:${raw.slice(start,end)}`;if(!ignored.includes(id)&&add('date',start,end,'invalid'))errors.push('Check the recognised date.');continue;}
  if(add('date',start,end,day)){chosenDay=day;patch.plannedOn=day;}
 }
 let duration:number|undefined;
 const durationPattern=new RegExp(`(?:${number}\\s*(?:hours?|hrs?|hr|h|个?小时|小時)(?:\\s*(?:and)?\\s*${number}\\s*(?:minutes?|mins?|min|m|分钟|分鐘|分)|半)?|(?:一个半|一个半|半个?|一個半)\\s*(?:小时|小時)|${number}\\s*(?:minutes?|mins?|min|m|分钟|分鐘))`,'gi');
 for(const match of text.matchAll(durationPattern)){
  const start=match.index!,end=start+match[0].length;if(!free(start,end)||duration!==undefined)continue;if(/[a-z\d_]/i.test(text[start-1]||'')||/[a-z]/i.test(text[end]||''))continue;
  const value=match[0];let minutes=0;
  if(/一个半|一個半/.test(value))minutes=90;else if(/^半/.test(value))minutes=30;else {for(const part of value.matchAll(new RegExp(`(${number})\\s*(hours?|hrs?|hr|h|个?小时|小時|minutes?|mins?|min|m|分钟|分鐘|分)`,'gi'))){const n=chineseNumber(part[1]),unit=part[2];minutes+=n*(/hour|hr|^h$|小时|小時/i.test(unit)?60:1);}if(/(?:小时|小時)半$/.test(value))minutes+=30;}
  if(add('duration',start,end,String(minutes))){duration=minutes;if(!Number.isFinite(minutes)||minutes<5||minutes>1440)errors.push('Choose a duration from 5 minutes to 24 hours.');else patch.estimate=Math.round(minutes);}
 }
 let startClock:ReturnType<typeof readClock>=null,endClock:ReturnType<typeof readClock>=null;
 const range=new RegExp(`(?:(?:from|start(?:\\s+at)?|从|开始)\\s*)?(${clock})\\s*(?:-|–|—|~|～|to|到|至|\\s+(?:end|finish|结束)(?:\\s+at)?\\s*)\\s*(${clock})`,'gi');
 for(const match of text.matchAll(range)){
  const start=match.index!,end=start+match[0].length;if(!free(start,end)||startClock)continue;
  if(!/:|am|pm|a\.m|p\.m|点|时|時|早|午|晚|from|start|从|开始/i.test(match[0]))continue;if(/[a-z\d_/]/i.test(text[start-1]||'')||/[a-z\d_]/i.test(text[end]||''))continue;
  let a=readClock(match[1],meridiem(match[2])),b=readClock(match[2],meridiem(match[1]));
  if(a&&b&&!meridiem(match[1])&&meridiem(match[2])&&b.minutes<a.minutes){const other=readClock(match[1],meridiem(match[2])==='pm'?'am':'pm');if(other&&((b.minutes-other.minutes+1440)%1440)<((b.minutes-a.minutes+1440)%1440))a=other;}
  if(add('time',start,end,a&&b?`${a.time}–${b.time}`:'invalid')){if(!a||!b||a.minutes===1440)errors.push('Check the recognised time.');else {startClock=a;endClock=b;}}
 }
 const ending=new RegExp(`(?:\\bend(?:\\s+at)?|\\bfinish(?:\\s+at)?|结束(?:于)?)\\s*(${clock})`,'gi');
 if(!endClock)for(const match of text.matchAll(ending)){const start=match.index!,end=start+match[0].length;if(!free(start,end))continue;const value=readClock(match[1]);if(add('time',start,end,value?.time||'invalid')){if(value)endClock=value;else errors.push('Check the recognised time.');break;}}
 const starting=new RegExp(`(?:(?:\\bat|\\bstart(?:\\s+at)?|开始(?:于)?|从)\\s*)?(${clock})`,'gi');
 if(!startClock)for(const match of text.matchAll(starting)){const start=match.index!,end=start+match[0].length;if(!free(start,end))continue;if(!/:|am|pm|a\.m|p\.m|点|时|時|早|午|晚|^at|^start|^开始|^从/i.test(match[0]))continue;if(/[a-z\d_/]/i.test(text[start-1]||'')||/[a-z\d_]/i.test(text[end]||''))continue;const value=readClock(match[1]);if(add('time',start,end,value?.time||'invalid')){if(value&&value.minutes<1440)startClock=value;else errors.push('Check the recognised time.');break;}}
 for(const match of text.matchAll(/(?:^|\s)(?:p([1-4])|优先级\s*([1-4]))(?=\s|$)/gi)){const start=match.index!+(match[0].startsWith(' ')?1:0),end=match.index!+match[0].length;if(add('priority',start,end,match[1]||match[2]))patch.priority=4-Number(match[1]||match[2]);}
 let workDay=chosenDay||context.today;
 if(endClock&&!startClock&&duration!==undefined&&duration>=5&&duration<=1440){const start=endClock.minutes-duration;if(start<0)workDay=shiftDay(workDay,-1);startClock={minutes:(start+1440)%1440,time:`${String(Math.floor(((start+1440)%1440)/60)).padStart(2,'0')}:${String((start+1440)%60).padStart(2,'0')}`};}
 if(startClock){patch.plannedOn=workDay;patch.plannedTime=startClock.time;const start=zonedTime(workDay,startClock.time,context.timezone);
  if(endClock){let minutes=(endClock.minutes-startClock.minutes+1440)%1440;if(minutes===0)minutes=1440;patch.plannedEnd=new Date(Date.parse(start)+minutes*60000).toISOString();if(duration===undefined)patch.estimate=minutes;if(minutes<5)errors.push('Choose a planned end 5 minutes to 24 hours after the start.');if(duration!==undefined&&duration!==minutes)hints.push('Estimated effort and the calendar window are different; both will be kept.');}
  else if(duration!==undefined&&duration>=5&&duration<=1440)patch.plannedEnd=new Date(Date.parse(start)+duration*60000).toISOString();
 }else if(endClock)errors.push('Add a start time or duration for an end time.');
 let title='',cursor=0;for(const token of [...tokens].sort((a,b)=>a.start-b.start)){title+=raw.slice(cursor,token.start);cursor=token.end;}title+=raw.slice(cursor);title=title.replace(/\s+/g,' ').replace(/^[,，;；\s]+|[,，;；\s]+$/g,'').trim();
 return {title,patch,tokens:tokens.sort((a,b)=>a.start-b.start),errors:[...new Set(errors)],hints:[...new Set(hints)]};
}
