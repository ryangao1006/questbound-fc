import {reconcileEconomy} from './economy';
import {availableSquadNumbers,precisePosition} from './football-career';
import {readCareerDocument,readPrivateObject,receiptStatement} from "./career-storage";
import {reconcileCareerProgress} from "./football-progress";
import {errorCode} from "./error-codes";
import { env } from "cloudflare:workers";
import { initialState,migrateState,SCHEMA_VERSION,type Envelope,type PlannerState } from "./model";
import {assertState} from "./domain";
import {legacyReadOnly,CUTOVER_MESSAGE} from './storage-cutover';
export class AppError extends Error {status:number;constructor(message:string,status=400){super(message);this.status=status;}}
export function isLegacyReadOnly(){return legacyReadOnly(env as unknown as {PLANNER_READ_ONLY?:string})}
export function assertLegacyWritable(){if(isLegacyReadOnly())throw new AppError(CUTOVER_MESSAGE,423)}
export function database(){if(!env.DB)throw new AppError("Your database is not connected yet.",503);return env.DB;}
export async function readState(owner:string):Promise<Envelope>{const db=database();const now=new Date().toISOString();await db.prepare("INSERT OR IGNORE INTO qi_states(owner,revision,schema_version,data,updated_at) VALUES(?,0,?,?,?)").bind(owner,SCHEMA_VERSION,JSON.stringify(initialState()),now).run();const row=await db.prepare("SELECT data,revision,updated_at FROM qi_states WHERE owner=?").bind(owner).first<{data:string;revision:number;updated_at:string}>();if(!row)throw new AppError("Planner could not be loaded.",503);return {state:migrateState(JSON.parse(row.data)),revision:row.revision,updatedAt:row.updated_at};}
export async function commit(owner:string,revision:number,operationId:string,change:(s:PlannerState)=>PlannerState|Promise<PlannerState>):Promise<Envelope>{
 assertLegacyWritable();
 if(!operationId||operationId.length>128)throw new AppError("A valid operation ID is required.");const db=database();
 const duplicate=await db.prepare("SELECT id FROM qi_operations WHERE owner=? AND id=?").bind(owner,operationId).first();if(duplicate)return readState(owner);
 const current=await readState(owner);if(current.revision!==revision)throw new AppError("Your planner changed on another device. Your draft is safe; review the latest version and try again.",409);
 const state=reconcileEconomy(await change(structuredClone(current.state)));assertState(state);const at=new Date().toISOString();
 const career=await readCareerDocument(owner);const nextCareer=career?reconcileCareerProgress(career.state,state,'planner:'+operationId):null;if(nextCareer){nextCareer.player.name=state.settings.name;const numberChanged=state.settings.playerNumber!==current.state.settings.playerNumber,positionChanged=state.settings.position!==current.state.settings.position;if((numberChanged||positionChanged)&&nextCareer.active)throw new AppError('Finish the current fixture before changing your position.');if(numberChanged&&career){const world=await readPrivateObject(owner,career.state.worldRef.key,career.state.worldRef.hash) as import('./football-model').CareerState['world'];if(!availableSquadNumbers(world,nextCareer.player.clubId,nextCareer.player.id).includes(state.settings.playerNumber))throw new AppError('That squad number is already in use at your club.');nextCareer.player.number=state.settings.playerNumber;}if(positionChanged)nextCareer.player.position=precisePosition(state.settings.position);}const careerChanged=!!career&&!!nextCareer&&JSON.stringify(nextCareer)!==JSON.stringify(career.state);
 const careerCondition=career?' AND EXISTS(SELECT 1 FROM qi_careers WHERE owner=? AND revision=?)':' AND NOT EXISTS(SELECT 1 FROM qi_careers WHERE owner=?)';
 const update=db.prepare("UPDATE qi_states SET data=?,revision=revision+1,schema_version=?,last_operation=?,updated_at=? WHERE owner=? AND revision=? AND NOT EXISTS(SELECT 1 FROM qi_operations WHERE owner=? AND id=?)"+careerCondition).bind(JSON.stringify(state),SCHEMA_VERSION,operationId,at,owner,revision,owner,operationId,...(career?[owner,career.row.revision]:[owner]));
 const statements=[update];
 if(careerChanged&&nextCareer&&career){nextCareer.player.name=state.settings.name;statements.push(db.prepare('UPDATE qi_careers SET data=?,revision=revision+1,last_operation=?,updated_at=? WHERE owner=? AND revision=? AND EXISTS(SELECT 1 FROM qi_states WHERE owner=? AND last_operation=?)').bind(JSON.stringify(nextCareer),'planner:'+operationId,at,owner,career.row.revision,owner,operationId));for(const grant of nextCareer.grants.filter(g=>!career.state.grants.some(old=>old.id===g.id)))statements.push(receiptStatement(owner,nextCareer.id,grant.id,'level',grant,'planner:'+operationId));}
 statements.push(db.prepare("INSERT OR IGNORE INTO qi_operations(owner,id,revision,created_at) SELECT owner,?,?,? FROM qi_states WHERE owner=? AND last_operation=?").bind(operationId,revision+1,at,owner,operationId));
 const result=await db.batch(statements);if(result[0].meta.changes===0){const done=await db.prepare("SELECT id FROM qi_operations WHERE owner=? AND id=?").bind(owner,operationId).first();if(done)return readState(owner);throw new AppError("Your planner changed on another device. Refresh and review your draft.",409);}return {state,revision:revision+1,updatedAt:at};
}
export async function serviceChange(owner:string,change:(s:PlannerState)=>PlannerState|Promise<PlannerState>){for(let attempt=0;attempt<4;attempt++){const current=await readState(owner);try{return await commit(owner,current.revision,crypto.randomUUID(),change);}catch(e){if(!(e instanceof AppError)||e.status!==409||attempt===3)throw e;}}throw new AppError("Planner is busy. Try again shortly.",409);}
export async function requester(req:Request){const id=req.headers.get("oai-authenticated-user-id");if(!id)throw new AppError("Please sign in to your private Quest Island site.",401);return id;}
export function sameOrigin(req:Request){const origin=req.headers.get("origin");if(!origin||origin!==new URL(req.url).origin)throw new AppError("Please perform this action from Quest Island.",403);}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});}
export function failure(error:unknown){console.error(error instanceof Error?error.name:"Request failed");const message=error instanceof Error?error.message:"This action could not be completed.";const status=error instanceof AppError?error.status:400;return json({error:message,messageKey:message,code:errorCode(message,status)},status);}
