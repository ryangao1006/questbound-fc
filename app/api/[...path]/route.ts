import {readCareer,readCareerDocument,careerObject} from "@/lib/career-storage";
import {careerCommand,activeMatch,replayBundle} from "@/lib/career-service";
import type {CareerCommand} from "@/lib/football-model";
import {matchesPrecondition,type CommandPrecondition} from "@/lib/command-rebase";
import {backgroundProviderJob} from "@/lib/provider-jobs";
import { env } from "cloudflare:workers";
import { requester, sameOrigin, json, failure, readState, commit, database, AppError, serviceChange, assertLegacyWritable,isLegacyReadOnly } from "@/lib/store";
import { reduceCommand } from "@/lib/domain";
import { base64url, hash, newKey } from "@/lib/crypto";
import { getSecret, putSecret, removeSecret } from "@/lib/secrets";
import { backupList, backupBytes, createBackup, recoveryKey, stageRestore, restoreBackup } from "@/lib/backups";
import { connectTodoist, todoistPreview, importTodoist, connectICloud, calendarSelection, createPlannerCalendar, syncProviders, type OneDriveSecret } from "@/lib/providers";
import { vapidKeys, registerDevice, testPush, runAllServices, runService } from "@/lib/reminder-service";
import type { Command } from "@/lib/model";
export const dynamic = "force-dynamic";
const pathOf = (r: Request) => new URL(r.url).pathname.replace(/^\/api\//, "");
async function helperOwner(req: Request) { const auth = req.headers.get("authorization")?.replace(/^Bearer /, ""); if (!auth)
    throw new AppError("Backup helper needs reconnecting.", 401); const tokenHash = await hash(auth); const row = await database().prepare("SELECT id,owner FROM qi_helpers WHERE token_hash=? AND revoked=0").bind(tokenHash).first<{
    id: string;
    owner: string;
}>(); if (!row)
    throw new AppError("Backup helper token is invalid or revoked.", 401); await database().prepare("UPDATE qi_helpers SET last_seen=? WHERE id=?").bind(new Date().toISOString(), row.id).run(); return row.owner; }
export async function GET(req: Request) { try {
    const path = pathOf(req);
    if (path.startsWith("helper/")) {
        const owner = await helperOwner(req);
        if (path === "helper/backups")
            return json({ backups: await backupList(owner) });
        if (path.startsWith("helper/download/")) {
            const { row, bytes } = await backupBytes(owner, path.split("/").at(-1)!);
            return new Response(bytes as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Cache-Control": "no-store", "X-Checksum-Sha256": row.checksum } });
        }
        throw new AppError("Not found", 404);
    }
    const owner = await requester(req);
    if (path === "state"){const value=await readState(owner);const c=value.state.connections.todoist;if(c?.connected&&!isLegacyReadOnly()&&!value.state.settings.integrationsPaused&&(!c.structureSyncedAt||Date.parse(c.lastSync||'1970-01-01')<Date.now()-45000))backgroundProviderJob(syncProviders(owner));return json(value);}
    if(path==="career/profile"){const saved=await readCareerDocument(owner);return json({profile:saved?{name:saved.state.player.name,number:saved.state.player.number,position:saved.state.player.position}:null});}
    if(path==="career/state")return json(await readCareer(owner));
    if(path==="career/match")return json(await activeMatch(owner));
    if(path.startsWith("career/replay/"))return json(await replayBundle(owner,decodeURIComponent(path.slice("career/replay/".length))));
    if(path.startsWith("career/objects/"))return json(await careerObject(owner,decodeURIComponent(path.slice("career/objects/".length))));
    if (path === "backups")
        return json({ backups: await backupList(owner), ready: !!await getSecret(owner, "recovery") });
    if (path.startsWith("backups/download/")) {
        const { row, bytes } = await backupBytes(owner, path.split("/").at(-1)!);
        return new Response(bytes as BodyInit, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="quest-island-${row.created_at.slice(0, 19).replaceAll(":", "-")}.qibak"`, "Cache-Control": "private, no-store" } });
    }
    if (path === "connections/todoist/preview")
        return json(await todoistPreview(owner, new URL(req.url).searchParams.get("project") || ""));
    if (path === "devices")
        return json({ devices: (await database().prepare("SELECT id,label,enabled,updated_at FROM qi_devices WHERE owner=?").bind(owner).all()).results });
    if (path === "connections/onedrive/callback")
        return oneDriveCallback(owner, req);
    throw new AppError("Not found", 404);
}
catch (e) {
    return failure(e);
} }
export async function POST(req: Request) {
    try {
        const path = pathOf(req);
        if (path === "service/run" || path === "service/bootstrap-helper") {
            const expected = env.SERVICE_SECRET;
            const actual = req.headers.get("authorization")?.replace(/^Bearer /, "") || "";
            if (!expected || await hash(actual) !== await hash(expected))
                throw new AppError("Background service authentication required.", 401);
            if (path === "service/run")
                return json({ results: await runAllServices() });
            const owners = (await database().prepare("SELECT owner FROM qi_states LIMIT 2").all<{
                owner: string;
            }>()).results;
            if (owners.length !== 1)
                throw new AppError("Sign in to the private planner before setting up its Mac companion. Multiple owners require individual enrollment.", 409);
            return json(await enrollBackupHelper(owners[0].owner, env.PUBLIC_SITE_URL || new URL(req.url).origin));
        }
        if (path === "helper/pre-update") {
            const owner = await helperOwner(req);
            return json(await createBackup(owner, "pre-update"));
        }
        if (path === "helper/ack") {
            const owner = await helperOwner(req);
            const data = await req.json() as {
                id: string;
                checksum: string;
                oneDrive?: boolean;
            };
            const row = await database().prepare("SELECT checksum FROM qi_backups WHERE id=? AND owner=? AND verified=1").bind(data.id, owner).first<{
                checksum: string;
            }>();
            if (!row || row.checksum !== data.checksum)
                throw new AppError("Local checksum does not match the verified archive.");
            await database().prepare("UPDATE qi_backups SET local_at=? WHERE id=? AND owner=?").bind(new Date().toISOString(), data.id, owner).run();
            return json({ verified: true });
        }
        sameOrigin(req);
        const owner = await requester(req);
        if(!["backups/setup","backups/create","helper/enroll"].includes(path))assertLegacyWritable();
        if (path === "restore/preview") {
            const form = await req.formData();
            const file = form.get("archive");
            if (!(file instanceof File))
                throw new AppError("Choose a Quest Island backup archive.");
            if (file.size > 20 * 1024 * 1024)
                throw new AppError("Archive exceeds 20 MB.");
            return json(await stageRestore(owner, new Uint8Array(await file.arrayBuffer()), String(form.get("key") || "")));
        }
        const b = await req.json() as Record<string, unknown>;
        if(path==="career/command")return json(await careerCommand(owner,Number(b.revision),String(b.operationId||""),b.command as CareerCommand));
        if (path === "command") {
            const command = b.command as Command;
            if (!command || typeof command.type !== "string")
                throw new AppError("Choose a planner action.");
            let result;try{result=await commit(owner,Number(b.revision),String(b.operationId||''),s=>reduceCommand(s,command));}catch(original){if(!(original instanceof AppError)||original.status!==409)throw original;for(let attempt=0;attempt<4;attempt++){const fresh=await readState(owner);if(!matchesPrecondition(command,b.precondition as CommandPrecondition|undefined,fresh.state))throw original;try{result=await commit(owner,fresh.revision,String(b.operationId||''),s=>reduceCommand(s,command));break}catch(e){if(!(e instanceof AppError)||e.status!==409||attempt===3)throw e;}}if(!result)throw original;}
            if(result.state.outbox.length)backgroundProviderJob(syncProviders(owner));return json(result);
        }
        if (path === "backups/setup") {
            const key = await recoveryKey(owner, true);
            return json({ key });
        }
        if (path === "backups/create")
            return json(await createBackup(owner, b.kind === "pre-update" ? "pre-update" : "manual"));
        if (path === "restore/commit")
            return json(await restoreBackup(owner, String(b.id), Number(b.revision), String(b.operationId)));
        if (path === "helper/enroll")
            return json(await enrollBackupHelper(owner, new URL(req.url).origin));
        if (path === "connections/todoist")
            return json(await connectTodoist(owner, String(b.token || "")));
        if (path === "connections/todoist/import")
            return json(await importTodoist(owner, String(b.project), b.mode === "sync" ? "sync" : "import", Array.isArray(b.selected) ? b.selected.map(String) : []));
        if (path === "connections/icloud")
            return json(await connectICloud(owner, String(b.username || ""), String(b.password || "")));
        if (path === "connections/icloud/calendars")
            return json(await calendarSelection(owner, b.selection as {
                id: string;
                read: boolean;
                write: boolean;
            }[]));
        if (path === "connections/icloud/create-calendar") {
            await createPlannerCalendar(owner);
            return json({ ok: true });
        }
        if (path === "connections/onedrive/start")
            return startOneDrive(owner, req, String(b.clientId || ""), String(b.clientSecret || ""));
        if (path === "connections/disconnect") {
            const provider = String(b.provider);
            if (!["icloud", "todoist", "onedrive"].includes(provider))
                throw new AppError("Unknown connection.");
            await removeSecret(owner, provider);
            return json(await serviceChange(owner, s => { s.connections[provider] = { connected: false }; return s; }));
        }
        if (path === "connections/resume") {
            await syncProviders(owner, true);
            const fresh = await readState(owner);
            if (["todoist", "icloud"].some(k => fresh.state.connections[k]?.connected && fresh.state.connections[k].error))
                throw new AppError("Reconnect or disconnect unavailable sources before resuming. Your restored records remain safe.", 409);
            return json(await serviceChange(owner, s => { s.settings.integrationsPaused = false; return s; }));
        }
        if (path === "connections/resolve") {
            const jobId = String(b.jobId);
            const choice = String(b.choice);
            await serviceChange(owner, s => { const item = s.outbox.find(o => o.id === jobId); if (!item)
                return s; if (choice === "provider")
                s.outbox = s.outbox.filter(o => o.provider!==item.provider||o.entityId!==item.entityId);
            else {
                item.status = "pending";
                item.nextAttempt = new Date().toISOString();
                item.error = undefined;item.conflict=false;item.payload.force=true;
            } return s; });
            if (choice === "provider")
                await syncProviders(owner, true);
            else
                await syncProviders(owner);
            return json(await readState(owner));
        }
        if (path === "sync") {
            await syncProviders(owner);
            return json(await readState(owner));
        }
        if (path === "push/key")
            return json({ publicKey: (await vapidKeys(owner)).publicKey });
        if (path === "push/register") {
            await registerDevice(owner, String(b.id), b.subscription as Parameters<typeof registerDevice>[2], String(b.label || "This device"));
            return json({ ok: true });
        }
        if (path === "push/test")
            return json({ accepted: await testPush(owner) });
        if (path === "push/disable") {
            await database().prepare("UPDATE qi_devices SET enabled=0 WHERE id=? AND owner=?").bind(String(b.id), owner).run();
            return json({ ok: true });
        }
        if (path === "service/check")
            return json(await runService(owner));
        throw new AppError("Not found", 404);
    }
    catch (e) {
        return failure(e);
    }
}
async function startOneDrive(owner: string, req: Request, clientId: string, clientSecret: string) { if (!/^[\w-]{20,80}$/.test(clientId) || !clientSecret)
    throw new AppError("Enter the Microsoft app client ID and secret from your app registration."); const state = newKey(), verifier = newKey() + newKey(); const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)))); const callback = new URL("/api/connections/onedrive/callback", req.url).toString(); await putSecret(owner, "onedrive-pending", { state, verifier, expiresAt: Date.now() + 600000, clientId, clientSecret, callback }); const params = new URLSearchParams({ client_id: clientId, response_type: "code", redirect_uri: callback, response_mode: "query", scope: "offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder", state, code_challenge: challenge, code_challenge_method: "S256" }); return json({ url: `https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?${params}` }); }
async function oneDriveCallback(owner: string, req: Request) { const pending = await getSecret<{
    state: string;
    verifier: string;
    expiresAt: number;
    clientId: string;
    clientSecret: string;
    callback: string;
}>(owner, "onedrive-pending"); await removeSecret(owner, "onedrive-pending"); const url = new URL(req.url); if (!pending || pending.state !== url.searchParams.get("state") || pending.expiresAt < Date.now())
    throw new AppError("OneDrive sign-in expired. Start again in Settings."); const code = url.searchParams.get("code"); if (!code)
    throw new AppError("OneDrive connection was not authorised."); const response = await fetch("https://login.microsoftonline.com/consumers/oauth2/v2.0/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: pending.clientId, client_secret: pending.clientSecret, grant_type: "authorization_code", code, redirect_uri: pending.callback, code_verifier: pending.verifier, scope: "offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder" }) }); const data = await response.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
}; if (!response.ok || !data.access_token || !data.refresh_token)
    throw new AppError("Microsoft could not complete the connection. Check the registered callback address."); await putSecret(owner, "onedrive", { clientId: pending.clientId, clientSecret: pending.clientSecret, ...data, expiresAt: Date.now() + (data.expires_in || 3600) * 1000 } satisfies OneDriveSecret); await serviceChange(owner, s => { s.connections.onedrive = { connected: true, lastSync: new Date().toISOString() }; return s; }); return Response.redirect(new URL("/?view=settings&connected=onedrive", req.url), 303); }
async function enrollBackupHelper(owner: string, siteUrl: string) {
    if (!env.SITES_SERVICE_ACCESS_TOKEN)
        throw new AppError("Private-site backup access needs configuring.", 503);
    await recoveryKey(owner, true);
    await createBackup(owner, "manual");
    const id = crypto.randomUUID(), token = newKey();
    await database().prepare("INSERT INTO qi_helpers(id,owner,token_hash) VALUES(?,?,?)").bind(id, owner, await hash(token)).run();
    return { id, token, recoveryKey: await recoveryKey(owner, true), siteUrl, siteAccessToken: env.SITES_SERVICE_ACCESS_TOKEN };
}
