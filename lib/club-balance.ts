/**
 * Balance model for the club economy (PLAN 2.2 / 2.3 and the acceptance table's
 * "balance" row). Pure arithmetic so the pacing can be asserted and documented.
 */
export const TASK_XP=10,TASK_FUNDS=20,HABIT_XP=10,HABIT_FUNDS=20;
export const FOCUS_BUCKET_MINUTES=20,FOCUS_XP_PER_BUCKET=5,FOCUS_FUNDS_PER_BUCKET=10;
export const LEVEL_FUNDS=40,LEVEL_XP=100,FIRST_CLUB_FUNDS=150;
export type DailyInput={tasks:number;habits?:number;focusMinutes:number};
export type DailyIncome={xp:number;funds:number;focusBuckets:number;focusRemainderMinutes:number;levelUps:number;levelFunds:number;totalFunds:number};
export function dailyIncome(input:DailyInput,options:{levelUps?:number}={}):DailyIncome{
 const tasks=Math.max(0,Math.floor(input.tasks)),habits=Math.max(0,Math.floor(input.habits??0)),minutes=Math.max(0,input.focusMinutes);
 const buckets=Math.floor(minutes/FOCUS_BUCKET_MINUTES),remainder=minutes-buckets*FOCUS_BUCKET_MINUTES;
 const levelUps=Math.max(0,Math.floor(options.levelUps??0));
 const xp=tasks*TASK_XP+habits*HABIT_XP+buckets*FOCUS_XP_PER_BUCKET;
 const funds=tasks*TASK_FUNDS+habits*HABIT_FUNDS+buckets*FOCUS_FUNDS_PER_BUCKET;
 const levelFunds=levelUps*LEVEL_FUNDS;
 return {xp,funds,focusBuckets:buckets,focusRemainderMinutes:remainder,levelUps,levelFunds,totalFunds:funds+levelFunds};
}
/** PLAN 2.3 example: four tasks plus forty focused minutes per day. */
export const PLAN_EXAMPLE_DAY:DailyInput={tasks:4,focusMinutes:40};
export function daysToSave(target:number,dailyFunds:number){return dailyFunds<=0?Number.POSITIVE_INFINITY:Math.ceil(Math.max(0,target)/dailyFunds)}
/** Rough weekly goal costs from the PLAN price tables. */
export const WEEKLY_GOALS={trainingPoint:20,tacticLevel1:100,facilityUpgrade:300,signing65Ovr:1000,stadiumL2:400} as const;
export type WeeklyPlan={day:DailyInput;days:number;income:DailyIncome;weeklyFunds:number;weeklyXp:number};
export function weeklyPlan(day:DailyInput=PLAN_EXAMPLE_DAY,days=7):WeeklyPlan{
 const income=dailyIncome(day);
 return {day,days,income,weeklyFunds:income.totalFunds*days,weeklyXp:income.xp*days};
}
export function weeklyGoalProgress(weeklyFunds:number){return Object.entries(WEEKLY_GOALS).map(([goal,cost])=>({goal,cost,affordable:weeklyFunds>=cost,weeks:cost>0?Math.ceil(cost/ weeklyFunds):0}))}
export function balanceSummary(){
 const income=dailyIncome(PLAN_EXAMPLE_DAY,{levelUps:0});
 return {dailyXp:income.xp,dailyFunds:income.totalFunds,weeklyFunds:income.totalFunds*7,daysTo1000:daysToSave(1000,income.totalFunds),daysToSigning:daysToSave(WEEKLY_GOALS.signing65Ovr,income.totalFunds)};
}
