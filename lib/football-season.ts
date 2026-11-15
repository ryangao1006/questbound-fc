import type {CareerState,Fixture} from './football-model.ts';
import type {FootballClub,FootballRosterPlayer} from './football-data.ts';
import {overall} from './football-stats.ts';
export function seedHash(text:string){let value=2166136261;for(let i=0;i<text.length;i++)value=Math.imul(value^text.charCodeAt(i),16777619);return value>>>0}
export function random(seed:number){let state=seed>>>0||1;return {next(){state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296},get state(){return state>>>0}}}
export function shuffle<T>(values:T[],seed:number){const result=[...values],rng=random(seed);for(let i=result.length-1;i>0;i--){const index=Math.floor(rng.next()*(i+1));[result[i],result[index]]=[result[index],result[i]]}return result}
export function gameDay(day:string,offset:number){return new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10)}
export function premierFixtures(clubs:string[],season:number,seed:number):Fixture[]{if(clubs.length!==20||new Set(clubs).size!==20)throw new Error('A Premier League season needs 20 unique clubs.');const ring=shuffle(clubs,seed),result:Fixture[]=[];for(let round=0;round<19;round++){for(let i=0;i<10;i++){let [home,away]=[ring[i],ring[19-i]];if((round+i)%2)[home,away]=[away,home];result.push({id:`pl:${season}:${round+1}:${home}:${away}`,competition:'premier-league',season,round:round+1,day:gameDay(`${season}-08-15`,round*7),home,away,stage:'league',played:false});result.push({id:`pl:${season}:${round+20}:${away}:${home}`,competition:'premier-league',season,round:round+20,day:gameDay(`${season}-08-15`,(round+19)*7),home:away,away:home,stage:'league',played:false})}ring.splice(1,0,ring.pop()!)}return result.sort(fixtureOrder)}
export const fixtureOrder=(a:Fixture,b:Fixture)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id);
/** Draw two opponents per pot, one at home and one away; never draw the same club twice. */
export function championsFixtures(clubs:FootballClub[],season:number,seed:number):Fixture[]{
 if(clubs.length!==36||new Set(clubs.map(c=>c.id)).size!==36)throw new Error('The Champions League needs 36 unique clubs.');
 const rng=random(seed);let edges:{home:string;away:string}[]=[];
 for(let attempt=0;attempt<120;attempt++){
  const pots=Array.from({length:4},(_,i)=>shuffle(clubs.filter(c=>(c.pot||4)===i+1),seed+attempt*19+i));if(pots.some(p=>p.length!==9))throw new Error('Each Champions League draw pot needs nine clubs.');
  edges=[];const opponents=new Map(clubs.map(c=>[c.id,new Map<string,number>()]));let failed=false;
  const allowed=(a:FootballClub,b:FootballClub)=>a.country!==b.country&&(opponents.get(a.id)!.get(b.country)||0)<2&&(opponents.get(b.id)!.get(a.country)||0)<2&&!edges.some(e=>e.home===a.id&&e.away===b.id||e.home===b.id&&e.away===a.id);
  const add=(a:FootballClub,b:FootballClub)=>{edges.push({home:a.id,away:b.id});for(const [x,y] of [[a,b],[b,a]])opponents.get(x.id)!.set(y.country,(opponents.get(x.id)!.get(y.country)||0)+1)};
  for(const pot of pots){let order:FootballClub[]|null=null;for(let n=0;n<100;n++){const tryOrder=shuffle(pot,seed+attempt*100+n);if(tryOrder.every((a,i)=>a.country!==tryOrder[(i+1)%9].country)){order=tryOrder;break}}if(!order){failed=true;break}order.forEach((a,i)=>add(a,order![(i+1)%9]));}
  if(failed)continue;
  for(let a=0;a<4&&!failed;a++)for(let b=a+1;b<4&&!failed;b++)for(let direction=0;direction<2;direction++){
   const left=direction?pots[b]:pots[a],right=direction?pots[a]:pots[b];const matched=new Map<string,FootballClub>();let visits=0;
   const find=(index:number):boolean=>{if(index===left.length)return true;if(++visits>10000)return false;const player=left[index];for(const candidate of shuffle(right,seed+attempt*137+index*19+direction)){if([...matched.values()].some(x=>x.id===candidate.id)||!allowed(player,candidate))continue;matched.set(player.id,candidate);if(find(index+1))return true;matched.delete(player.id)}return false};
   if(!find(0)){failed=true;break}left.forEach(c=>add(c,matched.get(c.id)!));
  }
  if(failed)continue;
  // Factor the regular draw graph into eight complete matchdays.
  for(let factorAttempt=0;factorAttempt<100;factorAttempt++){
   let available=[...edges];const rounds:{home:string;away:string}[][]=[];let factorFailed=false;
   for(let day=0;day<8;day++){
    const used=new Set<string>(),pairs:typeof edges=[];let visits=0;
    const find=():boolean=>{if(used.size===36)return true;if(++visits>18000)return false;const remaining=clubs.filter(c=>!used.has(c.id)).map(c=>({id:c.id,options:available.filter(e=>(e.home===c.id||e.away===c.id)&&!used.has(e.home)&&!used.has(e.away))})).sort((a,b)=>a.options.length-b.options.length||a.id.localeCompare(b.id));const first=remaining[0];if(!first?.options.length)return false;for(const edge of shuffle(first.options,seed+factorAttempt*101+day*7+used.size)){used.add(edge.home);used.add(edge.away);pairs.push(edge);if(find())return true;pairs.pop();used.delete(edge.home);used.delete(edge.away)}return false};
    if(!find()){factorFailed=true;break}rounds.push([...pairs]);available=available.filter(e=>!pairs.includes(e));
   }
   if(!factorFailed)return rounds.flatMap((round,i)=>round.map(e=>({id:`ucl:${season}:league:${i+1}:${e.home}:${e.away}`,competition:'champions-league' as const,season,round:i+1,day:gameDay(`${season}-09-15`,[0,21,42,63,77,91,126,140][i]),...e,stage:'league',played:false}))).sort(fixtureOrder);
  }
 }
 throw new Error('A valid Champions League draw could not be made. Try creating the career again.');
}
export type TableRow={clubId:string;played:number;won:number;drawn:number;lost:number;for:number;against:number;difference:number;points:number;awayGoals:number;opponentPoints:number};
export function leagueTable(fixtures:Fixture[],clubs:string[]):TableRow[]{const rows=new Map(clubs.map(clubId=>[clubId,{clubId,played:0,won:0,drawn:0,lost:0,for:0,against:0,difference:0,points:0,awayGoals:0,opponentPoints:0}]));for(const fixture of fixtures.filter(f=>f.played&&f.homeGoals!==undefined&&f.awayGoals!==undefined)){for(const [id,other,goals,conceded,away] of [[fixture.home,fixture.away,fixture.homeGoals!,fixture.awayGoals!,false],[fixture.away,fixture.home,fixture.awayGoals!,fixture.homeGoals!,true]] as const){const row=rows.get(id);if(!row)continue;row.played++;row.for+=goals;row.against+=conceded;row.difference+=goals-conceded;if(away)row.awayGoals+=goals;if(goals>conceded){row.won++;row.points+=3}else if(goals===conceded){row.drawn++;row.points++}else row.lost++;void other}}
 for(const fixture of fixtures.filter(f=>f.played)){const home=rows.get(fixture.home),away=rows.get(fixture.away);if(home&&away){home.opponentPoints+=away.points;away.opponentPoints+=home.points}}
 return [...rows.values()].sort((a,b)=>b.points-a.points||b.difference-a.difference||b.for-a.for||b.awayGoals-a.awayGoals||b.won-a.won||b.opponentPoints-a.opponentPoints||a.clubId.localeCompare(b.clubId));}
function strength(c:CareerState,id:string){const squad=c.world.players.filter(p=>p.clubId===id&&!p.loanedOut&&p.registration!=='unverified').map(p=>overall(p.position,p.position==='GK'?p.goalkeeper||{}:p.attributes)).sort((a,b)=>b-a);return squad.slice(0,11).reduce((a,b)=>a+b,0)/Math.max(1,Math.min(11,squad.length))}
export function simulateBackground(c:CareerState,fixture:Fixture){if(fixture.played)return;const rng=random(seedHash(fixture.id)+c.seed),difference=(strength(c,fixture.home)-strength(c,fixture.away))/25;const goals=(expect:number)=>{let value=0,product=1;const limit=Math.exp(-expect);while(product>limit&&value<12){product*=Math.max(.00001,rng.next());value++}return Math.max(0,value-1)};fixture.homeGoals=goals(Math.max(.25,1.45+difference));fixture.awayGoals=goals(Math.max(.25,1.15-difference));fixture.played=true;}
export function advanceBackground(c:CareerState,until:string){for(const fixture of c.fixtures.filter(f=>!f.played&&f.day<=until&&f.home!==c.player.clubId&&f.away!==c.player.clubId))simulateBackground(c,fixture);advanceChampionsStages(c)}
function tieWinner(c:CareerState,tieId:string){const legs=c.fixtures.filter(f=>f.tieId===tieId).sort((a,b)=>(a.leg||1)-(b.leg||1));if(!legs.length||legs.some(f=>!f.played))return null;const first=legs[0];let home=0,away=0;for(const leg of legs){if(leg.home===first.home){home+=leg.homeGoals||0;away+=leg.awayGoals||0}else{home+=leg.awayGoals||0;away+=leg.homeGoals||0}}const last=legs.at(-1)!;if(home===away){if(last.shootout)return last.shootout[0]>last.shootout[1]?last.home:last.away;const winner=(seedHash(tieId)+c.seed)%2?first.home:first.away;last.extraTime=true;last.shootout=winner===last.home?[5,4]:[4,5];return winner}return home>away?first.home:first.away}
function knockout(c:CareerState,teams:string[],stage:string,round:number,day:string,single=false){for(let i=0;i<teams.length/2;i++){const home=teams[teams.length-1-i],away=teams[i],tieId=`ucl:${c.season}:${stage}:${i}`;c.fixtures.push({id:tieId+':1',competition:'champions-league',season:c.season,round,day,home,away,stage,tieId,leg:1,played:false});if(!single)c.fixtures.push({id:tieId+':2',competition:'champions-league',season:c.season,round:round+1,day:gameDay(day,7),home:away,away:home,stage,tieId,leg:2,played:false})}}
export function advanceChampionsStages(c:CareerState){const ucl=c.fixtures.filter(f=>f.competition==='champions-league'&&f.season===c.season);const league=ucl.filter(f=>f.stage==='league');if(league.length!==144||league.some(f=>!f.played))return;const clubs=c.world.clubs.filter(t=>t.championsLeague).map(t=>t.id),table=leagueTable(league,clubs),year=c.season+1;
 if(!ucl.some(f=>f.stage==='playoff')){knockout(c,table.slice(8,24).map(t=>t.clubId),'playoff',9,`${year}-02-16`);return}
 const stages=[['playoff','round16',table.slice(0,8).map(t=>t.clubId),`${year}-03-09`],['round16','quarterfinal',[],`${year}-04-06`],['quarterfinal','semifinal',[],`${year}-04-27`],['semifinal','final',[],`${year}-05-29`]] as [string,string,string[],string][];
 for(const [previous,next,seeds,day] of stages){const fixtures=c.fixtures.filter(f=>f.season===c.season&&f.stage===previous&&f.competition==='champions-league');if(!fixtures.length||fixtures.some(f=>!f.played)||c.fixtures.some(f=>f.season===c.season&&f.stage===next&&f.competition==='champions-league'))continue;const winners=[...new Set(fixtures.map(f=>f.tieId!))].map(id=>tieWinner(c,id)).filter((id):id is string=>!!id);knockout(c,[...seeds,...winners],next,previous==='playoff'?11:previous==='round16'?13:previous==='quarterfinal'?15:17,day,next==='final');return}
}
export function playerSeasonFixtures(c:CareerState){return c.fixtures.filter(f=>f.season===c.season&&(f.home===c.player.clubId||f.away===c.player.clubId)).sort(fixtureOrder)}
export function nextPlayerFixture(c:CareerState){return playerSeasonFixtures(c).find(f=>!f.played)}
export function playerGameAttributes(p:FootballRosterPlayer){return {...p.attributes,diving:p.goalkeeper?.diving||10,handling:p.goalkeeper?.handling||10,kicking:p.goalkeeper?.kicking||p.attributes.pas,reflexes:p.goalkeeper?.reflexes||10,speed:p.goalkeeper?.speed||p.attributes.pac,positioning:p.goalkeeper?.positioning||10}}
