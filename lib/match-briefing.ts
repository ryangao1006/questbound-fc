import {clubRatings,type ClubState,type ClubTactic} from './club-state.ts';
import {TACTIC_SHAPE,type ClubTeam} from './club-match.ts';

/**
 * Pre-match opponent briefing (PLAN 3.6 manager depth). Pure rules: compare the
 * four lines, name the opponent's tactic, pick the strongest and weakest line and
 * suggest a shape with a one-line reason. Nothing here changes a match result.
 */
export type BriefLine='DEF'|'MID'|'ATT'|'GK';
export type LineComparison={line:BriefLine;ours:number;theirs:number;diff:number;edge:'ours'|'theirs'|'even'};
export type MatchBriefing={
 opponent:{name:string;shortName:string;tactic:ClubTactic;lines:{DEF:number;MID:number;ATT:number;GK:number}};
 comparison:LineComparison[];
 strongest:LineComparison;
 weakest:LineComparison;
 suggestedTactic:ClubTactic;
 tacticReason:string;
 headline:string;
 caution:string;
};
const TACTIC_NAMES:Record<ClubTactic,string>={balanced:'Balanced',possession:'Possession',counter:'Counter',wide:'Wide',press:'Press'};
export function tacticName(tactic:ClubTactic){return TACTIC_NAMES[tactic]??tactic}
export function compareLines(club:ClubState,opponent:ClubTeam):LineComparison[]{
 const ours=clubRatings(club),lines:BriefLine[]=['DEF','MID','ATT','GK'];
 return lines.map(line=>{
  const diff=Math.round((ours[line]-opponent.lines[line])*10)/10;
  return {line,ours:Math.round(ours[line]*10)/10,theirs:Math.round(opponent.lines[line]*10)/10,diff,edge:Math.abs(diff)<1.5?'even':diff>0?'ours':'theirs'};
 });
}
export function suggestTactic(comparison:LineComparison[],opponentTactic:ClubTactic):{tactic:ClubTactic;reason:string}{
 const byLine=new Map(comparison.map(entry=>[entry.line,entry]));
 const attackVsDefence=byLine.get('ATT')!.ours-byLine.get('DEF')!.theirs;
 const defenceVsAttack=byLine.get('DEF')!.ours-byLine.get('ATT')!.theirs;
 const midfieldEdge=byLine.get('MID')!.diff;
 if(attackVsDefence>=5)return {tactic:'press',reason:'Their defence is the weak spot — press high and force mistakes.'};
 if(midfieldEdge<=-5)return {tactic:'counter',reason:'They control midfield — sit deeper and hit them on the counter.'};
 if(defenceVsAttack<=-5)return {tactic:'possession',reason:'Their attack is stronger — keep the ball to protect the back line.'};
 if(opponentTactic==='press')return {tactic:'wide',reason:'They press centrally — stretch them with width.'};
 if(opponentTactic==='wide')return {tactic:'counter',reason:'They commit bodies wide — the counter is open.'};
 return {tactic:'balanced',reason:'No clear edge — keep the shape and take the chances you get.'};
}
export function matchBriefing(club:ClubState,opponent:ClubTeam):MatchBriefing{
 const comparison=compareLines(club,opponent);
 const sorted=[...comparison].sort((a,b)=>b.diff-a.diff);
 const strongest=sorted[0],weakest=sorted[sorted.length-1];
 const suggestion=suggestTactic(comparison,opponent.tactic);
 const edgeCount=comparison.filter(entry=>entry.edge==='ours').length;
 const headline=edgeCount>=3?'You have the edge across the pitch.':edgeCount===0?'They look stronger on paper — be compact.':'Evenly matched — the midfield may decide it.';
 const caution=`Their ${weakest.line} line is ${weakest.theirs.toFixed(1)} vs our ${weakest.ours.toFixed(1)}.`;
 return {opponent:{name:opponent.name,shortName:opponent.shortName,tactic:opponent.tactic,lines:{...opponent.lines}},comparison,strongest,weakest,suggestedTactic:suggestion.tactic,tacticReason:suggestion.reason,headline,caution};
}
export function briefingSummary(briefing:MatchBriefing){return {headline:briefing.headline,suggestion:`${tacticName(briefing.suggestedTactic)} — ${briefing.tacticReason}`,weakest:`${briefing.weakest.line} (${briefing.weakest.ours.toFixed(1)} vs ${briefing.weakest.theirs.toFixed(1)})`}}
export function tacticShapes(){return TACTIC_SHAPE}
