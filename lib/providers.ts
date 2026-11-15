import {writeEventTimes,calendarInstant} from "./ical";
import {isICloudCalendarURL,fetchICloudResource} from "./icloud-address";
import {providerRetry} from './provider-retry';
import { DAVClient } from "tsdav";
import ICAL from "ical.js";
import { database, readState, serviceChange, AppError,assertLegacyWritable } from "./store";
import { getSecret, putSecret, removeSecret } from "./secrets";
import { makeTask, reduceCommand, rebuildReminders } from "./domain";
import { localDay, type PlannerState, type TimeBlock, type OutboxItem } from "./model";
import { hash } from "./crypto";
import {syncTodoist,sendTodoist} from './todoist-provider';
export {todoist,connectTodoist,todoistPreview,importTodoist,syncTodoist} from './todoist-provider';
type CalendarInfo = {
    url: string;
    displayName?: string;
    components?: string[];
    privilegeSet?: string[];
};
type CalendarObject = {
    url: string;
    etag?: string;
    data?: string;
};
type ICloudSecret = {
    username: string;
    password: string;
    calendars: CalendarInfo[];
};
async function davClient(owner: string) { const secret = await getSecret<ICloudSecret>(owner, "icloud"); if (!secret)
    throw new AppError("Connect iCloud Calendar first."); const client = new DAVClient({ serverUrl: "https://caldav.icloud.com", credentials: { username: secret.username, password: secret.password }, authMethod: "Basic", defaultAccountType: "caldav", fetch: async (input: RequestInfo | URL, init?: RequestInit) => { const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url); if (!isICloudCalendarURL(url))
        throw new Error("Unexpected iCloud calendar address."); return fetch(input, { ...init, signal: AbortSignal.timeout(20000) }); } }); await client.login(); return client; }
export async function connectICloud(owner: string, username: string, password: string) { await putSecret(owner, "icloud", { username, password, calendars: [] }); try {
    const client = await davClient(owner);
    const cals = await client.fetchCalendars();
    await putSecret(owner, "icloud", { username, password, calendars: cals });
    await serviceChange(owner, s => { s.connections.icloud = { connected: true, calendars: cals.map((c, i) => ({ id: c.url, title: typeof c.displayName === "string" ? c.displayName : `Calendar ${i + 1}`, read: true, write: false })) }; return s; });
    return cals.map((c, i) => ({ id: c.url, title: typeof c.displayName === "string" ? c.displayName : `Calendar ${i + 1}` }));
}
catch (e) {
    await removeSecret(owner, "icloud");
    throw new AppError("iCloud could not connect. Check your Apple Account email and app-specific password.", 502);
} }
export async function calendarSelection(owner: string, selection: {
    id: string;
    read: boolean;
    write: boolean;
}[]) { const secret = await getSecret<ICloudSecret>(owner, "icloud"); if (!secret)
    throw new AppError("Connect iCloud first."); return serviceChange(owner, s => { s.connections.icloud.calendars = s.connections.icloud.calendars?.map(c => ({ ...c, read: !!selection.find(x => x.id === c.id)?.read, write: !!selection.find(x => x.id === c.id)?.write })); return s; }); }
export async function createPlannerCalendar(owner: string) {
    const client = await davClient(owner);
    let calendars = await client.fetchCalendars();
    // Reuse an existing planner calendar, including one made in Apple Calendar.
    // Repeated clicks must never create several calendars with the same name.
    if (!calendars.some(c => c.displayName === "Questbound FC")) {
        const principal = client.account?.homeUrl;
        if (!principal) throw new AppError("iCloud calendar discovery is incomplete. Reconnect iCloud.");
        const url = principal.replace(/\/?$/, "/") + `quest-island-${crypto.randomUUID()}/`;
        try {
            const responses = await client.makeCalendar({ url, props: { "d:displayname": "Questbound FC" } });
            if (!responses.length || !responses.every(r => r.status >= 200 && r.status < 300)) throw new Error("Creation refused");
        } catch {
            throw new AppError("Create a calendar named Questbound FC in Apple Calendar, then click this button again to connect it.", 502);
        }
        calendars = await client.fetchCalendars();
    }
    const planner = calendars.find(c => c.displayName === "Questbound FC");
    if (!planner) throw new AppError("iCloud calendar discovery is incomplete. Reconnect iCloud.");
    const secret = await getSecret<ICloudSecret>(owner, "icloud");
    if (!secret) throw new AppError("Connect iCloud first.");
    await putSecret(owner, "icloud", { ...secret, calendars });
    await serviceChange(owner, s => {
        const previous = s.connections.icloud.calendars || [];
        s.connections.icloud.calendars = calendars.map((c, i) => ({
            id: c.url, title: typeof c.displayName === "string" ? c.displayName : `Calendar ${i + 1}`,
            read: c.url === planner.url || !!previous.find(p => p.id === c.url)?.read,
            write: c.url === planner.url || !!previous.find(p => p.id === c.url)?.write,
        }));
        return s;
    });
}
import { parseICS, mergeCalendarBlocks } from "./ical";
export async function syncICloud(owner: string) {
    const { state } = await readState(owner);
    const client = await davClient(owner);
    const secret = await getSecret<ICloudSecret>(owner, "icloud");
    if (!secret)
        return;
    const from = new Date(Date.now() - 90 * 86400000), to = new Date(Date.now() + 180 * 86400000);
    const fetched: TimeBlock[] = [];
    const cache: Record<string, CalendarObject> = {};
    const verifiedResources = new Set<string>(), deletedResources = new Set<string>();
    for (const selection of state.connections.icloud?.calendars || []) {
        if (!selection.read)
            continue;
        const calendar = secret.calendars.find(c => c.url === selection.id);
        if (!calendar)
            continue;
        const objects = await client.fetchCalendarObjects({ calendar, timeRange: { start: from.toISOString(), end: to.toISOString() } });
        for (const object of objects) {
            if (!object.data)
                continue;
            cache[object.url] = object;
            verifiedResources.add(object.url);
            fetched.push(...parseICS(object.data, selection.id, object.url, object.etag, !selection.write, from, to));
        }
        // A bounded collection query cannot prove deletion. Verify absent resources individually.
        const absent = [...new Set(state.blocks.filter(b => b.calendarId === selection.id && b.remoteId && !verifiedResources.has(b.remoteId) && Date.parse(b.start) < to.getTime() && Date.parse(b.end) > from.getTime()).map(b => b.remoteId!))].slice(0, 20);
        for (const resource of absent) {
            const url = new URL(resource), cal = new URL(selection.id);
            if (!isICloudCalendarURL(url) || url.origin !== cal.origin || !url.pathname.startsWith(cal.pathname))
                continue;
            const response = await fetchICloudResource(url, "Basic " + btoa(secret.username + ":" + secret.password));
            if (response.status === 404) {
                deletedResources.add(resource);
                continue;
            }
            if (!response.ok)
                throw new AppError("An existing iCloud event could not be verified. Its previous copy has been preserved.", 502);
            const object = { url: resource, etag: response.headers.get("etag") || undefined, data: await response.text() };
            cache[resource] = object;
            verifiedResources.add(resource);
            fetched.push(...parseICS(object.data, selection.id, resource, object.etag, !selection.write, from, to));
        }
    }
    await putSecret(owner, "icloud-cache", cache);
    await serviceChange(owner, s => { const pending = new Set(s.outbox.filter(o => o.provider === "icloud").map(o => o.entityId)); s.blocks = mergeCalendarBlocks(s.blocks, fetched, pending, { from, to, verifiedResources, deletedResources }); s.connections.icloud = { ...s.connections.icloud, connected: true, lastSync: new Date().toISOString(), error: undefined }; return rebuildReminders(s, new Date()); });
}
async function sendICloud(owner: string, item: OutboxItem, s: PlannerState) {
    const client = await davClient(owner);
    const block = s.blocks.find(b => b.id === item.entityId) || (item.payload as TimeBlock);
    if (!block)
        return;
    const permitted = s.connections.icloud?.calendars?.find(c => c.id === block.calendarId && c.write);
    if (!permitted)
        throw new AppError("Enable editing for this calendar in Settings.");
    const cache = await getSecret<Record<string, CalendarObject>>(owner, "icloud-cache") || {};
    let original = block.remoteId ? cache[block.remoteId] : undefined;
    let response: Response;
    if (block.remoteId && !original) {
        const secret = await getSecret<ICloudSecret>(owner, "icloud");
        const address = new URL(block.remoteId);
        const calendarAddress = new URL(permitted.id);
        if (!isICloudCalendarURL(address) || address.origin !== calendarAddress.origin || !address.pathname.startsWith(calendarAddress.pathname))
            throw new AppError("Calendar resource does not belong to the selected calendar.");
        if (!secret)
            throw new AppError("Reconnect iCloud.");
        const response = await fetchICloudResource(address, "Basic " + btoa(secret.username + ":" + secret.password));
        if (response.status === 404 && item.action === "block.delete")
            return;
        if (!response.ok)
            throw new AppError("The remote calendar event could not be verified. Refresh iCloud first.", 502);
        original = { url: address.toString(), etag: response.headers.get("etag") || undefined, data: await response.text() };
    }
    if (original && block.etag && original.etag !== block.etag)
        throw new AppError("This event changed in Apple Calendar. Review the sync conflict in Settings.", 409);
    if (item.action === "block.delete") {
        if (!original)
            throw new AppError("A calendar deletion needs a verified remote event. Refresh iCloud first.", 409);
        if (block.occurrenceKey && block.scope !== "series") {
            const root = new ICAL.Component(ICAL.parse(original.data!));
            const master = root.getAllSubcomponents("vevent").find(c => !c.hasProperty("recurrence-id"));
            if (!master)
                throw new Error("Calendar series not found.");
            master.addPropertyWithValue("exdate", ICAL.Time.fromString(block.occurrenceKey, undefined));
            response = await client.updateCalendarObject({ calendarObject: { ...original, data: root.toString() } });
        }
        else
            response = await client.deleteCalendarObject({ calendarObject: original });
    }
    else {
        const root = original ? new ICAL.Component(ICAL.parse(original.data!)) : new ICAL.Component(["vcalendar", [], []]);
        root.updatePropertyWithValue("version", "2.0");
        root.updatePropertyWithValue("prodid", "-//Quest Island//Planner//EN");
        let component = root.getAllSubcomponents("vevent").find(c => !c.hasProperty("recurrence-id"));
        if (!component) {
            component = new ICAL.Component("vevent");
            component.updatePropertyWithValue("uid", block.icalUid || `qi-${block.id}`);
            root.addSubcomponent(component);
        }
        if (original && block.occurrenceKey && block.scope !== "series") {
            const recurrence = ICAL.Time.fromString(block.occurrenceKey, undefined);
            let exception = root.getAllSubcomponents("vevent").find(c => String(c.getFirstPropertyValue("recurrence-id")) === block.occurrenceKey);
            if (!exception) {
                exception = new ICAL.Component("vevent");
                exception.updatePropertyWithValue("uid", component.getFirstPropertyValue("uid"));
                exception.updatePropertyWithValue("recurrence-id", recurrence);
                root.addSubcomponent(exception);
            }
            component = exception;
        }
        let eventStart = block.start, eventEnd = block.end;
        if (original && block.scope === "series" && block.occurrenceKey) {
            const originalStart = Date.parse(calendarInstant(component.getFirstPropertyValue("dtstart") as ICAL.Time));
            const occurrence = Date.parse(calendarInstant(ICAL.Time.fromString(block.occurrenceKey, undefined)));
            eventStart = new Date(originalStart + Date.parse(block.start) - occurrence).toISOString();
            eventEnd = new Date(Date.parse(eventStart) + Date.parse(block.end) - Date.parse(block.start)).toISOString();
        }
        component.updatePropertyWithValue("summary", block.title);
        writeEventTimes(component,eventStart,eventEnd,block.allDay);
        component.updatePropertyWithValue("dtstamp", ICAL.Time.fromJSDate(new Date(), true));
        if (!original)
            component.removeAllSubcomponents("valarm");
        if (!original && block.repeat !== "none")
            component.updatePropertyWithValue("rrule", ICAL.Recur.fromString(`FREQ=${block.repeat.toUpperCase()}`));
        if (original)
            response = await client.updateCalendarObject({ calendarObject: { ...original, data: root.toString() } });
        else {
            const secret = await getSecret<ICloudSecret>(owner, "icloud");
            const calendar = secret?.calendars.find(c => c.url === block.calendarId);
            if (!calendar)
                throw new Error("Calendar not found.");
            response = await client.createCalendarObject({ calendar, filename: `qi-${block.id}.ics`, iCalString: root.toString(), headers: { "If-None-Match": "*" } });
            if (response.ok)
                await serviceChange(owner, s => { const b = s.blocks.find(b => b.id === block.id); if (b) {
                    b.remoteId = response.url || new URL(`qi-${block.id}.ics`, calendar.url).toString();
                    b.icalUid = `qi-${block.id}`;
                } return s; });
        }
    }
    // A retried DELETE may reach Apple after the first request already succeeded.
    // An absent resource is the requested final state, not a failed edit.
    if (item.action === "block.delete" && response.status === 404) return;
    if (!response.ok)
        throw new AppError(response.status === 412 ? "This calendar event changed in Apple Calendar. Refresh and review both versions." : `iCloud did not accept this edit (${response.status}).`, response.status === 412 ? 409 : 502);
}
export async function flushOutbox(owner: string) {
    const { state } = await readState(owner);
    if (state.settings.integrationsPaused)
        return;
    for (const item of state.outbox.filter(o => !o.conflict&&Date.parse(o.nextAttempt) <= Date.now()).slice(0, 40)) {
        const latestQueue=(await readState(owner)).state.outbox;if(latestQueue.find(o=>o.entityId===item.entityId&&o.provider===item.provider)?.id!==item.id)continue;
        const entityTag = `entity:${item.provider}:${item.entityId}`, lease = `locked:${crypto.randomUUID()}`, at = new Date().toISOString();
        await database().prepare("INSERT OR IGNORE INTO qi_deliveries(owner,tag,device,status,at) VALUES(?,?,'lock','free',?)").bind(owner, entityTag, at).run();
        const lock = await database().prepare("UPDATE qi_deliveries SET status=?,at=? WHERE owner=? AND tag=? AND device='lock' AND (status='free' OR at<?)").bind(lease, at, owner, entityTag, new Date(Date.now() - 300000).toISOString()).run();
        if (!lock.meta.changes)
            continue;
        try {
            const tag = `outbox:${item.id}`;
            await database().prepare("INSERT OR IGNORE INTO qi_deliveries(owner,tag,device,status,at) VALUES(?,?,'provider','pending',?)").bind(owner, tag, at).run();
            const previous = await database().prepare("SELECT status FROM qi_deliveries WHERE owner=? AND tag=? AND device='provider'").bind(owner, tag).first<{
                status: string;
            }>();
            if (previous?.status === "accepted") {
                await serviceChange(owner, s => { s.outbox = s.outbox.filter(o => o.id !== item.id); return s; });
                continue;
            }
            const claimed = await database().prepare("UPDATE qi_deliveries SET status='sending',at=? WHERE owner=? AND tag=? AND device='provider' AND (status='pending' OR (status='sending' AND at<?))").bind(at, owner, tag, new Date(Date.now() - 300000).toISOString()).run();
            if (!claimed.meta.changes)
                continue;
            try {
                const latest = await readState(owner);
                if (!latest.state.outbox.some(o => o.id === item.id))
                    continue;
                if (item.provider === "todoist")
                    await sendTodoist(owner, item, latest.state);
                else
                    await sendICloud(owner, item, latest.state);
                await database().prepare("UPDATE qi_deliveries SET status='accepted',at=? WHERE owner=? AND tag=? AND device='provider'").bind(new Date().toISOString(), owner, tag).run();
                await serviceChange(owner, s => { s.outbox = s.outbox.filter(o => o.id !== item.id); return s; });
            }
            catch (e) {
                await database().prepare("UPDATE qi_deliveries SET status='pending',error=? WHERE owner=? AND tag=? AND device='provider'").bind(e instanceof Error ? e.message : "Provider failed", owner, tag).run();
                await serviceChange(owner, s => { const o = s.outbox.find(o => o.id === item.id); if (o) {
                    Object.assign(o,providerRetry(e,o.attempts));
                } return s; });
            }
        }
        finally {
            await database().prepare("UPDATE qi_deliveries SET status='free',at=? WHERE owner=? AND tag=? AND device='lock' AND status=?").bind(new Date().toISOString(), owner, entityTag, lease).run();
        }
    }
}
export async function syncProviders(owner:string,force=false){
 assertLegacyWritable();
 const {state}=await readState(owner);if(state.settings.integrationsPaused&&!force)return;
 for(const [name,fn]of [['todoist',syncTodoist],['icloud',syncICloud]] as const){if(!state.connections[name]?.connected)continue;try{await fn(owner,force)}catch(e){await serviceChange(owner,s=>{s.connections[name]={...s.connections[name],connected:true,error:e instanceof Error?e.message:'Connection unavailable'};return s})}}
 if(!force){await flushOutbox(owner);if(state.connections.todoist?.connected)try{await syncTodoist(owner)}catch(e){await serviceChange(owner,s=>{s.connections.todoist.error=e instanceof Error?e.message:'Connection unavailable';return s})}}
}

export type OneDriveSecret = {
    clientId: string;
    clientSecret: string;
    access_token?: string;
    refresh_token?: string;
    expiresAt?: number;
    folderId?: string;
};
export async function oneDriveToken(owner: string) { const secret = await getSecret<OneDriveSecret>(owner, "onedrive"); if (!secret?.refresh_token)
    throw new AppError("Connect OneDrive in Settings to save cloud backups."); if (!secret.access_token || !secret.expiresAt || secret.expiresAt < Date.now() + 60000) {
    const r = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: secret.clientId, client_secret: secret.clientSecret, grant_type: "refresh_token", refresh_token: secret.refresh_token, scope: "offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder" }) });
    const data = await r.json() as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
    };
    if (!r.ok || !data.access_token)
        throw new AppError("OneDrive needs to be reconnected.", 502);
    secret.access_token = data.access_token;
    secret.refresh_token = data.refresh_token || secret.refresh_token;
    secret.expiresAt = Date.now() + (data.expires_in || 3600) * 1000;
    await putSecret(owner, "onedrive", secret);
} return secret.access_token; }
export async function graph(owner: string, path: string, init: RequestInit = {}) { const token = await oneDriveToken(owner); const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` }, redirect: "manual" }); if (!response.ok && response.status !== 302)
    throw new AppError(`OneDrive could not complete this action (${response.status}).`, 502); return response; }
export async function backupFolder(owner: string) { const secret = await getSecret<OneDriveSecret>(owner, "onedrive"); if (secret?.folderId)
    return secret.folderId; const root = await (await graph(owner, "/me/drive/special/approot")).json() as {
    id: string;
}; const children = await (await graph(owner, `/me/drive/items/${encodeURIComponent(root.id)}/children`)).json() as {
    value: {
        id: string;
        name: string;
    }[];
}; let folder = children.value.find(x => x.name === "Backups"); if (!folder)
    folder = await (await graph(owner, `/me/drive/items/${encodeURIComponent(root.id)}/children`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Backups", folder: {}, "@microsoft.graph.conflictBehavior": "fail" }) })).json() as {
        id: string;
        name: string;
    }; if (!folder?.id)
    throw new Error("OneDrive backup folder is unavailable."); await putSecret(owner, "onedrive", { ...secret, folderId: folder.id }); return folder.id; }
export async function uploadOneDrive(owner: string, id: string, bytes: Uint8Array) { const folder = await backupFolder(owner); const file = await (await graph(owner, `/me/drive/items/${encodeURIComponent(folder)}:/${encodeURIComponent(id + ".qibak")}:/content`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: bytes as BodyInit })).json() as {
    id: string;
}; const r = await graph(owner, `/me/drive/items/${encodeURIComponent(file.id)}/content`); let downloaded: Response; if (r.status === 302) {
    const location = r.headers.get("location");
    if (!location || new URL(location).protocol !== "https:")
        throw new Error("Unexpected OneDrive download address.");
    downloaded = await fetch(location);
}
else
    downloaded = r; if (!downloaded.ok || await hash(new Uint8Array(await downloaded.arrayBuffer())) !== await hash(bytes))
    throw new Error("OneDrive upload could not be verified. The previous backups remain available."); return file.id; }
