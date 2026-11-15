import type {FootballGoalkeeperAttributes,FootballPosition,FootballRosterPlayer} from './football-data.ts';
import {overall,rookieAttributes} from './football-engine/stats-v1.ts';
import type {ClubPlayer} from './club-model.ts';

/**
 * Transfer and sale rules for the manager pivot (PLAN.md 3.5).
 *
 * Pure rules only: nothing here reads storage, the network or the clock, and no
 * function mutates its arguments. Receipt timestamps are supplied by the caller
 * ('' means "not recorded yet"). Club views are structural, so a `ClubState`
 * from lib/club-state.ts can be passed directly; the returned club keeps every
 * extra field it was given.
 */

export const TRANSFER_BALANCE_VERSION='questbound-transfers-1' as const;
/** PLAN.md 3.5: scout centre L1-L4 can sign up to 68 / 76 / 84 / 99 OVR. */
export const SCOUT_CENTRE_CAPS=[68,76,84,99] as const;
export const SELL_REFUND_PERCENT=50;
export const MIN_SIGNING_PRICE=300;
/** PLAN.md 3.5: the gifted initial squad can be released but never sold for money. */
export const INITIAL_PLAYER_SALE_VALUE=0;

export type ScoutLevel=1|2|3|4;
export type TransferOrigin='initial'|'signed';
export type OccupiedPlayerIds=Iterable<string>;

/** Club roster fields the transfer rules need; a ClubState satisfies this shape. */
export type TransferPlayer={
 id:string;
 name?:string;
 position:FootballPosition;
 origin:TransferOrigin;
 ovr:number;
 /** Original signing price for the 50 % sale value; absent for gifted players. */
 paidPrice?:number;
};
export type TransferClub={
 players:TransferPlayer[];
 lineup:string[];
 facilities:{scoutCentre:number};
};

/** A scouting candidate: any identity with a current OVR, such as a real roster player. */
export type ScoutTarget={id:string;ovr:number};
export type TransferCandidate={id:string;name?:string;position:FootballPosition;ovr:number};
export type SigningTarget=ScoutTarget|FootballRosterPlayer;
export type SignedClubPlayer=ClubPlayer & {origin:'signed'};

export type SignCheck={ok:true;price:number}|{ok:false;price:number;reason:string};
export type SignOptions={occupied?:OccupiedPlayerIds;at?:string;receiptId?:string};
export type SignWorldOptions=SignOptions&{number?:number;usedNumbers?:Iterable<number>};
export type SellOptions={paidPrice?:number;at?:string;receiptId?:string};

export type SigningReceipt={id:string;kind:'signing';playerId:string;price:number;at:string};
export type SaleReceipt={id:string;kind:'sale';playerId:string;paidPrice:number;refund:number;at:string};
export type SignResult<C extends TransferClub>={club:C;player:TransferPlayer;price:number;receipt:SigningReceipt};
export type SellResult<C extends TransferClub>={club:C;player:TransferPlayer;refund:number;receipt:SaleReceipt};

const timestamp=(at?:string)=>typeof at==='string'?at:'';
const receiptId=(provided:string|undefined,fallback:string)=>{
 if(provided===undefined)return fallback;
 if(typeof provided!=='string'||!provided)throw new Error('A valid receipt ID is required.');
 return provided;
};
const hasOvr=(player:SigningTarget):player is ScoutTarget=>typeof (player as ScoutTarget).ovr==='number';
const isTransferPlayer=(player:TransferPlayer|FootballRosterPlayer):player is TransferPlayer=>typeof (player as TransferPlayer).ovr==='number'&&typeof (player as TransferPlayer).origin==='string';

/** PLAN.md 3.5: scout centre level caps. Levels outside L1-L4 clamp like trainingCap. */
export function scoutCap(level:number):number{
 if(!Number.isFinite(level))throw new Error('Scout centre level must be a number.');
 return SCOUT_CENTRE_CAPS[Math.max(1,Math.min(SCOUT_CENTRE_CAPS.length,Math.round(level)))-1];
}

/** PLAN.md 3.5 quote formula, rounded to whole club funds. */
export function signingPrice(ovr:number):number{
 if(!Number.isFinite(ovr))throw new Error('A valid OVR is required to quote a signing price.');
 const rating=Math.max(1,Math.min(99,ovr));
 return Math.max(MIN_SIGNING_PRICE,Math.round(500+100*(rating-60)+8*Math.max(0,rating-75)**2));
}

/** PLAN.md 3.5: selling returns 50 % of the original signing price, rounded down. */
export function sellValue(paidPrice:number):number{
 if(!Number.isSafeInteger(paidPrice)||paidPrice<0)throw new Error('A valid signing price is required to work out a sale value.');
 return Math.floor(paidPrice*SELL_REFUND_PERCENT/100);
}

/** PLAN.md 3.5: one real player identity can belong to only one club in the world. */
export function occupiedPlayerIds(players:Iterable<{id:string}>):Set<string>{
 const ids=new Set<string>();
 for(const player of players)if(player&&typeof player.id==='string'&&player.id)ids.add(player.id);
 return ids;
}

export function isWorldPlayerOccupied(worldPlayerId:string,occupied:OccupiedPlayerIds):boolean{
 if(typeof worldPlayerId!=='string'||!worldPlayerId)return false;
 for(const id of occupied)if(id===worldPlayerId)return true;
 return false;
}

/** Drop identities already owned by another club, e.g. from an opponent squad list. */
export function withoutOccupied<W extends {id:string}>(players:readonly W[],occupied:OccupiedPlayerIds):W[]{
 return players.filter(player=>player&&typeof player.id==='string'&&player.id&&!isWorldPlayerOccupied(player.id,occupied));
}

export function isAvailable(worldPlayerId:string,club:Pick<TransferClub,'players'>,occupied:OccupiedPlayerIds=[]):boolean{
 if(typeof worldPlayerId!=='string'||!worldPlayerId)return false;
 const players=club.players as readonly TransferPlayer[];
 if(players.some(player=>player.id===worldPlayerId))return false;
 return !isWorldPlayerOccupied(worldPlayerId,occupied);
}

/** The "can be signed" list: removes identities that already belong to a club. */
export function availableSignings<W extends {id:string}>(candidates:readonly W[],club:Pick<TransferClub,'players'>,occupied:OccupiedPlayerIds=[]):W[]{
 const taken=occupiedPlayerIds(club.players as Iterable<{id:string}>);
 for(const id of occupied)if(typeof id==='string'&&id)taken.add(id);
 return candidates.filter(candidate=>candidate&&typeof candidate.id==='string'&&candidate.id&&!taken.has(candidate.id));
}

function targetOvr(player:SigningTarget):number{
 if(hasOvr(player))return player.ovr;
 return worldPlayerOvr(player);
}

/**
 * PLAN.md 3.5: may this player be signed right now? A refusal carries a clear
 * reason, and the price is quoted either way so the UI can show it.
 */
export function canSign(player:SigningTarget,club:Pick<TransferClub,'players'|'facilities'>,occupied:OccupiedPlayerIds=[]):SignCheck{
 if(!player||typeof player.id!=='string'||!player.id)throw new Error('A real player identity is required to sign a player.');
 const ovr=targetOvr(player);
 if(!Number.isFinite(ovr))throw new Error('A valid OVR is required to sign a player.');
 const price=signingPrice(ovr);
 const players=club.players as readonly TransferPlayer[];
 if(players.some(entry=>entry.id===player.id))return {ok:false,price,reason:'This player is already in your club.'};
 if(isWorldPlayerOccupied(player.id,occupied))return {ok:false,price,reason:'This player already belongs to another club.'};
 const cap=scoutCap(club.facilities.scoutCentre);
 if(ovr>cap)return {ok:false,price,reason:`Your scout centre can only sign up to ${cap} OVR.`};
 return {ok:true,price};
}

/** PLAN.md 3.5: the starting eleven must be eleven unique players with exactly one keeper. */
export function startingElevenProblem(club:{players:readonly {id:string;position:FootballPosition}[];lineup:readonly string[]}):string|null{
 if(club.lineup.length!==11)return 'The starting eleven needs exactly eleven players.';
 if(new Set(club.lineup).size!==club.lineup.length)return 'The starting eleven cannot contain the same player twice.';
 const byId=new Map(club.players.map(player=>[player.id,player]));
 const starters=club.lineup.map(id=>byId.get(id));
 if(starters.some(player=>!player))return 'A starter is missing from the squad.';
 if(starters.filter(player=>player?.position==='GK').length!==1)return 'The starting eleven needs exactly one goalkeeper.';
 return null;
}

/** Real-roster bridge: the game OVR already used by club-match and club-preview. */
export function worldPlayerOvr(world:FootballRosterPlayer):number{
 if(!world||!world.position)throw new Error('A real player is required.');
 return overall(world.position,{...world.attributes,...world.goalkeeper});
}

export function signingTarget(world:FootballRosterPlayer):TransferCandidate{
 return {id:world.id,name:world.name,position:world.position,ovr:worldPlayerOvr(world)};
}

function shirtNumberFor(preferred:number,requested:number|undefined,used:Iterable<number>):number{
 const taken=new Set<number>();
 for(const number of used??[])if(Number.isSafeInteger(number))taken.add(number);
 if(requested!==undefined){
  if(!Number.isSafeInteger(requested)||requested<1||requested>99)throw new Error('A shirt number must be between 1 and 99.');
  if(taken.has(requested))throw new Error('That shirt number is already taken.');
  return requested;
 }
 if(Number.isSafeInteger(preferred)&&preferred>=1&&preferred<=99&&!taken.has(preferred))return preferred;
 for(let number=1;number<=99;number+=1)if(!taken.has(number))return number;
 throw new Error('There is no free shirt number in this squad.');
}

export type ClubPlayerBuildOptions={number?:number;usedNumbers?:Iterable<number>};

/** Convert a versioned real-roster player into a club-squad player for signing. */
export function worldPlayerToClubPlayer(world:FootballRosterPlayer,options:ClubPlayerBuildOptions={}):SignedClubPlayer{
 if(!world||typeof world.id!=='string'||!world.id)throw new Error('A real player is required.');
 const baseline=rookieAttributes(world.position);
 const goalkeeper:FootballGoalkeeperAttributes=world.goalkeeper??{
  diving:baseline.diving,handling:baseline.handling,kicking:baseline.kicking,
  reflexes:baseline.reflexes,speed:baseline.speed,positioning:baseline.positioning,
 };
 return {
  id:world.id,name:world.name,position:world.position,
  number:shirtNumberFor(world.number,options.number,options.usedNumbers??[]),
  foot:world.preferredFoot==='left'?'left':'right',
  attributes:{...world.attributes},goalkeeper,origin:'signed',ovr:worldPlayerOvr(world),
 };
}

function squadNumbersOf(club:TransferClub):number[]{
 const numbers:number[]=[];
 for(const player of club.players as readonly {number?:number}[])if(typeof player.number==='number')numbers.push(player.number);
 return numbers;
}

/**
 * PLAN.md 3.5: sign a player for the fixed quote. Refuses an over-cap target,
 * a duplicated identity or a player already owned elsewhere, with the same
 * reason `canSign` reports. The receipt timestamp comes from the caller.
 */
export function signPlayer<C extends TransferClub>(club:C,player:TransferPlayer,options?:SignOptions):SignResult<C>;
export function signPlayer<C extends TransferClub>(club:C,world:FootballRosterPlayer,options?:SignWorldOptions):SignResult<C>;
export function signPlayer<C extends TransferClub>(club:C,target:TransferPlayer|FootballRosterPlayer,options:SignWorldOptions={}):SignResult<C>{
 const usedNumbers=[...squadNumbersOf(club),...(options.usedNumbers??[])];
 const player=isTransferPlayer(target)?target:worldPlayerToClubPlayer(target,{number:options.number,usedNumbers});
 const check=canSign(player,club,options.occupied??[]);
 if(!check.ok)throw new Error(check.reason);
 const signed:TransferPlayer={...player,origin:'signed',paidPrice:check.price};
 const nextClub={...club,players:[...(club.players as readonly TransferPlayer[]),signed]} as unknown as C;
 const receipt:SigningReceipt={id:receiptId(options.receiptId,`signing:${player.id}`),kind:'signing',playerId:player.id,price:check.price,at:timestamp(options.at)};
 return {club:nextClub,player:signed,price:check.price,receipt};
}

function paidPriceFor(player:TransferPlayer,override:number|undefined):number{
 const value=override??player.paidPrice;
 if(value===undefined)throw new Error('This signed player has no recorded signing price.');
 if(!Number.isSafeInteger(value)||value<0)throw new Error('A valid signing price is required to work out a sale value.');
 return value;
}

/**
 * PLAN.md 3.5: sell a player for 50 % of their original price. The gifted
 * initial squad sells for nothing, training fees are never refunded, and a
 * sale that would break the starting eleven is refused with a reason.
 */
export function sellPlayer<C extends TransferClub>(club:C,playerId:string,options:SellOptions={}):SellResult<C>{
 if(typeof playerId!=='string'||!playerId)throw new Error('Choose a player to sell.');
 const players=club.players as readonly TransferPlayer[];
 const index=players.findIndex(player=>player.id===playerId);
 if(index<0)throw new Error('This player is not in your club.');
 const player=players[index];
 const lineup=club.lineup as readonly string[];
 if(lineup.includes(playerId))throw new Error('This player is in the starting eleven; make them a substitute before selling.');
 const remaining=players.filter((_,position)=>position!==index);
 const problem=startingElevenProblem({players:remaining,lineup});
 if(problem)throw new Error(`Selling this player would break the starting eleven: ${problem}`);
 const paidPrice=player.origin==='initial'?INITIAL_PLAYER_SALE_VALUE:paidPriceFor(player,options.paidPrice);
 const refund=paidPrice===0?0:sellValue(paidPrice);
 const receipt:SaleReceipt={id:receiptId(options.receiptId,`sale:${player.id}`),kind:'sale',playerId:player.id,paidPrice,refund,at:timestamp(options.at)};
 const nextClub={...club,players:remaining} as unknown as C;
 return {club:nextClub,player,refund,receipt};
}
