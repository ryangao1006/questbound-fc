import type {ClubMatchEventRecord,ClubMatchRecord} from './club-state.ts';

/**
 * Comic storyboard for a saved match (PLAN 3.6 explanation as panels).
 * The timeline is cut into the same five-minute blocks the model uses, so each
 * panel is one beat: its minute range, the score after the block, and the events
 * that happened in it. Pure and deterministic.
 */
export type StoryPanelKind='goal'|'save'|'chance'|'sub'|'quiet';
export type StoryEvent={minute:number;kind:'goal'|'save'|'chance'|'sub';side:'home'|'away';line:'MID'|'ATT';scorer?:string;out?:string;label:string};
export type StoryPanel={
 index:number;minuteStart:number;minuteEnd:number;kind:StoryPanelKind;
 score:[number,number];events:StoryEvent[];homeName:string;awayName:string;
};
export type Storyboard={panels:StoryPanel[];score:[number,number];homeName:string;awayName:string;totalEvents:number};
const BLOCK=5,BLOCKS=18;
export function storyboardFromRecord(record:Pick<ClubMatchRecord,'events'|'score'|'teams'>):Storyboard{
 const events=(record.events??[]).map(event=>({minute:event.minute,kind:event.kind,side:event.side,line:event.line,scorer:event.scorer,out:event.out,label:event.label})) as StoryEvent[];
 const homeName=record.teams?.home??'Home',awayName=record.teams?.away??'Away';
 const panels:StoryPanel[]=[];
 const score:[number,number]=[0,0];
 for(let index=0;index<BLOCKS;index+=1){
  const minuteStart=index*BLOCK+1,minuteEnd=index===BLOCKS-1?90:(index+1)*BLOCK;
  const inBlock=events.filter(event=>event.minute>=minuteStart&&event.minute<=minuteEnd);
  for(const event of inBlock)if(event.kind==='goal')score[event.side==='home'?0:1]+=1;
  const kind:StoryPanelKind=inBlock.some(event=>event.kind==='goal')?'goal':inBlock.some(event=>event.kind==='sub')?'sub':inBlock.some(event=>event.kind==='save')?'save':inBlock.some(event=>event.kind==='chance')?'chance':'quiet';
  panels.push({index,minuteStart,minuteEnd:index===0?BLOCK:minuteEnd,kind,score:[...score] as [number,number],events:inBlock,homeName,awayName});
 }
 return {panels,score:[...record.score] as [number,number],homeName,awayName,totalEvents:events.length};
}
export function storyboardBeats(board:Storyboard){return board.panels.filter(panel=>panel.kind!=='quiet')}
export function panelLabel(panel:StoryPanel){
 if(panel.kind==='quiet')return 'Quiet spell';
 if(panel.kind==='goal'){const event=panel.events.find(entry=>entry.kind==='goal')!;return `Goal · ${event.scorer??''}`.trim()}
 if(panel.kind==='sub'){const event=panel.events.find(entry=>entry.kind==='sub')!;return `Sub · ${event.scorer??''} for ${event.out??''}`}
 if(panel.kind==='save'){const event=panel.events.find(entry=>entry.kind==='save')!;return `Save · ${event.scorer??''}`}
 const event=panel.events.find(entry=>entry.kind==='chance')!;return `Chance · ${event.scorer??''}`;
}
export function storyboardSummary(board:Storyboard){
 const goals=board.panels.reduce((sum,panel)=>sum+panel.events.filter(event=>event.kind==='goal').length,0);
 return {panels:board.panels.length,beats:storyboardBeats(board).length,goals,totalEvents:board.totalEvents,score:board.score};
}
