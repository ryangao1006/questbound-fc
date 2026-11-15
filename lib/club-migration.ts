import {creditBalance,type Economy} from './economy.ts';
import {totalXP,type PlannerState} from './model.ts';

/**
 * Read-only preview of the club pivot migration (PLAN.md 4.3). Nothing is applied:
 * the preview only says what would carry over, what would be frozen and what would be granted once.
 */
export type ClubMigrationPreview={
 xp:number;funds:number;initialGrant:number;
 displayRights:{frames:string[];backdrops:string[];kits:string[]};
 frozen:{personalAttributes:boolean;skillPoints:null;matchHistory:null};
 baseline:{rewardIdentities:number;sessionIdentities:number;activeSession:boolean};
 warnings:string[];
};

export function previewClubMigration(state:PlannerState,equipped?:Partial<Economy['equipped']>){
 const economy=state.economy;
 const frames=[...new Set(economy.purchases.filter(purchase=>purchase.itemId.startsWith('frame.')).map(purchase=>purchase.itemId))];
 const backdrops=[...new Set(economy.purchases.filter(purchase=>purchase.itemId.startsWith('backdrop.')).map(purchase=>purchase.itemId))];
 const kits=[...new Set(state.settings.unlocked.filter(item=>['academyKit','awayKit','goldboots','boots','celebration','armband'].includes(item)))];
 const warnings:string[]=[];
 if(economy.sources.some(source=>source.spent>0))warnings.push('Spent funds keep their purchase history; the balance is carried as-is.');
 if(state.activeSession)warnings.push('A focus session is running: it keeps its elapsed time and starts the new reward baseline.');
 if(state.outbox.length)warnings.push(`${state.outbox.length} queued provider change(s) stay in the task pipeline and are not part of the club migration.`);
 return {
  xp:totalXP(state),
  funds:creditBalance(economy),
  initialGrant:150,
  displayRights:{frames,backdrops,kits},
  frozen:{personalAttributes:true,skillPoints:null,matchHistory:null},
  baseline:{rewardIdentities:state.rewards.length,sessionIdentities:state.sessions.length,activeSession:!!state.activeSession},
  warnings,
 };
}
/** The one-off 150 grant is recorded per account and must never be re-issued. */
export function initialGrantEligible(ledger:{initialGranted?:boolean}){return !ledger.initialGranted}
