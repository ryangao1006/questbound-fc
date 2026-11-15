import {newEconomy,type Economy} from './economy.ts';
import type {ClubState} from './club-state.ts';
import {defaultTaskDisplay,migrateTaskDisplay,type TaskDisplay} from "./task-workspace.ts";
import {defaultAvatar,migrateAvatar,migrateTheme,type AvatarConfig,type Theme} from "./avatar.ts";
export const APP_VERSION = "3.6.0";
export const SCHEMA_VERSION = 8;
export const AREAS = ["English Literature", "English Language", "Economics", "AS/A-level Maths", "Physics", "Chemistry", "Biology", "Computer Science", "Chinese", "NEC Economics", "Reading", "Fitness", "Wellbeing", "Projects"];
export const AREA_COLORS: Record<string, string> = { "English Literature": "#bb795f", "English Language": "#9b795d", Economics: "#6e9277", "AS/A-level Maths": "#7c8ca4", Physics: "#8a82ad", Chemistry: "#af9352", Biology: "#7e9e72", "Computer Science": "#749b9c", Chinese: "#c77d87", "NEC Economics": "#6e9277", Reading: "#b99a67", Fitness: "#d48760", Wellbeing: "#99a88b", Projects: "#9585b0" };
export type Task = {
    subjectId?: string;
    remoteProjectId?: string;
    remoteSectionId?: string;
    remoteParentId?: string;
    remoteDue?: Record<string, unknown>;
    syncBase?: Record<string, unknown>;
    id: string;
    title: string;
    area: string;
    listId: string;
    notes: string;
    plannedOn: string;
    plannedTime?: string;
    plannedEnd?: string;
    deadline: string;
    deadlineConfirmed: boolean;
    estimate: number;
    priority: number;
    main: boolean;
    done: boolean;
    completedAt?: string;
    startedAt?: string;
    createdAt: string;
    deletedAt?: string;
    subtasks: {
        id: string;
        title: string;
        done: boolean;
    }[];
    sources: {
        title: string;
        url: string;
    }[];
    remoteId?: string;
    recurring?: boolean;
    carryoverReviewedOn?: string;
    skipHistory?: {id:string;scope:string;fromDay:string;fromTime:string;nextDay:string;nextTime:string;at:string;undoneAt?:string}[];
    occurrence?: string;
    recurrenceState?: {
        count?: number;
        observedCount?: number;
        scopes: Record<string,string>;
        dues: Record<string,Record<string,unknown>>;
        acknowledgedDue?: Record<string,unknown>;
    };
    needsReview?: boolean;
    reminders: boolean;
};
export type TimeBlock = {
    taskWindow?: boolean;
    subjectId?: string;
    id: string;
    title: string;
    taskId?: string;
    area: string;
    start: string;
    end: string;
    repeat: "none" | "daily" | "weekly" | "monthly";
    until?: string;
    exceptions: Record<string, {
        skip?: boolean;
        allDay?: boolean;
        start?: string;
        end?: string;
        title?: string;
    }>;
    calendarId?: string;
    remoteId?: string;
    etag?: string;
    readOnly?: boolean;
    allDay?: boolean;
    icalUid?: string;
    occurrenceKey?: string;
    originId?: string;
    scope?: "occurrence" | "series";
};
export type Session = {
    workScope?: string;
    subjectId?: string;
    id: string;
    taskId?: string;
    area: string;
    startedAt: string;
    endedAt: string;
    seconds: number;
    kind: "focus" | "manual";
};
export type ActiveSession = {
    workScope?: string;
    subjectId?: string;
    id: string;
    taskId?: string;
    area: string;
    startedAt: string;
    target: number;
    pausedAt?: string;
    pausedSeconds: number;
};
export type Habit = {
    subjectId?: string;
    id: string;
    title: string;
    area: string;
    icon: string;
};
export type Reward = {
    id: string;
    points: number;
    active: boolean;
    at: string;
};
export type Reminder = {
    id: string;
    taskId?: string;
    taskIds?: string[];
    kind: string;
    at: string;
    title: string;
    body: string;
    status: "pending" | "sent" | "cancelled" | "dismissed";
    createdAt: string;
    snoozed?: boolean;
};
export type OutboxItem = {
    id: string;
    provider: "todoist" | "icloud";
    action: string;
    entityId: string;
    payload: Record<string, unknown>;
    attempts: number;
    nextAttempt: string;
    status: "pending" | "error";
    error?: string;
    attemptedAt?: string;
    conflict?: boolean;
};
export type Settings = {
    taskDisplay: TaskDisplay;
    theme: Theme;
    avatar: AvatarConfig;
    reduceMotion: boolean;
    name: string;
    language: "en" | "zh";
    timezone: string;
    quietStart: string;
    quietEnd: string;
    push: boolean;
    deadlineAlerts: boolean;
    sound: boolean;
    mutedAreas: string[];
    integrationsPaused: boolean;
    dailyNudge: string;
    carryoverTime: string;
    reviewTime: string;
    unlocked: string[];
    placed: string[];
    equipped: string[];
    characterClass: "Scholar" | "Ranger" | "Artificer";
    position: "GK" | "CB" | "FB" | "CM" | "W" | "ST";
    playerNumber: number;
};
export type Subject={id:string;title:string;listId:string;remoteId?:string;archived?:boolean;seeded?:boolean;syncBaseTitle?:string};
export type PlannerList={id:string;title:string;mode:"fresh"|"import"|"sync";projectId?:string;parentId?:string;archived?:boolean;inbox?:boolean;syncBaseTitle?:string};
export type PlannerState = {
    economy:Economy;
    club?:ClubState;
    subjects:Subject[];
    schemaVersion: number;
    settings: Settings;
    tasks: Task[];
    blocks: TimeBlock[];
    sessions: Session[];
    activeSession: ActiveSession | null;
    habits: Habit[];
    habitChecks: Record<string, boolean>;
    rewards: Reward[];
    reminders: Reminder[];
    outbox: OutboxItem[];
    lists: PlannerList[];
    connections: Record<string, {
        connected: boolean;
        lastSync?: string;
        structureSyncedAt?: string;
        twoWaySubjects?: boolean;
        error?: string;
        calendars?: {
            id: string;
            title: string;
            read: boolean;
            write: boolean;
        }[];
        projects?: {
            id: string;
            name: string;
        }[];
    }>;
    proposals: {
        id: string;
        title: string;
        tasks: Partial<Task>[];
        blocks: Partial<TimeBlock>[];
        createdAt: string;
        applied: boolean;
    }[];
    service: {
        lastRun?: string;
        lastError?: string;
    };
    lastRestoredAt?: string;
};
export type Envelope = {
    state: PlannerState;
    revision: number;
    updatedAt: string;
};
export type Command = {
    type: string;
    [key: string]: unknown;
};
export function initialSubjects():Subject[]{const groups:Record<string,string[]>={school:AREAS.filter(a=>!['Reading','Fitness','Wellbeing','Projects'].includes(a)),beyond:['Reading'],life:['Fitness','Wellbeing'],projects:['Computer Science','Projects']};return Object.entries(groups).flatMap(([listId,areas])=>areas.map((title,i)=>({id:`subject:${listId}:${i}`,title,listId,seeded:true})));}
export function initialState(): PlannerState { return { economy:newEconomy(), subjects: initialSubjects(), schemaVersion: SCHEMA_VERSION, settings: { taskDisplay:defaultTaskDisplay(),theme:"night-stadium",avatar:defaultAvatar(),reduceMotion:false,name: "Ryan", language: "en", timezone: "Asia/Shanghai", quietStart: "22:00", quietEnd: "08:00", push: false, deadlineAlerts: true, sound: false, mutedAreas: [], integrationsPaused: false, dailyNudge: "17:00", carryoverTime: "09:00", reviewTime: "20:30", unlocked: ["academyKit"], placed: ["cottage"], equipped: ["academyKit"], characterClass: "Scholar", position: "CM", playerNumber: 8 }, tasks: [], blocks: [], sessions: [], activeSession: null, habits: [], habitChecks: {}, rewards: [], reminders: [], outbox: [], lists: [{ id: "school", title: "School", mode: "fresh" }, { id: "beyond", title: "Beyond the classroom", mode: "fresh" }, { id: "life", title: "Life & wellbeing", mode: "fresh" }, { id: "projects", title: "Personal projects", mode: "fresh" }], connections: {}, proposals: [], service: {} }; }
export function totalXP(s: PlannerState) { return s.rewards.reduce((n, r) => n + (r.active ? r.points : 0), 0); }
export function level(s: PlannerState) { return 1 + Math.floor(totalXP(s) / 100); }
export function localDay(date: Date | string = new Date(), timezone = "Asia/Shanghai") { const p = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(date)); return ["year", "month", "day"].map(k => p.find(v => v.type === k)?.value).join("-"); }
export function clockInZone(date: Date | string, timezone = "Asia/Shanghai") { return new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(date)); }
export function zonedTime(day: string, time: string, timezone = "Asia/Shanghai") { const expected = new Date(`${day}T${time}:00Z`).getTime(); let utc = expected; for (let i = 0; i < 3; i++) {
    const date = new Date(utc);
    const display = localDay(date, timezone) + "T" + clockInZone(date, timezone) + ":00Z";
    utc += expected - new Date(display).getTime();
} return new Date(utc).toISOString(); }
export function activeSeconds(a: ActiveSession, at = new Date()) { const stop = a.pausedAt ? new Date(a.pausedAt).getTime() : at.getTime(); return Math.max(0, Math.min(a.target, Math.floor((stop - new Date(a.startedAt).getTime()) / 1000) - a.pausedSeconds)); }
export function safeTitle(value: unknown) { if (typeof value !== "string" || !value.trim() || value.trim().length > 300)
    throw new Error("Please enter a title of 1–300 characters."); return value.trim(); }
export function migrateState(value: unknown): PlannerState { const base = initialState(); const s = value as Partial<PlannerState>; if (!s || typeof s !== "object" || Number(s.schemaVersion || 1) > SCHEMA_VERSION)
    throw new Error("This data was created by a newer version. Update Questbound FC before restoring it."); const legacy: Record<string, string> = { cottage: "academyKit", tunic: "academyKit", library: "boots", staff: "boots", training: "kit", cloak: "kit", workshop: "armband", sword: "armband", boat: "celebration", companion: "celebration", garden: "goldboots", amulet: "goldboots", lighthouse: "banner", codex: "banner" }; const settings = { ...base.settings, ...s.settings };
    settings.theme=migrateTheme(s.settings?.theme); settings.taskDisplay=migrateTaskDisplay(s.settings?.taskDisplay); settings.avatar=migrateAvatar(s.settings?.avatar); settings.unlocked = Array.from(new Set(["academyKit", ...(s.settings?.unlocked || []).map(id => legacy[id] || id)])); settings.equipped = Array.from(new Set(["academyKit", ...((s.settings?.equipped || s.settings?.placed || []).map(id => legacy[id] || id))])).filter(id => settings.unlocked.includes(id)); const result={ ...base, ...s, settings, schemaVersion: SCHEMA_VERSION };if(!s.economy)result.economy=newEconomy(result);if(!s.subjects){result.subjects=initialSubjects().filter(x=>result.lists.some(l=>l.id===x.listId));for(const task of result.tasks){let subject=result.subjects.find(x=>x.listId===task.listId&&x.title===task.area);if(!subject){subject={id:`legacy-subject:${task.listId}:${encodeURIComponent(task.area)}`,title:task.area,listId:task.listId,seeded:true};result.subjects.push(subject)}}}result.tasks=result.tasks.map(task=>{const date=task.remoteDue?.date;if(task.plannedTime===undefined&&task.plannedOn&&typeof date==='string'&&date.includes('T')){const time=/(?:Z|[+-]\d{2}:\d{2})$/i.test(date)&&Number.isFinite(Date.parse(date))?clockInZone(date,settings.timezone):date.slice(11,16);if(/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return {...task,plannedTime:time,...(task.syncBase?{syncBase:{...task.syncBase,plannedTime:time}}:{})}}return task});return result; }
