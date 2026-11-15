import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyIncome,daysToSave,weeklyPlan,weeklyGoalProgress,balanceSummary,PLAN_EXAMPLE_DAY,WEEKLY_GOALS} from '../lib/club-balance.ts';
import {filterRoster,scoutingFilterOptions,describeFilters,playerLeague} from '../lib/club-scouting-filters.ts';
import {FOOTBALL_CLUBS,FOOTBALL_PLAYERS} from '../lib/football-data.ts';

test('the PLAN example day pays 50 XP and 100 funds',()=>{
 const income=dailyIncome(PLAN_EXAMPLE_DAY);
 assert.equal(income.xp,50);
 assert.equal(income.funds,100);
 assert.equal(income.focusBuckets,2);
 assert.equal(income.focusRemainderMinutes,0);
 assert.equal(income.totalFunds,100);
});

test('partial days, level-ups and remainders follow the same table',()=>{
 const three=dailyIncome({tasks:3,focusMinutes:40});
 assert.deepEqual({xp:three.xp,funds:three.funds},{xp:40,funds:80});
 const fifty=dailyIncome({tasks:0,focusMinutes:50});
 assert.deepEqual({xp:fifty.xp,funds:fifty.funds,buckets:fifty.focusBuckets,remainder:fifty.focusRemainderMinutes},{xp:10,funds:20,buckets:2,remainder:10});
 const level=dailyIncome({tasks:4,focusMinutes:40},{levelUps:1});
 assert.equal(level.levelFunds,40);
 assert.equal(level.totalFunds,140);
 assert.equal(dailyIncome({tasks:4,focusMinutes:10}).funds,80);
});

test('weekly plan and goal affordability come from the daily curve',()=>{
 const plan=weeklyPlan();
 assert.equal(plan.weeklyFunds,700);
 assert.equal(plan.weeklyXp,350);
 assert.equal(daysToSave(1000,100),10);
 assert.equal(daysToSave(WEEKLY_GOALS.signing65Ovr,100),10);
 const progress=weeklyGoalProgress(plan.weeklyFunds);
 assert.equal(progress.find(entry=>entry.goal==='trainingPoint')!.affordable,true);
 assert.equal(progress.find(entry=>entry.goal==='signing65Ovr')!.affordable,false);
 const summary=balanceSummary();
 assert.equal(summary.dailyXp,50);assert.equal(summary.dailyFunds,100);assert.equal(summary.weeklyFunds,700);assert.equal(summary.daysTo1000,10);
});

test('roster filters cover league, region and position',()=>{
 const premier=filterRoster(FOOTBALL_PLAYERS,FOOTBALL_CLUBS,{league:'premier-league'});
 assert(premier.length>0);
 assert(premier.every(player=>playerLeague(player,new Map(FOOTBALL_CLUBS.map(club=>[club.id,club])))==='premier-league'));
 const keepers=filterRoster(FOOTBALL_PLAYERS,FOOTBALL_CLUBS,{position:'GK'});
 assert(keepers.length>0);
 assert(keepers.every(player=>player.position==='GK'));
 const eng=filterRoster(FOOTBALL_PLAYERS,FOOTBALL_CLUBS,{region:'ENG'});
 assert(eng.length>0);
 const options=scoutingFilterOptions(FOOTBALL_CLUBS);
 assert(options.leagues.some(league=>league.id==='premier-league'));
 assert(options.regions.some(region=>region.id==='ENG'));
 assert.equal(describeFilters({league:'premier-league',position:'ST'}),'Premier League · ST');
 assert.equal(describeFilters({}),'All players');
});
