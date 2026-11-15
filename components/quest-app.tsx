"use client";
import {DormReturnBar} from "./dorm-return-bar";
import {dormDestination,type DormJourney,type DormSnapshot} from "@/lib/dorm-journey";
import type {DormObjectId} from "@/lib/dorm-room";
import {migrateState} from '@/lib/model';
import {previewTaskCheck,saveCueAtIntent,saveCueAfterSave} from '@/lib/task-feedback';
import {creditBalance} from '@/lib/economy';
import {plannerApi,plannerScope,isLocalPlanner,clientStatus,onClientStatus,syncLocalPlanner} from "@/lib/planner-client";
import {AccountSync} from "./account-sync";
import {UnfinishedBanner,UnfinishedReview,SkipOccurrence,SkippedFeedback} from "./task-follow-up";
import {carryoverTasks} from "@/lib/task-follow-up";
import {SmartTaskDialog} from "./smart-task-composer";
import {TaskDisclosure} from "./task-disclosure";
import {QuestJournal} from "./quest-journal";
import {Modal} from "./planner-dialog";
import {TaskForm} from "./task-composer";

import {LoadingScreen} from "./loading-screen";
import { lazy, Suspense, useState, useEffect, useRef, useCallback, type ReactNode, type FormEvent } from "react";
import { Sun, CalendarDays, Table2, Check, CheckCheck, Flag, Compass, Settings, Plus, ArrowUpRight, ArrowRight, ChevronLeft, ChevronRight, ChevronDown, Bell, Leaf, Play, Pause, Square, Clock, BookOpen, Sparkles, Cloud, CloudCheck, HardDrive, ShieldCheck, Download, Upload, RefreshCw, X, Trash2, Search, MoreHorizontal, Flame, Heart, Code2, Dumbbell, Link2, Lock, Star, CheckCircle2, AlertCircle, Menu, Volume2, SlidersHorizontal, TreePine, Anchor, House, Waves, GraduationCap, Inbox, ExternalLink, LogOut } from "lucide-react";
import { GameShell, type GameView } from "./game-shell";
import { CareerHub } from "./career-hub";

import {useGameSound,SoundSettings} from "./game-sound";
import {confirmedCareerFeedback,hasSavedFocusSession} from "@/lib/career-feedback";
import { LocaleProvider, useLocale } from "./locale";
import { translate, localeFor, dateTime } from "@/lib/i18n";
import { THEMES, THEME_LABELS } from "@/lib/avatar";
import { AREAS, AREA_COLORS, initialState, localDay, clockInZone, zonedTime, totalXP, level, activeSeconds, type PlannerState, type Task, type TimeBlock, type Envelope, type Command } from "@/lib/model";
import {canRebaseCommand,commandPrecondition} from "@/lib/command-rebase";
import {areaNames,subjectChoices} from "@/lib/subjects";
import {SubjectManager} from "./subject-manager";
import { occurrences,reduceCommand } from "@/lib/domain";
import {readSnapshot,writeSnapshot,readQueue,queueCommand,clearQueued} from "@/lib/site-cache";
import {applyQueued,flushQueue,type QueuedCommand} from "@/lib/site-queue";
import {taskDraftPatch} from "@/lib/task-draft";
import { plannedMinutes, actualMinutes, dayBounds } from "@/lib/time-report";
type View = GameView;
type Backup = {
    id: string;
    created_at: string;
    revision: number;
    kind: string;
    checksum: string;
    size: number;
    verified: number;
    onedrive_at?: string;
    local_at?: string;
    error?: string;
};
const asDate = (day: string) => new Date(day + "T12:00:00Z");
function changeMonth(day: string, amount: number) { const value = asDate(day), original = value.getUTCDate(); value.setUTCDate(1); value.setUTCMonth(value.getUTCMonth() + amount); const last = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0)).getUTCDate(); value.setUTCDate(Math.min(original, last)); return value.toISOString().slice(0, 10); }
const addDays = (day: string, n: number) => { const d = asDate(day); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const weekOf = (day: string) => addDays(day, -((asDate(day).getUTCDay() + 6) % 7));
const color = (area: string) => AREA_COLORS[area] || "#9a998a";
function download(name: string, contents: string | Blob, type = "application/json") { const blob = contents instanceof Blob ? contents : new Blob([contents], { type }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
const api = plannerApi;

function Empty({ icon: Icon = Leaf, title, description, action }: {
    icon?: typeof Leaf;
    title: string;
    description: string;
    action?: ReactNode;
}) { const { t: tx, language } = useLocale(); return <div className="empty"><span className="empty-icon"><Icon size={26}/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
function Badge({ area }: {
    area: string;
}) { const { t: tx, language } = useLocale(); return <span className="area-badge" style={{ color: color(area), background: color(area) + "14" }}><i style={{ background: color(area) }}/>{area==="No subject"?tx("No subject"):area}</span>; }
export default function QuestApp() {
    const [dormJourney,setDormJourney]=useState<DormJourney|null>(null);
    const activeDormJourney=dormJourney?.scope===plannerScope()?dormJourney:null;
    const [smartTask,setSmartTask]=useState<Partial<Task>|null>(null),[smartScope,setSmartScope]=useState("All");
    const [carryoverOpen,setCarryoverOpen]=useState(false),[skipTask,setSkipTask]=useState<Task|null>(null),[skipUndo,setSkipUndo]=useState<{id:string;title:string;skipId:string}|null>(null);
    const [subjectsOpen,setSubjectsOpen]=useState(false),[partFilter,setPartFilter]=useState("All");
    const [data, setData] = useState<Envelope | null>(null), [view, setView] = useState<View>("today"), [loadError, setLoadError] = useState(""), [saveStatus, setSaveStatus] = useState("Saved"), [retryCommand, setRetryCommand] = useState<Command | null>(null), [busy, setBusy] = useState(false), [toast, setToast] = useState<{
        text: string;
        xp?: number;
        clubLink?: boolean;
    } | null>(null), [taskEdit, setTaskEdit] = useState<Partial<Task> | null>(null), [blockEdit, setBlockEdit] = useState<Partial<TimeBlock> | null>(null), [menu, setMenu] = useState(false), [now, setNow] = useState(new Date()), [calendarDate, setCalendarDate] = useState(localDay()), [calendarMode, setCalendarMode] = useState<"day" | "week" | "month">("week"), [manualOpen, setManualOpen] = useState(false), [backups, setBackups] = useState<Backup[]>([]), [backupReady, setBackupReady] = useState(false), [settingsTab, setSettingsTab] = useState("general"), [reminderId, setReminderId] = useState<string | null>(null), [focusFeedback, setFocusFeedback] = useState<{
        sessionId: string;
        chunks: number;
        xp: number;
        funds: number;
        carrySeconds: number;
        nextMinutes: number;
    } | null>(null);
    const state = data?.state || initialState();
    const language = state.settings.language;
    const audio=useGameSound(state.settings);
    const [trainingMinutes, setTrainingMinutes] = useState(25), [trainingTask, setTrainingTask] = useState(""), [celebration, setCelebration] = useState(0);
    const tx = (key: string, ...values: unknown[]) => translate(state.settings.language, key, ...values);
    const busyRef = useRef(false);
    const mutationEpoch = useRef(0);
    const pendingOperations = useRef(new Map<string, string>());
    const notify = useCallback((text: string, xp?: number, clubLink = false) => setToast({ text: translate(state.settings.language, text), xp, clubLink }), [state.settings.language]);
    const dataRef = useRef<Envelope | null>(null);
    dataRef.current = data;
    const baseRef = useRef<Envelope | null>(null);
    const viewRef = useRef(view);
    viewRef.current = view;
    const refresh = useCallback(async () => {
        try {
            const epoch = mutationEpoch.current;
            const next = await api<Envelope>("state");
            if (epoch !== mutationEpoch.current) return;
            const envelope = {...next,state:migrateState(next.state)};
            baseRef.current = envelope;
            setData(envelope);
            setLoadError("");
            void writeSnapshot(envelope);
            void flushPendingRef.current();
        }
        catch (e) {
            const cached = await readSnapshot();
            if (cached) {
                const envelope = {revision:cached.revision,updatedAt:cached.updatedAt,state:migrateState(cached.state)};
                baseRef.current = envelope;
                const pending = await readQueue();
                setData(pending.length ? applyQueued(envelope, pending) : envelope);
                setSaveStatus("Local saved");
                setLoadError("Working from this device's offline copy.");
                return;
            }
            setLoadError((e as Error).message);
        }
    }, []);
    const flushPending = useCallback(async () => {
        if (busyRef.current) return;
        const queue = await readQueue();
        if (!queue.length) return;
        let revision = dataRef.current?.revision ?? 0;
        const transport = {
            send: async (entry: QueuedCommand) => { const result = await api<Envelope>("command", { command: entry.command, revision, operationId: entry.id }); revision = result.revision; return result; },
            refresh: async () => { const fresh = await api<Envelope>("state"); revision = fresh.revision; return fresh; }
        };
        const result = await flushQueue(queue, transport);
        if (result.accepted.length) await clearQueued(result.accepted.map(entry => entry.id));
        if (result.last) { const saved = {...result.last,state:migrateState(result.last.state)}; baseRef.current = saved; setData(saved); void writeSnapshot(saved); setSaveStatus("Saved"); setLoadError(""); }
        if (result.remaining.length) { setSaveStatus(result.conflict ? "Conflict" : "Local saved"); if (result.conflict) notify(translate(state.settings.language, "An offline change conflicts with the saved version. It is kept on this device until you review it.")); }
    }, [notify, state.settings.language]);
    const flushPendingRef = useRef(flushPending);
    flushPendingRef.current = flushPending;
    useEffect(()=>{if(!isLocalPlanner())return;const update=()=>{const info=clientStatus();if(info.record)setData(info.record.envelope);setSaveStatus(info.status);};const unsubscribe=onClientStatus(update);const online=()=>{void syncLocalPlanner()};window.addEventListener("online",online);return()=>{unsubscribe();window.removeEventListener("online",online)}},[]);
    useEffect(() => {
        refresh();
        const p = new URLSearchParams(location.search);
        const v = p.get("view");
        if (v && ["today", "calendar", "time", "quests", "island", "training", "settings", "inbox"].includes(v))
            setView(v as View);
        if(p.get("review")==="carryover")setCarryoverOpen(true);
        if (p.get("reminder")&&p.get("review")!=="carryover")
            setReminderId(p.get("reminder"));
        if (window.innerWidth < 700)
            setCalendarMode("day");
        if ("serviceWorker" in navigator)
            navigator.serviceWorker.register("/sw.js").catch(() => { });
        const reconnect = () => { void flushPendingRef.current(); };
        window.addEventListener("online", reconnect);
        void flushPendingRef.current();
        // The task views do not display seconds: keep their main thread free instead of
        // re-rendering the whole board every second. Live clocks only tick where shown.
        const timer = setInterval(() => {
            const current = viewRef.current;
            const needsClock = current === "today" || current === "training" || current === "calendar";
            if (needsClock) setNow(new Date());
        }, 1000);
        const poll = setInterval(() => {
            if (!busyRef.current && document.visibilityState === "visible")
                refresh();
        }, 30000);
        const onFocus = () => {
            if (!busyRef.current)
                refresh();
        };
        window.addEventListener("focus", onFocus);
        return () => { clearInterval(timer); clearInterval(poll); window.removeEventListener("focus", onFocus); window.removeEventListener("online", reconnect); };
    }, [refresh]);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(null), 6000);
        return () => clearTimeout(t);
    }, [toast]);
    useEffect(() => {
        if (view === "settings" && settingsTab === "backups")
            api<{
                backups: Backup[];
                ready: boolean;
            }>("backups").then(v => { setBackups(v.backups); setBackupReady(v.ready); }).catch(e => notify(e.message));
    }, [view, settingsTab, notify]);
    useEffect(()=>{if(data&&partFilter!=="All"&&!data.state.lists.some(p=>p.id===partFilter&&!p.archived)){setPartFilter("All")}},[data,partFilter]);
    const connectionFeedback = useRef(false);
    useEffect(() => {
        const waiting = !!data?.state.outbox.length;
        if (!waiting) {
            if (connectionFeedback.current) {
                connectionFeedback.current = false;
                if (!Object.values(data?.state.connections || {}).some(c => c?.error)) notify("Connected apps are up to date.");
            }
            return;
        }
        connectionFeedback.current = true;
        const timer = setInterval(() => {
            if (!busyRef.current && document.visibilityState === 'visible') void refresh();
        }, 3000);
        return () => clearInterval(timer);
    }, [data?.state.outbox.length, refresh, notify]);
    const run = useCallback(async (command: Command) => {
        if (!data || busyRef.current)
            return false;
        busyRef.current = true;
        mutationEpoch.current++;
        setBusy(true);
        setSaveStatus("Saving…");
        const fingerprint = JSON.stringify(command);
        const operationId = pendingOperations.current.get(fingerprint) || crypto.randomUUID();
        pendingOperations.current.set(fingerprint, operationId);
        const preview = previewTaskCheck(data, command);
        if (preview) {
            setData(preview);
            setSaveStatus("Reward confirming");
            const intentCue = saveCueAtIntent(command);
            if (intentCue)
                audio.play(intentCue, `intent:${operationId}`);
        }
        try {
            let basis=data,result:Envelope;try{result=await api<Envelope>('command',{command,revision:basis.revision,operationId,precondition:commandPrecondition(command,basis.state)})}catch(e){if((e as {status?:number}).status!==409)throw e;const fresh=await api<Envelope>('state');setData(fresh);if(!canRebaseCommand(command,basis.state,fresh.state))throw e;basis=fresh;result=await api<Envelope>('command',{command,revision:basis.revision,operationId,precondition:commandPrecondition(command,basis.state)})}
            pendingOperations.current.delete(fingerprint);
            setRetryCommand(null);
            baseRef.current = result;
            setData(result);
            if (command.type === "focus.start") setFocusFeedback(null);
            if (command.type === "focus.finish" && basis.state.activeSession && !result.state.activeSession) {
                const sessionId = basis.state.activeSession.id;
                const activeRewards = result.state.rewards.filter(
                    (reward) => reward.active && (reward.id === `session:${sessionId}` || reward.id.startsWith(`session:${sessionId}:chunk:`)),
                );
                const xp = activeRewards.reduce((sum, reward) => sum + (reward.active ? reward.points : 0), 0);
                const funds = Math.max(0, creditBalance(result.state.economy) - creditBalance(basis.state.economy));
                const carrySeconds = result.state.economy.focus?.carrySeconds ?? 0;
                setFocusFeedback({
                    sessionId,
                    chunks: activeRewards.length,
                    xp,
                    funds,
                    carrySeconds,
                    nextMinutes: Math.max(1, Math.ceil((1200 - Math.min(1199, carrySeconds)) / 60)),
                });
            }
            setSaveStatus(isLocalPlanner()?clientStatus().status:"Saved");
            const feedback=confirmedCareerFeedback(basis.state,result.state,command);
            // The completion cue belongs to the saved state, not to the optimistic preview.
            const savedCue=saveCueAfterSave(command,!!feedback?.levelUp);
            if(savedCue)audio.play(savedCue,`saved:${operationId}`);
            if(feedback){
                setCelebration(Date.now());
                const coins=Math.max(0,creditBalance(result.state.economy)-creditBalance(basis.state.economy));const message=feedback.levelUp?translate(result.state.settings.language,'Level {0} reached! +{1} XP',feedback.level,feedback.points):translate(result.state.settings.language,feedback.kind==='focus'?'Focus saved. +{0} XP':'Another goal recorded. +{0} XP',feedback.points);notify(message+(coins?' · +'+coins+' FC':''),feedback.points,coins>0);
                if (!savedCue && (!preview || feedback.levelUp)) audio.play(feedback.levelUp?'level':feedback.kind,`${operationId}:${feedback.id}`);
            }else if(command.type==='focus.start'&&!basis.state.activeSession&&result.state.activeSession||command.type==='focus.finish'&&basis.state.activeSession&&!result.state.activeSession){
                audio.play('focus',operationId);
                if(command.type==='focus.finish'&&hasSavedFocusSession(basis.state,result.state)){const focusCoins=Math.max(0,creditBalance(result.state.economy)-creditBalance(basis.state.economy));notify(translate(result.state.settings.language,'Session saved. Every active minute counts.')+(focusCoins?' · +'+focusCoins+' FC':''),undefined,focusCoins>0);}
            }
            return true;
        }
        catch (e) {
            const err = e as Error & {
                status?: number;
            };
            if (err.status === undefined) {
                // No HTTP answer at all: keep the change on this device and replay it later.
                const pending = await queueCommand(command, operationId);
                const base = baseRef.current ?? data;
                setData(applyQueued(base, pending));
                setSaveStatus("Local saved");
                setRetryCommand(null);
                notify("Saved on this device. It reaches your private site when the connection returns.");
                return true;
            }
            if (preview) setData(data);
            setRetryCommand(command);
            setSaveStatus(err.status === 409 ? "Conflict" : "Not saved");
            notify(err.message);
            if (err.status === 409)
                await refresh();
            return false;
        }
        finally {
            busyRef.current = false;
            setBusy(false);
        }
    }, [data, notify, refresh,audio.play]);
    async function external(path: string, body: unknown = {}) {
        try {
            setBusy(true);
            busyRef.current = true;
            const result = await api(path, body);
            await refresh();
            return result;
        }
        catch (e) {
            notify((e as Error).message);
            return null;
        }
        finally {
            setBusy(false);
            busyRef.current = false;
        }
    }
    const navigate = (v: View) => { setView(v); setMenu(false); const u = new URL(location.href); u.searchParams.set("view", v); history.replaceState(null, "", u); };
    const departDorm=(object:DormObjectId,snapshot:DormSnapshot)=>{const destination=dormDestination(object);setDormJourney({id:crypto.randomUUID(),scope:plannerScope(),object,destination,snapshot,phase:'away'});navigate(destination==='quests'?'quests':'island')};
    const returnToDorm=()=>{if(!activeDormJourney)return;setTaskEdit(null);setSmartTask(null);setDormJourney({...activeDormJourney,phase:'returning'});navigate('island')};
    const arrivedAtDorm=()=>setDormJourney(journey=>journey?.phase==='returning'?null:journey);
    const closeReminder = () => { setReminderId(null); const url = new URL(location.href); url.searchParams.delete("reminder"); url.searchParams.delete("task"); history.replaceState(null, "", url); };
    const closeCarryover=()=>{setCarryoverOpen(false);const url=new URL(location.href);url.searchParams.delete("review");history.replaceState(null,"",url)};
    const beginSkip=(task:Task)=>{setTaskEdit(null);closeCarryover();setSkipTask(structuredClone(task))};
    const closeTask = useCallback(() => setTaskEdit(null), []), closeBlock = useCallback(() => setBlockEdit(null), []);
    if (!state || !data)
        return <LoadingScreen error={loadError} retry={refresh}/>;
    const zh = state.settings.language === "zh";
    const today = localDay(now, state.settings.timezone);
    const xp = totalXP(state), lvl = level(state);
    const tasks = state.tasks.filter(t => !t.deletedAt);
    const open = tasks.filter(t => !t.done);
    const mains = open.filter(t => t.main).slice(0, 3);
    const planned = open.filter(t => t.plannedOn === today && !t.main);
    const doneToday = tasks.filter(t => t.completedAt && localDay(t.completedAt, state.settings.timezone) === today);
    const todayMinutes = Math.round(actualMinutes(state.sessions, ...dayBounds(today, state.settings.timezone)));
    const upcoming = state.blocks.flatMap(b => occurrences(b, now, new Date(now.getTime() + 7 * 86400000))).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 3);
    const pending = state.reminders.filter(r => r.status !== "cancelled" && r.status !== "dismissed" && Date.parse(r.at) <= now.getTime()).length;
    const unfinished=carryoverTasks(state,today);
    const suggestions = state.proposals.filter(p => !p.applied);
    const addQuest = (values: Partial<Task> = {}) => {const part=state.lists.find(l=>!l.archived&&l.id===partFilter)||state.lists.find(l=>!l.archived&&l.id==='school')||state.lists.find(l=>!l.archived);const subjects=subjectChoices(state,part?.id);const subject=view==='quests'?undefined:subjects.find(s=>s.title==='English Literature');setSmartScope(values.listId||(partFilter==='All'?'All':partFilter));setSmartTask({ plannedOn: view==='quests'?'':today, area:subject?.title||'No subject',subjectId:subject?.id,listId:part?.id,estimate:25,main:mains.length<3,...values });};
    const startFocus = (taskId?: string, minutes = trainingMinutes) => run({ type: "focus.start", taskId, minutes });
    const formatDate = (day: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) => new Intl.DateTimeFormat(zh ? "zh-CN" : "en-GB", { timeZone: state.settings.timezone, ...options }).format(asDate(day));
    const taskRow = (task:Task,compact=false) => <TaskDisclosure key={task.id} task={task} state={state} busy={busy} onEdit={setTaskEdit} onToggle={task=>{void run({type:"task.toggle",id:task.id,done:!task.done})}} onFocus={task=>{void startFocus(task.id)}} onSkip={beginSkip} run={run}/>;
    const active = state.activeSession;
    const elapsed = active ? activeSeconds(active, now) : 0;
    const remaining = active ? Math.max(0, active.target - elapsed) : trainingMinutes * 60;
    const minutes = String(Math.floor(remaining / 60)).padStart(2, "0"), seconds = String(remaining % 60).padStart(2, "0");
    function FocusCard() {
        const focusRule = state.economy.focus;
        const carrySeconds = focusRule?.carrySeconds ?? 0;
        const nextRewardMinutes = Math.max(1, Math.ceil((1200 - Math.min(1199, carrySeconds)) / 60));
        const carryHint = focusRule
            ? (zh ? `再专注 ${nextRewardMinutes} 分钟获得下一份奖励` : `Focus ${nextRewardMinutes} more minutes for the next reward`)
            : (zh ? "再专注 20 分钟获得第一份奖励" : "Focus 20 minutes for your first reward");
        const accumulatedMinutes = Math.floor(carrySeconds / 60);
        return <section className="focus-card"><div className="card-eyebrow"><span><span className="live-dot"/>{tx("TRAINING SESSION")}</span><span>{tx(active&&elapsed>=1200?"+5 XP when saved":"20 active min · +5 XP")}</span></div><div className="focus-clock">{minutes}<span>:</span>{seconds}</div><p>{active ? tasks.find(t => t.id === active.taskId)?.title || tx("A little time for what matters") : tx("One thing at a time. You've got this.")}</p><p className="focus-carry-hint" data-carry-seconds={carrySeconds} data-next-reward-minutes={nextRewardMinutes}>{carryHint}</p><div className="focus-controls">{!active ? <button onClick={() => startFocus()} disabled={busy}><Play size={15} fill="currentColor"/>{tx("Start focus")}</button> : <><button onClick={() => run({ type: active.pausedAt ? "focus.resume" : "focus.pause" })} disabled={busy}>{active.pausedAt ? <Play size={15}/> : <Pause size={15}/>} {active.pausedAt ? tx("Resume") : tx("Pause")}</button><button className="finish-focus" onClick={() => run({ type: "focus.finish" })} disabled={busy}><Square size={13}/>{tx("Save session")}</button></>}</div>{focusFeedback ? <div className={`focus-reward-feedback${focusFeedback.chunks > 0 ? " has-reward" : ""}`} role="status" aria-live="polite" data-focus-chunks={focusFeedback.chunks} data-focus-xp={focusFeedback.xp} data-focus-funds={focusFeedback.funds} data-focus-next-minutes={focusFeedback.nextMinutes}><b>{focusFeedback.chunks > 0 ? (zh ? `本次获得 ${focusFeedback.chunks} 份专注奖励` : `${focusFeedback.chunks} focus reward${focusFeedback.chunks === 1 ? "" : "s"} earned`) : (zh ? `已累计 ${accumulatedMinutes} 分钟` : `${accumulatedMinutes} minutes accumulated`)}</b>{focusFeedback.chunks > 0 ? <span className="focus-reward-gain">{zh ? `+${focusFeedback.xp} 经验值 · +${focusFeedback.funds} 资金` : `+${focusFeedback.xp} XP · +${focusFeedback.funds} funds`}</span> : null}<span className="focus-reward-next">{zh ? `还差 ${focusFeedback.nextMinutes} 分钟再得 1 份` : `${focusFeedback.nextMinutes} more minutes for 1 reward`}</span></div> : null}{active && remaining === 0 && <span className="focus-finished">{tx("Nice work. Save your progress and take a breath.")}</span>}</section>;
    }
    function HabitsCard() { return <section className="card habit-card"><div className="section-heading"><h2>{tx("Little rituals")}</h2><span className="muted small">{state.habits.filter(h => state.habitChecks[`${h.id}:${today}`]).length}/{state.habits.length}</span></div>{state.habits.map(h => { const checked = !!state.habitChecks[`${h.id}:${today}`]; return <button key={h.id} className={`habit-row ${checked ? "is-done" : ""}`} disabled={busy} onClick={() => run({ type: "habit.toggle", id: h.id, day: today, done: !checked })}><span className="habit-icon">{h.area === "Fitness" ? <Dumbbell size={17}/> : h.icon === "water" ? <Waves size={17}/> : <Sun size={17}/>}</span><span>{h.title}</span><i className="habit-check">{checked && <Check size={12}/>}</i></button>; })}{!state.habits.length && <p className="muted small ritual-intro">{tx("Small habits, a softer kind of progress. Choose a ritual to begin.")}</p>}<div className="habit-suggestions">{[{ title: "Move your body", area: "Fitness", icon: "move" }, { title: "Stay hydrated", area: "Wellbeing", icon: "water" }, { title: "Take a real break", area: "Wellbeing", icon: "sun" }].filter(h => !state.habits.some(x => x.title === h.title)).slice(0, 2).map(h => <button key={h.title} onClick={() => run({ type: "habit.add", ...h })}><Plus size={13}/>{tx(h.title)}</button>)}</div></section>; }
    function Today() { const from = new Date(zonedTime(weekOf(today), "00:00", state.settings.timezone)), to = new Date(zonedTime(addDays(weekOf(today), 7), "00:00", state.settings.timezone)); return <><UnfinishedBanner count={unfinished.length} onOpen={()=>setCarryoverOpen(true)}/><CareerHub state={state} mainQuests={mains.map(task => taskRow(task))} optionalQuests={planned.map(task => taskRow(task, true))} focus={FocusCard()} upcoming={upcoming} weekMinutes={actualMinutes(state.sessions, from, to)} completed={tasks.filter(task => task.done && task.completedAt && Date.parse(task.completedAt) >= from.getTime() && Date.parse(task.completedAt) < to.getTime()).length} busy={busy} celebration={celebration} onNew={() => addQuest()} onCareer={() => navigate("island")} onCalendar={() => navigate("calendar")} onInbox={() => navigate("inbox")} onQuests={() => navigate("quests")} onBlock={setBlockEdit}/></>; }
    function Training() { return <><PageHeading eyebrow={tx("TRAINING GROUND")} title={tx("One session. One step forward.")} text={tx("Build focus, take breaks and keep an honest record.")}/><div className="training-layout"><section className="card training-session"><h2>{tx("Choose your session")}</h2><label>{tx("Focus quest")}<select value={trainingTask} onChange={e => setTrainingTask(e.target.value)} disabled={!!active}><option value="">{tx("Free training")}</option>{open.map(task => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label>{tx("Session length")}</label><div className="duration-picker">{[15, 25, 50].map(n => <button key={n} className={trainingMinutes === n ? "selected" : ""} disabled={!!active} onClick={() => setTrainingMinutes(n)}>{n}<small>{tx("min")}</small></button>)}</div>{!active && <button className="primary" disabled={busy} onClick={() => startFocus(trainingTask || undefined)}><Play size={16}/>{tx("Start training")}</button>}<p className="customiser-note">{tx("20 active minutes earns 5 XP. Every saved minute counts toward your time record.")}</p></section><div>{FocusCard()}</div><div>{HabitsCard()}</div></div><section className="card training-history"><div className="section-heading"><h2>{tx("Recent sessions")}</h2><button className="secondary" onClick={() => setManualOpen(true)}><Plus size={15}/>{tx("Log time")}</button></div>{state.sessions.length ? <div className="table-scroll"><table className="time-table"><thead><tr><th>{tx("Date")}</th><th>{tx("Quest")}</th><th>{tx("Area")}</th><th>{tx("Actual minutes")}</th></tr></thead><tbody>{[...state.sessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 15).map(session => <tr key={session.id}><td>{dateTime(state.settings.language, session.startedAt)}</td><td>{tasks.find(task => task.id === session.taskId)?.title || tx(session.kind === 'focus' ? 'Free training' : 'Manual time')}</td><td><Badge area={session.area}/></td><td>{Math.round(session.seconds / 60)}</td></tr>)}</tbody></table></div> : <Empty title={tx("Your training record starts here.")} description={tx("Start a focus session or log time you already spent.")}/>}</section></>; }
    const taskEditor=taskEdit&&<TaskForm onSkip={beginSkip} embedded={view==='quests'} run={run} key={taskEdit.id||"new"} task={taskEdit} state={state} busy={busy} onClose={closeTask} onSave={async(t,original)=>{const editing=state.tasks.some(x=>x.id===t.id);const {patch,base}=taskDraftPatch(original,t);const saved=editing&&!Object.keys(patch).length?true:await run(editing?{type:'task.edit',id:t.id,patch,base}:{type:'task.add',task:t});if(saved)setTaskEdit(null);return saved}} onDelete={async id=>{if(await run({type:'task.delete',id}))setTaskEdit(null)}} onFocus={id=>{void startFocus(id);setTaskEdit(null)}}/>;
    function Quests() { return <QuestJournal editor={taskEditor} selectedId={taskEdit?.id} run={run} state={state} today={today} busy={busy} part={partFilter} onPart={setPartFilter} onNew={addQuest} onEdit={setTaskEdit} onToggle={task=>{void run({type:"task.toggle",id:task.id,done:!task.done})}} onFocus={task=>{void startFocus(task.id)}} onSubjects={()=>setSubjectsOpen(true)} onSkip={beginSkip} onReview={()=>setCarryoverOpen(true)}/>; }
    function Calendar() {
        const week = weekOf(calendarDate);
        const days = Array.from({ length: calendarMode === "day" ? 1 : 7 }, (_, i) => calendarMode === "day" ? calendarDate : addDays(week, i));
        const rangeStart = new Date(zonedTime(days[0], "00:00"));
        const rangeEnd = new Date(zonedTime(addDays(days.at(-1)!, 1), "00:00"));
        const events = state.blocks.flatMap(b => occurrences(b, rangeStart, rangeEnd));
        const hours = Array.from({ length: 49 }, (_, i) => i * 30);
        const addAt = (day: string, minute: number) => { const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`; setBlockEdit({ start: zonedTime(day, time), end: new Date(Date.parse(zonedTime(day, time)) + 30 * 60000).toISOString(), area: "Projects", repeat: "none" }); };
        const move = (id: string, day: string, y: number) => {
            const b = events.find(x => x.id === id);
            if (!b)
                return;
            const mins = Math.min(23 * 60 + 30, Math.max(0, Math.round(y / 24) * 30));
            const start = zonedTime(day, `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`);
            saveOccurrence(b, { start, end: new Date(Date.parse(start) + Date.parse(b.end) - Date.parse(b.start)).toISOString() });
        };
        return <><PageHeading eyebrow={tx("MAKE TIME FOR WHAT MATTERS")} title={tx("A little room in your week")} text={tx("Move your plans around. Your actual time and real deadlines stay separate.")} action={<button className="primary" onClick={() => addAt(calendarDate, 17 * 60)}><Plus size={16}/>{tx("Plan time")}</button>}/><div className="calendar-toolbar"><div className="button-row"><button className="secondary" onClick={() => setCalendarDate(today)}>{tx("Today")}</button><button className="icon-button" aria-label={tx("Previous period")} onClick={() => setCalendarDate(calendarMode === "month" ? changeMonth(calendarDate, -1) : addDays(calendarDate, calendarMode === "week" ? -7 : -1))}><ChevronLeft size={17}/></button><button className="icon-button" aria-label={tx("Next period")} onClick={() => setCalendarDate(calendarMode === "month" ? changeMonth(calendarDate, 1) : addDays(calendarDate, calendarMode === "week" ? 7 : 1))}><ChevronRight size={17}/></button><h2>{formatDate(calendarDate, { month: "long", year: "numeric" })}</h2></div><div className="segments">{["day", "week", "month"].map(v => <button key={v} className={calendarMode === v ? "active" : ""} onClick={() => setCalendarMode(v as typeof calendarMode)}>{tx(v[0].toUpperCase() + v.slice(1))}</button>)}</div></div>{calendarMode === "month" ? <MonthView /> : <div className={`calendar-container ${calendarMode === "week" ? "is-week" : ""}`}><div className="week-head" style={{ gridTemplateColumns: `58px repeat(${days.length},minmax(0,1fr))` }}><span className="timezone-label">{tx("GMT+8")}</span>{days.map(day => <button key={day} className={day === today ? "is-today" : ""} onClick={() => { setCalendarDate(day); setCalendarMode("day"); }}><span>{formatDate(day, { weekday: "short" })}</span><b>{asDate(day).getUTCDate()}</b></button>)}</div><div className="all-day-grid" style={{ gridTemplateColumns: `58px repeat(${days.length},minmax(0,1fr))` }}><span>{tx("All day")}</span>{days.map(day => <div key={day}><button className="all-day-add" aria-label={tx("Add all-day event {0}",day)} onClick={()=>setBlockEdit({allDay:true,start:zonedTime(day,"00:00"),end:zonedTime(addDays(day,1),"00:00")})}><Plus size={12}/></button>{events.filter(b => b.allDay && Date.parse(b.end) > Date.parse(zonedTime(day, "00:00")) && Date.parse(b.start) < Date.parse(zonedTime(addDays(day, 1), "00:00"))).map(b => <button key={b.id} onClick={() => setBlockEdit(b)}>{b.title}</button>)}</div>)}</div><div className="week-body" style={{ gridTemplateColumns: `58px repeat(${days.length},minmax(0,1fr))` }}><div className="hours">{hours.map(m => <span key={m} style={{ top: m * .8 }}>{m % 60 === 0 ? `${String(m / 60).padStart(2, "0")}:00` : ""}</span>)}</div>{days.map(day => <div key={day} className={`day-column ${day === today ? "today-column" : ""}`} onDoubleClick={e => addAt(day, Math.min(23 * 60 + 30, Math.max(0, Math.floor((e.clientY - e.currentTarget.getBoundingClientRect().top) / 24) * 30)))} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); move(e.dataTransfer.getData("text/plain"), day, e.clientY - e.currentTarget.getBoundingClientRect().top); }}>{hours.map(m => <div key={m} className={`grid-line ${m % 60 === 0 ? "hour" : ""}`} style={{ top: m * .8 }}/>)}{events.filter(b => !b.allDay && Date.parse(b.end) > Date.parse(zonedTime(day, "00:00")) && Date.parse(b.start) < Date.parse(zonedTime(addDays(day, 1), "00:00"))).map(b => {
                        const dayStart = Date.parse(zonedTime(day, "00:00"));
                        const visibleStart = Math.max(dayStart, Date.parse(b.start));
                        const visibleEnd = Math.min(Date.parse(zonedTime(addDays(day, 1), "00:00")), Date.parse(b.end));
                        const top = (visibleStart - dayStart) / 60000 * .8;
                        const height = Math.max(28, (visibleEnd - visibleStart) / 60000 * .8);
                        return <div key={b.id} className="calendar-event" style={{ top, height: Math.min(height, 1152 - top), background: color(b.area) + "20", borderColor: color(b.area), color: color(b.area) }} draggable={!b.readOnly} onDragStart={e => e.dataTransfer.setData("text/plain", b.id)}><button onClick={() => setBlockEdit(b)}><b>{b.title}</b><span>{b.allDay ? tx("All day") : `${clockInZone(b.start)}–${clockInZone(b.end)}`}</span>{b.calendarId && <Cloud size={11}/>}</button>{!b.readOnly && <span className="resize-handle" role="slider" aria-label={tx("Resize {0}", b.title)} aria-valuenow={Math.round((Date.parse(b.end) - Date.parse(b.start)) / 60000)} tabIndex={0} onKeyDown={e => {
                                    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                                        e.preventDefault();
                                        saveOccurrence(b, { end: new Date(Math.max(Date.parse(b.start) + 15 * 60000, Date.parse(b.end) + (e.key === "ArrowDown" ? 30 : -30) * 60000)).toISOString() });
                                    }
                                }} onPointerDown={e => {
                                    e.preventDefault();
                                    const start = e.clientY;
                                    const finish = (end: PointerEvent) => {
                                        window.removeEventListener("pointerup", finish);
                                        const change = Math.round((end.clientY - start) / 24) * 30;
                                        if (change)
                                            saveOccurrence(b, { end: new Date(Math.max(Date.parse(b.start) + 15 * 60000, Date.parse(b.end) + change * 60000)).toISOString() });
                                    };
                                    window.addEventListener("pointerup", finish, { once: true });
                                }}/>}</div>;
                    })}</div>)}</div></div>}<div className="calendar-note"><span><i className="dot terracotta"/>{tx("Your plans")}</span><span><Cloud size={13}/>{" " + tx("iCloud") + " "}{state.connections.icloud?.connected ? tx("connected") : tx("not connected yet")}</span><button onClick={() => { navigate("settings"); setSettingsTab("connections"); }}>{tx("Manage calendars")}<ArrowUpRight size={13}/></button></div></>;
    }
    async function saveOccurrence(b: TimeBlock, patch: Partial<TimeBlock>) {
        if (b.originId) {
            const original = state!.blocks.find(x => x.id === b.originId);
            if (!original)
                return;
            await run({ type: "block.save", block: { ...original, exceptions: { ...original.exceptions, [b.occurrenceKey!]: { ...patch } } } });
        }
        else
            await run({ type: "block.save", block: { ...b, ...patch } });
    }
    function MonthView() { const month = calendarDate.slice(0, 7); const first = weekOf(month + "-01"); const days = Array.from({ length: 42 }, (_, i) => addDays(first, i)); const events = state!.blocks.flatMap(b => occurrences(b, new Date(zonedTime(first, "00:00")), new Date(zonedTime(addDays(first, 42), "00:00")))); return <div className="month-grid">{["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"].map(d => <div key={d} className="month-weekday">{tx(d)}</div>)}{days.map(day => <div key={day} className={`month-day ${day.startsWith(month) ? "" : "other-month"} ${day === today ? "is-today" : ""}`}><button className="month-date" onClick={() => { setCalendarDate(day); setCalendarMode("day"); }}>{asDate(day).getUTCDate()}</button>{events.filter(b => b.allDay ? Date.parse(b.start)<Date.parse(zonedTime(addDays(day,1),"00:00"))&&Date.parse(b.end)>Date.parse(zonedTime(day,"00:00")) : localDay(b.start) === day).slice(0, 3).map(b => <button key={b.id} className="month-event" style={{ borderColor: color(b.area) }} onClick={() => setBlockEdit(b)}>{b.allDay ? "" : clockInZone(b.start) + " "}{b.title}</button>)}<button className="month-add" aria-label={tx("Add event {0}", day)} onClick={() => setBlockEdit({ start: zonedTime(day, "17:00"), end: zonedTime(day, "17:30") })}><Plus size={12}/></button></div>)}</div>; }
    function TimeView() { const week = weekOf(calendarDate); const days = Array.from({ length: 7 }, (_, i) => addDays(week, i)); const from = new Date(zonedTime(week, "00:00")), to = new Date(zonedTime(addDays(week, 7), "00:00")); const blocks = state!.blocks.flatMap(b => occurrences(b, from, to)); const sessions = state!.sessions.filter(s => Date.parse(s.endedAt) > from.getTime() && Date.parse(s.startedAt) < to.getTime()); const plan = (area?: string) => plannedMinutes(blocks, from, to, area); const actual = (area?: string) => actualMinutes(sessions, from, to, area); const areas = areaNames(state).filter(a => blocks.some(b => b.area === a) || sessions.some(s => s.area === a)); const csv = () => { const rows = [[tx("Date"), tx("Subject"), tx("Planned minutes"), tx("Actual minutes")], ...days.flatMap(day => { const bounds = dayBounds(day, state.settings.timezone); return areas.map(area => [day, tx(area), String(plannedMinutes(blocks, ...bounds, area)), String(actualMinutes(sessions, ...bounds, area))]); })]; download(`questbound-fc-time-${week}.csv`, "\uFEFF" + rows.map(r => r.map(v => '"' + v.replaceAll('"', '""') + '"').join(",")).join("\r\n"), "text/csv;charset=utf-8"); }; return <><PageHeading eyebrow={tx("NOTICE WHERE YOUR TIME GOES")} title={tx("Time, with a little perspective")} text={tx("Your plan is a guide. Your actual time tells the story.")} action={<div className="button-row"><button className="secondary" onClick={() => setManualOpen(true)}><Plus size={15}/>{tx("Log time")}</button><button className="primary" onClick={csv}><Download size={15}/>{tx("CSV")}</button></div>}/><div className="calendar-toolbar"><div className="button-row"><button className="icon-button" aria-label={tx("Previous week")} onClick={() => setCalendarDate(addDays(calendarDate, -7))}><ChevronLeft size={17}/></button><h2>{formatDate(week)} – {formatDate(addDays(week, 6))}</h2><button className="icon-button" aria-label={tx("Next week")} onClick={() => setCalendarDate(addDays(calendarDate, 7))}><ChevronRight size={17}/></button></div><button className="text-button" onClick={() => navigate("calendar")}>{tx("Open planning grid")}<ArrowUpRight size={15}/></button></div><div className="time-summary"><section className="card"><span className="eyebrow">{tx("PLANNED TIME")}</span><h2>{Math.floor(plan() / 60)}<small>{tx("h")}</small> {Math.round(plan() % 60)}<small>{tx("m")}</small></h2><p>{tx("Calendar blocks this week")}</p></section><section className="card"><span className="eyebrow">{tx("TIME YOU LOGGED")}</span><h2>{Math.floor(actual() / 60)}<small>{tx("h")}</small> {Math.round(actual() % 60)}<small>{tx("m")}</small></h2><p>{tx("Saved focus and manual sessions")}</p></section><section className="card"><span className="eyebrow">{tx("A LITTLE PERSPECTIVE")}</span><h3>{actual() ? tx("You showed up.") : tx("Start with a small session.")}</h3><p>{tx("A plan can change. Every honest minute counts.")}</p></section></div><section className="card"><div className="section-heading"><h2>{tx("Your week at a glance")}</h2><div className="chart-key"><span><i className="planned-key"/>{tx("Planned")}</span><span><i className="actual-key"/>{tx("Actual")}</span></div></div><div className="time-chart">{days.map(day => { const bounds = dayBounds(day, state.settings.timezone); const planned = plannedMinutes(blocks, ...bounds), actual = actualMinutes(sessions, ...bounds); return <div key={day} className="chart-day"><div className="chart-bars"><span className="planned-bar" style={{ height: Math.max(3, Math.min(150, planned * .6)) }} title={tx("{0} minutes planned", Math.round(planned))}/><span className="actual-bar" style={{ height: Math.max(3, Math.min(150, actual * .6)) }} title={tx("{0} minutes logged", Math.round(actual))}/></div><b>{formatDate(day, { weekday: "short" })}</b><small>{asDate(day).getUTCDate()}</small></div>; })}</div></section><section className="card"><div className="section-heading"><h2>{tx("Planned vs actual")}</h2></div><div className="table-scroll"><table className="time-table"><thead><tr><th>{tx("Area")}</th><th>{tx("Planned")}</th><th>{tx("Actual")}</th><th>{tx("Difference")}</th></tr></thead><tbody>{areas.length ? areas.map(a => <tr key={a}><td><Badge area={a}/></td><td>{Math.round(plan(a))}{" " + tx("min")}</td><td>{Math.round(actual(a))}{" " + tx("min")}</td><td>{Math.round(actual(a) - plan(a)) > 0 ? "+" : ""}{Math.round(actual(a) - plan(a))}{" " + tx("min")}</td></tr>) : <tr><td colSpan={4} className="table-empty">{tx("Your saved plans and sessions will appear here.")}</td></tr>}</tbody></table></div></section></>; }
    function IslandView() { return <div className="card club-redirect"><span className="eyebrow">{tx("CLUB MANAGEMENT")}</span><h2>{tx("Your club is the game now.")}</h2><p className="muted">{tx("Squad, line ratings, training and line-ups live in the club workspace. Tasks, calendar and focus stay exactly where they are.")}</p><a className="primary" href="/club">{tx("Open club workspace")}</a></div> }
    function InboxView() {
        return <><UnfinishedBanner count={unfinished.length} onOpen={()=>setCarryoverOpen(true)}/><PageHeading eyebrow={tx("A LITTLE GUIDANCE")} title={tx("Your coach inbox")} text={tx("Gentle reminders and thoughtful plans, all in one place.")}/>{suggestions.map(p => <section className="card proposal-card" key={p.id}><span className="eyebrow"><Sparkles size={13}/>{" " + tx("AI COMPANION")}</span><h2>{p.title}</h2><p className="muted">{p.tasks.length}{" " + tx("quests \u00B7") + " "}{p.blocks.length}{" " + tx("planning blocks")}</p>{p.tasks.map((t, i) => <div className="proposal-task" key={i}><Flag size={15}/><div><b>{t.title}</b><p>{t.area} · {t.estimate || 25}{" " + tx("min") + " "}{t.plannedOn ? `· ${t.plannedOn}` : ""}</p>{t.sources?.filter(s => /^https?:\/\//.test(s.url)).map(s => <a href={s.url} target="_blank" rel="noreferrer" key={s.url}>{s.title}<ArrowUpRight size={12}/></a>)}</div></div>)}<button className="primary" disabled={busy} onClick={() => run({ type: "proposal.apply", id: p.id })}><Check size={15}/>{tx("Apply this plan")}</button></section>)}<section className="card">{state.reminders.filter(r => r.status !== "cancelled" && r.status !== "dismissed").sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30).map(r => <div className="reminder-row" key={r.id}><span className="reminder-icon"><Bell size={18}/></span><div><h3>{r.title}</h3><p>{r.body}</p><span className="muted small">{formatDate(localDay(r.at))} · {clockInZone(r.at)} · {tx(r.status === "sent" ? "Push service accepted" : r.status)}</span><div className="reminder-actions"><button onClick={() => {
                    const t = tasks.find(t => t.id === r.taskId);
                    if (t)
                        setTaskEdit(t);
                    else if(r.kind==="carryover")setCarryoverOpen(true);
                    else
                        navigate("today");
                }}>{tx("Open quest")}<ArrowRight size={12}/></button><button onClick={() => run({ type: "reminder.snooze", id: r.id, minutes: 15 })}>{tx("Snooze 15m")}</button><button onClick={() => run({ type: "reminder.snooze", id: r.id, minutes: 30 })}>{tx("30m")}</button><button onClick={() => {
                    const m = window.prompt(tx("Snooze for how many minutes?"), "60");
                    if (m && Number(m) > 0)
                        run({ type: "reminder.snooze", id: r.id, minutes: Number(m) });
                }}>{tx("Custom")}</button><button onClick={() => run({ type: "reminder.dismiss", id: r.id })}>{tx("Dismiss")}</button></div></div></div>)}{!state.reminders.some(r => r.status !== "cancelled" && r.status !== "dismissed") && <Empty icon={Bell} title={tx("A little peace and quiet.")} description={tx("Reminders will appear here when you plan work or set confirmed deadlines.")}/>}</section></>;
    }
    function SettingsPage() {
        const settings = state.settings;
        const connectionCard = (provider: string, title: string, description: string, children: ReactNode) => { const c = state.connections[provider]; return <section className="card connection-card"><div className="connection-title"><span className={`connection-symbol ${provider}`}>{provider === "icloud" ? <CalendarDays size={23}/> : provider === "todoist" ? <CheckCheck size={23}/> : <Cloud size={23}/>}</span><div><h2>{tx(title)}</h2><p>{tx(description)}</p></div><span className={`status-pill ${c?.connected ? "connected" : ""}`}>{c?.connected ? tx("Connected") : tx("Not connected")}</span></div>{c?.error && <div className="notice error"><AlertCircle size={16}/>{c.error}</div>}{children}{c?.lastSync && <p className="muted small">{tx("Last checked:") + " "}{new Date(c.lastSync).toLocaleString(localeFor(language), { timeZone: "Asia/Shanghai" })}</p>}</section>; };
        return <><AccountSync/><PageHeading eyebrow={tx("MAKE YOURSELF AT HOME")} title={tx("Your career, your way")} text={tx("A few preferences and connections. Your data stays with you.")}/><div className="settings-tabs">{[["general", "Preferences"], ["connections", "Connections"], ["notifications", "Reminders"], ["backups", "Data & backups"], ["ai", "AI companion"]].map(([id, title]) => <button key={id} className={settingsTab === id ? "active" : ""} onClick={() => setSettingsTab(id)}>{tx(title)}</button>)}</div>{settingsTab === "general" && <><section className="card appearance-settings"><h2>{tx("Stadium appearance")}</h2><div className="theme-cards">{THEMES.map(theme => <button key={theme} className={settings.theme === theme ? "selected" : ""} aria-pressed={settings.theme === theme} disabled={busy} onClick={() => run({ type: "settings.update", patch: { theme } })}><span className={`theme-preview swatch-${theme}`}/><b>{tx(THEME_LABELS[theme])}</b>{settings.theme === theme && <Check size={16}/>}</button>)}</div><label className="checkbox-label"><input type="checkbox" checked={settings.reduceMotion} onChange={e => run({ type: "settings.update", patch: { reduceMotion: e.target.checked } })}/>{tx("Reduce motion")}</label><p className="muted">{tx("Your device’s reduced-motion setting is also respected.")}</p></section><section className="card settings-card"><h2>{tx("Your preferences")}</h2><label>{tx("Language")}<select name="language" value={settings.language} onChange={e => run({ type: "settings.update", patch: { language: e.target.value } })}><option value="en">{tx("English")}</option><option value="zh">{tx("\u4E2D\u6587 \u00B7 Chinese")}</option></select></label><div className="setting-row"><div><b>{tx("Timezone")}</b><p>{tx("Asia/Shanghai \u00B7 Monday-start weeks")}</p></div><span className="status-pill">{tx("GMT+8")}</span></div><div className="notice"><ShieldCheck size={18}/><p>{tx("New versions keep the same live database. Your tasks, focus history and settings are preserved.")}</p></div></section><SoundSettings settings={settings} busy={busy} onEnabled={sound=>run({type:'settings.update',patch:{sound}})} audio={audio}/></>}
 {settingsTab === "connections" && <div className="settings-stack">{connectionCard("icloud", "iCloud Calendar", "Your next season your plans, alongside the rest of your life.", <>{!state.connections.icloud?.connected ? <form className="connection-form" onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            const form = e.currentTarget;
                            const result = await external("connections/icloud", { username: f.get("username"), password: f.get("password") });
                            if (result) {
                                form.reset();
                                notify(tx("iCloud connected. Choose which calendars to show and edit."));
                            }
                        }}><div className="form-grid"><label>{tx("Apple Account email")}<input name="username" type="email" autoComplete="off" required/></label><label>{tx("App-specific password")}<input name="password" type="password" autoComplete="new-password" required/></label></div><p className="muted small">{tx("Create a revocable app-specific password in") + " "}<a href="https://account.apple.com/" target="_blank" rel="noreferrer">{tx("Apple Account settings") + " "}<ArrowUpRight size={12}/></a>.</p><button className="secondary" disabled={busy}><Link2 size={15}/>{tx("Connect iCloud")}</button></form> : <><div className="calendar-permissions"><div className="permission-heading"><span>{tx("Calendar")}</span><span>{tx("Show")}</span><span>{tx("Edit")}</span></div>{state.connections.icloud.calendars?.map(c => <div key={c.id}><b>{c.title}</b><input type="checkbox" aria-label={tx("Show {0}", c.title)} checked={c.read} onChange={e => external("connections/icloud/calendars", { selection: state.connections.icloud.calendars!.map(x => ({ ...x, read: x.id === c.id ? e.target.checked : x.read })) })}/><input type="checkbox" aria-label={tx("Allow editing {0}", c.title)} checked={c.write} onChange={e => external("connections/icloud/calendars", { selection: state.connections.icloud.calendars!.map(x => ({ ...x, write: x.id === c.id ? e.target.checked : x.write })) })}/></div>)}</div><div className="button-row"><button className="secondary" disabled={busy} onClick={() => external("connections/icloud/create-calendar")}><Plus size={14}/>{tx("Create Questbound FC calendar")}</button><button className="text-button" onClick={() => external("connections/disconnect", { provider: "icloud" })}>{tx("Disconnect")}</button></div></>}</>)}
 {connectionCard("todoist", "Todoist", "Start fresh, bring tasks over once, or keep a list connected.", <>{!state.connections.todoist?.connected ? <form className="connection-form" onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            const form = e.currentTarget;
                            const result = await external("connections/todoist", { token: f.get("token") });
                            if (result) {
                                form.reset();
                                notify(tx("Todoist connected. Preview the tasks you want to bring over."));
                            }
                        }}><label>{tx("Personal API token")}<input name="token" type="password" autoComplete="new-password" required/></label><p className="muted small">{tx("Find this in Todoist \u2192 Settings \u2192 Integrations \u2192 Developer.")}</p><button className="secondary" disabled={busy}><Link2 size={15}/>{tx("Connect Todoist")}</button></form> : <SubjectManager state={state} busy={busy} run={run} sync={()=>external("sync")}/>}</>)}
 <section className="card"><div className="section-heading"><h2>{tx("Connection health")}</h2><button className="secondary" disabled={busy} onClick={async () => {
                    if (await external("sync"))
                        notify(tx("Connected sources checked."));
                }}><RefreshCw size={14}/>{tx("Refresh connections")}</button></div>{state.outbox.length ? <><p className="muted">{state.outbox.length}{" " + tx("changes waiting for their provider.")}</p>{state.outbox.map(o => <div className="sync-row" key={o.id}><span>{o.provider} · {o.action}</span><span>{tx(o.error || "Pending sync")}</span>{o.error && <div className="button-row"><button className="text-button" onClick={() => external("connections/resolve", { jobId: o.id, choice: "provider" })}>{tx("Use provider version")}</button><button className="text-button" onClick={() => external("connections/resolve", { jobId: o.id, choice: "planner" })}>{tx("Retry planner version")}</button></div>}</div>)}</> : <p className="muted">{tx("No outgoing changes are waiting.")}</p>}{settings.integrationsPaused && <div className="notice"><AlertCircle size={18}/><div><b>{tx("Connections paused after restoration")}</b><p>{tx("Refresh provider records and review any conflicts, then resume.")}</p><button className="secondary" onClick={() => external("connections/resume")}>{tx("Resume connections & reminders")}</button></div></div>}</section></div>}
 {settingsTab === "notifications" && <section className="card settings-card"><h2>{tx("Gentle nudges from your career")}</h2><p className="muted">{tx("A reminder to begin, one follow-up, and a little perspective at the end of the day.")}</p><div className="notification-setup"><span className="reminder-icon"><Bell size={23}/></span><div><b>{tx("Reach me on this device")}</b><p>{tx("On iPhone, add Questbound FC to your Home Screen first, then allow notifications.")}</p></div><button className="primary" disabled={busy} onClick={async () => {
                    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
                        notify(tx("Open the installed Home Screen app on iPhone, or a browser that supports web notifications."));
                        return;
                    }
                    const permission = await Notification.requestPermission();
                    if (permission !== "granted") {
                        notify(tx("Notifications are off. You can enable them in your device's website settings."));
                        return;
                    }
                    try {
                        const key = await api<{
                            publicKey: string;
                        }>("push/key", {});
                        const ready = await navigator.serviceWorker.ready;
                        const padded = key.publicKey.replaceAll("-", "+").replaceAll("_", "/");
                        const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
                        const subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
                        let id = localStorage.getItem("qi-device");
                        if (!id) {
                            id = crypto.randomUUID();
                            localStorage.setItem("qi-device", id);
                        }
                        await api("push/register", { id, subscription: subscription.toJSON(), label: /iPhone|iPad/.test(navigator.userAgent) ? "iPhone / iPad" : "Mac / browser" });
                        await run({ type: "settings.update", patch: { push: true } });
                        notify(tx("This device is connected. Send a test to check it."));
                    }
                    catch (e) {
                        notify((e as Error).message);
                    }
                }}>{tx("Enable notifications")}</button></div><div className="button-row"><button className="secondary" disabled={busy} onClick={async () => {
                    if (await external("push/test"))
                        notify(tx("The push service accepted your test. Check this device for the notification."));
                }}>{tx("Send a test")}</button><button className="text-button" onClick={async () => {
                    const id = localStorage.getItem("qi-device");
                    if (id && await external("push/disable", { id }))
                        notify(tx("Reminders are off on this device."));
                }}>{tx("Mute this device")}</button></div><form onSubmit={async (e) => { e.preventDefault(); const f = new FormData(e.currentTarget); await run({ type: "settings.update", patch: { quietStart: f.get("quietStart"), quietEnd: f.get("quietEnd"), dailyNudge: f.get("dailyNudge"), carryoverTime: f.get("carryoverTime"), reviewTime: f.get("reviewTime"), deadlineAlerts: f.get("deadlines") === "on", mutedAreas: areaNames(state).filter(a => f.get(`mute:${a}`) === "on") } }); }}><div className="form-grid"><label>{tx("Quiet hours begin")}<input type="time" name="quietStart" defaultValue={settings.quietStart}/></label><label>{tx("Quiet hours end")}<input type="time" name="quietEnd" defaultValue={settings.quietEnd}/></label><label>{tx("Untimed quest nudge")}<input type="time" name="dailyNudge" defaultValue={settings.dailyNudge}/></label><label>{tx("Unfinished-task morning review")}<input type="time" name="carryoverTime" defaultValue={settings.carryoverTime}/></label><label>{tx("Evening review")}<input type="time" name="reviewTime" defaultValue={settings.reviewTime}/></label></div><label className="checkbox-label"><input name="deadlines" type="checkbox" defaultChecked={settings.deadlineAlerts}/>{tx("Confirmed deadline alerts: 24 hours and 1 hour before")}</label><details className="setup-details"><summary>{tx("Quiet areas \u00B7 mute selected categories")}</summary><div className="muted-area-grid">{areaNames(state).map(a => <label className="checkbox-label" key={a}><input name={`mute:${a}`} type="checkbox" defaultChecked={settings.mutedAreas.includes(a)}/>{a}</label>)}</div></details><button className="primary" disabled={busy}>{tx("Save reminder preferences")}</button></form><div className={`notice ${state.service.lastError ? "error" : ""}`}><Clock size={18}/><div><b>{tx("Background reminder service")}</b><p>{state.service.lastRun ? tx("Last check: {0}", new Date(state.service.lastRun).toLocaleString(localeFor(language), { timeZone: "Asia/Shanghai" })) : tx("Awaiting background-host setup. Closed-site reminders become active after the scheduled worker is connected.")}</p>{state.service.lastError && <p>{state.service.lastError}</p>}</div></div></section>}
 {settingsTab === "backups" && <BackupPanel backups={backups} ready={backupReady} busy={busy} revision={data!.revision} external={external} notify={notify} reload={async () => {
                    const b = await api<{
                        backups: Backup[];
                        ready: boolean;
                    }>("backups");
                    setBackups(b.backups);
                    setBackupReady(b.ready);
                }} refresh={refresh}/>}
 {settingsTab === "ai" && <section className="card settings-card ai-settings"><span className="ai-emblem"><Sparkles size={31}/></span><h2>{tx("A thoughtful companion.")}<br />{tx("Your existing subscription.")}</h2><p className="muted">{tx("Use ChatGPT or Codex alongside your career. Read connected school sources, talk through your priorities, and bring a plan here to review.")}</p><div className="ai-example">{tx("\u201CCheck my latest Teams homework and OneNote notes. Suggest tomorrow's three quests around my calendar.\u201D")}</div><ol className="setup-steps"><li>{tx("Open ChatGPT or Codex and install your private Questbound FC plugin under Plugins \u2192 Personal \u2192 Created by you.")}</li><li>{tx("Use get_planner_context to read the current plan, then propose_plan to stage suggestions.")}</li><li>{tx("Review proposals in your career inbox, or explicitly ask the AI to apply one.")}</li></ol><p className="muted small">{tx("Teams and OneNote use the connections available in that chat. Codex reads local folders you authorise. No OpenAI API key is needed.")}</p><div className="button-row"><a className="primary" href="https://chatgpt.com/" target="_blank" rel="noreferrer">{tx("Open ChatGPT")}<ArrowUpRight size={16}/></a><button className="secondary" onClick={() => navigate("inbox")}><Inbox size={16}/>{tx("Review proposals")}</button></div></section>}</>;
    }
    return <LocaleProvider language={state.settings.language} theme={state.settings.theme} onDisplayChange={patch => run({ type: "settings.update", patch })}><GameShell state={state} view={view} navigate={navigate} saveStatus={saveStatus} pending={pending + suggestions.length} busy={busy} patch={patch => run({ type: "settings.update", patch })} now={now} unavailable={!!loadError} onRefresh={refresh} retryable={!!retryCommand} onRetry={() => { const retry = retryCommand; if (retry) void run(retry); }} onFocus={action => run({ type: `focus.${action}` })}>{activeDormJourney&&<DormReturnBar journey={activeDormJourney} onReturn={returnToDorm}/>}<div className={activeDormJourney?.phase==='away'?'dorm-destination-screen':'dorm-route-screen'}>{loadError && <div className="notice error"><AlertCircle size={17}/><p>{tx(loadError)} · {tx("Showing your last loaded data.")}</p><button className="text-button" onClick={refresh}>{tx("Retry")}</button></div>}{view === "today" ? Today() : view === "quests" ? Quests() : view === "calendar" ? Calendar() : view === "training" ? Training() : view === "time" ? TimeView() : view === "island" ? IslandView() : view === "inbox" ? InboxView() : SettingsPage()}</div></GameShell><div className="football-overlays">{smartTask&&<SmartTaskDialog key={`${smartTask.listId}:${smartTask.subjectId}`} initial={smartTask} subjectScope={smartScope} state={state} busy={busy} run={run} onCancel={()=>setSmartTask(null)} onSaved={(task,edit)=>{setSmartTask(null);notify("Task added.");if(edit)setTaskEdit(task)}}/>}{carryoverOpen&&<UnfinishedReview state={state} busy={busy} run={run} onClose={closeCarryover} onEdit={task=>{closeCarryover();setTaskEdit(task)}} onSkip={beginSkip}/>} {skipTask&&<SkipOccurrence key={skipTask.id} task={skipTask} state={state} busy={busy} run={run} onClose={()=>setSkipTask(null)} onSaved={skipId=>{setSkipUndo({id:skipTask.id,title:skipTask.title,skipId});setSkipTask(null)}}/>}{skipUndo&&<SkippedFeedback busy={busy} title={skipUndo.title} onDismiss={()=>setSkipUndo(null)} onUndo={async()=>{if(await run({type:"task.skip.undo",id:skipUndo.id,skipId:skipUndo.skipId}))setSkipUndo(null)}}/>}{subjectsOpen&&<Modal wide title={tx("Subjects & parts")} onClose={()=>setSubjectsOpen(false)}><SubjectManager state={state} busy={busy} run={run} sync={()=>external("sync")}/></Modal>}{toast && <div className={`toast ${toast.xp ? "celebration" : ""}`} role="status">{toast.xp ? <Sparkles size={21}/> : <Leaf size={19}/>}<span className="reward-feedback-copy">{toast.text}{!!toast.xp&&<span className="reward-next-level"><progress max={100} value={totalXP(state)%100} aria-label={tx("Progress to next level")}/><small>{tx("{0} XP to the next level",100-totalXP(state)%100)}</small></span>}{toast.clubLink&&<a className="toast-club-link" data-club-link href={typeof window!=="undefined"&&(window as unknown as {__QFC_DEMO__?:boolean}).__QFC_DEMO__?"#top":"/club"}>{zh?"查看俱乐部":"Open club"}</a>}</span><button aria-label={tx("Dismiss feedback")} onClick={() => setToast(null)}><X size={15}/></button>{toast.xp && Array.from({ length: 12 }, (_, i) => <i className="confetti" key={i} style={{ "--i": i } as React.CSSProperties}/>)}</div>}{view!=='quests'&&taskEditor}{blockEdit && <BlockForm block={blockEdit} state={state} busy={busy} onClose={closeBlock} onSave={async (b) => {
                if (await run({ type: "block.save", block: { ...b, id: b.id || crypto.randomUUID() } }))
                    setBlockEdit(null);
            }} onDelete={async (b) => {
                if (b.originId && b.scope !== "series") {
                    const original = state.blocks.find(x => x.id === b.originId);
                    if (original && await run({ type: "block.save", block: { ...original, exceptions: { ...original.exceptions, [b.occurrenceKey!]: { skip: true } } } }))
                        setBlockEdit(null);
                }
                else if (await run({ type: "block.delete", id: b.originId || b.id }))
                    setBlockEdit(null);
            }}/>}{manualOpen && <ManualTime state={state} onClose={() => setManualOpen(false)} busy={busy} onSave={async (c) => {
                if (await run(c))
                    setManualOpen(false);
            }}/>}{reminderId && <Modal title={tx("A little nudge from your coach")} onClose={closeReminder}><p>{state.reminders.find(r => r.id === reminderId)?.body || "Let's check your latest plan."}</p>{(() => {
                const reminder = state.reminders.find(r => r.id === reminderId);
                const task = tasks.find(t => t.id === reminder?.taskId);
                return <div className="reminder-control-panel">{reminder?.kind==="carryover"&&<button className="primary" onClick={()=>{closeReminder();setCarryoverOpen(true)}}>{tx("Review unfinished tasks")}</button>}{task && <><button className="primary" disabled={busy || !!state.activeSession || task.done} onClick={async () => {
                            if (await run({ type: "focus.start", taskId: task.id, minutes: 25 }))
                                closeReminder();
                        }}><Play size={15}/>{tx("Start")}</button><button className="secondary" disabled={busy || task.done} onClick={async () => {
                            if (await run({ type: "task.toggle", id: task.id, done: true }))
                                closeReminder();
                        }}><Check size={15}/>{tx("Mark done")}</button>{task.recurring&&!task.done&&<button className="secondary" disabled={busy} onClick={()=>{closeReminder();beginSkip(task)}}>{tx("Skip this occurrence")}</button>}<button className="secondary" onClick={() => {
                            const block = state.blocks.find(b => b.taskId === task.id);
                            closeReminder();
                            if (block)
                                setBlockEdit(block);
                            else
                                setTaskEdit(task);
                        }}><CalendarDays size={15}/>{tx("Reschedule")}</button></>}{[15, 30].map(minutes => <button key={minutes} className="secondary" disabled={busy} onClick={async () => {
                            if (await run({ type: "reminder.snooze", id: reminderId, minutes }))
                                closeReminder();
                        }}>{tx("Snooze") + " "}{minutes}{tx("m")}</button>)}<button className="text-button" disabled={busy} onClick={async () => {
                        const minutes = Number(window.prompt(tx("Snooze for how many minutes?"), "60"));
                        if (minutes > 0 && await run({ type: "reminder.snooze", id: reminderId, minutes }))
                            closeReminder();
                    }}>{tx("Custom snooze")}</button><button className="text-button" onClick={() => { closeReminder(); navigate("inbox"); }}>{tx("Open coach inbox")}<ArrowRight size={14}/></button></div>;
            })()}</Modal>}</div></LocaleProvider>;
}
function PageHeading({ eyebrow, title, text, action }: {
    eyebrow: string;
    title: string;
    text: string;
    action?: ReactNode;
}) { const { t: tx, language } = useLocale(); return <div className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{action}</div>; }
function BlockForm({ block, state, busy, onClose, onSave, onDelete }: {
    block: Partial<TimeBlock>;
    state: PlannerState;
    busy: boolean;
    onClose: () => void;
    onSave: (b: TimeBlock) => void;
    onDelete: (b: TimeBlock) => void;
}) { const { t: tx, language } = useLocale(); const [draft, setDraft] = useState<Partial<TimeBlock>>({ ...block, id: block.id || crypto.randomUUID(), exceptions: block.exceptions || {}, repeat: block.repeat || "none", area: block.area || "Projects" }); const set = (p: Partial<TimeBlock>) => setDraft(d => ({ ...d, ...p })); return <Modal title={block.id ? tx("A little time in your calendar") : tx("Make a little room")} onClose={onClose}><form onSubmit={e => { e.preventDefault(); onSave(draft as TimeBlock); }}><label>{tx("What is this time for?")}<input required maxLength={300} value={draft.title || ""} onChange={e => set({ title: e.target.value })} disabled={block.readOnly} placeholder={tx("Reading, training, or your next small step\u2026")}/></label><label>{tx("Link a quest \u00B7 optional")}<select value={draft.taskId || ""} onChange={e => { const task = state.tasks.find(t => t.id === e.target.value); set({ taskId: task?.id, title: task?.title || draft.title, area: task?.area || draft.area,subjectId:task?.subjectId }); }} disabled={block.readOnly||block.taskWindow}><option value="">{tx("A standalone event")}</option>{state.tasks.filter(t => !t.deletedAt && !t.done).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label className="all-day-toggle"><input type="checkbox" checked={!!draft.allDay} disabled={block.readOnly||block.taskWindow} onChange={e=>{const day=localDay(draft.start||new Date().toISOString());set(e.target.checked?{allDay:true,start:zonedTime(day,"00:00"),end:zonedTime(addDays(localDay(draft.end||draft.start||new Date().toISOString()),1),"00:00")}:{allDay:false,start:zonedTime(day,"09:00"),end:zonedTime(day,"09:30")});}}/>{tx("All day")}</label>{draft.allDay?<div className="form-grid">{(["start","end"] as const).map(k=><label key={k}>{tx(k==="start"?"First day":"Last day")}<input required type="date" disabled={block.readOnly} min={k==="end"&&draft.start?localDay(draft.start):undefined} value={draft[k]?(k==="end"?addDays(localDay(draft[k]!),-1):localDay(draft[k]!)):""} onChange={e=>{if(!e.target.value)return;const value=zonedTime(k==="end"?addDays(e.target.value,1):e.target.value,"00:00");set(k==="start"&&Date.parse(value)>=Date.parse(draft.end||"")?{start:value,end:zonedTime(addDays(e.target.value,1),"00:00")}:{[k]:value});}}/></label>)}</div>:null}<div className="form-grid">{(!draft.allDay?["start", "end"]:[]).map(k => <label key={k}>{k === "start" ? tx("Starts") : tx("Ends")}<input required type="datetime-local" disabled={block.readOnly} value={draft[k as "start" | "end"] ? localDay(draft[k as "start" | "end"]!) + "T" + clockInZone(draft[k as "start" | "end"]!) : ""} onChange={e => set({ [k]: e.target.value ? zonedTime(e.target.value.slice(0, 10), e.target.value.slice(11, 16)) : "" })}/></label>)}<label>{tx("Area")}<select value={draft.area} onChange={e => set({ area: e.target.value })} disabled={block.readOnly||block.taskWindow}>{areaNames(state).map(a => <option key={a} value={a}>{a}</option>)}</select></label><label>{tx("Repeats")}<select value={draft.repeat} onChange={e => set({ repeat: e.target.value as TimeBlock["repeat"] })} disabled={block.readOnly || block.taskWindow || !!block.occurrenceKey}><option value="none">{tx("Does not repeat")}</option><option value="daily">{tx("Every day")}</option><option value="weekly">{tx("Every week")}</option><option value="monthly">{tx("Every month")}</option></select></label></div>{block.occurrenceKey && <label>{tx("Apply changes to")}<select value={draft.scope || "occurrence"} onChange={e => set({ scope: e.target.value as "occurrence" | "series" })}><option value="occurrence">{tx("Only this occurrence")}</option><option value="series">{tx("The whole series")}</option></select></label>}<label>{tx("Calendar")}<select value={draft.calendarId || ""} disabled={block.readOnly||block.taskWindow} onChange={e => set({ calendarId: e.target.value || undefined })}><option value="">{tx("Inside Questbound FC")}</option>{state.connections.icloud?.calendars?.filter(c => c.write).map(c => <option key={c.id} value={c.id}>{c.title}{" " + tx("\u00B7 iCloud")}</option>)}</select></label><p className="muted small">{block.taskWindow&&tx("This time window stays linked to its task. Change the subject in task details.")+" "}{tx("Planning a block doesn't complete a quest or change its real deadline.")}</p><div className="modal-footer">{block.id && !block.readOnly ? <button type="button" className="icon-button danger" onClick={() => onDelete(draft as TimeBlock)} aria-label={tx("Remove time block")}><Trash2 size={17}/></button> : <span />}<div className="button-row"><button type="button" className="text-button" onClick={onClose}>{tx("Cancel")}</button>{!block.readOnly && <button className="primary" disabled={busy}>{tx("Save time")}<Check size={15}/></button>}</div></div></form></Modal>; }
function ManualTime({ state, busy, onClose, onSave }: {
    state: PlannerState;
    busy: boolean;
    onClose: () => void;
    onSave: (c: Command) => void;
}) { const { t: tx, language } = useLocale(); const [sessionId] = useState(() => crypto.randomUUID()); return <Modal title={tx("Give your time a little credit")} onClose={onClose}><form onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget); const date = String(f.get("date")); onSave({ type: "session.add", id: sessionId, taskId: String(f.get("taskId")), area: String(f.get("area")), minutes: Number(f.get("minutes")), startedAt: zonedTime(date, "12:00") }); }}><label>{tx("Quest \u00B7 optional")}<select name="taskId"><option value="">{tx("Unassigned time")}</option>{state.tasks.filter(t => !t.deletedAt).map(t => <option key={t.id} value={t.id}>{t.title}</option>)}</select></label><label>{tx("Area")}<select name="area">{areaNames(state).map(a => <option key={a} value={a}>{a}</option>)}</select></label><div className="form-grid"><label>{tx("Date")}<input name="date" type="date" required defaultValue={localDay()}/></label><label>{tx("Minutes")}<input name="minutes" type="number" min={1} max={1440} defaultValue={25} required/></label></div><p className="muted small">{tx("Manual entries record actual time. They don't automatically complete a quest or earn focus-session XP.")}</p><button className="primary" disabled={busy}>{tx("Save time")}<Check size={15}/></button></form></Modal>; }
function TodoistImport({ projects, busy, onImport, onError }: {
    projects: {
        id: string;
        name: string;
    }[];
    busy: boolean;
    onImport: (p: string, m: string, s: string[]) => void;
    onError: (s: string) => void;
}) {
    const { t: tx, language } = useLocale();
    const [project, setProject] = useState(projects[0]?.id || ""), [mode, setMode] = useState("sync"), [items, setItems] = useState<{
        id: string;
        title: string;
        plannedOn: string;
        deadline: string;
    }[]>([]), [selected, setSelected] = useState<string[]>([]), [previewed, setPreviewed] = useState(false);
    return <div className="todoist-import"><div className="form-grid"><label>{tx("Project")}<select value={project} onChange={e => { setProject(e.target.value); setItems([]); setSelected([]); setPreviewed(false); }}>{projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>{tx("How to bring it over")}<select value={mode} onChange={e => setMode(e.target.value)}><option value="import">{tx("Import once")}</option><option value="sync">{tx("Keep both in sync")}</option></select></label></div><button className="secondary" disabled={busy || !project} onClick={async () => {
            try {
                const result = await api<{
                    items: typeof items;
                }>(`connections/todoist/preview?project=${encodeURIComponent(project)}`);
                setItems(result.items);
                setSelected(result.items.map(i => i.id));
                setPreviewed(true);
            }
            catch (e) {
                onError((e as Error).message);
            }
        }}>{tx("Preview tasks")}<ArrowRight size={14}/></button>{previewed && <><div className="import-preview">{items.length ? items.map(t => <label key={t.id} className="import-task"><input type="checkbox" checked={selected.includes(t.id)} onChange={e => setSelected(v => e.target.checked ? [...v, t.id] : v.filter(id => id !== t.id))}/><span><b>{t.title}</b><small>{t.plannedOn ? tx("Suggested: {0}", t.plannedOn) : tx("No planned date")}{t.deadline ? tx("\u00B7 Deadline: {0}", t.deadline) : ""}</small></span></label>) : <p className="muted">{tx("No active tasks in this project.")}</p>}</div><p className="muted small">{tx("Imported tasks need date review before reminders begin. Fresh lists remain available alongside these.")}</p><button className="primary" disabled={busy || !selected.length} onClick={() => onImport(project, mode, selected)}>{tx("Bring") + " "}{selected.length}{" " + tx("quests over")}<ArrowRight size={15}/></button></>}</div>;
}
function BackupPanel({ backups, ready, busy, revision, external, notify, reload, refresh }: {
    backups: Backup[];
    ready: boolean;
    busy: boolean;
    revision: number;
    external: (p: string, b?: unknown) => Promise<Record<string, unknown> | null>;
    notify: (s: string) => void;
    reload: () => Promise<void>;
    refresh: () => Promise<void>;
}) {
    const { t: tx, language } = useLocale();
    const [key, setKey] = useState(""), [restore, setRestore] = useState<{
        id: string;
        createdAt: string;
        counts: Record<string, number>;
    } | null>(null), [restoreBusy, setRestoreBusy] = useState(false);
    const latest = backups[0];
    const latestOne = backups.find(b => b.onedrive_at), latestLocal = backups.find(b => b.local_at);
    return <div className="settings-stack"><div className="backup-overview"><section className="card"><span className="backup-icon"><ShieldCheck size={23}/></span><h3>{tx(isLocalPlanner()?"OneDrive cloud data":"Live database")}</h3><b>{tx("Saved \u00B7 revision") + " "}{revision}</b><p>{tx(isLocalPlanner()?"Cloud sync status is shown above; local saving and cloud upload are separate.":"One shared home for every device.")}</p></section><section className="card"><span className="backup-icon"><Cloud size={23}/></span><h3>{tx("OneDrive copy")}</h3><b>{latestOne ? tx("Verified") : tx("Awaiting setup")}</b><p>{latestOne ? new Date(latestOne.onedrive_at!).toLocaleString(localeFor(language), { timeZone: "Asia/Shanghai" }) : tx("Your own encrypted recovery archives.")}</p></section><section className="card"><span className="backup-icon"><HardDrive size={23}/></span><h3>{tx("Independent Mac copy")}</h3><b>{latestLocal ? tx("Verified") : tx("Awaiting helper")}</b><p>{latestLocal ? new Date(latestLocal.local_at!).toLocaleString(localeFor(language), { timeZone: "Asia/Shanghai" }) : tx("Catches up after your Mac wakes.")}</p></section></div><section className="card settings-card"><div className="section-heading"><div><h2>{tx("Your progress is worth keeping.")}</h2><p className="muted">{tx("Encrypted snapshots, verified copies, and a way back if something goes wrong.")}</p></div><ShieldCheck size={27} className="green"/></div>{!ready ? <div className="notice"><Lock size={21}/><div><b>{tx("Start with your recovery key")}</b><p>{tx("Keep a copy somewhere safe. You'll need it to open a backup if the original site becomes unavailable.")}</p><button className="primary" disabled={busy} onClick={async () => {
                const result = await external("backups/setup");
                if (result?.key) {
                    setKey(String(result.key));
                    await reload();
                }
            }}>{tx("Create my recovery key")}<ArrowRight size={14}/></button></div></div> : <div className="button-row"><button className="primary" disabled={busy} onClick={async () => {
                if (await external("backups/create")) {
                    await reload();
                    notify(tx("A new encrypted backup was created and verified."));
                }
            }}><ShieldCheck size={15}/>{tx("Back up now")}</button><button className="secondary" disabled={busy} onClick={async () => {
                const result = await external("backups/setup");
                if (result?.key)
                    setKey(String(result.key));
            }}><Download size={15}/>{tx("Recovery key")}</button></div>}{key && <div className="recovery-key"><div><b>{tx("Your recovery key")}</b><button className="icon-button" aria-label={tx("Hide recovery key")} onClick={() => setKey("")}><X size={15}/></button></div><code>{key}</code><button className="secondary" onClick={() => download("quest-island-recovery-key.txt", `Questbound FC recovery key\n\n${key}\n\nKeep this separately from your encrypted backups.\n`, "text/plain")}><Download size={14}/>{tx("Save key separately")}</button></div>}<div className="backup-policy"><p><b>{tx("Hourly snapshots")}</b>{" " + tx("\u00B7 24 hourly, 30 daily, 12 monthly, and 10 pre-update recovery points.")}</p><p>{tx("Updates keep the existing database. A database-changing update requires a verified snapshot and migration checks.")}</p><p>{tx("Archives contain your app records and source links. Provider passwords and access tokens are excluded.")}</p></div></section><section className="card"><div className="section-heading"><h2>{tx("Recovery points")}</h2><span className="muted small">{backups.length}{" " + tx("available")}</span></div>{backups.length ? <div className="table-scroll"><table className="time-table backup-table"><thead><tr><th>{tx("Created")}</th><th>{tx("Revision")}</th><th>{tx("Verified copies")}</th><th /></tr></thead><tbody>{backups.map(b => <tr key={b.id}><td><b>{new Date(b.created_at).toLocaleDateString(localeFor(language), { timeZone: "Asia/Shanghai" })}</b><small>{new Date(b.created_at).toLocaleTimeString(localeFor(language), { timeZone: "Asia/Shanghai", hour: "2-digit", minute: "2-digit" })} · {tx(b.kind)}</small>{b.error && <small className="late">{b.error}</small>}</td><td>{b.revision}</td><td><span className="copy-status"><ShieldCheck size={14}/>{b.verified ? tx("Archive verified") : tx("Verifying")}</span><small>{tx("OneDrive:") + " "}{b.onedrive_at ? tx("verified") : tx("pending")}{" " + tx("\u00B7 Mac:") + " "}{b.local_at ? tx("verified") : tx("pending")}</small></td><td><a className="icon-button" href={`/api/backups/download/${b.id}`} aria-label={tx("Download backup {0}", b.created_at)}><Download size={16}/></a></td></tr>)}</tbody></table></div> : <Empty icon={ShieldCheck} title={tx("A little peace of mind starts here.")} description={tx("Set up your recovery key, then create your first verified backup.")}/>}</section><section className="card settings-card"><h2>{tx("A separate copy on your Mac")}</h2><p className="muted">{tx("The helper saves independent archives outside the app folder. It can also copy them into your existing OneDrive folder. It never mirrors deletions between your backup locations.")}</p><ol className="setup-steps"><li>{tx("Download the Mac helper installer.")}</li><li>{tx("Create a one-time setup file and open it with the installer.")}</li><li>{tx("The helper stores its backup-only token and recovery key in Mac Keychain, then catches up hourly while your Mac is awake.")}</li></ol><div className="button-row"><a className="secondary" href="/downloads/install-backup-helper.sh" download><Download size={15}/>{tx("Mac helper installer")}</a><button className="secondary" disabled={busy || !ready} onClick={async () => {
            const result = await external("helper/enroll");
            if (result) {
                download("quest-island.qiconnect", JSON.stringify(result));
                notify(tx("Setup file downloaded. The installer moves its secrets into Keychain and removes the file."));
            }
        }}>{tx("Create setup file")}<ArrowRight size={14}/></button></div></section><section className="card settings-card"><h2>{tx("Restore a recovery point")}</h2><p className="muted">{tx("Check the archive first. You'll see its date and record counts before replacing the current planner.")}</p><form onSubmit={async (e) => {
            e.preventDefault();
            setRestoreBusy(true);
            try {
                const f = new FormData(e.currentTarget);
                const r = await fetch("/api/restore/preview", { method: "POST", body: f,headers:isLocalPlanner()?{"X-QFC-Account":plannerScope()}:{} });
                const d = await r.json() as {
                    id: string;
                    createdAt: string;
                    counts: Record<string, number>;
                    error?: string;
                };
                if (!r.ok)
                    throw new Error(d.error);
                setRestore(d);
            }
            catch (e) {
                notify((e as Error).message);
            }
            finally {
                setRestoreBusy(false);
            }
        }}><label>{tx("Encrypted .qibak archive")}<input name="archive" type="file" accept=".qibak" required/></label><label>{tx("Recovery key")}<input name="key" type="password" required autoComplete="off"/></label><button className="secondary" disabled={restoreBusy}><Upload size={15}/>{restoreBusy ? tx("Checking\u2026") : tx("Verify and preview")}</button></form>{restore && <div className="restore-preview"><h3>{tx("Verified backup \u00B7") + " "}{new Date(restore.createdAt).toLocaleString(localeFor(language), { timeZone: "Asia/Shanghai" })}</h3><p>{Object.entries(restore.counts).map(([k, n]) => `${n} ${tx(k)}`).join(" · ")}</p><p>{tx("A snapshot of your current planner is taken first. Outbound connections and reminders pause until you review the restored data.")}</p><p>{tx("Played career history and newer active match checkpoints are preserved so restoration cannot repeat rewards or transfers.")}</p><p>{tx("Existing credit receipts, purchases and equipped items are retained. Unspent credits follow the restored task history.")}</p><button className="primary" disabled={busy} onClick={async () => {
                if (!window.confirm(tx("Replace the current planner with this verified recovery point? A pre-restore backup will be saved first.")))
                    return;
                if (await external("restore/commit", { id: restore.id, revision, operationId: crypto.randomUUID() })) {
                    setRestore(null);
                    await refresh();
                    await reload();
                    notify(tx("Your planner was restored. Review connections before resuming sync and reminders."));
                }
            }}>{tx("Restore this recovery point")}</button></div>}</section></div>;
}
