import {env} from "cloudflare:workers";
import {database,AppError} from "./store";
import {sealJSON,openJSON} from "./crypto";
function master(){const k=env.APP_ENCRYPTION_KEY;if(!k)throw new AppError("Secure connections need the site's encryption key. Your planner data remains saved.",503);return k;}
export async function getSecret<T=Record<string,unknown>>(owner:string,name:string):Promise<T|null>{const row=await database().prepare("SELECT ciphertext FROM qi_secrets WHERE owner=? AND name=?").bind(owner,name).first<{ciphertext:string}>();return row?openJSON<T>(row.ciphertext,master()):null;}
export async function putSecret(owner:string,name:string,value:unknown){const ciphertext=await sealJSON(value,master());await database().prepare("INSERT INTO qi_secrets(owner,name,ciphertext) VALUES(?,?,?) ON CONFLICT(owner,name) DO UPDATE SET ciphertext=excluded.ciphertext").bind(owner,name,ciphertext).run();}
export async function secretOnce<T>(owner:string,name:string,value:T):Promise<T>{const ciphertext=await sealJSON(value,master());await database().prepare("INSERT OR IGNORE INTO qi_secrets(owner,name,ciphertext) VALUES(?,?,?)").bind(owner,name,ciphertext).run();const stored=await getSecret<T>(owner,name);if(!stored)throw new AppError("Secure setup could not be completed.",503);return stored;}
export async function removeSecret(owner:string,name:string){await database().prepare("DELETE FROM qi_secrets WHERE owner=? AND name=?").bind(owner,name).run();}
