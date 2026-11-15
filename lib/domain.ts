import {assertEconomy,reconcileEconomy,purchaseItem,equipItem,type ShopKind} from './economy.ts';
import {CLUB_TACTICS,FACILITY_PRICES,createClubState,debitClubFunds,facilityGate,facilityUpgradeCost,seedFrom,setClubLineup,tacticTrainingCost,trainClubPlayer,type ClubState,type FacilityKey} from './club-state.ts';
import {opponentFor,teamFromClub} from './club-match.ts';
import {advanceMatchV2,createMatchV2,reportMatchV2,replaceV2Team,setV2Tactic,simulateClubMatchV2} from './match-v2.ts';
import {sellPlayer,signPlayer,signingPrice,signingTarget} from './club-transfers.ts';
import {createSeason,playSeasonRound} from './club-league.ts';
import {createCup,playCupRound} from './club-cup.ts';
import {canSelectDisplay} from './club-display.ts';
import {canSelectDecor} from './club-decor.ts';
import {focusCarryAfter,planFocus} from './focus-policy.ts';
import {FOOTBALL_PLAYERS} from './football-data.ts';
import {levelForXp} from './club-model.ts';
import {moveTaskWindow,syncTaskWindow,validateTaskWindow} from './task-window.ts';
import {carryoverTasks,carryoverReminderAt,skippedTaskDay,validDay} from './task-follow-up.ts';
import {validTaskDisplay} from "./task-workspace.ts";
import {todoistWorkDay,todoistWorkTime} from './todoist-dates.ts';
import {bindTaskSubject,renameSubject,queueTodoist,taskSyncPayload} from "./subjects.ts";
import {translate} from "./i18n.ts";
import {assertAvatar,THEMES,migrateTheme} from "./avatar.ts";
import { initialState, migrateState, localDay, clockInZone, zonedTime, activeSeconds, safeTitle, totalXP, level, type PlannerState, type Command, type Task, type TimeBlock } from "./model.ts";
const iso = (d: Date) => d.toISOString();
function reward(s: PlannerState, id: string, points: number, active: boolean, now: Date) { const r = s.rewards.find(r => r.id === id); if (r)
    r.active = active;
else if (active)
    s.rewards.push({ id, points, active, at: iso(now) }); }
export function makeTask(value: Partial<Task>, now: Date): Task { if(value.plannedTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.plannedTime))throw new Error("Choose a valid planned start time."); const deadline = value.deadline || ""; if (deadline && !Number.isFinite(Date.parse(deadline)))
    throw new Error("Choose a valid deadline."); return { id: value.id || crypto.randomUUID(), title: safeTitle(value.title), area: value.area || "Projects", listId: value.listId || "school", notes: (value.notes || "").slice(0, 10000), plannedOn: value.plannedOn || "", plannedTime:value.plannedOn?value.plannedTime:"", ...("plannedEnd" in value?{plannedEnd:value.plannedEnd||""}:{}), deadline, deadlineConfirmed: !!value.deadlineConfirmed, estimate: Math.max(5, Math.min(1440, Number(value.estimate) || 25)), priority: Math.min(3, Math.max(0, Number(value.priority) || 0)), main: !!value.main, done: !!value.done, createdAt: value.createdAt || iso(now), subtasks: value.subtasks || [], sources: value.sources || [], subjectId:value.subjectId||undefined,remoteProjectId:value.remoteProjectId,remoteSectionId:value.remoteSectionId,remoteParentId:value.remoteParentId,remoteDue:value.remoteDue,syncBase:value.syncBase,remoteId: value.remoteId, recurring: value.recurring, occurrence: value.occurrence, recurrenceState:value.recurrenceState, ...(value.skipHistory?{skipHistory:value.skipHistory}:{}), ...(value.carryoverReviewedOn?{carryoverReviewedOn:value.carryoverReviewedOn}:{}), needsReview: !!value.needsReview, reminders: value.reminders !== false }; }
function enqueue(s: PlannerState, provider: "todoist" | "icloud", action: string, entityId: string, payload: Record<string, unknown>, now: Date) { s.outbox = s.outbox.filter(o => !(o.entityId === entityId && o.action === action)); s.outbox.push({ id: crypto.randomUUID(), provider, action, entityId, payload, attempts: 0, nextAttempt: iso(now), status: "pending" }); }
export function reduceCommand(input: PlannerState, cmd: Command, now = new Date()): PlannerState {
    const s = migrateState(structuredClone(input));
    const id = String(cmd.id || "");
    const previousTask=s.tasks.find(t=>t.id===id);const taskBefore=previousTask?structuredClone(previousTask):undefined;
    const task = () => { const t = s.tasks.find(t => t.id === id && !t.deletedAt); if (!t)
        throw new Error("This quest no longer exists. Refresh your planner."); return t; };
    reconcileEconomy(s,now);
    switch (cmd.type) {
        case 'shop.purchase':purchaseItem(s.economy,String(cmd.itemId||''),id,now);break;
        case 'club.create': {if(s.club)throw new Error('Your club already exists.');s.club=createClubState({name:String(cmd.name||''),shortName:String(cmd.shortName||''),city:String(cmd.city||''),colours:cmd.colours as {primary?:string;secondary?:string}|undefined,kits:cmd.kits as {home?:string;away?:string}|undefined,formation:cmd.formation as ClubState['formation']|undefined},id||crypto.randomUUID(),now);if(!s.economy.sources.some(source=>source.id==='grant:club-initial'))s.economy.sources.push({id:'grant:club-initial',kind:'grant',amount:150,eligible:150,spent:0,at:now.toISOString()});break;}
        case 'club.train': {if(!s.club)throw new Error('Create your club first.');const result=trainClubPlayer(s.club,String(cmd.playerId||''),String(cmd.attribute||'') as never,s.economy,id||crypto.randomUUID(),now);s.club=result.club;break;}
        case 'club.lineup': {if(!s.club)throw new Error('Create your club first.');s.club=setClubLineup(s.club,cmd.formation as ClubState['formation'],(cmd.starters as string[])||[]);break;}
        case 'club.tactic': {if(!s.club)throw new Error('Create your club first.');const tactic=String(cmd.tactic||'') as ClubState['tactics']['active'];if(!CLUB_TACTICS.includes(tactic))throw new Error('Choose a known tactic.');s.club={...s.club,tactics:{...s.club.tactics,active:tactic}};break;}
        case 'club.tactic.train': {if(!s.club)throw new Error('Create your club first.');const tactic=String(cmd.tactic||'') as ClubState['tactics']['active'];if(!CLUB_TACTICS.includes(tactic))throw new Error('Choose a known tactic.');const level=s.club.tactics.levels[tactic]??0;const price=tacticTrainingCost(level);if(price===null)throw new Error('This tactic is fully trained.');const funding=debitClubFunds(s.economy,price,id||crypto.randomUUID(),now);const nextLevel=level+1;s.club={...s.club,tactics:{...s.club.tactics,levels:{...s.club.tactics.levels,[tactic]:nextLevel}},receipts:[...s.club.receipts,{id:(id||'')+':tactic:'+tactic,kind:'tactic',label:`Tactic ${tactic} L${nextLevel}`,cost:price,at:now.toISOString(),funding}]};break;}
        case 'club.sign': {if(!s.club)throw new Error('Create your club first.');if(s.club.players.length>=25)throw new Error('Your squad is full (25 players).');const worldId=String(cmd.worldPlayerId||'');const world=FOOTBALL_PLAYERS.find(player=>player.id===worldId);if(!world)throw new Error('Choose a player from the scouting list.');const target=signingTarget(world);const occupied=new Set(s.club.players.map(player=>player.id));if(occupied.has(worldId))throw new Error('This player already belongs to another club.');const price=signingPrice(target.ovr);const funding=debitClubFunds(s.economy,price,(id||crypto.randomUUID())+':signing',now);const signed=signPlayer(s.club as never,world,{at:now.toISOString(),receiptId:id||crypto.randomUUID()});s.club={...(signed.club as unknown as ClubState),receipts:[...s.club.receipts,{id:(id||'')+':signing',kind:'signing',label:`${target.name} · ${target.ovr} OVR`,cost:price,at:now.toISOString(),funding}]};break;}
        case 'club.sell': {if(!s.club)throw new Error('Create your club first.');const playerId=String(cmd.playerId||'');const player=s.club.players.find(entry=>entry.id===playerId);if(!player)throw new Error('This player is not in your club.');const sold=sellPlayer(s.club as never,playerId,{at:now.toISOString(),receiptId:id||crypto.randomUUID()});const refund=sold.refund;if(refund>0)s.economy.sources.push({id:'transfer:'+(id||crypto.randomUUID()),kind:'transfer',amount:refund,eligible:refund,spent:0,at:now.toISOString()});s.club={...(sold.club as unknown as ClubState),receipts:[...s.club.receipts,{id:(id||'')+':sale',kind:'sale',label:`${player.name} sold`,cost:refund,at:now.toISOString(),funding:[]}]};break;}
        case 'club.league.start': {if(!s.club)throw new Error('Create your club first.');const tier=Math.max(0,Math.min(3,Number(cmd.tier??0))) as 0|1|2|3;const previous=s.club.season;const history=[...(s.club.history??[])];if(previous&&!history.some(entry=>entry.id===previous.id)){const sorted=[...previous.table].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);const position=Math.max(1,sorted.findIndex(row=>row.teamId==='club')+1);const own=sorted.find(row=>row.teamId==='club');history.push({id:previous.id,tier:previous.tier,position,points:own?.points??0,won:own?.won??0,drawn:own?.drawn??0,lost:own?.lost??0,gf:own?.gf??0,ga:own?.ga??0,outcome:(!previous.finished?'abandoned':position===1?'champion':position<=2?'promoted':position>=7?'relegated':'stayed') as 'champion'|'promoted'|'relegated'|'stayed'|'abandoned',at:now.toISOString(),lineup:s.club.lineup.flatMap(id=>{const player=s.club!.players.find(entry=>entry.id===id);return player?[{id:player.id,name:player.name,position:player.position,ovr:player.ovr}]:[]})})}s.club={...s.club,season:createSeason(s.club,tier,seedFrom(String(id||'season')+tier),id||crypto.randomUUID()),history:history.slice(-20)};break;}
        case 'club.league.play': {if(!s.club)throw new Error('Create your club first.');if(!s.club.season)throw new Error('Start a season first.');const played=playSeasonRound(s.club,s.club.season);const season=played.season;let trophies=s.club.trophies??[];let history=s.club.history??[];if(season.finished){const sorted=[...season.table].sort((a,b)=>b.points-a.points||(b.gf-b.ga)-(a.gf-a.ga)||b.gf-a.gf);const position=Math.max(1,sorted.findIndex(row=>row.teamId==='club')+1);const own=sorted.find(row=>row.teamId==='club');if(sorted[0]?.teamId==='club'&&!trophies.some(trophy=>trophy.id==='league:'+season.id))trophies=[...trophies,{id:'league:'+season.id,kind:'league',tier:season.tier,label:'League title',at:now.toISOString(),kitId:'kit:league:'+season.id}];if(!history.some(entry=>entry.id===season.id))history=[...history,{id:season.id,tier:season.tier,position,points:own?.points??0,won:own?.won??0,drawn:own?.drawn??0,lost:own?.lost??0,gf:own?.gf??0,ga:own?.ga??0,outcome:(position===1?'champion':position<=2?'promoted':position>=7?'relegated':'stayed') as 'champion'|'promoted'|'relegated'|'stayed',at:now.toISOString(),lineup:s.club.lineup.flatMap(id=>{const player=s.club!.players.find(entry=>entry.id===id);return player?[{id:player.id,name:player.name,position:player.position,ovr:player.ovr}]:[]})}].slice(-20)}s.club={...s.club,season,trophies,history};break;}
        case 'club.cup.start': {if(!s.club)throw new Error('Create your club first.');const tier=Math.max(0,Math.min(3,Number(cmd.tier??0))) as 0|1|2|3;s.club={...s.club,cup:createCup(s.club,tier,seedFrom(String(id||'cup')+tier),id||crypto.randomUUID())};break;}
        case 'club.cup.play': {if(!s.club)throw new Error('Create your club first.');if(!s.club.cup)throw new Error('Start the challenge cup first.');const played=playCupRound(s.club,s.club.cup);const cup=played.cup;let trophies=s.club.trophies??[];if(cup.finished&&cup.winner==='club'&&!trophies.some(trophy=>trophy.id==='cup:'+cup.id))trophies=[...trophies,{id:'cup:'+cup.id,kind:'cup',tier:cup.tier,label:'Challenge Cup',at:now.toISOString(),kitId:'kit:cup:'+cup.id}];s.club={...s.club,cup,trophies};break;}
        case 'club.migrate': {if(!s.club)throw new Error('Create your club first.');if(cmd.confirm!==true)throw new Error('Confirm the migration summary to continue.');let granted=false;if(!s.economy.sources.some(source=>source.id==='grant:club-initial')){s.economy.sources.push({id:'grant:club-initial',kind:'grant',amount:150,eligible:150,spent:0,at:now.toISOString()});granted=true}s.club={...s.club,migratedAt:s.club.migratedAt??now.toISOString()};void granted;break;}
        case 'club.live.start': {if(!s.club)throw new Error('Create your club first.');const tier=Math.max(0,Math.min(3,Number(cmd.tier??0)));const seed=seedFrom(String(id||'live')+tier+Date.now());const opponent=opponentFor(tier,seed);s.club={...s.club,live:{tier,startedAt:now.toISOString(),session:createMatchV2(teamFromClub(s.club),opponent,seed)}};break;}
        case 'club.live.advance': {if(!s.club)throw new Error('Create your club first.');if(!s.club.live)throw new Error('Start a live match first.');const session=advanceMatchV2(s.club.live.session);if(!session.finished){s.club={...s.club,live:{...s.club.live,session}};break;}const report=reportMatchV2(session);const record={id:(id||crypto.randomUUID())+':live',at:now.toISOString(),tier:s.club.live.tier,seed:session.seed,opponent:{name:session.away.name,shortName:session.away.shortName},teams:{home:session.home.name,away:session.away.name},score:session.score,possession:session.possession,shots:session.shots,onTarget:session.onTarget,events:[...session.events.filter(event=>event.kind==='sub'),...session.events.filter(event=>event.kind!=='sub').slice(-40)].sort((a,b)=>a.minute-b.minute).map(event=>({...event,homeName:session.home.name,awayName:session.away.name})),path:session.path,engine:'v2' as const,timeline:report.timeline,xg:report.xg,lineups:report.lineups,subs:s.club.live.session.subs??0,explanation:report.explanation};s.club={...s.club,live:undefined,matches:[record,...(s.club.matches??[])].slice(0,30)};break;}
        case 'club.live.sub': {if(!s.club)throw new Error('Create your club first.');if(!s.club.live)throw new Error('Start a live match first.');const session=s.club.live.session;if(session.finished)throw new Error('This match is already finished.');if((session.subs??0)>=5)throw new Error('Five substitutions are the limit per match.');const outId=String(cmd.outId||''),inId=String(cmd.inId||'');const outgoing=s.club.players.find(player=>player.id===outId),incoming=s.club.players.find(player=>player.id===inId);if(!outgoing)throw new Error('Choose a player from the starting eleven.');if(!incoming)throw new Error('Choose a player from your squad.');if(!s.club.lineup.includes(outId))throw new Error('That player is not in the starting eleven.');if(s.club.lineup.includes(inId))throw new Error('That player is already on the pitch.');const nextLineup=s.club.lineup.map(id=>id===outId?inId:id);const updated=setClubLineup(s.club,s.club.formation,nextLineup);const live=s.club.live;const home={...teamFromClub(updated),tactic:session.home.tactic};const minute=Math.min(90,session.block*5+1);const events=[...session.events,{minute,side:'home' as const,kind:'sub' as const,line:'MID' as const,label:'Substitution',scorer:incoming.name,out:outgoing.name}];const nextSession=replaceV2Team({...session,events,subs:(session.subs??0)+1},'home',home);s.club={...updated,live:{...live,session:nextSession}};break;}
        case 'club.live.tactic': {if(!s.club)throw new Error('Create your club first.');if(!s.club.live)throw new Error('Start a live match first.');const tactic=String(cmd.tactic||'') as ClubState['tactics']['active'];if(!CLUB_TACTICS.includes(tactic))throw new Error('Choose a known tactic.');s.club={...s.club,live:{...s.club.live,session:setV2Tactic(s.club.live.session,'home',tactic)}};break;}
        case 'club.live.abandon': {if(!s.club)throw new Error('Create your club first.');s.club={...s.club,live:undefined};break;}
        case 'club.display': {if(!s.club)throw new Error('Create your club first.');const next={...(s.club.display??{})};for(const kind of ['frame','backdrop','kit'] as const){const raw=cmd[kind];if(raw===undefined)continue;const value=String(raw);const check=canSelectDisplay(s,kind,value);if(!check.ok)throw new Error(check.reason);if(value===''||value==='none')delete next[kind];else next[kind]=value}s.club={...s.club,display:next};break;}
        case 'club.celebrate': {if(!s.club)throw new Error('Create your club first.');const trophyId=String(cmd.trophyId||'');const trophy=(s.club.trophies??[]).find(entry=>entry.id===trophyId);if(!trophy)throw new Error('Choose a trophy you have won.');if(!trophy.celebratedAt)s.club={...s.club,trophies:(s.club.trophies??[]).map(entry=>entry.id===trophyId?{...entry,celebratedAt:now.toISOString()}:entry)};break;}
        case 'club.decor': {if(!s.club)throw new Error('Create your club first.');const next={...(s.club.decor??{})};for(const kind of ['pitch','stands','lights'] as const){const raw=cmd[kind];if(raw===undefined)continue;const value=String(raw);const check=canSelectDecor(s.club,kind,value);if(!check.ok)throw new Error(check.reason);if(value===''||value==='none')delete next[kind];else next[kind]=value}s.club={...s.club,decor:next};break;}
        case 'club.match': {if(!s.club)throw new Error('Create your club first.');const tier=Math.max(0,Math.min(3,Number(cmd.tier??0)));const seed=seedFrom(String(id||'')+':'+tier+':'+(s.club.matches?.length??0));const opponent=opponentFor(tier,seed);const report=simulateClubMatchV2(teamFromClub(s.club),opponent,seed);const record={id:id||crypto.randomUUID(),at:now.toISOString(),tier,seed,opponent:{name:opponent.name,shortName:opponent.shortName},teams:{home:report.home.name,away:report.away.name},score:report.score,possession:report.possession,shots:report.shots,onTarget:report.onTarget,events:report.events.slice(-40).map(event=>({...event,homeName:report.home.name,awayName:report.away.name})),path:report.path,engine:'v2' as const,timeline:report.timeline,ballTrack:report.ballTrack,xg:report.xg,lineups:report.lineups,subs:0,explanation:report.explanation};s.club={...s.club,matches:[record,...(s.club.matches??[])].slice(0,30)};break;}
        case 'club.facility': {if(!s.club)throw new Error('Create your club first.');const facility=String(cmd.facility||'') as FacilityKey;if(!(facility in FACILITY_PRICES))throw new Error('Choose a known facility.');const current=s.club.facilities[facility];const price=facilityUpgradeCost(facility,current);if(price===null)throw new Error('This facility is fully built.');const nextLevel=current+1;const gate=facilityGate(facility,nextLevel);const clubLevel=levelForXp(s.rewards.reduce((sum,reward)=>sum+(reward.active?reward.points:0),0));if(clubLevel<gate)throw new Error(`Reach club level ${gate} to upgrade ${facility}.`);const funding=debitClubFunds(s.economy,price,id||crypto.randomUUID(),now);s.club={...s.club,facilities:{...s.club.facilities,[facility]:nextLevel},receipts:[...s.club.receipts,{id:(id||'')+':facility:'+facility,kind:'facility',label:`${facility} L${nextLevel}`,cost:price,at:now.toISOString(),funding}]};break;}
        case 'inventory.equip':equipItem(s.economy,String(cmd.kind) as ShopKind,String(cmd.itemId||''));break;
        case "part.add": {const part=cmd.part as {id?:string;title:string};const key=part.id||id||crypto.randomUUID();if(s.lists.some(l=>l.id===key))break;const sync=!!s.connections.todoist?.connected;if(s.lists.some(l=>!l.archived&&l.title.toLocaleLowerCase()===safeTitle(part.title).toLocaleLowerCase()))throw new Error('A part with this name already exists.');const list={id:key,title:safeTitle(part.title),mode:sync?'sync' as const:'fresh' as const};s.lists.push(list);if(sync)queueTodoist(s,'project.upsert',key,{title:list.title},now);break;}
        case "part.rename": {const part=s.lists.find(l=>l.id===id&&!l.archived);if(!part)throw new Error('Choose an active part.');const baseTitle=part.title;part.title=safeTitle(cmd.title);if(part.mode==='sync')queueTodoist(s,'project.upsert',part.id,{title:part.title,baseTitle},now);break;}
        case "subject.add": {const value=cmd.subject as {id?:string;title:string;listId:string};const key=value.id||id||crypto.randomUUID();if(s.subjects.some(x=>x.id===key))break;const part=s.lists.find(l=>l.id===value.listId&&!l.archived);if(!part)throw new Error('Choose an active part.');const title=safeTitle(value.title);if(s.subjects.some(x=>!x.archived&&x.listId===part.id&&x.title.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new Error('This part already has a subject with that name.');const subject={id:key,title,listId:part.id};s.subjects.push(subject);if(s.connections.todoist?.connected&&part.mode!=='import'){part.mode='sync';if(!part.projectId)queueTodoist(s,'project.upsert',part.id,{title:part.title},now);queueTodoist(s,'section.upsert',key,{title,listId:part.id},now)}break;}
        case "part.move": {
            const part=s.lists.find(l=>l.id===id&&!l.archived),parentId=String(cmd.parentId||''),parent=parentId?s.lists.find(l=>l.id===parentId&&!l.archived):undefined;
            if(!part||part.inbox||part.mode==='import'||parentId&&(!parent||parent.inbox||parent.mode==='import'))throw new Error('Choose editable parts outside the Inbox.');
            const seen=new Set<string>([part.id]);let cursor=parent;while(cursor){if(seen.has(cursor.id))throw new Error('A part cannot be moved inside itself or its descendants.');seen.add(cursor.id);cursor=s.lists.find(l=>l.id===cursor!.parentId||!!l.projectId&&l.projectId===cursor!.parentId);}
            if(part.mode==='sync'&&parent&&parent.mode!=='sync'){parent.mode='sync';queueTodoist(s,'project.upsert',parent.id,{title:parent.title},now);}
            const baseParentId=part.parentId;part.parentId=parent?(parent.projectId||parent.id):undefined;
            if(part.mode==='sync')queueTodoist(s,'project.move',part.id,{parentId:parent?.id||'',baseParentId},now);break;
        }
        case "subject.move": {
            const subject=s.subjects.find(x=>x.id===id&&!x.archived),target=s.lists.find(l=>l.id===String(cmd.listId)&&!l.archived),source=s.lists.find(l=>l.id===subject?.listId);
            if(!subject||!source||!target||source.mode==='import'||target.mode==='import')throw new Error('Choose an editable subject and destination part.');
            if(subject.listId===target.id)break;
            if(s.subjects.some(x=>x.id!==id&&!x.archived&&x.listId===target.id&&x.title.toLocaleLowerCase()===subject.title.toLocaleLowerCase()))throw new Error('This part already has a subject with that name.');
            const baseListId=subject.listId;subject.listId=target.id;
            for(const task of s.tasks.filter(t=>t.subjectId===id)){task.listId=target.id;if(target.projectId)task.remoteProjectId=target.projectId;}
            if(s.activeSession?.subjectId===id)s.activeSession.area=subject.title;
            if(subject.remoteId||source.mode==='sync'){
                target.mode='sync';if(!target.projectId)queueTodoist(s,'project.upsert',target.id,{title:target.title},now);
                // Unsent section creation can simply target its final part; attempted payloads stay immutable.
                const creation=s.outbox.find(o=>o.provider==='todoist'&&o.entityId===id&&o.action==='section.upsert'&&!o.attemptedAt);
                if(creation)creation.payload.listId=target.id;
                queueTodoist(s,'section.move',id,{listId:target.id,baseListId},now);
            }else if(target.mode==='sync'&&s.connections.todoist?.connected){queueTodoist(s,'section.upsert',id,{title:subject.title,listId:target.id},now);for(const task of s.tasks.filter(t=>t.subjectId===id&&!t.deletedAt))queueTodoist(s,'task.upsert',task.id,taskSyncPayload(task),now);}
            break;
        }
        case "subject.rename": {const subject=s.subjects.find(x=>x.id===id&&!x.archived);if(!subject)throw new Error('Choose an active subject.');const title=safeTitle(cmd.title);if(s.subjects.some(x=>x.id!==id&&!x.archived&&x.listId===subject.listId&&x.title.toLocaleLowerCase()===title.toLocaleLowerCase()))throw new Error('This part already has a subject with that name.');const baseTitle=subject.title;renameSubject(s,subject,title);if(s.lists.find(l=>l.id===subject.listId)?.mode==='sync')queueTodoist(s,'section.upsert',id,{title,listId:subject.listId,baseTitle},now);break;}
        case "task.add": {
            const t = makeTask(cmd.task as Partial<Task>, now);
            if (s.tasks.some(x => x.id === t.id))
                return s;
            validateTaskWindow(t,s.settings.timezone);bindTaskSubject(s,t);s.tasks.push(t);syncTaskWindow(s,t);
            const l = s.lists.find(l => l.id === t.listId);
            if (l?.mode === "sync")
                queueTodoist(s,"task.upsert",t.id,taskSyncPayload(t),now);
            break;
        }
        case "task.edit": {
            const t = task();
            const raw = cmd.patch as Partial<Task>;const writable=["title","notes","area","listId","subjectId","plannedOn","plannedTime","plannedEnd","deadline","deadlineConfirmed","estimate","priority","main","subtasks","sources","needsReview","reminders"];const p=Object.fromEntries(Object.entries(raw).filter(([k])=>writable.includes(k))) as Partial<Task>;
            const base=cmd.base as Record<string,unknown>|undefined;if(base&&Object.keys(p).some(k=>JSON.stringify((t as unknown as Record<string,unknown>)[k])!==JSON.stringify(base[k])&&JSON.stringify((t as unknown as Record<string,unknown>)[k])!==JSON.stringify((p as Record<string,unknown>)[k])))throw new Error('This quest changed while you were editing. Your draft is kept; reopen it to review the latest version.');
            const next = makeTask({ ...t, ...p, id: t.id, done: t.done, createdAt: t.createdAt, remoteId: t.remoteId }, now);
            if(p.listId&&p.listId!==t.listId&&!("subjectId" in p))next.subjectId=undefined;
            moveTaskWindow(t,next,s.settings.timezone,"plannedEnd" in p);bindTaskSubject(s,next,"subjectId" in p);Object.assign(t, next);
            break;
        }
        case "task.toggle": {
            const t = task();
            if(t.recurring&&cmd.occurrence&&cmd.occurrence!==t.occurrence){
                const history=t.recurrenceState,entry=Object.entries(history?.scopes||{}).find(([,scope])=>scope===cmd.occurrence);
                if(cmd.done||!history||!entry||Number(entry[0])!==(history.count??0)-1)throw new Error('This recurring task has moved on. Refresh it before undoing.');
                history.count=Number(entry[0]);t.occurrence=String(cmd.occurrence);
                const due=history.dues[entry[0]];if(due){t.remoteDue=structuredClone(due);t.plannedOn=todoistWorkDay(due,s.settings.timezone);t.plannedTime=todoistWorkTime(due,s.settings.timezone);}
            }
            t.done = Boolean(cmd.done);
            t.completedAt = t.done ? iso(now) : undefined;
            reward(s, `task:${t.id}${t.recurring ? ":" + t.occurrence : ""}`, 10, t.done, now);
            break;
        }
        case "task.skip": {
            const t=task(),skipId=String(cmd.skipId||'');
            if(!skipId||skipId.length>200)throw new Error('Refresh this task before skipping it.');
            if(t.skipHistory?.some(entry=>entry.id===skipId))break;
            if(!t.recurring||t.done)throw new Error('Only an unfinished recurring task can be skipped.');
            if(String(cmd.occurrence||'')!==String(t.occurrence||'')||cmd.fromDay!==t.plannedOn||String(cmd.fromTime||'')!==(t.plannedTime||''))throw new Error('This occurrence changed. Review its latest schedule before skipping.');
            const nextDay=String(cmd.nextDay||''),nextTime=String(cmd.nextTime||'');
            if(!validDay(nextDay)||!validDay(t.plannedOn)||nextDay<=t.plannedOn)throw new Error('Choose a next occurrence after the current work date.');
            if(nextTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextTime))throw new Error('Choose a valid planned start time.');
            t.skipHistory??=[];t.skipHistory.push({id:skipId,scope:t.occurrence||'',fromDay:t.plannedOn,fromTime:t.plannedTime||'',nextDay,nextTime,at:iso(now)});
            t.plannedOn=nextDay;t.plannedTime=nextTime;t.carryoverReviewedOn=localDay(now,s.settings.timezone);delete t.startedAt;
            break;
        }
        case "task.skip.undo": {
            const t=task(),entry=t.skipHistory?.find(entry=>entry.id===cmd.skipId);
            if(!entry)throw new Error('This skipped occurrence is no longer available.');
            if(entry.undoneAt)break;
            if(t.done||!t.recurring||String(t.occurrence||'')!==entry.scope||t.plannedOn!==entry.nextDay||(t.plannedTime||'')!==entry.nextTime)throw new Error('This occurrence changed. Review its latest schedule before undoing.');
            t.plannedOn=entry.fromDay;t.plannedTime=entry.fromTime;entry.undoneAt=iso(now);delete t.carryoverReviewedOn;
            break;
        }
        case "task.review.keep": {
            const t=task(),day=localDay(now,s.settings.timezone);
            if(cmd.day!==day)throw new Error('A new day has started. Review the latest unfinished tasks.');
            t.carryoverReviewedOn=day;
            break;
        }
        case "task.start":
            task().startedAt = iso(now);
            break;
        case "task.delete": {
            const t = task();
            t.deletedAt = iso(now);
            reward(s, `task:${t.id}${t.recurring ? ":" + t.occurrence : ""}`, 10, false, now);
            s.blocks = s.blocks.filter(b => b.taskId !== t.id);
            break;
        }
        case "subtask.toggle": {
            const t = task();
            const sub = t.subtasks.find(v => v.id === cmd.subtaskId);
            if (!sub)
                throw new Error("Subtask not found.");
            sub.done = !!cmd.done;
            break;
        }
        case "habit.add":
            s.habits.push({ id: id || crypto.randomUUID(), title: safeTitle(cmd.title), area: String(cmd.area || "Wellbeing"), icon: String(cmd.icon || "sun") });
            break;
        case "habit.toggle": {
            if (!s.habits.some(h => h.id === id))
                throw new Error("Habit not found.");
            const day = String(cmd.day || localDay(now, s.settings.timezone));
            if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
                throw new Error("Invalid date.");
            const key = `${id}:${day}`;
            s.habitChecks[key] = !!cmd.done;
            reward(s, `habit:${key}`, 10, !!cmd.done, now);
            break;
        }
        case "habit.delete":
            s.habits = s.habits.filter(h => h.id !== id);
            break;
        case "block.save": {
            let value = cmd.block as TimeBlock;
            if (value.originId) {
                const original = s.blocks.find(b => b.id === value.originId);
                if (!original)
                    throw new Error("This series no longer exists.");
                if (value.scope === "series") {
                    const delta = Date.parse(value.start) - Date.parse(value.occurrenceKey!);
                    const duration = Date.parse(value.end) - Date.parse(value.start);
                    const start = new Date(Date.parse(original.start) + delta).toISOString();
                    const exceptions = Object.fromEntries(Object.entries(original.exceptions).map(([key, ex]) => [new Date(Date.parse(key) + delta).toISOString(), { ...ex, ...(ex.start ? { start: new Date(Date.parse(ex.start) + delta).toISOString() } : {}), ...(ex.end ? { end: new Date(Date.parse(ex.end) + delta).toISOString() } : {}) }]));
                    value = { ...original, ...value, id: original.id, start, end: new Date(Date.parse(start) + duration).toISOString(), exceptions };
                    delete value.originId;
                    delete value.occurrenceKey;
                    delete value.scope;
                }
                else
                    value = { ...original, exceptions: { ...original.exceptions, [value.occurrenceKey!]: { start: value.start, end: value.end, title: value.title, allDay:!!value.allDay } } };
            }
            if(value.allDay){
                if(value.taskWindow)throw new Error("Task time windows must have a start and end time.");
                value={...value,start:zonedTime(localDay(value.start),"00:00"),end:zonedTime(localDay(value.end),"00:00")};
            }
            const old = s.blocks.find(b => b.id === value.id);
            if(old?.taskWindow&&old.taskId){const linked=s.tasks.find(t=>t.id===old.taskId&&!t.deletedAt);if(!linked)throw new Error('This quest no longer exists. Refresh your planner.');const previous=structuredClone(linked);linked.title=safeTitle(value.title);linked.plannedOn=localDay(value.start,s.settings.timezone);linked.plannedTime=clockInZone(value.start,s.settings.timezone);linked.plannedEnd=value.end;validateTaskWindow(linked,s.settings.timezone);if(s.lists.find(l=>l.id===linked.listId)?.mode==='sync'||linked.remoteId)queueTodoist(s,'task.upsert',linked.id,taskSyncPayload(linked,previous),now);value={...value,taskId:linked.id,title:linked.title,area:linked.area,subjectId:linked.subjectId,taskWindow:true,repeat:'none',exceptions:{}};}
            if (old?.readOnly)
                throw new Error("This calendar is read-only.");
            if (!Number.isFinite(Date.parse(value.start)) || !Number.isFinite(Date.parse(value.end)) || Date.parse(value.end) <= Date.parse(value.start))
                throw new Error("The end must be later than the start.");
            const b = { ...old, ...value, id: value.id || crypto.randomUUID(), title: safeTitle(value.title), exceptions: value.exceptions || old?.exceptions || {}, repeat: value.repeat || "none" } as TimeBlock;
            if (old)
                Object.assign(old, b);
            else
                s.blocks.push(b);
            if (b.calendarId)
                enqueue(s, "icloud", "block.upsert", b.id, {}, now);
            break;
        }
        case "block.delete": {
            const b = s.blocks.find(b => b.id === id);
            if (b?.readOnly)
                throw new Error("This calendar is read-only.");
            if(b?.taskWindow&&b.taskId){const linked=s.tasks.find(t=>t.id===b.taskId);if(linked)linked.plannedEnd="";}
            if (b?.calendarId) {
                const attempted = s.outbox.some(o => o.entityId === b.id && o.attempts > 0);
                s.outbox = s.outbox.filter(o => o.entityId !== b.id);
                if (b.remoteId || attempted)
                    enqueue(s, "icloud", "block.delete", b.id, { ...b, remoteId: b.remoteId || new URL(`qi-${b.id}.ics`, b.calendarId).toString() }, now);
            }
            s.blocks = s.blocks.filter(b => b.id !== id);
            break;
        }
        case "focus.start": {
            if (s.activeSession)
                throw new Error("A focus session is already running. Finish it first.");
            const t = s.tasks.find(t => t.id === cmd.taskId && !t.deletedAt);
            if (t)
                t.startedAt = iso(now);
            s.activeSession = { id: id || crypto.randomUUID(), taskId: t?.id, workScope:t?`task:${t.id}${t.recurring?":"+t.occurrence:""}`:undefined, area: t?.area || String(cmd.area || "Projects"),subjectId:t?.subjectId, startedAt: iso(now), target: Math.min(180, Math.max(5, Number(cmd.minutes) || 25)) * 60, pausedSeconds: 0 };
            break;
        }
        case "focus.pause":
            if (s.activeSession && !s.activeSession.pausedAt)
                s.activeSession.pausedAt = iso(now);
            break;
        case "focus.resume":
            if (s.activeSession?.pausedAt) {
                s.activeSession.pausedSeconds += Math.max(0, Math.floor((now.getTime() - Date.parse(s.activeSession.pausedAt)) / 1000));
                delete s.activeSession.pausedAt;
            }
            break;
        case "focus.finish": {
            const a = s.activeSession;
            if (a) {
                const seconds = activeSeconds(a, now);
                if (seconds > 0 && !s.sessions.some(x => x.id === a.id)) {
                    s.sessions.push({ id: a.id, taskId: a.taskId, workScope:a.workScope, area: a.area,subjectId:a.subjectId, startedAt: a.startedAt, endedAt: iso(now), seconds, kind: "focus" });
                    // PLAN 2.2 focus buckets, applied forward-only: the first finished session after this
                    // rule starts becomes the cutoff, sessions that ended earlier keep their old rewards.
                    if (!s.economy.focus) s.economy.focus = { from: iso(now), carrySeconds: 0 };
                    const cutoff = Date.parse(s.economy.focus.from);
                    const prior = s.sessions.filter(x => x.id !== a.id && x.kind === "focus" && Date.parse(x.endedAt) >= cutoff);
                    const plan = planFocus(seconds, focusCarryAfter(prior, s.economy.focus.from));
                    if (plan.chunks >= 1) reward(s, `session:${a.id}`, 5, true, now);
                    for (let chunk = 2; chunk <= plan.chunks; chunk += 1) reward(s, `session:${a.id}:chunk:${chunk}`, 5, true, now);
                    s.economy.focus.carrySeconds = plan.carrySeconds;
                }
                s.activeSession = null;
            }
            break;
        }
        case "focus.discard":
            s.activeSession = null;
            break;
        case "session.add": {
            const minutes = Number(cmd.minutes);
            if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 1440)
                throw new Error("Enter a duration between 1 and 1440 minutes.");
            if (s.sessions.some(x => x.id === id))
                break;
            const t = s.tasks.find(x => x.id === cmd.taskId);
            const start = String(cmd.startedAt || iso(now));
            if (!Number.isFinite(Date.parse(start)))
                throw new Error("Invalid session date.");
            s.sessions.push({ id: id || crypto.randomUUID(), taskId: t?.id, area: t?.area || String(cmd.area || "Projects"),subjectId:t?.subjectId, startedAt: start, endedAt: new Date(Date.parse(start) + minutes * 60000).toISOString(), seconds: minutes * 60, kind: "manual" });
            break;
        }
        case "settings.update": {
            const p = {...cmd.patch as Partial<PlannerState["settings"]>};
            if("theme" in p)p.theme=migrateTheme(p.theme);
            const allowed = ["name", "language", "taskDisplay", "theme", "avatar", "reduceMotion", "characterClass", "position", "playerNumber", "quietStart", "quietEnd", "push", "deadlineAlerts", "sound", "mutedAreas", "dailyNudge", "carryoverTime", "reviewTime"] as const;
            for (const k of allowed)
                if (k in p)
                    (s.settings as unknown as Record<string, unknown>)[k] = p[k];
            if (![s.settings.quietStart, s.settings.quietEnd, s.settings.dailyNudge, s.settings.carryoverTime, s.settings.reviewTime].every(t => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))
                throw new Error("Enter valid reminder times.");
            break;
        }
        case "island.unlock":
        case "character.equip": {
            const legacy: Record<string, string> = { library: "boots", staff: "boots", training: "kit", cloak: "kit", workshop: "armband", sword: "armband", boat: "celebration", companion: "celebration", garden: "goldboots", amulet: "goldboots", lighthouse: "banner", codex: "banner" };
            const item = legacy[String(cmd.item)] || String(cmd.item);
            const tiers: Record<string, number> = { academyKit: 1, boots: 2, kit: 3, armband: 4, celebration: 5, goldboots: 6, banner: 7 };
            if (!tiers[item] || level(s) < tiers[item] && !s.settings.unlocked.includes(item))
                throw new Error("Complete quests to reach the career level needed for this reward.");
            if (!s.settings.unlocked.includes(item))
                s.settings.unlocked.push(item);
            if (cmd.unequip && item !== "academyKit")
                s.settings.equipped = s.settings.equipped.filter(i => i !== item);
            else if (!s.settings.equipped.includes(item))
                s.settings.equipped.push(item);
            break;
        }
        case "reminder.snooze": {
            const r = s.reminders.find(r => r.id === id);
            if (r) {
                const minutes = Math.min(1440, Math.max(1, Number(cmd.minutes) || 15));
                r.at = new Date(now.getTime() + minutes * 60000).toISOString();
                r.status = "pending";
                r.snoozed = true;
            }
            break;
        }
        case "reminder.dismiss": {
            const r = s.reminders.find(r => r.id === id);
            if (r)
                r.status = "dismissed";
            break;
        }
        case "proposal.create": {
            const p = cmd.proposal as {
                title: string;
                tasks: Partial<Task>[];
                blocks: Partial<TimeBlock>[];
            };
            if ((p.tasks?.length || 0) > 100 || (p.blocks?.length || 0) > 100)
                throw new Error("Split this proposal into fewer than 100 items.");
            s.proposals.push({ id: id || crypto.randomUUID(), title: safeTitle(p.title), tasks: p.tasks || [], blocks: p.blocks || [], createdAt: iso(now), applied: false });
            break;
        }
        case "proposal.apply": {
            const p = s.proposals.find(p => p.id === id);
            if (!p)
                throw new Error("Proposal not found.");
            if (p.applied)
                break;
            for (const t of p.tasks)
                {const task=bindTaskSubject(s,makeTask(t,now));s.tasks.push(task);syncTaskWindow(s,task);if(s.lists.find(l=>l.id===task.listId)?.mode==='sync')queueTodoist(s,'task.upsert',task.id,taskSyncPayload(task),now);}
            for (const b of p.blocks) {
                if (!b.start || !b.end || Date.parse(b.end) <= Date.parse(b.start))
                    throw new Error("Proposal contains an invalid time block.");
                s.blocks.push({ ...b, id: b.id || crypto.randomUUID(), title: safeTitle(b.title), area: b.area || "Projects", repeat: b.repeat || "none", exceptions: b.exceptions || {} } as TimeBlock);
            }
            p.applied = true;
            break;
        }
        default: throw new Error("Unknown planner action.");
    }
    if(cmd.type.startsWith('task.')&&taskBefore){const after=s.tasks.find(t=>t.id===id);if(after){moveTaskWindow(taskBefore,after,s.settings.timezone,cmd.type==='task.edit'&&Object.prototype.hasOwnProperty.call(cmd.patch,'plannedEnd'));syncTaskWindow(s,after);}}
    if (['task.edit','task.toggle','task.delete','task.skip','task.skip.undo'].includes(cmd.type)){
        const t=s.tasks.find(t=>t.id===id),part=s.lists.find(l=>l.id===t?.listId);
        if(t&&(part?.mode==='sync'||t.remoteId))queueTodoist(s,cmd.type==='task.toggle'?(t.done?'task.close':'task.reopen'):cmd.type==='task.delete'?'task.delete':'task.upsert',id,taskSyncPayload(t,taskBefore),now);
    }
    if (s.tasks.filter(t => t.main && !t.done && !t.deletedAt).length > 3)
        throw new Error("Choose up to three main quests. You can keep other quests in your list.");
    return rebuildReminders(reconcileEconomy(s,now), now);
}
export function occurrences(block: TimeBlock, from: Date, to: Date): TimeBlock[] { if (block.repeat === "none")
    return Date.parse(block.end) >= from.getTime() && Date.parse(block.start) < to.getTime() ? [block] : []; const result: TimeBlock[] = []; let start = new Date(block.start); const duration = Date.parse(block.end) - start.getTime(); for (let n = 0; n < 4000 && start < to; n++) {
    if (block.until && start > new Date(block.until))
        break;
    const key = start.toISOString();
    const ex = block.exceptions[key];
    const actualStart = ex?.start || key;
    const actualEnd = ex?.end || new Date(start.getTime() + duration).toISOString();
    if (!ex?.skip && Date.parse(actualEnd) >= from.getTime() && Date.parse(actualStart) < to.getTime())
        result.push({ ...block, title: ex?.title || block.title, allDay:ex?.allDay??block.allDay, id: `${block.id}@${key}`, start: actualStart, end: actualEnd, originId: block.id, occurrenceKey: key } as TimeBlock);
    const next = new Date(start);
    if (block.repeat === "daily")
        next.setUTCDate(next.getUTCDate() + 1);
    else if (block.repeat === "weekly")
        next.setUTCDate(next.getUTCDate() + 7);
    else {
        const originalDay = new Date(block.start).getUTCDate();
        let month = start.getUTCMonth() + 1;
        do {
            next.setUTCFullYear(start.getUTCFullYear());
            next.setUTCDate(1);
            next.setUTCMonth(month++);
            next.setUTCDate(originalDay);
        } while (next.getUTCDate() !== originalDay);
    }
    start = next;
} return result; }
export function isQuiet(s: PlannerState, now: Date) { const t = clockInZone(now, s.settings.timezone), a = s.settings.quietStart, b = s.settings.quietEnd; return a === b ? false : a > b ? t >= a || t < b : t >= a && t < b; }
export function rebuildReminders(s: PlannerState, now: Date) {
    const day = localDay(now, s.settings.timezone);
    const reminderCutoff=Math.max(now.getTime()-15*60000,Date.parse(s.lastRestoredAt||"1970-01-01T00:00:00Z"));
    const t=(key:string,...args:unknown[])=>translate(s.settings.language,key,...args);
    const desired = new Map<string, Omit<PlannerState["reminders"][number], "status" | "createdAt">>();
    const add = (id: string, kind: string, at: string, title: string, body: string, taskId?: string) => { desired.set(id, { id, kind, at, title:t(title), body, taskId }); };
    const end = new Date(now.getTime() + 8 * 86400000);
    const relevantBlocks=s.blocks.flatMap(b=>occurrences(b,new Date(now.getTime()-86400000),end));
    for (const b of relevantBlocks) {
        if(b.allDay)continue;
        const t = s.tasks.find(t => t.id === b.taskId);
        if (!t || t.done || t.deletedAt || t.needsReview || !t.reminders || s.settings.mutedAreas.includes(t.area) || s.lists.find(l=>l.id===t.listId)?.archived || skippedTaskDay(t,localDay(b.start,s.settings.timezone)))
            continue;
        add(`${b.taskWindow?`planned:${t.id}`:b.id}:${b.start}:before`, "before", new Date(Date.parse(b.start) - 600000).toISOString(), "Your next quest is almost ready", t.title, t.id);
        if (!t.startedAt)
            add(`${b.taskWindow?`planned:${t.id}`:b.id}:${b.start}:follow`, "follow", new Date(Date.parse(b.start) + 1200000).toISOString(), "A little nudge from your coach", translate(s.settings.language,"{0} is still on your plan. Start, snooze, or move it.",t.title), t.id);
    }
    for (const t of s.tasks) {
        if (t.done || t.deletedAt || t.needsReview || !t.reminders || s.settings.mutedAreas.includes(t.area) || s.lists.find(l=>l.id===t.listId)?.archived)
            continue;
        if(t.plannedOn&&t.plannedTime&&!relevantBlocks.some(b=>b.taskId===t.id&&localDay(b.start,s.settings.timezone)===t.plannedOn)){const start=zonedTime(t.plannedOn,t.plannedTime,s.settings.timezone);add(`planned:${t.id}:${start}:before`,"before",new Date(Date.parse(start)-600000).toISOString(),"Your next quest is almost ready",t.title,t.id);if(!t.startedAt)add(`planned:${t.id}:${start}:follow`,"follow",new Date(Date.parse(start)+1200000).toISOString(),"A little nudge from your coach",translate(s.settings.language,"{0} is still on your plan. Start, snooze, or move it.",t.title),t.id);}
        if (t.deadline && t.deadlineConfirmed && s.settings.deadlineAlerts)
            for (const hours of [24, 1])
                add(`deadline:${t.id}:${t.deadline}:${hours}`, "deadline", new Date(Date.parse(t.deadline) - hours * 3600000).toISOString(), translate(s.settings.language,"Quest deadline in {0} {1}",hours,translate(s.settings.language,hours===1?"hour":"hours")), t.title, t.id);
    }
    const untimed = s.tasks.filter(t => !t.done && !t.deletedAt && !t.needsReview && t.reminders && t.plannedOn === day && !t.plannedTime && !s.settings.mutedAreas.includes(t.area) && !s.lists.find(l=>l.id===t.listId)?.archived && !relevantBlocks.some(b => b.taskId === t.id&&localDay(b.start,s.settings.timezone)===day));
    if (untimed.length)
        add(`day:${day}`, "daily", zonedTime(day, s.settings.dailyNudge, s.settings.timezone), "A small quest is a good place to start", t("{0} quests are still on today's plan.",untimed.length));
    const carryover=carryoverTasks(s,day),carryoverAt=carryoverReminderAt(s,day,now);
    if(carryover.length&&carryoverAt){
        add(`carryover:${day}`, 'carryover',carryoverAt,'A fresh start for unfinished tasks',t('{0} earlier tasks need a decision. Complete, reschedule, keep, or skip a recurring occurrence.',carryover.length));
        desired.get(`carryover:${day}`)!.taskIds=carryover.map(task=>task.id);
    }
    const completed = s.tasks.filter(t => t.completedAt && localDay(t.completedAt, s.settings.timezone) === day && !t.deletedAt).length;
    const minutes = Math.round(s.sessions.filter(x => localDay(x.startedAt, s.settings.timezone) === day).reduce((n, x) => n + x.seconds, 0) / 60);
    if (s.tasks.some(t => !t.deletedAt && !t.needsReview && !s.lists.find(l=>l.id===t.listId)?.archived && (t.plannedOn === day || t.main)) || completed || minutes)
        add(`review:${day}`, "review", zonedTime(day, s.settings.reviewTime, s.settings.timezone), "Your coach's evening check-in", t("{0} quests completed · {1} focus minutes logged. Choose the next step for what remains.",completed,minutes));
    if (s.activeSession && !s.activeSession.pausedAt) {
        const a = s.activeSession;
        add(`focus:${a.id}`, "focus", new Date(Date.parse(a.startedAt) + (a.target + a.pausedSeconds) * 1000).toISOString(), "Training complete. Progress earned.", t("Your focus session is ready to save. Take a breath and collect your progress."), a.taskId);
    }
    for (const r of s.reminders) {
        const next = desired.get(r.id);
        const task = s.tasks.find(t => t.id === r.taskId);
        if (r.status === "sent" || r.status === "dismissed")
            continue;
        if (!next || task?.done || task?.deletedAt || task?.needsReview) {
            r.status = "cancelled";
            continue;
        }
        if (r.snoozed) {
            if (Date.parse(r.at) >= reminderCutoff)
                r.status = "pending";
            else r.status = "cancelled";
            r.title = next.title;
            r.body = next.body;
            r.taskIds = next.taskIds;
            continue;
        }
        Object.assign(r, next);
        r.status = Date.parse(next.at) >= reminderCutoff ? "pending" : "cancelled";
    }
    for (const [id, r] of desired)
        if (!s.reminders.some(x => x.id === id) && Date.parse(r.at) >= reminderCutoff)
            s.reminders.push({ ...r, status: "pending", createdAt: iso(now) });
    s.reminders = s.reminders.filter(r => r.status === "pending" || Date.parse(r.createdAt) > now.getTime() - 30 * 86400000);
    return s;
}
export function assertState(s: PlannerState) {
    const arrays = ["tasks", "blocks", "sessions", "habits", "rewards", "reminders", "outbox", "lists", "subjects", "proposals"] as const;
    for (const key of arrays) {
        const list = s[key];
        if (!Array.isArray(list))
            throw new Error(`Invalid ${key} collection.`);
        const ids = list.map(x => { if (!x || typeof x !== "object" || typeof x.id !== "string" || !x.id || x.id.length > 4000)
            throw new Error(`Invalid ${key} record.`); return x.id; });
        if (new Set(ids).size !== ids.length)
            throw new Error(`Duplicate ${key} records in backup.`);
    }
    for(const subject of s.subjects){safeTitle(subject.title);if(!s.lists.some(l=>l.id===subject.listId))throw new Error('A subject refers to a missing part.');}
    if(new Set(s.subjects.filter(x=>x.remoteId).map(x=>x.remoteId)).size!==s.subjects.filter(x=>x.remoteId).length)throw new Error('Duplicate Todoist subject mappings.');
    for(const t of s.tasks)if(t.subjectId&&!s.subjects.some(x=>x.id===t.subjectId&&x.listId===t.listId))throw new Error('A quest subject does not belong to its part.');
    assertEconomy(s.economy);
    const p = s.settings;
    if (!p || typeof p !== "object" || typeof p.name !== "string" || p.name.length > 100 || !["en", "zh"].includes(p.language) || typeof p.timezone !== "string")
        throw new Error("Invalid planner preferences.");
    if(!THEMES.includes(p.theme)||typeof p.reduceMotion!=="boolean")throw new Error("Choose a valid theme.");
    assertAvatar(p.avatar);
    if(!validTaskDisplay(p.taskDisplay))throw new Error("Invalid task display preferences.");
    if (!["GK", "CB", "FB", "CM", "W", "ST"].includes(p.position) || !Number.isInteger(p.playerNumber) || p.playerNumber < 1 || p.playerNumber > 99)
        throw new Error("Choose a valid playing position and squad number.");
    if (!["Scholar", "Ranger", "Artificer"].includes(p.characterClass))
        throw new Error("Invalid character class.");
    try {
        new Intl.DateTimeFormat("en", { timeZone: p.timezone });
    }
    catch {
        throw new Error("Invalid planner timezone.");
    }
    for (const key of ["mutedAreas", "unlocked", "placed", "equipped"] as const)
        if (!Array.isArray(p[key]) || !p[key].every(x => typeof x === "string"))
            throw new Error("Invalid preference lists.");
    for (const key of ["quietStart", "quietEnd", "dailyNudge", "carryoverTime", "reviewTime"] as const)
        if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(p[key]))
            throw new Error("Invalid reminder preferences.");
    for (const key of ["push", "deadlineAlerts", "sound", "integrationsPaused"] as const)
        if (typeof p[key] !== "boolean")
            throw new Error("Invalid preference flags.");
    for (const t of s.tasks) {
        safeTitle(t.title);
        validateTaskWindow(t,s.settings.timezone);
        if(t.plannedEnd&&!t.deletedAt&&!s.blocks.some(b=>b.taskWindow&&b.id===`task-window:${t.id}`&&b.taskId===t.id))throw new Error("Invalid task time window.");
        if (typeof t.done !== "boolean" || typeof t.area !== "string" || !Number.isFinite(t.estimate) || t.estimate < 5 || t.estimate > 1440 || !Array.isArray(t.subtasks) || !Array.isArray(t.sources) || !s.lists.some(l => l.id === t.listId))
            throw new Error("Invalid quest record.");
        if(t.plannedTime&&(!t.plannedOn||!/^([01]\d|2[0-3]):[0-5]\d$/.test(t.plannedTime)))throw new Error("Choose a valid planned start time.");
        if(t.plannedOn&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.plannedOn)||!Number.isFinite(Date.parse(t.plannedOn+"T12:00:00Z"))))throw new Error("Choose a valid work date.");
        if (t.deadline && !Number.isFinite(Date.parse(t.deadline)))
            throw new Error("Invalid quest deadline.");
        if(t.carryoverReviewedOn&&!validDay(t.carryoverReviewedOn))throw new Error('Invalid unfinished-task review date.');
        if(t.skipHistory&&(!Array.isArray(t.skipHistory)||new Set(t.skipHistory.map(entry=>entry.id)).size!==t.skipHistory.length||t.skipHistory.some(entry=>!entry||typeof entry.id!=='string'||!entry.id||typeof entry.scope!=='string'||!validDay(entry.fromDay)||!validDay(entry.nextDay)||entry.nextDay<=entry.fromDay||![entry.fromTime,entry.nextTime].every(time=>typeof time==='string'&&(!time||/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))||!Number.isFinite(Date.parse(entry.at))||entry.undoneAt&&!Number.isFinite(Date.parse(entry.undoneAt)))))throw new Error('Invalid skipped occurrence history.');
        for (const sub of t.subtasks)
            if (!sub || typeof sub.id !== "string" || typeof sub.title !== "string" || typeof sub.done !== "boolean")
                throw new Error("Invalid quest steps.");
        for (const source of t.sources)
            if (!source || typeof source.title !== "string" || typeof source.url !== "string")
                throw new Error("Invalid quest sources.");
    }
    for (const b of s.blocks) {
        if(b.taskWindow){const linked=s.tasks.find(t=>t.id===b.taskId&&!t.deletedAt);if(!linked||b.calendarId||b.remoteId||b.id!==`task-window:${linked.id}`||!linked.plannedEnd||b.repeat!=='none'||Date.parse(b.start)!==Date.parse(zonedTime(linked.plannedOn,linked.plannedTime||'',s.settings.timezone))||Date.parse(b.end)!==Date.parse(linked.plannedEnd))throw new Error('Invalid task time window.');}
        if (!Number.isFinite(Date.parse(b.start)) || !Number.isFinite(Date.parse(b.end)) || Date.parse(b.end) <= Date.parse(b.start) || !b.exceptions || typeof b.exceptions !== "object" || !["none", "daily", "weekly", "monthly"].includes(b.repeat))
            throw new Error("Invalid time block.");
        if (b.taskId && !s.tasks.some(t => t.id === b.taskId))
            throw new Error("A calendar block refers to a missing quest.");
    }
    for (const session of s.sessions)
        if (!Number.isFinite(session.seconds) || session.seconds < 0 || session.seconds > 86400 || !Number.isFinite(Date.parse(session.startedAt)) || !Number.isFinite(Date.parse(session.endedAt)))
            throw new Error("Invalid saved session.");
    for (const h of s.habits)
        if (typeof h.title !== "string" || typeof h.area !== "string")
            throw new Error("Invalid habit.");
    if (!s.habitChecks || typeof s.habitChecks !== "object" || Object.values(s.habitChecks).some(v => typeof v !== "boolean"))
        throw new Error("Invalid habit history.");
    for (const r of s.rewards)
        if (!Number.isInteger(r.points) || r.points < 0 || r.points > 50 || typeof r.active !== "boolean")
            throw new Error("Invalid reward history.");
    if (!s.connections || typeof s.connections !== "object" || !s.service || typeof s.service !== "object")
        throw new Error("Invalid connection metadata.");
    if (s.activeSession && (!Number.isFinite(s.activeSession.target) || s.activeSession.target < 300 || s.activeSession.target > 10800 || !Number.isFinite(Date.parse(s.activeSession.startedAt))))
        throw new Error("Invalid active focus session.");
    if (totalXP(s) < 0)
        throw new Error("Invalid reward balance.");
    return true;
}
