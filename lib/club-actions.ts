import {clubFunds,clubRatings,type ClubState} from './club-state.ts';
import {trainingPrice} from './club-model.ts';
import {signingPrice} from './club-transfers.ts';
import type {PlannerState} from './model.ts';

/**
 * "What should I do next?" for the club home screen. Pure, deterministic and
 * capped at three suggestions so the overview stays short.
 */
export type ClubAction={
 id:'league'|'cup'|'train'|'tactic'|'facility'|'sign'|'friendly'|'create';
 title:string;titleZh:string;detail:string;detailZh:string;
 href:string;urgent:boolean;
};
export function nextClubActions(state:PlannerState,limit=3):ClubAction[]{
 const club=state.club;
 if(!club)return [{id:'create',title:'Create your club',titleZh:'创建俱乐部',detail:'Name it, pick colours and get your first squad.',detailZh:'起个名字、选好配色，领取第一批球员。',href:'/club#club-create',urgent:true}];
 const actions:ClubAction[]=[],funds=clubFunds(state.economy);
 if(!club.season)actions.push({id:'league',title:'Start a league season',titleZh:'开始联赛赛季',detail:'Fourteen rounds, promotion and relegation.',detailZh:'14 轮联赛，有升级和降级。',href:'/club#club-league',urgent:actions.length===0});
 else if(!club.season.finished&&club.season.round<14)actions.push({id:'league',title:`Play league round ${club.season.round+1}`,titleZh:`进行联赛第 ${club.season.round+1} 轮`,detail:'Each round updates the table.',detailZh:'每轮都会更新积分榜。',href:'/club#club-league',urgent:false});
 if(!club.cup)actions.push({id:'cup',title:'Enter the challenge cup',titleZh:'参加挑战杯',detail:'Four clubs, two rounds, fictional opponents.',detailZh:'四支球队两轮，虚构对手。',href:'/club#club-cup',urgent:false});
 else if(!club.cup.finished)actions.push({id:'cup',title:'Play the next cup round',titleZh:'进行杯赛下一轮',detail:'Semi-finals and final.',detailZh:'半决赛与决赛。',href:'/club#club-cup',urgent:false});
 const prices=club.players.map(player=>{const price=trainingPrice(player.attributes.pas);return typeof price==='number'?price:Number.POSITIVE_INFINITY});
 const cheapest=prices.length?Math.min(...prices):Number.POSITIVE_INFINITY;
 if(funds>=cheapest)actions.push({id:'train',title:'Train a player',titleZh:'培养球员',detail:`From ${cheapest} FC per attribute point.`,detailZh:`最低 ${cheapest} 资金一点属性。`,href:'/club#club-training',urgent:false});
 if(funds>=300)actions.push({id:'sign',title:'Sign a recommended player',titleZh:'签入推荐球员',detail:`Scout picks start at ${signingPrice(65).toLocaleString()} FC.`,detailZh:`球探推荐最低约 ${signingPrice(65).toLocaleString()} 资金。`,href:'/club#club-transfers',urgent:false});
 if(actions.length<limit)actions.push({id:'friendly',title:'Play a friendly',titleZh:'打一场友谊赛',detail:'Free, instant and a good way to test a tactic.',detailZh:'免费、即时，适合试验战术。',href:'/club#club-match',urgent:false});
 return actions.slice(0,limit);
}
export function clubHomeSummary(state:PlannerState){
 const club=state.club;
 if(!club)return {headline:'',headlineZh:'',detail:'',detailZh:'',next:'create' as const};
 const ratings=clubRatings(club),funds=clubFunds(state.economy);
 const next=!club.season?'league':!club.season.finished?'league':!club.cup||!club.cup.finished?'cup':'friendly';
 return {headline:`${club.name} · OVR ${ratings.overall.toFixed(1)}`,headlineZh:`${club.name} · 总评 ${ratings.overall.toFixed(1)}`,detail:`${funds.toLocaleString()} FC · ${club.players.length} players · ${club.trophies?.length??0} trophies`,detailZh:`${funds.toLocaleString()} 资金 · ${club.players.length} 名球员 · ${club.trophies?.length??0} 座奖杯`,next:next as string};
}
export function summarizeAction(action:ClubAction){return action.title}
