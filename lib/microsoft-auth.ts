/** Server-only Microsoft identity adapter. Vault implementations must encrypt token material. */
const issuer='https://login.microsoftonline.com/9188040d-6c67-4c5b-b112-36a304b66dad/v2.0';
const endpoint='https://login.microsoftonline.com/consumers/oauth2/v2.0';
export const MICROSOFT_SCOPES='openid profile offline_access https://graph.microsoft.com/Files.ReadWrite.AppFolder';
export type MicrosoftPending={state:string;binding:string;nonce:string;verifier:string;expiresAt:number;returnTo:string;enrollmentGrant?:string};
export type MicrosoftSession={id:string;subject:string;name:string;accessToken:string;refreshToken:string;tokenExpiresAt:number;expiresAt:number};
export interface MicrosoftVault {
 putPending(value:MicrosoftPending):Promise<void>;
 /** Atomically consume: parallel callbacks may not both redeem a state. */
 takePending(state:string):Promise<MicrosoftPending|null>;
 putSession(value:MicrosoftSession):Promise<void>;
 getSession(id:string):Promise<MicrosoftSession|null>;
 deleteSession(id:string):Promise<void>;
 /** Atomically validates/consumes a trusted setup grant and binds the first owner. */
 enrollOwner?(subject:string,grant:string):Promise<boolean>;
}
export type MicrosoftConfig={clientId:string;clientSecret:string;redirectUri:string;allowedSubjects:string[];sessionSeconds?:number};
export class MicrosoftAuthError extends Error {status:number;constructor(message:string,status=401){super(message);this.status=status;}}
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
const random=()=>encode(crypto.getRandomValues(new Uint8Array(32)));
const decode=(value:string)=>Uint8Array.from(atob(value.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));
const jsonPart=(value:string)=>JSON.parse(new TextDecoder().decode(decode(value))) as Record<string,unknown>;
function cookie(req:Request,name:string){return req.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'';}
const setCookie=(name:string,value:string,seconds:number)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function safeReturn(value:string|null){return value?.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\r\n]/.test(value)?value:'/';}
export function createMicrosoftAuth(config:MicrosoftConfig,vault:MicrosoftVault,fetcher:typeof fetch=fetch){
 const redirect=new URL(config.redirectUri);
 if(redirect.protocol!=='https:'||!config.clientId||!config.clientSecret)throw new MicrosoftAuthError('Microsoft sign-in needs configuring.',503);
 const now=()=>Date.now();
 async function tokens(body:URLSearchParams){
  const response=await fetcher(endpoint+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok||typeof data.access_token!=='string')throw new MicrosoftAuthError('Microsoft authorization expired or was not granted. Please reconnect.');
  return data;
 }
 async function verify(token:string,nonce:string){
  try{
   const parts=token.split('.');if(parts.length!==3)throw new Error();
   const header=jsonPart(parts[0]),claims=jsonPart(parts[1]);
   if(header.alg!=='RS256'||typeof header.kid!=='string')throw new Error();
   const response=await fetcher('https://login.microsoftonline.com/consumers/discovery/v2.0/keys');
   if(!response.ok)throw new Error();
   const jwks=await response.json() as {keys:(JsonWebKey&{kid?:string})[]};
   const jwk=jwks.keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.use||k.use==='sig'));
   if(!jwk)throw new Error();
   const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw new Error();
   if(claims.iss!==issuer||claims.aud!==config.clientId||claims.nonce!==nonce||typeof claims.sub!=='string'||!claims.sub||typeof claims.exp!=='number'||claims.exp*1000<=now()||typeof claims.iat!=='number'||claims.iat*1000>now()+60000||typeof claims.nbf==='number'&&claims.nbf*1000>now()+60000)throw new Error();
   return {subject:issuer+'|'+claims.sub,name:typeof claims.name==='string'?claims.name:'Microsoft account'};
  }catch{throw new MicrosoftAuthError('Microsoft identity could not be verified. Start sign-in again.');}
 }
 async function begin(req:Request,enrollmentGrant?:string){
   if(!enrollmentGrant&&!config.allowedSubjects.length)throw new MicrosoftAuthError('The private owner account must be configured before sign-in.',503);
   const pending:MicrosoftPending={state:random(),binding:random(),nonce:random(),verifier:random()+random(),expiresAt:now()+600000,returnTo:safeReturn(new URL(req.url).searchParams.get('returnTo'))};
   if(enrollmentGrant)pending.enrollmentGrant=enrollmentGrant;
   await vault.putPending(pending);
   const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pending.verifier))));
   const params=new URLSearchParams({client_id:config.clientId,response_type:'code',redirect_uri:config.redirectUri,response_mode:'query',prompt:'select_account',scope:MICROSOFT_SCOPES,state:pending.state,nonce:pending.nonce,code_challenge:challenge,code_challenge_method:'S256'});
   return {url:endpoint+'/authorize?'+params,cookie:setCookie('__Host-qfc-ms-state',pending.binding,600)};

 }
 return {
  begin(req:Request){return begin(req)},
  /** Server-only route must first validate its setup authorization; vault validates again atomically. */
  beginEnrollment(req:Request,grant:string){if(!grant||!vault.enrollOwner)throw new MicrosoftAuthError('Owner setup authorization is required.',403);return begin(req,grant)},
  async callback(req:Request){
   if(new URL(req.url).origin!==redirect.origin||new URL(req.url).pathname!==redirect.pathname)throw new MicrosoftAuthError('Invalid sign-in callback.');
   const query=new URL(req.url).searchParams,state=query.get('state');
   const pending=state?await vault.takePending(state):null;
   if(!pending||pending.expiresAt<=now()||cookie(req,'__Host-qfc-ms-state')!==pending.binding)throw new MicrosoftAuthError('Sign-in expired or belongs to another browser.');
   const code=query.get('code');if(!code||query.has('error'))throw new MicrosoftAuthError('Microsoft sign-in was not authorized.');
   const data=await tokens(new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,grant_type:'authorization_code',code,redirect_uri:config.redirectUri,code_verifier:pending.verifier,scope:MICROSOFT_SCOPES}));
   if(typeof data.id_token!=='string'||typeof data.refresh_token!=='string')throw new MicrosoftAuthError('Microsoft did not grant the required authorization.');
   const identity=await verify(data.id_token,pending.nonce);
   if(!config.allowedSubjects.includes(identity.subject)){
    if(!pending.enrollmentGrant||!vault.enrollOwner||!await vault.enrollOwner(identity.subject,pending.enrollmentGrant))throw new MicrosoftAuthError('This private planner is restricted to its configured owner.',403);
    config.allowedSubjects.push(identity.subject);
   }
   const session:MicrosoftSession={id:random(),...identity,accessToken:String(data.access_token),refreshToken:data.refresh_token,tokenExpiresAt:now()+Math.max(0,Number(data.expires_in)||0)*1000,expiresAt:now()+(config.sessionSeconds||604800)*1000};
   await vault.putSession(session);
   return {session,returnTo:pending.returnTo,cookies:[setCookie('__Host-qfc-session',session.id,config.sessionSeconds||604800),setCookie('__Host-qfc-ms-state','',0)]};
  },
  async session(req:Request){const id=cookie(req,'__Host-qfc-session');if(!id)return null;const session=await vault.getSession(id);if(!session)return null;if(session.expiresAt<=now()||!config.allowedSubjects.includes(session.subject)){await vault.deleteSession(id);return null;}return session;},
  /** Caller serializes refreshes per account so rotated refresh tokens are not lost. */
  async refresh(session:MicrosoftSession){
   if(session.expiresAt<=now()||!config.allowedSubjects.includes(session.subject))throw new MicrosoftAuthError('Please sign in again.');
   if(session.tokenExpiresAt>now()+60000)return session;
   const data=await tokens(new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,grant_type:'refresh_token',refresh_token:session.refreshToken,scope:MICROSOFT_SCOPES}));
   const updated={...session,accessToken:String(data.access_token),refreshToken:typeof data.refresh_token==='string'?data.refresh_token:session.refreshToken,tokenExpiresAt:now()+Math.max(0,Number(data.expires_in)||0)*1000};
   await vault.putSession(updated);return updated;
  },
  /** Connector authorization outlives a browser session, until revocation or owner removal.
   * Caller serializes rotation and persists returned material in its encrypted provider vault.
   * This does not create or extend a browser session.
   */
  async refreshAuthorization(authorization:MicrosoftSession){
   if(!config.allowedSubjects.includes(authorization.subject))throw new MicrosoftAuthError('This Microsoft connection is no longer authorized.',403);
   if(authorization.tokenExpiresAt>now()+60000)return authorization;
   const data=await tokens(new URLSearchParams({client_id:config.clientId,client_secret:config.clientSecret,grant_type:'refresh_token',refresh_token:authorization.refreshToken,scope:MICROSOFT_SCOPES}));
   return {...authorization,accessToken:String(data.access_token),refreshToken:typeof data.refresh_token==='string'?data.refresh_token:authorization.refreshToken,tokenExpiresAt:now()+Math.max(0,Number(data.expires_in)||0)*1000};
  },
  async logout(req:Request){const id=cookie(req,'__Host-qfc-session');if(id)await vault.deleteSession(id);return {cookies:[setCookie('__Host-qfc-session','',0),setCookie('__Host-qfc-ms-state','',0)]};}
 };
}
