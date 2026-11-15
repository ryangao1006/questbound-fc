"use client";

import Link from "next/link";
import {
  Fragment,
  Suspense,
  lazy,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  FORMATION_OPTIONS,
  buildClubPreview,
  squadLineCounts,
  type ClubPreview,
  type ClubPreviewPlayer,
} from "@/lib/club-preview";
import {
  CLUB_FORMATIONS,
  LINE_WEIGHTS,
  autoPick,
  levelForXp,
  lineOf,
  playerRatingInSlot,
  positionFit,
  quoteTraining,
  trainPlayer,
  trainingCap,
  trainingPrice,
  type ClubFormation,
  type ClubPlayer,
  type LineRatings,
} from "@/lib/club-model";
import { previewClubMigration } from "@/lib/club-migration";
import {
  scoutCap,
  sellValue,
  signingPrice,
  worldPlayerOvr,
} from "@/lib/club-transfers";
import {
  TIER_OVR,
  createSeason,
  playSeasonRound,
  seasonOutcome,
  sortTable,
  type ClubSeason,
  type LeagueTier,
} from "@/lib/club-league";
import type { ClubCup, CupMatch, CupTier } from "@/lib/club-cup";
import { opponentFor, simulateClubMatch, teamFromClub } from "@/lib/club-match";
import {
  CLUB_TACTICS,
  FACILITY_MAX,
  TACTIC_BONUS,
  TACTIC_MAX_LEVEL,
  clubFunds,
  clubPlayer,
  clubRatings,
  facilityGate,
  facilityUpgradeCost,
  tacticTrainingCost,
  seedFrom,
  type ClubMatchRecord,
  type ClubReceipt,
  type ClubState,
  type ClubTactic,
  type ClubTrophy,
  type SeasonRecord,
  type FacilityKey,
} from "@/lib/club-state";
import type { FootballAttributes, FootballClub, FootballRosterPlayer } from "@/lib/football-data";
import {
  PLAN_EXAMPLE_DAY,
  balanceSummary,
  dailyIncome,
  weeklyGoalProgress,
  weeklyPlan,
} from "@/lib/club-balance";
import {
  clubDisplay,
  type DisplayKind,
} from "@/lib/club-display";
import { kitForTrophy, type KitItem } from "@/lib/club-collection";
import {
  cardSummary,
  clubCrest,
  squadCards,
  type ClubCrest,
  type PlayerCard,
} from "@/lib/club-cards";
import { matchBriefing } from "@/lib/match-briefing";
import {
  celebrationFor,
  celebrationStars,
  pendingCelebration,
  type Celebration,
} from "@/lib/club-celebration";
import {
  decorOptions,
  resolveDecor,
  type DecorKind,
  type DecorOption,
  type ResolvedDecor,
} from "@/lib/club-decor";
import {
  storyboardBeats,
  storyboardFromRecord,
  storyboardSummary,
  type StoryPanel,
} from "@/lib/match-storyboard";
import {
  canTrainDetail,
  nextTrainingAttribute,
  playerDetail,
  type AttributeKey,
} from "@/lib/club-player-detail";
import {
  assistantOf,
  conditionReport,
  fitnessOf,
  injuryMatchesOf,
  isAvailable,
  isInjured,
  type ConditionReport,
} from "@/lib/club-condition";
import { clubHomeSummary, nextClubActions } from "@/lib/club-actions";
import {
  budgetSplit,
  compareBars,
  formationDots,
  levelPips,
  polar,
  progressRing,
  ratingsRadar,
  trophyPips,
} from "@/lib/club-diagrams";
import {
  describeFilters,
  filterRoster,
  scoutingFilterOptions,
  type ScoutingFilters,
} from "@/lib/club-scouting-filters";
import {
  scoutingPlan as computeScoutingPlan,
  type ClubLine as ScoutingClubLine,
  type ScoutingRecommendation,
} from "@/lib/club-scouting";
import { dateTime, translate, type Language } from "@/lib/i18n";
import { level, totalXP, type PlannerState } from "@/lib/model";

/**
 * Read-only preview of the club-management pivot (PLAN.md). The page only *displays*
 * what the domain layer would produce: buildClubPreview() is pure, and this component
 * never posts, saves or mutates planner data. New copy lives in the local dictionary
 * below; shared strings come from lib/i18n.ts translate(), and lib/messages.ts is
 * intentionally untouched.
 */
const COPY = {
  /* header */
  backToPlanner: { en: "Back to planner", zh: "返回计划" },
  eyebrow: { en: "Questbound FC · Club management", zh: "Questbound FC · 俱乐部经营" },
  title: { en: "Club management · interactive preview", zh: "俱乐部经营 · 可操作预览版本" },
  lede: {
    en: "Build a club, train a player and set the line-up. Every action on this page goes through the real command API and is saved into your planner; nothing is written directly to storage.",
    zh: "在这里建队、培养球员和排布首发。页面上每个操作都通过真实的命令接口写入你的计划数据，不会绕过接口直接写存储。",
  },
  badgeReadonly: { en: "Read-only", zh: "只读" },
  badgeLive: { en: "Live planner data", zh: "实时计划数据" },
  badgeLoading: { en: "Reading planner…", zh: "正在读取计划数据…" },
  badgeSample: { en: "示例数据 / sample data", zh: "示例数据 / sample data" },
  dataSourceTitle: { en: "Data source", zh: "数据来源" },
  sourceLive: { en: "Built from the planner state saved on this site.", zh: "数据来自本站已保存的计划状态。" },
  sourceLoading: { en: "Reading the saved planner state…", zh: "正在读取已保存的计划状态…" },
  sourceSample: {
    en: "The saved planner state could not be read, so this page falls back to the built-in sample club.",
    zh: "无法读取已保存的计划状态，因此本页显示内置示例俱乐部。",
  },
  sourceSampleReason: { en: "Reason", zh: "原因" },
  sourceMeta: { en: "Planner revision {0} · updated {1}", zh: "计划版本 {0} · 更新于 {1}" },
  shortSubtitle: { en: "Six sections. One clear next step.", zh: "六个栏目，一次说清下一步。" },
  dataDetails: { en: "Data details", zh: "数据说明" },
  footerDetails: { en: "About saving", zh: "保存说明" },

  /* club card */
  clubCardTitle: { en: "Club card", zh: "俱乐部卡" },
  clubCardIntro: {
    en: "The identity, colours and line ratings the club home page would lead with.",
    zh: "俱乐部首页将优先展示的身份、配色与分线评分。",
  },
  shortName: { en: "Short name", zh: "简称" },
  city: { en: "City", zh: "城市" },
  kitColours: { en: "Kit colours", zh: "球衣配色" },
  homeKit: { en: "Home kit", zh: "主场球衣" },
  awayKit: { en: "Away kit", zh: "客场球衣" },
  currentFormation: { en: "Current formation", zh: "当前阵型" },
  formationOptions: { en: "Formation options", zh: "阵型选项" },
  current: { en: "Current", zh: "当前" },
  overallValue: { en: "Overall", zh: "总评" },
  formula: {
    en: "Overall = DEF 30% + MID 30% + ATT 30% + GK 10%",
    zh: "总评 = DEF 30% + MID 30% + ATT 30% + GK 10%",
  },
  progressToNext: { en: "Progress to the next level", zh: "升级进度" },
  nextLevel: { en: "{0} XP to level {1}", zh: "距等级 {1} 还差 {0} 经验值" },
  defence: { en: "Defence", zh: "防线" },
  midfield: { en: "Midfield", zh: "中场" },
  attack: { en: "Attack", zh: "锋线" },
  goalkeeper: { en: "Goalkeeper", zh: "门将" },
  facilitiesTitle: { en: "Facilities", zh: "设施" },
  trainingCentre: { en: "Training centre", zh: "训练中心" },
  scoutCentre: { en: "Scout centre", zh: "球探中心" },
  stadium: { en: "Stadium", zh: "球场" },

  /* squad */
  squadIntro: {
    en: "The twenty founding players. Starters follow the current formation; the bench keeps squad order. Fit and the next PAS training quote are shown for every row.",
    zh: "20 名初始球员。首发按当前阵型排列，替补按球队阵容顺序排列。每一行都展示位置适配与下一笔 PAS 培养报价。",
  },
  counts: { en: "GK {0} · DEF {1} · MID {2} · ATT {3}", zh: "门将 {0} · 后卫 {1} · 中场 {2} · 前锋 {3}" },
  starters: { en: "Starting XI", zh: "首发阵容" },
  bench: { en: "Bench", zh: "替补席" },
  benchNote: { en: "Bench players keep squad order; fit applies to formation slots only.", zh: "替补按阵容顺序排列；位置适配仅按阵型槽位计算。" },
  columnNumber: { en: "No.", zh: "号码" },
  columnPlayer: { en: "Player", zh: "球员" },
  columnPosition: { en: "Position", zh: "位置" },
  columnLine: { en: "Line", zh: "线位" },
  columnOvr: { en: "OVR", zh: "综合" },
  columnFit: { en: "Fit", zh: "适配" },
  columnTraining: { en: "Next PAS training", zh: "下一笔 PAS 培养" },
  columnStatus: { en: "Training centre", zh: "训练中心" },
  columnFitness: { en: "Fitness", zh: "体能" },
  columnCondition: { en: "Status", zh: "状态" },
  conditionAvailable: { en: "Available", zh: "可用" },
  conditionInjured: { en: "Injured", zh: "伤停" },
  conditionTired: { en: "Tired", zh: "疲劳" },
  conditionInjuryBadge: { en: "Out {0}", zh: "伤停 {0} 场" },
  conditionStarterAvg: { en: "XI fitness {0}", zh: "首发体能 {0}" },
  conditionTitle: { en: "Condition", zh: "球员状态" },
  conditionOverviewLabel: { en: "Squad condition: {0} available, {1} injured, {2} tired; starting XI fitness {3}", zh: "球队状态：可用 {0}、伤停 {1}、疲劳 {2}；首发平均体能 {3}" },
  trainingInjured: { en: "Injured — training unavailable", zh: "伤停 — 无法培养" },
  clubDetailInjured: { en: "This player is injured; wait for recovery before training.", zh: "该球员伤停中，恢复后才能培养。" },
  assistantTitle: { en: "Assistant", zh: "助教" },
  assistantAutoSquad: { en: "Auto-squad", zh: "自动排阵" },
  assistantAutoSubs: { en: "Auto-substitutions", zh: "自动换人" },
  assistantNote: { en: "The assistant only replaces players who cannot play; it never overrides a healthy XI you set by hand.", zh: "助教只会替换无法出场的球员，不会覆盖你手动排好的健康首发。" },
  assistantOn: { en: "Assistant setting saved: {0} on.", zh: "助教设置已保存：{0}已开启。" },
  assistantOff: { en: "Assistant setting saved: {0} off.", zh: "助教设置已保存：{0}已关闭。" },
  assistantPreMatch: { en: "Assistant will adjust {0} unavailable starter(s).", zh: "助教会自动调整 {0} 名无法出场的首发。" },
  assistantPreMatchManual: { en: "{0} unavailable starter(s); auto-squad is off.", zh: "{0} 名首发无法出场；自动排阵已关闭。" },
  conditionSummaryTitle: { en: "Post-match condition", zh: "赛后体能" },
  conditionSummaryAverage: { en: "Starting XI fitness {0} → {1}", zh: "首发平均体能 {0} → {1}" },
  conditionSummaryNewInjuries: { en: "New injuries: {0}", zh: "新增伤病：{0}" },
  conditionSummaryNoInjuries: { en: "No new injuries", zh: "无新增伤病" },
  conditionSummaryQuick: { en: "Quick match", zh: "快速比赛" },
  conditionSummaryLive: { en: "Live match", zh: "临场指挥" },
  assistantSettingsHint: { en: "Defaults are on. Changes apply to the next match.", zh: "默认开启；修改会应用于下一场比赛。" },
  allowed: { en: "Allowed", zh: "可培养" },
  blocked: { en: "Blocked", zh: "被阻挡" },
  initialPlayer: { en: "Initial squad", zh: "初始球员" },
  signedPlayer: { en: "Signed", zh: "签约球员" },
  leftFoot: { en: "Left foot", zh: "左脚" },
  rightFoot: { en: "Right foot", zh: "右脚" },
  fitNote: {
    en: "Fit combines the player's natural position with the formation slot: 100% familiar, 95% adjacent or compatible, 85% clearly unsuitable.",
    zh: "位置适配＝球员自然位置与阵型槽位的匹配度：熟悉 100%、相邻或兼容 95%、明显不适合 85%。",
  },
  fitBench: { en: "No starting slot assigned", zh: "未安排首发槽位" },
  blockedNote: {
    en: "{0} starting quote(s) are blocked by the current training-centre level. Upgrade the training centre before buying those PAS points.",
    zh: "有 {0} 笔首发培养被当前训练中心等级阻挡；需要先升级训练中心才能购买这些 PAS 点数。",
  },
  noBlockedNote: {
    en: "No starting quote is blocked at the current training-centre level.",
    zh: "当前训练中心等级下没有首发培养被阻挡。",
  },

  /* line explanation */
  linesTitle: { en: "How the line ratings work", zh: "分线评分规则" },
  linesIntro: {
    en: "Every outfield player's line score uses fixed attribute weights. A team line rating is the average of that line's starters, shown to one decimal place.",
    zh: "每名外场球员的分线评分按固定权重计算；球队分线评分是该线位首发的平均值，保留一位小数。",
  },
  lineDef: { en: "Defence (DEF)", zh: "防线（DEF）" },
  lineMid: { en: "Midfield (MID)", zh: "中场（MID）" },
  lineAtt: { en: "Attack (ATT)", zh: "锋线（ATT）" },
  weightAttribute: { en: "Attribute", zh: "属性" },
  weightWeight: { en: "Weight", zh: "权重" },
  fitTitle: { en: "Position fit", zh: "位置适配" },
  fitIntro: {
    en: "A starter in a slot is scaled by how well their natural position fits that slot:",
    zh: "首发球员按自然位置与阵型槽位的匹配程度缩放评分：",
  },
  fitExact: { en: "Familiar position", zh: "熟悉位置" },
  fitCompatible: { en: "Adjacent / compatible position", zh: "相邻、兼容位置" },
  fitUnsuitable: { en: "Clearly unsuitable position", zh: "明显不适合的位置" },
  gkNote: {
    en: "Goalkeepers keep the goalkeeper attributes and take the 10% GK share of the overall rating. The formula is only a way to explain the squad; the match engine reads each player's actual attributes.",
    zh: "门将沿用门将能力，并以 10% 计入总评。该公式只用于解释阵容；比赛引擎读取每名球员的真实属性。",
  },
  attrPac: { en: "Pace", zh: "速度" },
  attrSho: { en: "Shooting", zh: "射门" },
  attrPas: { en: "Passing", zh: "传球" },
  attrDri: { en: "Dribbling", zh: "盘带" },
  attrDef: { en: "Defending", zh: "防守" },
  attrPhy: { en: "Physical", zh: "身体" },

  /* migration */
  migrationTitle: { en: "Migration preview", zh: "迁移预览" },
  migrationIntro: {
    en: "What would carry over from the current planner if the club pivot were applied. This page only previews the values; it applies nothing.",
    zh: "如果切换到俱乐部经营，现有计划数据会如何迁移。本页只预览数值，不应用任何改动。",
  },
  migrationDetails: { en: "Carried values", zh: "迁移数值" },
  migrationXp: { en: "XP carried over", zh: "迁移经验值" },
  migrationFunds: { en: "Funds carried over", zh: "迁移资金" },
  migrationGrant: { en: "One-off initial grant", zh: "首次建队一次性资金" },
  migrationGrantNote: { en: "Issued once per account and never re-issued.", zh: "每个账户只发放一次，不会重复发放。" },
  displayRights: { en: "Display rights", zh: "外观权益" },
  frames: { en: "Frames", zh: "头像框" },
  backdrops: { en: "Backdrops", zh: "背景" },
  kits: { en: "Kits", zh: "球衣" },
  frozen: { en: "Frozen", zh: "冻结项" },
  personalAttributes: { en: "Personal attributes", zh: "个人属性" },
  skillPoints: { en: "Skill points", zh: "技能点" },
  matchHistory: { en: "Match history", zh: "比赛记录" },
  rewardBaseline: { en: "Reward baseline", zh: "奖励计数基准" },
  rewardIdentities: { en: "Reward identities", zh: "奖励身份数" },
  sessionIdentities: { en: "Session identities", zh: "专注场次数" },
  activeSession: { en: "Active focus session", zh: "进行中的专注" },
  warnings: { en: "Warnings", zh: "提示" },
  noWarnings: { en: "No warnings.", zh: "没有提示。" },
  none: { en: "None", zh: "无" },
  readonlyTitle: { en: "Read-only preview", zh: "只读预览" },
  readonlyMain: {
    en: "read-only preview, nothing is written",
    zh: "只读预览，未写入任何数据",
  },
  rawJson: { en: "Raw migration preview (JSON)", zh: "迁移预览原始数据（JSON）" },
  rawJsonHint: {
    en: "Exactly the object returned by the domain layer. Expand it to inspect every field.",
    zh: "领域层返回的原始对象；展开可核对每一个字段。",
  },

  /* actionable manager mode */
  interactiveBadge: { en: "Interactive", zh: "可操作" },
  savedToPlanner: { en: "Changes save to your planner", zh: "改动会保存到你的计划" },
  walletFunds: { en: "Available funds", zh: "可用资金" },
  walletNote: { en: "spent through real receipts", zh: "通过真实回执扣款" },
  sampleActionsNote: {
    en: "This is sample data only. Creating, training and line-up changes need a signed-in planner.",
    zh: "当前是示例数据。建队、培养和排阵需要先登录真实计划数据。",
  },
  loadingClub: { en: "Reading your club…", zh: "正在读取你的俱乐部…" },
  createTitle: { en: "Create your club", zh: "建立你的俱乐部" },
  createIntro: {
    en: "Pick a name, a two-to-four character short name, colours and a starting formation. Twenty original players are generated once and saved with the club.",
    zh: "填写队名、2–4 字简称、主辅色和初始阵型。系统会一次性生成 20 名原创球员并随俱乐部一起保存。",
  },
  createName: { en: "Club name", zh: "俱乐部名称" },
  createShortName: { en: "Short name", zh: "简称" },
  createCity: { en: "City", zh: "城市" },
  createPrimary: { en: "Primary colour", zh: "主色" },
  createSecondary: { en: "Secondary colour", zh: "辅色" },
  createFormation: { en: "Starting formation", zh: "初始阵型" },
  createSubmit: { en: "Create club", zh: "建立俱乐部" },
  creating: { en: "Creating…", zh: "建立中…" },
  createSuccess: { en: "Club created and saved: {0}", zh: "俱乐部已建立并保存：{0}" },
  createNameHint: { en: "2–40 characters.", zh: "2–40 个字符。" },
  createShortHint: { en: "2–4 characters, shown on the crest.", zh: "2–4 个字符，显示在队徽上。" },
  createPreview: { en: "Preview", zh: "预览" },
  createNamePlaceholder: { en: "Northbridge FC", zh: "北桥联队" },
  createShortPlaceholder: { en: "NBR", zh: "北桥" },
  createCityPlaceholder: { en: "Northbridge", zh: "北桥" },

  trainingTitle: { en: "Train a player", zh: "培养球员" },
  trainingIntro: {
    en: "Spend club funds to raise one attribute by +1. Prices follow PLAN.md and the training centre caps how high an attribute can go.",
    zh: "使用俱乐部资金把一项属性提升 1 点。价格遵循 PLAN.md；训练中心等级决定属性上限。",
  },
  trainingPlayer: { en: "Player", zh: "球员" },
  trainingAttribute: { en: "Attribute", zh: "属性" },
  trainingDefaultHint: { en: "Defaults to the weakest starting slot.", zh: "默认选中首发阵容中的短板。" },
  trainingCurrent: { en: "Attribute change", zh: "属性变化" },
  trainingPrice: { en: "Price", zh: "价格" },
  trainingCentreCap: { en: "Training centre cap", zh: "训练中心上限" },
  trainingBlocked: { en: "Blocked by the training centre", zh: "被训练中心上限阻挡" },
  trainingAvailable: { en: "Available", zh: "可以培养" },
  trainingOvr: { en: "OVR change", zh: "总评变化" },
  trainingLines: { en: "Line ratings after training", zh: "培养后的分线评分" },
  trainingConfirm: { en: "Train for {0} FC", zh: "花费 {0} 资金培养" },
  trainingSaving: { en: "Training…", zh: "培养中…" },
  trainingInsufficient: { en: "Not enough club funds.", zh: "俱乐部资金不足。" },
  trainingBlockedAction: { en: "Training centre limit", zh: "训练中心上限阻挡" },
  trainingNoChange: { en: "no change", zh: "无变化" },
  trainingSuccess: { en: "Receipt: {0} · {1} FC", zh: "回执：{0} · {1} 资金" },
  receiptLabel: { en: "Receipt", zh: "回执" },
  recentReceipts: { en: "Recent receipts", zh: "最近回执" },
  noReceipts: { en: "No club receipts yet.", zh: "还没有俱乐部回执。" },
  trainingReceiptNote: {
    en: "The receipt is stored in your planner and debits the same FC Credits ledger as everything else.",
    zh: "回执保存在你的计划数据中，并从同一份 FC 资金账本扣款。",
  },

  lineupTitle: { en: "Line-up & formation", zh: "首发与阵型" },
  lineupIntro: {
    en: "Starters follow the formation slot order. One-click re-picks the best fit for every slot; changing formation re-picks for the new shape.",
    zh: "首发按阵型槽位顺序排列。「一键合理排阵」会为每个槽位挑选最合适的人；切换阵型会按新阵型自动重排。",
  },
  lineupFormation: { en: "Formation", zh: "阵型" },
  lineupAutoPick: { en: "Auto pick best XI", zh: "一键合理排阵" },
  lineupSaving: { en: "Applying…", zh: "应用中…" },
  lineupSuccess: { en: "Line-up saved: {0} · 11 starters", zh: "首发已保存：{0} · 11 人" },
  lineupFormationNote: { en: "Changing formation saves a new line-up with the same 11 players re-picked for the new shape.", zh: "切换阵型会保存一份新首发：按新阵型重新挑选 11 人。" },
  lineupSlot: { en: "Slot", zh: "位置" },
  starterPill: { en: "Starter", zh: "首发" },
  benchPill: { en: "Bench", zh: "替补" },

  commandBusy: { en: "Saving…", zh: "保存中…" },
  commandFailed: { en: "Could not save: {0}", zh: "保存失败：{0}" },
  revisionConflict: {
    en: "Your planner changed in another tab. The latest data was reloaded — please try again.",
    zh: "计划数据已在其他标签页更新，已重新载入最新数据，请再试一次。",
  },
  refreshAction: { en: "Reload planner data", zh: "重新载入计划数据" },
  refreshing: { en: "Reloading…", zh: "重新载入中…" },
  createFailed: { en: "Could not create the club: {0}", zh: "无法建立俱乐部：{0}" },
  lineupFailed: { en: "Could not save the line-up: {0}", zh: "无法保存首发：{0}" },
  trainResult: { en: "{0} {1} {2} → {3} · OVR {4} → {5}", zh: "{0} {1} {2} → {3} · 总评 {4} → {5}" },
  lineRatingBeforeAfter: { en: "was {0}", zh: "原 {0}" },
  facilitiesTitle2: { en: "Facilities", zh: "设施" },
  capValue: { en: "{0} (cap {1})", zh: "{0}（上限 {1}）" },

  /* tactics */
  tacticsTitle: { en: "Tactics", zh: "战术" },
  tacticsIntro: {
    en: "Each tactic levels up a different line bonus. Switching is free and keeps every level; training costs club funds and applies the bonus to the active tactic.",
    zh: "每套战术对不同的线位提供属性加成。切换免费且保留等级；训练需要花费俱乐部资金，加成只作用于当前激活的战术。",
  },
  tacticBalanced: { en: "Balanced", zh: "均衡" },
  tacticPossession: { en: "Possession", zh: "控球" },
  tacticCounter: { en: "Counter", zh: "快速反击" },
  tacticWide: { en: "Wide", zh: "边路" },
  tacticPress: { en: "High press", zh: "高位压迫" },
  tacticActive: { en: "Active", zh: "已激活" },
  tacticActivate: { en: "Activate", zh: "切换" },
  tacticTrain: { en: "Train to L{1} · {0} FC", zh: "训练至 L{1} · {0} 资金" },
  tacticMax: { en: "Max level", zh: "已满级" },
  tacticLevel: { en: "Level {0}/{1}", zh: "等级 {0}/{1}" },
  tacticBonus: { en: "+{0} {1} · {2}", zh: "+{0} {1} · {2}" },
  tacticRatingsNote: {
    en: "Line ratings include the active tactic bonus. Switch or train a tactic to see them move.",
    zh: "分线评分已包含当前战术加成。切换或训练战术后可以看到数值变化。",
  },
  tacticSwitched: { en: "Tactic switched: {0}", zh: "已切换战术：{0}" },
  tacticInactiveHint: {
    en: "Buying a level does not switch the active tactic.",
    zh: "购买等级不会自动切换当前战术。",
  },
  tacticBought: { en: "Tactic trained: {0}", zh: "战术已训练：{0}" },
  receiptLine: { en: "Receipt: {0} · {1} FC", zh: "回执：{0} · {1} 资金" },
  insufficientFunds: { en: "Not enough club funds.", zh: "俱乐部资金不足。" },
  savingAction: { en: "Saving…", zh: "保存中…" },

  /* facilities */
  facilitiesIntro: {
    en: "Upgrade the training centre, scout centre and stadium with club funds. Later levels need a higher club level.",
    zh: "使用俱乐部资金升级训练中心、球探中心和球场。后续等级需要更高的俱乐部等级。",
  },
  facilityEffectTraining: { en: "Sets the cap for bought attribute points.", zh: "决定属性培养的上限。" },
  facilityEffectScout: { en: "Improves the players you can scout.", zh: "提升可考察的球员范围。" },
  facilityEffectStadium: { en: "Grows the match-day crowd and income.", zh: "提高比赛日上座与收入。" },
  facilityLevel: { en: "Lv {0}/{1}", zh: "Lv {0}/{1}" },
  facilityNext: { en: "Next level: {0} FC", zh: "下一级：{0} 资金" },
  facilityGate: { en: "Unlocks at club level {0}", zh: "俱乐部等级 {0} 解锁" },
  facilityGateHint: { en: "Reach club level {0} first.", zh: "请先达到俱乐部等级 {0}。" },
  facilityMax: { en: "Fully built", zh: "已满级" },
  facilityUpgrade: { en: "Upgrade", zh: "升级" },
  facilityUpgrading: { en: "Upgrading…", zh: "升级中…" },
  facilityCapChange: { en: "Training cap {0} → {1}", zh: "培养上限 {0} → {1}" },
  facilityUpgraded: { en: "Facility upgraded: {0}", zh: "设施已升级：{0}" },

  /* match */
  matchTitle: { en: "Match", zh: "比赛" },
  decorTitle: { en: "Stadium decorations", zh: "球场装饰" },
  decorIntro: { en: "Decorate the pitch, stands and floodlights. Everything unlocked is free.", zh: "装饰草皮、看台与泛光灯。已解锁的装饰全部免费。" },
  decorPitch: { en: "Pitch", zh: "草皮" },
  decorStands: { en: "Stands", zh: "看台" },
  decorLights: { en: "Floodlights", zh: "泛光灯" },
  decorUse: { en: "Use", zh: "使用" },
  decorInUse: { en: "In use", zh: "使用中" },
  decorLocked: { en: "Locked", zh: "未解锁" },
  decorUnlockedCount: { en: "{0} of {1} unlocked", zh: "已解锁 {0}/{1}" },
  decorUnlockFacility: { en: "{0} Lv{1} required", zh: "需要{0} Lv{1}" },
  decorUnlockTrophies: { en: "{0} trophies required", zh: "需要 {0} 座奖杯" },
  decorApplied: { en: "Decoration applied: {0}", zh: "已应用装饰：{0}" },

  storyboardTitle: { en: "Match storyboard", zh: "比赛分镜" },
  storyboardAria: { en: "Match storyboard panels", zh: "比赛分镜格子" },
  storyboardSummary: { en: "{0} panels · {1} beats", zh: "{0} 格 · {1} 个片场" },
  storyboardQuiet: { en: "Quiet spell", zh: "平静回合" },
  storyboardGoal: { en: "Goal", zh: "进球" },
  storyboardSave: { en: "Save", zh: "扑救" },
  storyboardChance: { en: "Chance", zh: "机会" },
  storyboardSub: { en: "Sub", zh: "换人" },
  storyboardNoData: { en: "No storyboard data for this match.", zh: "这场比赛没有分镜数据。" },
  storyboardHint: { en: "Tap a panel with a beat to open the 3D watch.", zh: "点击有事件的格子打开 3D 观战。" },

  matchIntro: {
    en: "Play a quick simulation against a fictional opponent. The result uses your real line-up, active tactic and a deterministic seed; matches neither cost nor pay club funds.",
    zh: "与虚构对手进行快速模拟。结果依据真实首发、当前战术和确定性种子计算；比赛既不消耗也不产出俱乐部资金。",
  },
  matchTierLabel: { en: "Opponent level", zh: "对手级别" },
  matchTierRookie: { en: "Rookie", zh: "新秀" },
  matchTierRising: { en: "Rising", zh: "新锐" },
  matchTierContender: { en: "Contender", zh: "劲旅" },
  matchTierElite: { en: "Elite", zh: "精英" },
  matchTierRookieDesc: { en: "Newly formed side, a gentler test.", zh: "新组建的球队，压力较小。" },
  matchTierRisingDesc: { en: "Solid lower-league side.", zh: "稳定的低级别联赛球队。" },
  matchTierContenderDesc: { en: "Promotion contender with a strong midfield.", zh: "具备升级实力的劲旅，中场强硬。" },
  matchTierEliteDesc: { en: "Top-flight quality: every line is dangerous.", zh: "顶级水平：每条线都很有威胁。" },
  matchSimulate: { en: "Quick simulate", zh: "快速模拟" },
  matchSimulating: { en: "Simulating…", zh: "模拟中…" },
  matchFinished: { en: "Match finished: {0}", zh: "比赛结束：{0}" },
  matchResultTitle: { en: "Latest result", zh: "最新赛果" },
  matchHomeShort: { en: "Home", zh: "主" },
  matchAwayShort: { en: "Away", zh: "客" },
  matchPossession: { en: "Possession", zh: "控球率" },
  matchShots: { en: "Shots (on target)", zh: "射门（射正）" },
  matchDominant: { en: "Dominant line", zh: "占优线位" },
  matchChances: { en: "Chances from", zh: "机会来自" },
  matchConceded: { en: "Conceded because", zh: "失球原因" },
  matchTacticNote: { en: "Tactic note", zh: "战术说明" },
  matchNextStep: { en: "Next step", zh: "下一步建议" },
  matchEven: { en: "Even", zh: "均势" },
  matchRecent: { en: "Recent matches", zh: "最近比赛" },
  matchEmpty: {
    en: "No matches played yet. Simulate one to start the record.",
    zh: "还没有比赛记录，先模拟一场吧。",
  },
  matchNoFunds: { en: "no funds paid", zh: "不产出资金" },

  /* transfers */
  transfersTitle: { en: "Transfers", zh: "引援与出售" },
  transfersIntro: {
    en: "Sign real players with club funds or sell squad players. The scout centre caps the OVR you can sign; the squad holds 25 players. Selling returns 50% of the signing price, and the gifted initial squad sells for nothing.",
    zh: "使用俱乐部资金签入真实球员，或出售阵容中的球员。球探中心等级决定可签入的 OVR 上限，阵容上限为 25 人。出售返还签约价的 50%，初始赠送球员出售返还为 0。",
  },
  scoutTitle: { en: "Scout list", zh: "球探名单" },
  scoutPositionFilter: { en: "Position", zh: "位置" },
  scoutPositionAll: { en: "All", zh: "全部" },
  scoutFiltersTitle: { en: "Scouting filters", zh: "球探筛选" },
  scoutLeague: { en: "League", zh: "联赛" },
  scoutLeagueOther: { en: "Other leagues", zh: "其他联赛" },
  scoutLeaguePremier: { en: "Premier League", zh: "英超" },
  scoutRegion: { en: "Region", zh: "地区" },
  scoutFilterAll: { en: "All", zh: "全部" },
  scoutClearFilters: { en: "Clear filters", zh: "清除筛选" },
  scoutFilterSummary: { en: "{0} · {1} players · {2} recommendations", zh: "{0} · {1} 名球员 · {2} 条推荐" },
  scoutRecommendEmpty: { en: "No recommendations match these filters.", zh: "没有符合筛选条件的推荐。" },
  scoutLoading: { en: "Loading the 2,062-player scouting roster…", zh: "正在加载 2,062 名球员的球探名单…" },
  scoutLoadFailed: { en: "Could not load the scouting roster: {0}", zh: "无法加载球探名单：{0}" },
  scoutRetry: { en: "Retry", zh: "重试" },
  scoutSortLabel: { en: "Sort", zh: "排序" },
  scoutSortOvr: { en: "OVR high to low", zh: "OVR 从高到低" },
  scoutSortPriceAsc: { en: "Price low to high", zh: "价格从低到高" },
  scoutSortPriceDesc: { en: "Price high to low", zh: "价格从高到低" },
  scoutCapFilter: { en: "Only within scout cap", zh: "仅显示球探上限内" },
  scoutCapInfo: {
    en: "Scout centre Lv {0} · cap {1} OVR",
    zh: "球探中心 Lv {0} · 上限 {1} OVR",
  },
  scoutCount: { en: "Showing {0} of {1} players", zh: "显示 {0} / {1} 名球员" },
  scoutEmpty: { en: "No players match these filters.", zh: "没有符合条件的球员。" },
  transferPrice: { en: "Price", zh: "价格" },
  transferSign: { en: "Sign", zh: "签入" },
  transferSigning: { en: "Signing…", zh: "签入中…" },
  transferSignAction: { en: "Sign · {0} FC", zh: "签入 · {0} 资金" },
  transferReasonFunds: { en: "Not enough funds", zh: "资金不足" },
  transferReasonCapped: { en: "Over scout cap ({0} OVR)", zh: "超出球探上限（{0} OVR）" },
  transferReasonInSquad: { en: "Already in squad", zh: "已在阵中" },
  transferReasonSquadFull: { en: "Squad full (25)", zh: "阵容已满（25 人）" },
  transferSignSuccess: { en: "Signed: {0} · {1} FC", zh: "已签入：{0} · {1} 资金" },
  sellColumn: { en: "Sell", zh: "出售" },
  sellAction: { en: "Sell · +{0} FC", zh: "出售 · +{0} 资金" },
  sellConfirm: { en: "Confirm sale (+{0} FC)", zh: "确认出售（+{0} 资金）" },
  sellConfirming: { en: "Selling…", zh: "出售中…" },
  sellCancel: { en: "Cancel", zh: "取消" },
  sellSuccess: { en: "Sold: {0} · refund {1} FC", zh: "已出售：{0} · 返还 {1} 资金" },
  sellNote: {
    en: "Initial players sell for 0. Signed players return 50% of their signing price; starting players must be moved to the bench before they can be sold.",
    zh: "初始球员出售返还 0；签约球员返还签约价的 50%；首发球员需要先换到替补才能出售。",
  },

  /* squad player cards + crest */
  squadViewLabel: { en: "Squad view", zh: "阵容视图" },
  squadCardsView: { en: "Card view", zh: "卡片视图" },
  squadListView: { en: "List view", zh: "列表视图" },
  cardsTitle: { en: "Player cards", zh: "球员卡" },
  cardsSummary: { en: "{0} cards · {1} starters · {2} bench", zh: "{0} 张卡 · {1} 首发 · {2} 替补" },
  cardsStarterAvg: { en: "Starting XI average OVR {0}", zh: "首发平均 OVR {0}" },
  cardsGold: { en: "Gold {0}", zh: "金卡 {0}" },
  cardsSilver: { en: "Silver {0}", zh: "银卡 {0}" },
  cardsBronze: { en: "Bronze {0}", zh: "铜卡 {0}" },
  cardTierGold: { en: "Gold", zh: "金卡" },
  cardTierSilver: { en: "Silver", zh: "银卡" },
  cardTierBronze: { en: "Bronze", zh: "铜卡" },
  cardAcademy: { en: "Academy", zh: "青训" },
  cardSigned: { en: "Signed", zh: "签入" },
  cardSignedPrice: { en: "Signed · {0} FC", zh: "签入 · {0} 资金" },
  cardCaptain: { en: "Captain", zh: "队长" },
  clubDetailOpen: { en: "Open player details", zh: "打开球员详情" },
  clubDetailTitle: { en: "Player details", zh: "球员详情" },
  clubDetailClose: { en: "Close player details", zh: "关闭球员详情" },
  clubDetailRadar: { en: "Attribute radar", zh: "属性雷达" },
  clubDetailCap: { en: "Training centre cap", zh: "训练中心上限" },
  clubDetailProgress: { en: "{0}% of cap {1}", zh: "上限 {1} 的 {0}%" },
  clubDetailNext: { en: "Next: {0} FC", zh: "下次：{0} 资金" },
  clubDetailAtCap: { en: "At training cap", zh: "已达训练上限" },
  clubDetailMax: { en: "Already at the maximum", zh: "已达属性上限" },
  clubDetailTrain: { en: "Train", zh: "培养" },
  clubDetailTraining: { en: "Training…", zh: "培养中…" },
  clubDetailInsufficient: { en: "Not enough funds (needs {0} FC)", zh: "资金不足（需要 {0} 资金）" },
  clubDetailOriginAcademy: { en: "Academy player", zh: "青训球员" },
  clubDetailOriginSigned: { en: "Signed for {0} FC", zh: "以 {0} 资金签入" },
  clubDetailLineRating: { en: "Line rating {0} · {1}", zh: "{1} 线评分 {0}" },
  clubDetailTrained: { en: "{0} {1} {2} → {3} · {4} FC · funds {5} → {6}", zh: "{0} {1} {2} → {3} · {4} 资金 · 余额 {5} → {6}" },
  clubDetailNoTrain: { en: "No attribute can be trained yet.", zh: "暂时没有可培养的属性。" },
  clubDetailFunds: { en: "Available funds: {0} FC", zh: "可用资金：{0} 资金" },
  clubDetailSuggested: { en: "Suggested: {0}", zh: "建议：{0}" },
  crestAria: { en: "{0} crest · {1} stars", zh: "{0} 队徽 · {1} 星" },

  /* league */
  leagueTitle: { en: "League", zh: "联赛" },
  leagueIntro: {
    en: "Play a full season: eight clubs, fourteen rounds of a double round-robin. The top two promote, the bottom two relegate, and seasons neither cost nor pay club funds.",
    zh: "进行完整赛季：8 支球队、14 轮双循环。前两名升级、后两名降级；赛季不消耗也不产出俱乐部资金。",
  },
  leagueStartTitle: { en: "Start a season", zh: "开始一个赛季" },
  leagueTierLabel: { en: "League tier", zh: "联赛级别" },
  leagueTierBaseline: { en: "Baseline {0} OVR", zh: "基准实力 {0} OVR" },
  leagueStartButton: { en: "Start season", zh: "开始赛季" },
  leagueStarting: { en: "Starting…", zh: "开始中…" },
  leagueStarted: { en: "Season started: {0}", zh: "赛季已开始：{0}" },
  leagueSummary: {
    en: "Round {0} / {1} · position {2} · {3} pts",
    zh: "第 {0}/{1} 轮 · 第 {2} 名 · {3} 分",
  },
  leagueTable: { en: "League table", zh: "积分榜" },
  leagueRank: { en: "Rank", zh: "名次" },
  leagueTeam: { en: "Team", zh: "球队" },
  leaguePlayed: { en: "P", zh: "场次" },
  leagueWon: { en: "W", zh: "胜" },
  leagueDrawn: { en: "D", zh: "平" },
  leagueLost: { en: "L", zh: "负" },
  leagueGoals: { en: "GF:GA", zh: "进失球" },
  leaguePoints: { en: "Pts", zh: "积分" },
  leagueYou: { en: "You", zh: "你" },
  leaguePromotion: { en: "Promotion", zh: "升级区" },
  leagueRelegation: { en: "Relegation", zh: "降级区" },
  leagueNextRound: { en: "Play next round", zh: "进行下一轮" },
  leagueSimulating: { en: "Simulating…", zh: "模拟中…" },
  leagueRoundDone: { en: "Round {0} finished", zh: "第 {0} 轮结束" },
  leagueRecent: { en: "Latest round results", zh: "最近一轮结果" },
  leagueNoResults: { en: "No round has been played yet.", zh: "还没有进行任何一轮。" },
  leagueRebuiltNote: {
    en: "Results rebuilt from the season seed after reload.",
    zh: "页面重新加载后按赛季种子重建的结果。",
  },
  leagueFinalPosition: { en: "Final position: {0}", zh: "最终排名：第 {0} 名" },
  leaguePromoted: { en: "Promoted! Next season: {0}", zh: "升级！下赛季：{0}" },
  leagueRelegated: { en: "Relegated. Next season: {0}", zh: "降级。下赛季：{0}" },
  leagueStayed: { en: "Stayed in {0}", zh: "留在 {0}" },
  leagueNextSeason: { en: "Start next season · {0}", zh: "开始下一赛季 · {0}" },
  leagueNoFunds: { en: "Seasons cost and pay nothing", zh: "赛季不消耗也不产出资金" },

  /* challenge cup */
  cupTitle: { en: "Challenge Cup", zh: "挑战杯" },
  cupIntro: {
    en: "A fictional four-club knockout: two semi-finals and a final. Real clubs from the directory appear only as fictional opponents; cups neither cost nor pay club funds.",
    zh: "虚构的 4 队淘汰赛：两场半决赛加一场决赛。目录中的真实俱乐部仅作为虚构对手出场；杯赛不消耗也不产出俱乐部资金。",
  },
  cupDisclaimer: {
    en: "Fictional challenge cup — not a real fixture list.",
    zh: "虚构挑战杯，不是真实赛程。",
  },
  cupTierLabel: { en: "Cup level", zh: "杯赛级别" },
  cupStartButton: { en: "Start challenge cup", zh: "开始挑战杯" },
  cupStarting: { en: "Starting…", zh: "开始中…" },
  cupStarted: { en: "Challenge cup started: {0}", zh: "挑战杯已开始：{0}" },
  cupNoFunds: { en: "Cups cost and pay nothing", zh: "杯赛不消耗也不产出资金" },
  cupSemiFinal: { en: "Semi-finals", zh: "半决赛" },
  cupFinal: { en: "Final", zh: "决赛" },
  cupFinalTbd: { en: "The final pairing appears after the semi-finals.", zh: "决赛对阵将在半决赛结束后产生。" },
  cupVs: { en: "vs", zh: "vs" },
  cupPenalties: { en: "Penalties", zh: "点球大战" },
  cupPensScore: { en: "Penalties {0}–{1}", zh: "点球 {0}–{1}" },
  cupPensAria: { en: "Penalty shootout, home {0}, away {1}", zh: "点球大战：主队 {0}，客队 {1}" },
  cupYourOpponent: { en: "Your opponent: {0} ({1})", zh: "你的对手：{0}（{1}）" },
  cupEliminatedWaiting: {
    en: "Your club is out; the final is still to be played.",
    zh: "你的球队已被淘汰，决赛仍待进行。",
  },
  cupRoundSemisPending: { en: "Semi-finals to play", zh: "半决赛待进行" },
  cupRoundSemisDone: { en: "Semi-finals done · final to play", zh: "半决赛已结束 · 决赛待进行" },
  cupRoundFinished: { en: "Cup finished", zh: "杯赛已结束" },
  cupPlaySemis: { en: "Play semi-finals", zh: "进行半决赛" },
  cupPlayFinal: { en: "Play final", zh: "进行决赛" },
  cupSimulating: { en: "Simulating…", zh: "模拟中…" },
  cupSemiDone: { en: "Semi-finals finished", zh: "半决赛结束" },
  cupFinalDone: { en: "Final finished", zh: "决赛结束" },
  cupWon: { en: "Champions!", zh: "夺冠！" },
  cupLost: { en: "Eliminated", zh: "被淘汰" },
  cupChampion: { en: "Champion: {0}", zh: "冠军：{0}" },
  cupWonFlash: { en: "your club won the cup", zh: "你的俱乐部夺得挑战杯" },
  cupLostFlash: { en: "cup over — {0} won", zh: "杯赛结束——{0} 夺冠" },
  cupReplay: { en: "Play another cup · {0}", zh: "再打一届 · {0}" },

  /* honours + match player ratings */
  honoursTitle: { en: "Honours", zh: "荣誉" },
  honoursIntro: {
    en: "Trophies the club has won. League titles and Challenge Cups appear here as soon as the server records them.",
    zh: "俱乐部获得的奖杯。联赛冠军与挑战杯会在服务器记录后出现在这里。",
  },
  honoursEmpty: {
    en: "No trophies yet. Win the Challenge Cup or a league title and it will appear here.",
    zh: "还没有奖杯。赢得挑战杯或联赛冠军后，奖杯会出现在这里。",
  },
  honourLeagueTitle: { en: "League title", zh: "联赛冠军" },
  honourMeta: { en: "{0} · won {1}", zh: "{0} · 获得于 {1}" },
  matchPlayerRatings: { en: "Player ratings", zh: "本场评分" },
  matchRatingsNote: {
    en: "Rebuilt locally from the same seed; goalkeepers are not rated.",
    zh: "评分由同一 seed 在本地重建；门将不参与评分。",
  },
  matchRatingsMismatch: {
    en: "Rebuilt with the current squad and tactic, so the score can differ from the stored record.",
    zh: "按当前阵容与战术重建，比分可能与已保存记录不同。",
  },
  matchRatingsUnavailable: { en: "Ratings could not be rebuilt for this match.", zh: "无法重建本场评分。" },
  columnGoals: { en: "Goals", zh: "进球" },
  columnRating: { en: "Rating", zh: "评分" },

  /* migration summary + one-time confirm */
  migrateSummaryTitle: { en: "Migration summary", zh: "迁移摘要" },
  migrateSummaryIntro: {
    en: "PLAN 4.3: what carries over from the legacy club. The summary below is read-only until you confirm it once.",
    zh: "PLAN 4.3：旧俱乐部数据如何承接。以下摘要为只读预览，确认一次后才会写入。",
  },
  migrateStatusTitle: { en: "Migration status", zh: "迁移状态" },
  migratePreviewNote: { en: "Read-only preview; nothing is written until you confirm.", zh: "只读预览；确认后才写入。" },
  migrateConfirmHint: { en: "Confirming applies the summary above once.", zh: "确认后会一次性应用上面的摘要。" },
  migrateConfirm: { en: "Confirm and apply migration", zh: "确认并应用迁移" },
  migrateApplying: { en: "Applying…", zh: "确认中…" },
  migrateDone: { en: "Migration applied (at {0})", zh: "迁移完成（已于 {0}）" },
  migrateFundsAnnounce: { en: "Club funds {0} → {1} FC", zh: "可用资金 {0} → {1} 资金" },
  migrateGranted: { en: "one-off 150 FC granted", zh: "已发放一次性 150 资金" },
  migratedStatus: { en: "Migrated at {0}", zh: "已于 {0} 迁移" },
  migrateOnceNote: { en: "The one-off 150 FC grant is paid only once.", zh: "一次性 150 资金只发放一次。" },
  migrateXpNote: { en: "Legacy XP carries over 1:1.", zh: "既有经验值一比一承接。" },
  migrateFundsNote: { en: "Existing club funds carry over as they are.", zh: "现有俱乐部资金原样承接。" },
  migrateFrozenNote: {
    en: "Personal attributes and skill points are frozen; old matches are not settled automatically.",
    zh: "个人属性与技能点会被封存；旧比赛不会自动结算。",
  },
  migrateBaselineNote: {
    en: "Reward and session baselines keep counting from the existing history.",
    zh: "奖励与会话基线从现有历史继续计算。",
  },

  /* base navigation + season history */
  baseNavTitle: { en: "Base", zh: "基地" },
  baseNavAria: { en: "Base navigation", zh: "基地导航" },
  baseNavClub: { en: "Club card", zh: "俱乐部卡" },
  baseNavMatch: { en: "Match", zh: "比赛" },
  baseNavTactics: { en: "Tactics", zh: "战术" },
  baseNavTraining: { en: "Training", zh: "培养" },
  baseNavFacilities: { en: "Facilities", zh: "设施" },
  baseNavTransfers: { en: "Transfers", zh: "引援" },
  baseNavLeague: { en: "League", zh: "联赛" },
  baseNavCup: { en: "Cup", zh: "挑战杯" },
  baseNavHonours: { en: "Honours", zh: "荣誉" },
  baseNavMigrate: { en: "Migration", zh: "迁移" },
  historyTitle: { en: "Season history", zh: "赛季历史" },
  historyCount: { en: "{0} seasons", zh: "{0} 个赛季" },
  historyEmpty: {
    en: "No season history yet. Finish or start a new season to record it here.",
    zh: "还没有赛季历史。完成或开始新赛季后会记录在这里。",
  },
  historyTier: { en: "Tier", zh: "级别" },
  historyPosition: { en: "Position", zh: "名次" },
  historyPoints: { en: "Points", zh: "积分" },
  historyRecord: { en: "W-D-L", zh: "胜平负" },
  historyGoals: { en: "GF:GA", zh: "进失球" },
  historyOutcome: { en: "Outcome", zh: "结果" },
  historyDate: { en: "Date", zh: "日期" },
  historyChampion: { en: "Champions", zh: "联赛冠军" },
  historyPromoted: { en: "Promoted", zh: "升级" },
  historyRelegated: { en: "Relegated", zh: "降级" },
  historyStayed: { en: "Stayed", zh: "保级" },
  historyAbandoned: { en: "Abandoned", zh: "中途放弃" },
  historyRecordFormat: { en: "{0}W {1}D {2}L", zh: "{0}胜 {1}平 {2}负" },

  /* replay */
  replayOpen: { en: "Watch replay", zh: "回放本场" },
  replayClose: { en: "Close replay", zh: "关闭回放" },
  replayTitle: { en: "Match replay", zh: "观战回放" },
  replayDataBadge: { en: "Match replay · data-driven (not 3D real-time)", zh: "观战回放 · 数据驱动（非 3D 实时）" },
  replay3dNote: {
    en: "Text replay of the saved timeline; the first 3D watch is an event animation, not a physics simulation.",
    zh: "文字回放已保存的时间线；3D 观战第一版是事件动画，不是物理模拟。",
  },
  watch3dOpen: { en: "3D watch", zh: "3D 观战" },
  watch3dClose: { en: "Close 3D watch", zh: "关闭 3D 观战" },
  watch3dLoading: { en: "Loading 3D scene…", zh: "正在加载 3D 场景…" },
  watch3dFallbackTitle: { en: "3D watch unavailable in this browser", zh: "此浏览器无法使用 3D 观战" },
  watch3dFallbackNote: { en: "WebGL is unavailable. You can follow the same saved timeline as a text replay.", zh: "WebGL 不可用。你仍可用文字回放查看同一条已保存时间线。" },
  watch3dTextReplay: { en: "Use text replay", zh: "改用文字回放" },
  watch3dFallbackClose: { en: "Close", zh: "关闭" },
  matchTextReplay: { en: "Text replay", zh: "文字回放" },
  matchPlayAgain: { en: "Play again", zh: "再赛一场" },
  watchHero: { en: "Watch 3D", zh: "观看 3D" },
  newMatch: { en: "Start a new match", zh: "开始新比赛" },
  matchHeroTitle: { en: "Latest result", zh: "最新赛果" },
  replayUnavailable: {
    en: "This match has no timeline data, so it cannot be replayed.",
    zh: "此场比赛没有时间线数据，无法回放。",
  },
  replayPlay: { en: "Play", zh: "播放" },
  replayPause: { en: "Pause", zh: "暂停" },
  replayAgain: { en: "Replay", zh: "重新播放" },
  replayFullTime: { en: "Full time", zh: "终场" },
  replayFullTimeAnnounce: { en: "Full time: {0} {1} – {2} {3}", zh: "终场：{0} {1} – {2} {3}" },
  replaySpeedLabel: { en: "Replay speed", zh: "回放速度" },
  replayBack5: { en: "Back 5 minutes", zh: "后退 5 分钟" },
  replayForward5: { en: "Forward 5 minutes", zh: "前进 5 分钟" },
  replayProgressLabel: { en: "Match progress (minutes)", zh: "比赛进度（分钟）" },
  replayCommentary: { en: "Commentary", zh: "文字解说" },
  replayGoal: { en: "Goal", zh: "进球" },
  replaySave: { en: "Save", zh: "扑救" },
  replayChance: { en: "Chance", zh: "机会" },
  replayNoEvents: { en: "This match timeline has no events.", zh: "这场比赛的记分时间线没有事件。" },
  replayKeyboardHint: {
    en: "Space = play/pause · ←/→ = ±5 minutes",
    zh: "空格 = 播放/暂停 · ←/→ = ±5 分钟",
  },

  /* club tabs + overview */
  tabAria: { en: "Club sections", zh: "俱乐部栏目" },
  tabOverview: { en: "Overview", zh: "概览" },
  tabTeam: { en: "Team", zh: "球队" },
  tabClub: { en: "Club", zh: "俱乐部" },
  tabSquad: { en: "Squad", zh: "阵容" },
  tabMatch: { en: "Match", zh: "比赛" },
  tabCompetitions: { en: "League & cup", zh: "联赛杯赛" },
  tabTransfers: { en: "Recruitment & facilities", zh: "引援与设施" },
  tabHonours: { en: "Honours & display", zh: "荣誉与展示" },
  overviewTitle: { en: "Your club at a glance", zh: "俱乐部概览" },
  onboardingTitle: { en: "Getting started", zh: "新手引导" },
  onboardingStep1Title: { en: "Earn funds & XP", zh: "赚取资金与 XP" },
  onboardingStep1Body: { en: "Complete tasks and focus sessions to earn club funds and levels.", zh: "完成任务与专注会话，获得俱乐部资金与等级经验。" },
  onboardingStep2Title: { en: "Train players & tactics", zh: "培养球员与战术" },
  onboardingStep2Body: { en: "Spend funds to raise attributes and upgrade your match tactics.", zh: "用资金提升球员属性，并升级比赛战术。" },
  onboardingStep3Title: { en: "Play and watch 3D", zh: "打比赛，看 3D 观战" },
  onboardingStep3Body: { en: "Simulate or coach a match, then open the 3D watch to see the ball live.", zh: "模拟或临场指挥一场比赛，再打开 3D 观战看实时球路。" },
  onboardingNext: { en: "Next", zh: "下一步" },
  onboardingFinish: { en: "Finish", zh: "完成" },
  onboardingSkip: { en: "Skip", zh: "跳过" },
  onboardingReplay: { en: "Replay the guide", zh: "重看新手引导" },
  onboardingStep: { en: "Step {0} / 3", zh: "第 {0} / 3 步" },
  onboardingProgress: { en: "Onboarding step {0} of 3", zh: "新手引导第 {0} / 3 步" },
  onboardingSkipped: { en: "Guide skipped. Use ? to replay it anytime.", zh: "已跳过引导。可随时用 ? 重看。" },
  onboardingDismissed: { en: "Guide finished. Use ? to replay it anytime.", zh: "引导已完成。可随时用 ? 重看。" },
  balanceTitle: { en: "Income & goals", zh: "收入与目标" },
  balancePace: { en: "PLAN example pace: 4 tasks + 40 focus minutes per day — not live stats.", zh: "按 PLAN 示例节奏估算：每天 4 个任务 + 40 分钟专注——非实时统计。" },
  balanceDailyTitle: { en: "Daily income", zh: "每日收入" },
  balanceWeeklyTitle: { en: "Weekly income", zh: "每周收入" },
  balanceXp: { en: "XP", zh: "经验" },
  balanceFunds: { en: "Funds", zh: "资金" },
  balanceDaysTitle: { en: "Days to save", zh: "攒够所需天数" },
  balanceDays1000: { en: "1,000 funds", zh: "1,000 资金" },
  balanceDaysSigning: { en: "65-OVR signing", zh: "65 OVR 签约" },
  balanceDays: { en: "{0} days", zh: "{0} 天" },
  balanceGoalsTitle: { en: "Weekly goal affordability", zh: "每周目标可负担性" },
  balanceGoalTraining: { en: "Training point", zh: "培养点" },
  balanceGoalTactic: { en: "Tactic level 1", zh: "战术 Lv 1" },
  balanceGoalFacility: { en: "Facility upgrade", zh: "设施升级" },
  balanceGoalSigning: { en: "65-OVR signing", zh: "65 OVR 签约" },
  balanceGoalStadium: { en: "Stadium L2", zh: "球场 L2" },
  balanceAffordable: { en: "within a week", zh: "一周内" },
  balanceNotAffordable: { en: "{0} weeks", zh: "{0} 周" },
  balanceUnlimited: { en: "n/a", zh: "—" },
  exportTitle: { en: "Export club summary", zh: "导出俱乐部摘要" },
  exportIntro: { en: "Download a JSON and Markdown summary to your device. Nothing is uploaded.", zh: "将 JSON 与 Markdown 摘要下载到本地，不会上传任何数据。" },
  exportButton: { en: "Export summary", zh: "导出摘要" },
  exportAria: { en: "Download the club summary as JSON and Markdown", zh: "下载俱乐部摘要的 JSON 与 Markdown 文件" },
  exportDone: { en: "Club summary downloaded: {0}.json and {1}.md", zh: "俱乐部摘要已下载：{0}.json 与 {1}.md" },
  exportEmpty: { en: "No club data to export yet.", zh: "还没有可导出的俱乐部数据。" },
  overviewIntro: { en: "A short home for what matters. Pick a tab when you need the detail.", zh: "只保留重要内容，需要细节时再切换到对应栏目。" },
  overviewNext: { en: "Next steps", zh: "下一步" },
  overviewLatest: { en: "Latest result", zh: "最近一场" },
  overviewNoMatch: { en: "No match yet. Play a friendly to get started.", zh: "还没有比赛，先打一场友谊赛吧。" },
  overviewViewMatch: { en: "View match", zh: "查看比赛" },
  overviewQuick: { en: "Quick links", zh: "快捷入口" },
  overviewQuickSquad: { en: "Squad", zh: "阵容" },
  overviewQuickTactics: { en: "Tactics", zh: "战术" },
  overviewQuickTransfers: { en: "Transfers", zh: "引援" },
  overviewQuickLeague: { en: "League", zh: "联赛" },
  overviewStats: { en: "Club numbers", zh: "关键统计" },
  overviewPlayers: { en: "Players", zh: "球员" },
  overviewTrophies: { en: "Trophies", zh: "奖杯" },
  overviewSeasons: { en: "Seasons", zh: "赛季" },
  overviewPlan: { en: "Season plan", zh: "赛季计划" },
  overviewFormation: { en: "Formation & tactic", zh: "阵型与战术" },
  overviewContinue: { en: "Continue", zh: "继续" },
  viewAllDetails: { en: "View all details", zh: "查看全部细节" },
  moreDetails: { en: "More details", zh: "更多说明" },
  radarLabel: { en: "Line ratings radar", zh: "分线能力雷达" },
  budgetLabel: { en: "Funds compared with the cheapest training", zh: "资金与最低培养费用对比" },
  levelLabel: { en: "Club level", zh: "俱乐部等级" },
  trophyLabel: { en: "Trophy cabinet", zh: "奖杯收藏" },
  celebrationEyebrow: { en: "Trophy celebration", zh: "夺冠庆典" },
  celebrationClaim: { en: "Collect & continue", zh: "领取并继续" },
  celebrationHonours: { en: "View honours room", zh: "查看荣誉室" },
  celebrationClose: { en: "Close", zh: "关闭" },
  celebrationLater: { en: "Later", zh: "稍后再说" },
  celebrationRewatch: { en: "Rewatch celebration", zh: "重看庆典" },
  celebrationKit: { en: "Commemorative kit", zh: "纪念球衣" },
  celebrationNoKit: { en: "No commemorative kit — this trophy predates club kits.", zh: "旧奖杯无纪念球衣——它早于纪念球衣系统。" },
  celebrationStarsLabel: { en: "Trophy stars: {0}", zh: "奖杯星：{0}" },
  celebrationClaimed: { en: "Trophy celebration collected.", zh: "夺冠庆典已领取。" },
  celebrationReadonly: { en: "Replay · read-only", zh: "回顾 · 只读" },
  formationLabel: { en: "Starting formation", zh: "首发阵型" },
  roundProgressLabel: { en: "League round progress", zh: "联赛轮次进度" },
  cupProgressLabel: { en: "Cup progress", zh: "杯赛进度" },

  /* live match control */
  liveTitle: { en: "Live match control", zh: "临场指挥" },
  liveIntro: {
    en: "Eighteen five-minute blocks. Between blocks you can change your tactic for free; it affects the rest of the match.",
    zh: "共 18 个 5 分钟小节。小节之间可以免费更换战术，并影响后续小节。",
  },
  liveParity: {
    en: "Advancing all 18 blocks without decisions gives exactly the same match as the quick simulation for the same seed.",
    zh: "推进全部 18 节且不做任何决定时，结果与同种子的快速模拟完全一致。",
  },
  liveTierLabel: { en: "Opponent level", zh: "对手级别" },
  liveStart: { en: "Start live match", zh: "开始实时比赛" },
  liveStarting: { en: "Starting…", zh: "开始中…" },
  liveStarted: { en: "Live match started: {0}", zh: "临场指挥开始：{0}" },
  liveBlock: { en: "Block {0} / {1}", zh: "第 {0} 节 / {1}" },
  liveCurrentTactic: { en: "Current tactic", zh: "当前战术" },
  livePossession: { en: "Possession (live)", zh: "控球（实时累计）" },
  liveShots: { en: "Shots (live)", zh: "射门（实时累计）" },
  liveNextBlock: { en: "Play next block", zh: "进行下一节" },
  liveAdvancing: { en: "Advancing…", zh: "推进中…" },
  liveBlockDone: { en: "Block {0} finished · {1} – {2}", zh: "第 {0} 节结束 · 比分 {1} – {2}" },
  liveAbandon: { en: "Abandon match", zh: "放弃比赛" },
  liveAbandonConfirmAction: { en: "Confirm abandon", zh: "确认放弃" },
  liveAbandoning: { en: "Abandoning…", zh: "放弃中…" },
  liveCancel: { en: "Cancel", zh: "取消" },
  liveAbandoned: { en: "Match abandoned; nothing was recorded.", zh: "比赛已放弃，未写入记录。" },
  liveFullTime: { en: "Full time — recorded: {0} {1} – {2} {3}", zh: "比赛结束，已写入记录：{0} {1} – {2} {3}" },
  liveFinishedTitle: { en: "Full time — match recorded", zh: "比赛结束，已写入记录" },
  liveFinalScore: { en: "{0} {1} – {2} {3}", zh: "{0} {1} – {2} {3}" },
  liveViewResult: { en: "View the latest result & replay", zh: "查看最近一场结果与回放" },
  liveEvents: { en: "Live events", zh: "实时事件" },
  liveNoEvents: { en: "No events yet.", zh: "还没有事件。" },
  liveTacticChanged: { en: "Tactic changed: {0} (applies to later blocks)", zh: "战术已切换：{0}（影响后续小节）" },
  liveCurrentFormation: { en: "Current formation", zh: "当前阵型" },
  liveFormationChanged: { en: "Formation changed: {0} (applies to later blocks)", zh: "阵型已切换：{0}（影响后续小节）" },
  liveFormationLabel: { en: "Live formation", zh: "临场阵型" },
  liveQuickSimNote: {
    en: "The quick simulation that does not change the result still lives in the result card above.",
    zh: "不改变结果的快速模拟仍在比赛结果卡中。",
  },

  /* live pre-match briefing */
  briefingTitle: { en: "Opponent briefing", zh: "对手简报" },
  briefingOpponent: { en: "Opponent", zh: "对手" },
  briefingTactic: { en: "Their tactic", zh: "对方战术" },
  briefingCompare: { en: "Line comparison", zh: "四线对比" },
  briefingOurs: { en: "Ours", zh: "我方" },
  briefingTheirs: { en: "Theirs", zh: "对手" },
  briefingWeakest: { en: "Caution", zh: "注意" },
  briefingCaution: { en: "Their {0} line is {1} vs our {2}.", zh: "对手 {0} 线 {1}，我方 {2}。" },
  briefingSuggested: { en: "Suggested tactic", zh: "推荐战术" },
  briefingApply: { en: "Apply suggested tactic", zh: "应用推荐战术" },
  briefingApplying: { en: "Applying…", zh: "应用中…" },
  tacticSuggestTitle: { en: "Recommended tactic", zh: "推荐战术" },
  tacticSuggestOpponent: { en: "vs {0}", zh: "对手：{0}" },
  tacticSuggestApply: { en: "Apply recommended tactic", zh: "应用推荐战术" },
  tacticSuggestApplied: { en: "Recommended tactic applied: {0}", zh: "已应用推荐战术：{0}" },
  tacticSuggestFallback: { en: "No opponent preview available — balanced is the safe default.", zh: "拿不到对手预览——默认使用均衡战术最稳妥。" },
  briefingAlready: { en: "Already using the suggested tactic", zh: "已使用推荐战术" },
  briefingEdgeOurs: { en: "Our edge", zh: "我方占优" },
  briefingEdgeTheirs: { en: "Their edge", zh: "对手占优" },
  briefingEdgeEven: { en: "Even", zh: "接近" },

  /* live substitutions */
  liveSubsTitle: { en: "Substitutions", zh: "换人" },
  liveSubsCounter: { en: "Subs {0}/{1}", zh: "换人 {0}/{1}" },
  liveSubOutLabel: { en: "Off (starter)", zh: "下场首发" },
  liveSubInLabel: { en: "On (bench)", zh: "上场替补" },
  liveSubButton: { en: "Substitute", zh: "换人" },
  liveSubBusy: { en: "Substituting…", zh: "换人中…" },
  liveSubDone: { en: "Substitution: {0} → {1}", zh: "换人：{0} → {1}" },
  liveSubLimitReached: { en: "Five substitutions are the limit per match.", zh: "本场已达 5 次换人上限。" },
  liveSubNeedKeeper: {
    en: "No goalkeeper on the bench; exactly one goalkeeper must stay on the pitch.",
    zh: "替补席没有门将可选；场上必须保留 1 名门将。",
  },
  liveSubNeedOutfield: { en: "No outfield player on the bench.", zh: "替补席没有外场球员可选。" },
  liveSubNoStarter: { en: "No starter available to take off.", zh: "没有可换下的首发球员。" },
  replaySub: { en: "Sub", zh: "换人" },

  /* scouting recommendations */
  scoutingTitle: { en: "Scouting recommendations", zh: "球探推荐" },
  scoutingReadOnly: {
    en: "Recommendations are local read-only calculations and do not change the club.",
    zh: "推荐为本地只读计算，不改动俱乐部。",
  },
  scoutingWeakest: { en: "Weakest line", zh: "最弱一线" },
  scoutingWeakestValue: { en: "{0} · rating {1} · gap {2}", zh: "{0} · 评分 {1} · 差距 {2}" },
  scoutingBudget: { en: "Budget", zh: "预算" },
  scoutingCap: { en: "Scout cap", zh: "球探上限" },
  scoutingSquad: { en: "Squad", zh: "阵容" },
  scoutingNeedsTitle: { en: "Line needs", zh: "各线需求" },
  scoutingRating: { en: "Rating", zh: "评分" },
  scoutingGap: { en: "Gap", zh: "差距" },
  scoutingTarget: { en: "Target", zh: "目标" },
  scoutingRecommendations: { en: "Recommended players", zh: "推荐名单" },
  scoutingNoAffordable: {
    en: "No recommended target fits the current budget; recommendations are read-only.",
    zh: "预算内暂无可以签入的推荐目标；推荐仅为只读计算。",
  },
  scoutingNoTargets: { en: "No in-cap recommendations right now.", zh: "当前没有球探上限内的推荐目标。" },
  scoutingNoteLabel: { en: "Scout note", zh: "球探备注" },
  scoutReasonWeakest: { en: "Weakest line", zh: "最弱一线" },
  scoutReasonUpgrade: { en: "Upgrade", zh: "升级" },
  scoutReasonDepth: { en: "Depth", zh: "深度" },
  scoutReasonAffordable: { en: "Affordable", zh: "可负担" },

  /* club display */
  displayTitle: { en: "Club display", zh: "俱乐部展示" },
  displayIntro: {
    en: "Apply frames and backdrops your account already owns to the club card. Selecting them is free.",
    zh: "把账号已经拥有的卡框与背景应用到俱乐部卡上；选择不收费。",
  },
  displayLegacyNote: {
    en: "Purchases from your old account appear here automatically and are never charged again.",
    zh: "旧存档购买过会自动出现在这里，不会重复收费。",
  },
  displayFrames: { en: "Frames", zh: "卡框" },
  displayBackdrops: { en: "Backdrops", zh: "背景" },
  displayUse: { en: "Use", zh: "使用" },
  displaySelected: { en: "In use", zh: "已使用" },
  displayUnowned: { en: "Not owned", zh: "未拥有" },
  displayApplying: { en: "Applying…", zh: "应用中…" },
  displayClearing: { en: "Clearing…", zh: "清除中…" },
  displayClearFrame: { en: "Clear frame", zh: "清除卡框" },
  displayClearBackdrop: { en: "Clear backdrop", zh: "清除背景" },
  displayApplied: { en: "Applied: {0}", zh: "已应用：{0}" },
  displayCleared: { en: "Cleared: {0}", zh: "已清除：{0}" },
  displayKindFrame: { en: "frame", zh: "卡框" },
  displayKindBackdrop: { en: "backdrop", zh: "背景" },
  displayNoRights: {
    en: "This account owns no display items yet; old purchases appear here automatically when present.",
    zh: "当前账号还没有可用的展示权益；已有的旧购买会自动出现在这里。",
  },
  displayCredits: { en: "Existing display rights · available {0} FC", zh: "展示权益来自既有购买 · 可用资金 {0} FC" },
  displayKitKindBase: { en: "Base kit", zh: "基础球衣" },
  displayKitKindCup: { en: "Cup kit", zh: "挑战杯纪念球衣" },
  displayKitKindLeague: { en: "League kit", zh: "联赛纪念球衣" },
  displayKits: { en: "Kits", zh: "球衣" },
  displayKitHome: { en: "Home kit", zh: "主场球衣" },
  displayKitAway: { en: "Away kit", zh: "客场球衣" },
  displayKitCup: { en: "{0} cup kit", zh: "{0}挑战杯纪念球衣" },
  displayKitLeague: { en: "{0} champions kit", zh: "{0}联赛冠军纪念球衣" },
  displayKitBaseNote: { en: "Always in your collection.", zh: "始终在你的收藏中。" },
  displayKitLegacyNote: {
    en: "Commemorative kits only come from trophies that recorded a kit id; old trophies never gain one retroactively.",
    zh: "纪念球衣只来自记录了 kitId 的奖杯；旧奖杯不会补发。",
  },
  displayKitNoCommemorative: {
    en: "No commemorative kits yet — cup wins and league titles unlock them.",
    zh: "还没有纪念球衣——挑战杯夺冠或联赛第一会解锁。",
  },
  displayKitSelectedLabel: { en: "Selected kit", zh: "当前球衣" },
  displayKitClear: { en: "Clear kit", zh: "清除球衣" },
  displayKindKit: { en: "kit", zh: "球衣" },
  trophyLegacyKit: { en: "No commemorative kit (legacy record)", zh: "无纪念球衣（旧记录）" },
  historyLineupTitle: { en: "Historic lineup", zh: "历史阵容" },
  historyLineupMissing: { en: "Lineup not saved for this old season.", zh: "这家旧赛季没有保存阵容。" },
  historyShowLineup: { en: "Show historic lineup — {0}", zh: "查看历史阵容——{0}" },
  historyHideLineup: { en: "Hide historic lineup — {0}", zh: "收起历史阵容——{0}" },
  displayFrameSilverName: { en: "Silver finish", zh: "银色边框" },
  displayFrameSilverDesc: { en: "A brushed silver club card.", zh: "拉丝银色质感的俱乐部卡边框。" },
  displayFrameEmeraldName: { en: "Emerald finish", zh: "祖母绿边框" },
  displayFrameEmeraldDesc: { en: "A deep green club card.", zh: "深绿色质感的俱乐部卡边框。" },
  displayFrameObsidianName: { en: "Obsidian finish", zh: "黑曜石边框" },
  displayFrameObsidianDesc: { en: "A dark club card with bright lettering.", zh: "深色卡片搭配明亮字体的边框。" },
  displayBackdropStadiumName: { en: "Floodlight backdrop", zh: "泛光灯背景" },
  displayBackdropStadiumDesc: { en: "Floodlight beams behind the club card.", zh: "俱乐部卡后的泛光灯束背景。" },
  displayBackdropSunsetName: { en: "Golden hour backdrop", zh: "黄金时刻背景" },
  displayBackdropSunsetDesc: { en: "Warm light behind the club card.", zh: "俱乐部卡后的温暖夕照背景。" },
  displayBackdropTacticsName: { en: "Tactics backdrop", zh: "战术板背景" },
  displayBackdropTacticsDesc: { en: "A tactical grid behind the club card.", zh: "俱乐部卡后的战术网格背景。" },

  /* footer */
  footerNoteLive: {
    en: "Actions on this page are saved through POST /api/command and appear as receipts in your planner document. Nothing is written directly to storage.",
    zh: "本页操作通过 POST /api/command 保存，并会在你的计划文档中留下回执；不会直接写入任何存储。",
  },
  footerNote: {
    en: "Preview only. Your planner, tasks, focus history, rewards and settings are untouched.",
    zh: "仅供预览。你的计划、任务、专注记录、奖励和设置不会发生任何改变。",
  },
  footerLanguage: { en: "Content language follows the planner setting.", zh: "内容语言跟随计划设置。" },
  footerSource: { en: "Source:", zh: "来源：" },
} as const;

type CopyKey = keyof typeof COPY;

function copy(language: Language, key: CopyKey, ...values: (string | number)[]): string {
  const template: string = COPY[key][language];
  return template.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? ""));
}

const LINE_LABEL_KEY: Record<ClubPreviewPlayer["line"], CopyKey> = {
  GK: "goalkeeper",
  DEF: "defence",
  MID: "midfield",
  ATT: "attack",
};

/** Mirrors LINE_WEIGHTS in lib/club-model.ts; kept static so this page also documents the rule. */
const LINE_WEIGHT_TABLE: { key: CopyKey; rows: { attribute: CopyKey; weight: number }[] }[] = [
  {
    key: "lineDef",
    rows: [
      { attribute: "attrDef", weight: 55 },
      { attribute: "attrPhy", weight: 20 },
      { attribute: "attrPac", weight: 10 },
      { attribute: "attrPas", weight: 10 },
      { attribute: "attrDri", weight: 5 },
    ],
  },
  {
    key: "lineMid",
    rows: [
      { attribute: "attrPas", weight: 45 },
      { attribute: "attrDri", weight: 30 },
      { attribute: "attrPac", weight: 10 },
      { attribute: "attrPhy", weight: 10 },
      { attribute: "attrDef", weight: 5 },
    ],
  },
  {
    key: "lineAtt",
    rows: [
      { attribute: "attrSho", weight: 40 },
      { attribute: "attrDri", weight: 25 },
      { attribute: "attrPac", weight: 15 },
      { attribute: "attrPas", weight: 15 },
      { attribute: "attrPhy", weight: 5 },
    ],
  },
];

const ATTRIBUTE_CODE: Record<string, string> = {
  attrPac: "PAC",
  attrSho: "SHO",
  attrPas: "PAS",
  attrDri: "DRI",
  attrDef: "DEF",
  attrPhy: "PHY",
};

const FIT_RULES: { key: CopyKey; percent: number }[] = [
  { key: "fitExact", percent: 100 },
  { key: "fitCompatible", percent: 95 },
  { key: "fitUnsuitable", percent: 85 },
];

type Envelope = { state: PlannerState; revision: number; updatedAt: string };
type PageMode = "loading" | "sample" | "create" | "club";
const TACTIC_NAME_KEY: Record<ClubTactic, CopyKey> = {
  balanced: "tacticBalanced",
  possession: "tacticPossession",
  counter: "tacticCounter",
  wide: "tacticWide",
  press: "tacticPress",
};

const BRIEFING_HEADLINE_ZH: Record<string, string> = {
  "You have the edge across the pitch.": "你在全场占据优势。",
  "They look stronger on paper — be compact.": "纸面实力对手更强——保持紧凑。",
  "Evenly matched — the midfield may decide it.": "实力接近——中场可能决定比赛。",
};

const BRIEFING_REASON_ZH: Record<string, string> = {
  "Their defence is the weak spot — press high and force mistakes.": "对手防线是弱点——高位逼抢，迫使对手失误。",
  "They control midfield — sit deeper and hit them on the counter.": "对手控制中场——回收更深，抓反击机会。",
  "Their attack is stronger — keep the ball to protect the back line.": "对手进攻更强——控住球，保护后防线。",
  "They press centrally — stretch them with width.": "对手在中路逼抢——用宽度拉开他们。",
  "They commit bodies wide — the counter is open.": "对手在边路投入兵力——反击空间已经打开。",
  "No clear edge — keep the shape and take the chances you get.": "没有明显优势——保持阵型，把握出现的机会。",
};

const briefingText = (language: Language, english: string, translations: Record<string, string>) =>
  language === "zh" ? translations[english] ?? english : english;

const cardTierLabel = (tier: "gold" | "silver" | "bronze"): CopyKey =>
  tier === "gold" ? "cardTierGold" : tier === "silver" ? "cardTierSilver" : "cardTierBronze";

const DECOR_KIND_KEY: Record<DecorKind, CopyKey> = {
  pitch: "decorPitch",
  stands: "decorStands",
  lights: "decorLights",
};

const ATTRIBUTE_LABEL_KEY: Record<keyof FootballAttributes, CopyKey> = {
  pac: "attrPac",
  sho: "attrSho",
  pas: "attrPas",
  dri: "attrDri",
  def: "attrDef",
  phy: "attrPhy",
};

const FACILITY_ORDER: FacilityKey[] = ["trainingCentre", "scoutCentre", "stadium"];
const FACILITY_EFFECT_KEY: Record<FacilityKey, CopyKey> = {
  trainingCentre: "facilityEffectTraining",
  scoutCentre: "facilityEffectScout",
  stadium: "facilityEffectStadium",
};

function ratingDeltaText(before: LineRatings, after: LineRatings): string {
  const keys: (keyof LineRatings)[] = ["DEF", "MID", "ATT", "GK", "overall"];
  return keys
    .filter((key) => before[key].toFixed(1) !== after[key].toFixed(1))
    .map((key) => `${key === "overall" ? "OVR" : key} ${before[key].toFixed(1)} → ${after[key].toFixed(1)}`)
    .join(" · ");
}

function lastReceiptOfKind(club: ClubState | undefined, kind: ClubReceipt["kind"]): ClubReceipt | undefined {
  if (!club) return undefined;
  for (let index = club.receipts.length - 1; index >= 0; index -= 1) {
    if (club.receipts[index].kind === kind) return club.receipts[index];
  }
  return undefined;
}

const MATCH_TIER_NAME_KEY: CopyKey[] = [
  "matchTierRookie",
  "matchTierRising",
  "matchTierContender",
  "matchTierElite",
];
const MATCH_TIER_DESC_KEY: CopyKey[] = [
  "matchTierRookieDesc",
  "matchTierRisingDesc",
  "matchTierContenderDesc",
  "matchTierEliteDesc",
];

/** lib/club-match.ts explanations are English; keep the raw string for en and map the known zh phrasings. */
const EXPLANATION_ZH: Record<string, string> = {
  "your attack": "你的锋线",
  "your midfield": "你的中场",
  "their forwards found space behind your line": "对手前锋打穿了防线身后",
  "their midfield broke through the middle": "对手中场从中路突破",
  "you kept their chances low": "你限制了对手的机会",
  "High pressing won the ball early but left space behind.": "高位压迫让球队早早抢回球权，但身后会留下空间。",
  "Patient possession kept the ball but slowed the final pass.": "耐心控球保住了球权，但最后一传变慢。",
  "Counter-attacks created the best chances after defending deep.": "深度防守后的反击创造了最好的机会。",
  "Width stretched them, but crosses needed more bodies in the box.": "边路宽度拉开了对手，但传中时禁区里人手不足。",
  "Balanced shape kept the team compact.": "均衡阵型让球队保持紧凑。",
  "Keep this shape and train the line that created the chances.": "保持这套阵型，并训练创造机会的那条线。",
};

function explainText(language: Language, raw: string): string {
  if (language === "en") return raw;
  const direct = EXPLANATION_ZH[raw];
  if (direct) return direct;
  if (raw.startsWith("Improve ")) {
    const line = raw.includes("your attack") ? "锋线" : raw.includes("your midfield") ? "中场" : "防线";
    return `加强你的${line}，或降低对手在该线的优势。`;
  }
  return raw;
}

function matchTierIndex(value: number): 0 | 1 | 2 | 3 {
  const rounded = Math.round(Number(value) || 0);
  return (rounded < 0 ? 0 : rounded > 3 ? 3 : rounded) as 0 | 1 | 2 | 3;
}

function explainedLineLabel(language: Language, line: string): string {
  const key = LINE_LABEL_KEY[line as ClubPreviewPlayer["line"]];
  return key ? copy(language, key) : line;
}

function matchScoreline(record: ClubMatchRecord): string {
  return `${record.opponent.name} · ${record.score[0]} – ${record.score[1]}`;
}

/** Loaded only when the transfer/scouting area is first opened; the full roster is large. */
type ScoutDataset = {
  clubs: readonly FootballClub[];
  players: readonly FootballRosterPlayer[];
  targets: { world: FootballRosterPlayer; ovr: number; price: number }[];
};

/** 50 % refund of the recorded signing price; gifted initial players are worthless. */
function playerSaleValue(player: ClubPlayer): number {
  if (player.origin === "initial") return 0;
  const paid = (player as ClubPlayer & { paidPrice?: number }).paidPrice;
  return typeof paid === "number" && paid > 0 ? sellValue(paid) : 0;
}

type ScoutSort = "ovr" | "priceAsc" | "priceDesc";

function leagueFixtureText(
  result: { home: string; away: string; score: [number, number] },
  nameOf: (teamId: string) => string,
): string {
  return `${nameOf(result.home)} ${result.score[0]} – ${result.score[1]} ${nameOf(result.away)}`;
}

function cupNameOf(cup: ClubCup | null | undefined, clubName: string | undefined, teamId: string): string {
  if (teamId === "club") return clubName ?? teamId;
  if (!cup) return teamId;
  return cup?.teams.find((team) => team.id === teamId)?.name ?? teamId;
}

const DISPLAY_KIND_COPY: Record<DisplayKind, CopyKey> = {
  frame: "displayKindFrame",
  backdrop: "displayKindBackdrop",
  kit: "displayKindKit",
};

function kitDisplayName(language: Language, kit: Pick<KitItem, "id" | "kind" | "tier">): string {
  if (kit.kind === "base") {
    return copy(language, kit.id === "kit.home" ? "displayKitHome" : "displayKitAway");
  }
  const tierName = kit.tier === null ? "" : copy(language, MATCH_TIER_NAME_KEY[matchTierIndex(kit.tier)]);
  return copy(language, kit.kind === "cup" ? "displayKitCup" : "displayKitLeague", tierName);
}

const DISPLAY_OPTION_COPY: Record<string, { name: CopyKey; description: CopyKey }> = {
  "frame.silver": { name: "displayFrameSilverName", description: "displayFrameSilverDesc" },
  "frame.emerald": { name: "displayFrameEmeraldName", description: "displayFrameEmeraldDesc" },
  "frame.obsidian": { name: "displayFrameObsidianName", description: "displayFrameObsidianDesc" },
  "backdrop.stadium": { name: "displayBackdropStadiumName", description: "displayBackdropStadiumDesc" },
  "backdrop.sunset": { name: "displayBackdropSunsetName", description: "displayBackdropSunsetDesc" },
  "backdrop.tactics": { name: "displayBackdropTacticsName", description: "displayBackdropTacticsDesc" },
};

const SCOUT_LINE_COPY: Record<ScoutingClubLine, CopyKey> = {
  DEF: "defence",
  MID: "midfield",
  ATT: "attack",
  GK: "goalkeeper",
};

const SCOUT_REASON_COPY: Record<ScoutingRecommendation["reason"], CopyKey> = {
  "weakest-line": "scoutReasonWeakest",
  upgrade: "scoutReasonUpgrade",
  depth: "scoutReasonDepth",
  affordable: "scoutReasonAffordable",
};

type ClubTab = "overview" | "team" | "match" | "club";

const CLUB_TABS: { id: ClubTab; label: CopyKey }[] = [
  { id: "overview", label: "tabOverview" },
  { id: "team", label: "tabTeam" },
  { id: "match", label: "tabMatch" },
  { id: "club", label: "tabClub" },
];

const LEGACY_TAB_ALIAS: Record<string, ClubTab> = {
  overview: "overview",
  squad: "team",
  team: "team",
  match: "match",
  competitions: "match",
  transfers: "club",
  honours: "club",
  club: "club",
};

const TAB_FOR_ANCHOR: Record<string, ClubTab> = {
  "club-create": "overview",
  "club-card": "club",
  "club-squad": "team",
  "club-lineup": "team",
  "club-training": "team",
  "club-tactics": "team",
  "club-lines": "team",
  "club-match": "match",
  "club-replay-panel": "match",
  "club-watch3d-panel": "match",
  "club-league": "match",
  "club-cup": "match",
  "club-transfers": "club",
  "club-facilities": "club",
  "club-migrate": "club",
  "club-migration-sample": "club",
  "club-honours": "club",
};

function tabFromUrl(url: URL): { tab: ClubTab; anchor: string | null } {
  const requestedTab = url.searchParams.get("tab");
  if (requestedTab && LEGACY_TAB_ALIAS[requestedTab]) {
    return { tab: LEGACY_TAB_ALIAS[requestedTab], anchor: url.hash ? url.hash.slice(1) : null };
  }
  const anchor = url.hash ? url.hash.slice(1) : "";
  if (anchor && TAB_FOR_ANCHOR[anchor]) return { tab: TAB_FOR_ANCHOR[anchor], anchor };
  if (anchor === "club-overview") return { tab: "overview", anchor };
  return { tab: "overview", anchor: null };
}

/* three.js lives in its own chunk and is only fetched when the 3D watch opens. */
const LazyClubWatch3D = lazy(() => import("./club-watch-3d"));

function supportsWebGL(): boolean {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function replayKindKey(kind: "goal" | "chance" | "save" | "sub"): CopyKey {
  return kind === "goal" ? "replayGoal" : kind === "save" ? "replaySave" : kind === "sub" ? "replaySub" : "replayChance";
}

const SEASON_OUTCOME_KEY: Record<SeasonRecord["outcome"], CopyKey> = {
  champion: "historyChampion",
  promoted: "historyPromoted",
  relegated: "historyRelegated",
  stayed: "historyStayed",
  abandoned: "historyAbandoned",
};

type DataSource = "loading" | "live" | "sample";
type Feedback = { kind: "success" | "error" | "info"; text: string } | null;
type TrainableAttribute = keyof FootballAttributes;
type CreateForm = {
  name: string;
  shortName: string;
  city: string;
  primary: string;
  secondary: string;
  formation: ClubFormation;
};

const TRAINABLE_ATTRIBUTES: { key: TrainableAttribute; code: string; label: CopyKey }[] = [
  { key: "pac", code: "PAC", label: "attrPac" },
  { key: "sho", code: "SHO", label: "attrSho" },
  { key: "pas", code: "PAS", label: "attrPas" },
  { key: "dri", code: "DRI", label: "attrDri" },
  { key: "def", code: "DEF", label: "attrDef" },
  { key: "phy", code: "PHY", label: "attrPhy" },
];
const TRAINABLE_KEYS = TRAINABLE_ATTRIBUTES.map((entry) => entry.key);
const HEX_COLOUR = /^#[0-9a-f]{6}$/i;

class CommandError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "CommandError";
    this.status = status;
  }
}

const isStaticDemo = () => typeof window !== "undefined" && Boolean((window as unknown as { __QFC_DEMO__?: boolean }).__QFC_DEMO__);

async function readEnvelope(signal?: AbortSignal): Promise<Envelope> {
  if (isStaticDemo()) {
    const { demoRead } = await import("@/lib/club-demo-store");
    const envelope = demoRead();
    return { state: envelope.state, revision: envelope.revision, updatedAt: envelope.updatedAt };
  }
  const response = await fetch("/api/state", {
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<Envelope> & { error?: string };
  if (!response.ok) throw new CommandError(payload?.error || `HTTP ${response.status}`, response.status);
  if (!payload?.state || typeof payload.state !== "object") throw new CommandError("Unexpected planner response", 502);
  return {
    state: payload.state,
    revision: typeof payload.revision === "number" ? payload.revision : 0,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : "",
  };
}

/** Every club action goes through the real command endpoint; nothing is written to storage directly. */
async function sendCommand(command: Record<string, unknown>, revision: number): Promise<Envelope> {
  const operationId = crypto.randomUUID();
  if (isStaticDemo()) {
    const { demoSend } = await import("@/lib/club-demo-store");
    try {
      const envelope = demoSend(command, revision, operationId);
      return { state: envelope.state, revision: envelope.revision, updatedAt: envelope.updatedAt };
    } catch (error) {
      const status = (error as { status?: number }).status ?? 400;
      throw new CommandError(error instanceof Error ? error.message : "Demo command failed", status);
    }
  }
  const response = await fetch("/api/command", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify({ revision, operationId, command }),
  });
  const payload = (await response.json().catch(() => ({}))) as Partial<Envelope> & { error?: string };
  if (!response.ok) throw new CommandError(payload?.error || `HTTP ${response.status}`, response.status);
  if (!payload?.state || typeof payload.state !== "object") throw new CommandError("Unexpected command response", 502);
  return {
    state: payload.state,
    revision: typeof payload.revision === "number" ? payload.revision : revision + 1,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString(),
  };
}

/** Map the persisted ClubState onto the read-only preview shape so both modes share one layout. */
function buildLivePreview(club: ClubState, state: PlannerState): ClubPreview {
  const xp = totalXP(state);
  const byId = new Map(club.players.map((player) => [player.id, player]));
  const slots = CLUB_FORMATIONS[club.formation];
  const starterPlayers = club.lineup
    .map((id) => byId.get(id))
    .filter((player): player is ClubPlayer => Boolean(player));
  const starterIds = new Set(starterPlayers.map((player) => player.id));
  const fitById = new Map<string, number>();
  starterPlayers.forEach((player, index) => {
    const slot = slots[index];
    if (slot) fitById.set(player.id, positionFit(player.position, slot.position));
  });
  return {
    identity: {
      name: club.name,
      shortName: club.shortName,
      city: club.city,
      crest: { primary: club.colours.primary, secondary: club.colours.secondary },
      homeKit: club.kits.home,
      awayKit: club.kits.away,
    },
    level: levelForXp(xp),
    xp,
    formation: club.formation,
    ratings: clubRatings(club),
    squad: club.players.map((player) => {
      const value = quoteTraining(player, "pas", club.facilities.trainingCentre);
      return {
        ...player,
        line: lineOf(player.position),
        fit: fitById.get(player.id) ?? 1,
        training: { from: value.from, to: value.to, price: value.price, blocked: value.blocked },
      } as ClubPreviewPlayer;
    }),
    starters: starterPlayers.map((player) => player.id),
    bench: club.players.filter((player) => !starterIds.has(player.id)).map((player) => player.id),
    facilities: club.facilities,
    migration: previewClubMigration(state),
  };
}

/** PLAN.md 3.1: default training target is the weakest starting slot. */
function shortBoardPlayerId(club: ClubState): string {
  const byId = new Map(club.players.map((player) => [player.id, player]));
  const slots = CLUB_FORMATIONS[club.formation];
  let weakest: { id: string; score: number } | null = null;
  for (let index = 0; index < club.lineup.length; index += 1) {
    const id = club.lineup[index];
    const player = byId.get(id);
    const slot = slots[index];
    if (!player || !slot) continue;
    const score = playerRatingInSlot(player, slot);
    if (!weakest || score < weakest.score) weakest = { id, score };
  }
  return weakest?.id ?? club.players[0]?.id ?? "";
}

/** Pick the weakest line-relevant attribute that is not blocked at the current training centre. */
function defaultTrainableAttribute(player: ClubPlayer, trainingCentre: number): TrainableAttribute {
  const line = lineOf(player.position);
  const lineKeys: TrainableAttribute[] =
    line === "GK" ? TRAINABLE_KEYS : LINE_WEIGHTS[line].map(([key]) => key as TrainableAttribute);
  const available = lineKeys.filter((key) => !quoteTraining(player, key, trainingCentre).blocked);
  const pool = available.length ? available : lineKeys.filter((key) => !quoteTraining(player, key, trainingCentre).blocked);
  const candidates = pool.length ? pool : TRAINABLE_KEYS;
  return candidates.reduce((best, key) => (player.attributes[key] < player.attributes[best] ? key : best), candidates[0] ?? "pas");
}

function rawValue(value: boolean | null): string {
  return JSON.stringify(value) ?? String(value);
}

function RawList({ values, empty }: { values: string[]; empty: string }) {
  if (!values.length) {
    return (
      <span className="club-empty-value">
        <code className="club-code">[]</code>
        <span className="club-none">{empty}</span>
      </span>
    );
  }
  return (
    <span className="club-chips">
      {values.map((value) => (
        <code className="club-code" key={value}>
          {value}
        </code>
      ))}
    </span>
  );
}

function SquadTable({
  caption,
  players,
  language,
  starters,
  renderAction,
}: {
  caption: string;
  players: ClubPreviewPlayer[];
  language: Language;
  starters: boolean;
  renderAction?: (player: ClubPreviewPlayer) => ReactNode;
}) {
  return (
    <div className="club-table-wrap">
      <table className="club-table">
        <caption className="club-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{copy(language, "columnNumber")}</th>
            <th scope="col">{copy(language, "columnPlayer")}</th>
            <th scope="col">{copy(language, "columnPosition")}</th>
            <th scope="col">{copy(language, "columnLine")}</th>
            <th scope="col">{copy(language, "columnOvr")}</th>
            <th scope="col">{copy(language, "columnFit")}</th>
            <th scope="col">{copy(language, "columnFitness")}</th>
            <th scope="col">{copy(language, "columnCondition")}</th>
            <th scope="col">{copy(language, "columnTraining")}</th>
            <th scope="col">{copy(language, "columnStatus")}</th>
            {renderAction ? <th scope="col">{copy(language, "sellColumn")}</th> : null}
          </tr>
        </thead>
        <tbody>
          {players.map((player) => (
            <tr key={player.id}>
              <td data-col="number" data-label={copy(language, "columnNumber")}>
                {player.number}
              </td>
              <td data-col="name" data-label={copy(language, "columnPlayer")}>
                <span className="club-player-name">{player.name}</span>
                <span className="club-player-meta">
                  {player.foot === "left" ? copy(language, "leftFoot") : copy(language, "rightFoot")}
                  {" · "}
                  {player.origin === "signed" ? copy(language, "signedPlayer") : copy(language, "initialPlayer")}
                </span>
              </td>
              <td data-col="position" data-label={copy(language, "columnPosition")}>
                {player.position}
              </td>
              <td data-col="line" data-label={copy(language, "columnLine")}>
                <span className="club-line" title={copy(language, LINE_LABEL_KEY[player.line])}>
                  <i className={`club-line-dot club-line-dot-${player.line.toLowerCase()}`} aria-hidden="true" />
                  {player.line}
                </span>
              </td>
              <td data-col="ovr" data-label={copy(language, "columnOvr")}>
                <b className="club-ovr">{player.ovr}</b>
              </td>
              <td data-col="fit" data-label={copy(language, "columnFit")}>
                {starters ? (
                  `${Math.round(player.fit * 100)}%`
                ) : (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="club-visually-hidden">{copy(language, "fitBench")}</span>
                  </>
                )}
              </td>
              <td data-col="fitness" data-label={copy(language, "columnFitness")}>
                <ConditionBar fitness={fitnessOf(player)} injury={injuryMatchesOf(player)} compact language={language} />
              </td>
              <td data-col="condition" data-label={copy(language, "columnCondition")}>
                <span className={`club-condition-state${injuryMatchesOf(player) > 0 ? " is-injured" : fitnessOf(player) < 35 ? " is-tired" : ""}`}>
                  {injuryMatchesOf(player) > 0
                    ? copy(language, "conditionInjuryBadge", injuryMatchesOf(player))
                    : fitnessOf(player) < 35
                      ? copy(language, "conditionTired")
                      : copy(language, "conditionAvailable")}
                </span>
              </td>
              <td data-col="training" data-label={copy(language, "columnTraining")}>
                <span className="club-training-step">
                  {"PAS "}
                  {player.training.from}
                  {" → "}
                  {player.training.to}
                </span>
                <span className="club-training-price">
                  {player.training.price > 0 ? `${player.training.price} FC` : "—"}
                </span>
              </td>
              <td data-col="status" data-label={copy(language, "columnStatus")}>
                {player.training.blocked ? (
                  <>
                    <span className="club-pill club-pill-blocked">{copy(language, "blocked")}</span>
                    <span className="club-blocked-reason" lang={language === "zh" ? "en-GB" : undefined}>
                      {player.training.blocked}
                    </span>
                  </>
                ) : (
                  <span className="club-pill club-pill-ok">{copy(language, "allowed")}</span>
                )}
              </td>
              {renderAction ? (
                <td data-col="action" data-label={copy(language, "sellColumn")}>
                  {renderAction(player)}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchStoryboard({
  record,
  language,
  homeColor,
  awayColor,
  onOpenWatch,
}: {
  record: ClubMatchRecord;
  language: Language;
  homeColor: string;
  awayColor: string;
  onOpenWatch: () => void;
}) {
  const hasTimeline = Array.isArray(record.events) && record.events.length > 0;
  const board = useMemo(() => (hasTimeline ? storyboardFromRecord(record) : null), [hasTimeline, record]);
  if (!board) {
    return (
      <section className="club-storyboard club-storyboard-empty" aria-labelledby="club-storyboard-heading">
        <div className="club-table-heading">
          <h3 id="club-storyboard-heading">{copy(language, "storyboardTitle")}</h3>
        </div>
        <p className="club-note" role="status">{copy(language, "storyboardNoData")}</p>
      </section>
    );
  }
  const summary = storyboardSummary(board);
  const beats = storyboardBeats(board);
  const kindLabel = (kind: StoryPanel["kind"]) =>
    copy(
      language,
      kind === "goal"
        ? "storyboardGoal"
        : kind === "save"
          ? "storyboardSave"
          : kind === "chance"
            ? "storyboardChance"
            : kind === "sub"
              ? "storyboardSub"
              : "storyboardQuiet",
    );
  const panelDetail = (panel: StoryPanel) => {
    const event = panel.events[0];
    if (!event) return copy(language, "storyboardQuiet");
    if (event.kind === "goal") return `⚽ ${event.scorer ?? (event.side === "home" ? board.homeName : board.awayName)}`;
    if (event.kind === "save") return `🧤 ${event.scorer ?? board.awayName}`;
    if (event.kind === "sub") return `⇄ ${event.out ?? "—"} → ${event.scorer ?? "—"}`;
    return `◌ ${event.scorer ?? (event.side === "home" ? board.homeName : board.awayName)}`;
  };
  const panelSide = (panel: StoryPanel) => {
    const goal = panel.events.find((event) => event.kind === "goal");
    return goal ? goal.side : null;
  };
  const ariaLabel = (panel: StoryPanel) => {
    const eventText = panel.events.length ? panel.events.map((event) => `${kindLabel(event.kind)}${event.scorer ? ` ${event.scorer}` : ""}`).join(", ") : kindLabel("quiet");
    return `${panel.minuteStart}–${panel.minuteEnd}' · ${eventText} · ${board.homeName} ${panel.score[0]}–${panel.score[1]} ${board.awayName}`;
  };
  return (
    <section className="club-storyboard" aria-labelledby="club-storyboard-heading">
      <div className="club-storyboard-head">
        <div>
          <h3 id="club-storyboard-heading">{copy(language, "storyboardTitle")}</h3>
          <p className="club-storyboard-summary">{copy(language, "storyboardSummary", summary.panels, summary.beats)}</p>
        </div>
        <span className="club-storyboard-hint">{copy(language, "storyboardHint")}</span>
      </div>
      <div
        className="club-storyboard-scroll"
        role="region"
        aria-label={copy(language, "storyboardAria")}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          event.currentTarget.scrollBy({ left: event.key === "ArrowRight" ? 150 : -150, behavior: "smooth" });
        }}
      >
        <ol className="club-storyboard-track">
          {board.panels.map((panel) => {
            const hasEvents = panel.events.length > 0;
            const side = panelSide(panel);
            return (
              <li key={panel.index}>
                <button
                  type="button"
                  className={`club-storyboard-panel is-${panel.kind}${side ? ` is-side-${side}` : ""}${hasEvents ? " has-events" : ""}`}
                  aria-label={ariaLabel(panel)}
                  aria-disabled={!hasEvents}
                  disabled={!hasEvents}
                  data-panel-index={panel.index}
                  data-panel-kind={panel.kind}
                  data-panel-score={`${panel.score[0]}-${panel.score[1]}`}
                  data-panel-beat={hasEvents ? "true" : "false"}
                  onClick={() => {
                    if (hasEvents) onOpenWatch();
                  }}
                  style={
                    {
                      "--storyboard-home": homeColor,
                      "--storyboard-away": awayColor,
                    } as CSSProperties
                  }
                >
                  <span className="club-storyboard-minute">{`${panel.minuteStart}–${panel.minuteEnd}'`}</span>
                  <b className="club-storyboard-score">{`${panel.score[0]} – ${panel.score[1]}`}</b>
                  <span className="club-storyboard-detail">{panelDetail(panel)}</span>
                  <span className="club-storyboard-kind">{kindLabel(panel.kind)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      <p className="club-visually-hidden">{`${beats.length} beats`}</p>
    </section>
  );
}

function MatchReplay({
  record,
  language,
  homeName,
  awayName,
  homeColor,
  awayColor,
  homeShortName,
  awayShortName,
  homeTrophies = 0,
  decor,
  watchOpen,
  onWatchOpenChange,
  replayOpen,
  onReplayOpenChange,
}: {
  record: ClubMatchRecord;
  language: Language;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  homeShortName?: string;
  awayShortName?: string;
  homeTrophies?: number;
  decor?: ResolvedDecor;
  watchOpen?: boolean;
  onWatchOpenChange?: (open: boolean) => void;
  replayOpen?: boolean;
  onReplayOpenChange?: (open: boolean) => void;
}) {
  const events = record.events;
  const eventsAvailable = Array.isArray(events);
  const sortedEvents = useMemo(
    () => (events ? [...events].sort((a, b) => a.minute - b.minute) : []),
    [events],
  );
  const [internalOpen, setInternalOpen] = useState(false);
  const open = replayOpen ?? internalOpen;
  const setOpen = (value: boolean) => {
    if (onReplayOpenChange) onReplayOpenChange(value);
    else setInternalOpen(value);
  };
  const [internalShow3d, setInternalShow3d] = useState(false);
  const show3d = watchOpen ?? internalShow3d;
  const setShow3d = (value: boolean) => {
    if (onWatchOpenChange) onWatchOpenChange(value);
    else setInternalShow3d(value);
  };
  const [webglAvailable, setWebglAvailable] = useState(true);
  const [minute, setMinute] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const commentaryRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time WebGL capability probe.
    setWebglAvailable(supportsWebGL());
  }, []);

  /* Advance exactly one match minute at a time; at 90 the next timeout is skipped. */
  useEffect(() => {
    if (!open || !playing || minute >= 90) return;
    const timeout = window.setTimeout(() => setMinute((value) => Math.min(90, value + 1)), 400 / speed);
    return () => window.clearTimeout(timeout);
  }, [open, playing, minute, speed]);

  /* Keep the commentary scrolled to the last event that has happened. */
  useEffect(() => {
    if (!open) return;
    const container = commentaryRef.current;
    const current = container?.querySelector<HTMLElement>(".club-replay-comment.is-current");
    if (!container || !current) return;
    const target = current.offsetTop - container.clientHeight / 2 + current.clientHeight / 2;
    container.scrollTop = Math.max(0, target);
  }, [open, minute]);

  const finished = minute >= 90;
  const home = record.teams?.home ?? homeName;
  const away = record.teams?.away ?? awayName;
  const goals = sortedEvents.filter((event) => event.kind === "goal" && event.minute <= minute);
  const homeGoals = goals.filter((event) => event.side === "home").length;
  const awayGoals = goals.filter((event) => event.side === "away").length;
  const lastVisibleIndex = sortedEvents.reduce(
    (index, event, currentIndex) => (event.minute <= minute ? currentIndex : index),
    -1,
  );
  const currentEvent = lastVisibleIndex >= 0 ? sortedEvents[lastVisibleIndex] : null;
  const announce = !open
    ? ""
    : finished
      ? copy(language, "replayFullTimeAnnounce", home, homeGoals, away, awayGoals)
      : currentEvent
        ? `${minute}' ${copy(
            language,
            currentEvent.kind === "goal" ? "replayGoal" : currentEvent.kind === "save" ? "replaySave" : "replayChance",
          )} · ${currentEvent.scorer ?? (currentEvent.side === "home" ? home : away)}`
        : "";

  const toggle = () => {
    if (finished) {
      setMinute(0);
      setPlaying(true);
      return;
    }
    setPlaying((value) => !value);
  };
  const seek = (delta: number) => setMinute((value) => Math.max(0, Math.min(90, value + delta)));
  const openReplay = () => {
    setOpen(true);
    setMinute(0);
    setPlaying(false);
    setSpeed(1);
    window.setTimeout(() => panelRef.current?.focus(), 0);
  };
  const closeReplay = () => {
    setPlaying(false);
    setOpen(false);
    setMinute(0);
  };
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    const interactive =
      target !== null && target !== event.currentTarget && ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
    if (interactive) return;
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      toggle();
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      seek(-5);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      seek(5);
    }
  };

  if (!eventsAvailable) {
    return (
      <div className="club-replay-wrap">
        <button type="button" className="club-button club-button-secondary club-replay-open" disabled>
          {copy(language, "replayOpen")}
        </button>
        <p className="club-warning-inline">{copy(language, "replayUnavailable")}</p>
        <MatchStoryboard record={record} language={language} homeColor={homeColor} awayColor={awayColor} onOpenWatch={() => setShow3d(true)} />
      </div>
    );
  }

  return (
    <div className="club-replay-wrap">
      <div className="club-replay-launch">
        <button
          type="button"
          className="club-button club-button-secondary club-replay-open"
          onClick={open ? closeReplay : openReplay}
          aria-expanded={open}
          aria-controls="club-replay-panel"
        >
          {open ? copy(language, "replayClose") : copy(language, "replayOpen")}
        </button>
        <button
          type="button"
          className="club-button club-button-secondary club-replay-3d-toggle"
          onClick={() => setShow3d(!show3d)}
          aria-expanded={show3d}
          aria-controls="club-watch3d-panel"
        >
          {show3d ? copy(language, "watch3dClose") : copy(language, "watch3dOpen")}
        </button>
        <span className="club-badge club-badge-replay">{copy(language, "replayDataBadge")}</span>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "replay3dNote")}</p></details>
      </div>
      <details className="club-storyboard-details">
        <summary>{copy(language, "storyboardTitle")}</summary>
        <MatchStoryboard
          record={record}
          language={language}
          homeColor={homeColor}
          awayColor={awayColor}
          onOpenWatch={() => {
            setShow3d(true);
            window.setTimeout(() => document.getElementById("club-watch3d-panel")?.scrollIntoView({ block: "start", behavior: "smooth" }), 120);
          }}
        />
      </details>
      {show3d ? (
        webglAvailable ? (
          <div id="club-watch3d-panel">
            <Suspense
              fallback={
                <div className="club-watch3d-loading" role="status" aria-live="polite">
                  <span className="club-watch3d-spinner" aria-hidden="true" />
                  <p>{copy(language, "watch3dLoading")}</p>
                </div>
              }
            >
              <LazyClubWatch3D
                events={sortedEvents}
                path={record.path}
                timeline={record.timeline}
                ballTrack={(record as ClubMatchRecord & { ballTrack?: { m: number; x: number; y: number }[] }).ballTrack}
                lineups={record.lineups}
                homeName={home}
                awayName={away}
                homeColor={homeColor}
                awayColor={awayColor}
                homeShortName={homeShortName}
                awayShortName={awayShortName}
                homeTrophies={homeTrophies}
                decor={decor}
                language={language}
                onClose={() => setShow3d(false)}
              />
            </Suspense>
          </div>
        ) : (
          <div className="club-watch3d-fallback" role="status" aria-live="polite">
            <b>{copy(language, "watch3dFallbackTitle")}</b>
            <p>{copy(language, "watch3dFallbackNote")}</p>
            <div className="club-watch3d-fallback-actions">
              <button
                type="button"
                className="club-button club-button-primary"
                onClick={() => {
                  setShow3d(false);
                  openReplay();
                }}
              >
                {copy(language, "watch3dTextReplay")}
              </button>
              <button type="button" className="club-button club-button-secondary" onClick={() => setShow3d(false)}>
                {copy(language, "watch3dFallbackClose")}
              </button>
            </div>
          </div>
        )
      ) : null}
      {open ? (
        <div
          className="club-replay"
          id="club-replay-panel"
          ref={panelRef}
          role="region"
          aria-label={copy(language, "replayTitle")}
          tabIndex={0}
          onKeyDown={handleKeyDown}
        >
          <p className="club-replay-disclaimer">
            {`${copy(language, "replayKeyboardHint")}`}
          </p>
          <div className="club-replay-scoreboard">
            <span className="club-replay-side">{home}</span>
            <b className="club-replay-score">{`${homeGoals} – ${awayGoals}`}</b>
            <span className="club-replay-side club-replay-side-away">{away}</span>
            <span className="club-replay-clock">
              <span className="club-replay-minute">{`${minute}'`}</span>
              {finished ? <span className="club-pill club-pill-active">{copy(language, "replayFullTime")}</span> : null}
            </span>
          </div>
          <div className="club-replay-controls">
            <button type="button" className="club-button club-button-primary club-replay-toggle" onClick={toggle}>
              {finished ? copy(language, "replayAgain") : playing ? copy(language, "replayPause") : copy(language, "replayPlay")}
            </button>
            <div className="club-replay-speed" role="group" aria-label={copy(language, "replaySpeedLabel")}>
              {([1, 2, 4] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={`club-replay-speed-button${speed === value ? " is-selected" : ""}`}
                  aria-pressed={speed === value}
                  onClick={() => setSpeed(value)}
                >
                  {`${value}×`}
                </button>
              ))}
            </div>
            <button type="button" className="club-icon-button club-replay-seek" onClick={() => seek(-5)} aria-label={copy(language, "replayBack5")}>
              −5′
            </button>
            <button type="button" className="club-icon-button club-replay-seek" onClick={() => seek(5)} aria-label={copy(language, "replayForward5")}>
              +5′
            </button>
          </div>
          <div className="club-replay-progress">
            <input
              type="range"
              min={0}
              max={90}
              step={1}
              value={minute}
              onChange={(event) => setMinute(Number(event.target.value))}
              aria-label={copy(language, "replayProgressLabel")}
              aria-valuetext={`${minute}'`}
            />
            <span className="club-replay-progress-labels">
              <span>0′</span>
              <span>45′</span>
              <span>90′</span>
            </span>
          </div>
          <div className="club-replay-stats">
            <span>
              {`${copy(language, "matchPossession")} ${Math.round(record.possession[0])}% – ${Math.round(record.possession[1])}%`}
            </span>
            <span>
              {`${copy(language, "matchShots")} ${record.shots[0]} (${record.onTarget[0]}) – ${record.shots[1]} (${record.onTarget[1]})`}
            </span>
          </div>
          <div className="club-replay-commentary" ref={commentaryRef}>
            <h4 className="club-subheading">{copy(language, "replayCommentary")}</h4>
            {sortedEvents.length ? (
              <ol className="club-replay-events">
                {sortedEvents.map((event, index) => {
                  const future = event.minute > minute;
                  const current = index === lastVisibleIndex;
                  return (
                    <li
                      key={`${event.minute}:${event.side}:${event.kind}:${index}`}
                      className={`club-replay-comment${future ? " is-future" : ""}${current ? " is-current" : ""}`}
                    >
                      <span className="club-replay-comment-minute">{`${event.minute}'`}</span>
                      <span className={`club-replay-comment-kind is-${event.kind}`}>
                        {copy(language, replayKindKey(event.kind))}
                      </span>
                      <span className="club-replay-comment-body">
                        <b>{event.side === "home" ? home : away}</b>
                        {event.kind === "sub"
                          ? ` · ${event.out ?? "—"} → ${event.scorer ?? "—"}`
                          : event.scorer
                            ? ` · ${event.scorer}`
                            : ""}
                        {event.label && event.kind !== "goal" && event.kind !== "sub" ? ` · ${event.label}` : ""}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="club-note">{copy(language, "replayNoEvents")}</p>
            )}
          </div>
          <p className="club-replay-live" role="status" aria-live="polite">
            {announce}
          </p>
        </div>
      ) : null}
    </div>
  );
}

const CARD_SKIN_TONES = ["#f2c8a8", "#d9a479", "#b57b52", "#8a5a3b", "#5f3d28", "#f5d7bd"];

function ClubCrestSvg({ crest, size = 64, className }: { crest: ClubCrest; size?: number; className?: string }) {
  const [primary, secondary] = crest.colours;
  const starSpacing = 13;
  const startX = 50 - ((Math.max(1, crest.stars) - 1) * starSpacing) / 2;
  return (
    <svg
      className={`club-crest-svg${className ? ` ${className}` : ""}`}
      width={size}
      height={size * 1.16}
      viewBox="0 0 100 116"
      role="img"
      aria-label={copy("en", "crestAria", crest.initials, crest.stars)}
      data-crest-stars={crest.stars}
      data-crest-initials={crest.initials}
    >
      <path d="M8 15 L92 15 L92 63 Q50 108 8 63 Z" fill={primary} stroke="#10151f" strokeWidth="5" strokeLinejoin="round" />
      {crest.stripe ? <path d="M31 15 L49 15 L41 91 L19 81 Z" fill={secondary} opacity="0.82" /> : null}
      <path d="M14 21 L86 21 L86 61 Q50 99 14 61 Z" fill="none" stroke={secondary} strokeWidth="2" opacity="0.75" />
      <text x="50" y="62" textAnchor="middle" fill={secondary} stroke="#10151f" strokeWidth="1.4" paintOrder="stroke" fontFamily="Arial Black, Trebuchet MS, sans-serif" fontWeight="900" fontSize="25">
        {crest.initials}
      </text>
      <text x="50" y="78" textAnchor="middle" fill={secondary} fontFamily="Trebuchet MS, sans-serif" fontWeight="700" fontSize="6.5" letterSpacing="1">
        {crest.motto.slice(0, 14)}
      </text>
      {Array.from({ length: crest.stars }).map((_, index) => {
        const x = startX + index * starSpacing;
        return (
          <path
            key={index}
            d={`M${x} 7 L${x + 2.1} 12 L${x + 7.4} 12.4 L${x + 3.2} 15.6 L${x + 4.7} 20.6 L${x} 17.5 L${x - 4.7} 20.6 L${x - 3.2} 15.6 L${x - 7.4} 12.4 L${x - 2.1} 12 Z`}
            fill={secondary}
            stroke="#10151f"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        );
      })}
    </svg>
  );
}

function CelebrationCupSvg() {
  return (
    <svg className="club-celebration-cup" viewBox="0 0 200 220" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="club-cup-gold" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="0.48" stopColor="#f4c445" />
          <stop offset="1" stopColor="#c98b1f" />
        </linearGradient>
      </defs>
      <path d="M55 28 H145 L139 93 Q132 145 100 158 Q68 145 61 93 Z" fill="url(#club-cup-gold)" stroke="#10151f" strokeWidth="8" strokeLinejoin="round" />
      <path d="M55 36 Q20 34 22 72 Q24 105 63 109" fill="none" stroke="#10151f" strokeWidth="12" strokeLinecap="round" />
      <path d="M145 36 Q180 34 178 72 Q176 105 137 109" fill="none" stroke="#10151f" strokeWidth="12" strokeLinecap="round" />
      <path d="M55 36 Q22 34 24 70 Q28 96 64 101" fill="none" stroke="#f4c445" strokeWidth="6" strokeLinecap="round" />
      <path d="M145 36 Q178 34 176 70 Q172 96 136 101" fill="none" stroke="#f4c445" strokeWidth="6" strokeLinecap="round" />
      <path d="M100 155 V180" stroke="#10151f" strokeWidth="12" strokeLinecap="round" />
      <path d="M63 200 Q63 180 100 180 Q137 180 137 200 Z" fill="url(#club-cup-gold)" stroke="#10151f" strokeWidth="8" strokeLinejoin="round" />
      <path d="M63 200 H137" stroke="#10151f" strokeWidth="8" strokeLinecap="round" />
      <path d="M76 52 Q100 68 124 52" fill="none" stroke="#fff8dc" strokeWidth="6" strokeLinecap="round" opacity="0.8" />
      <path d="M86 85 H114" stroke="#10151f" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
      <text x="100" y="118" textAnchor="middle" fontFamily="Arial Black, Trebuchet MS, sans-serif" fontSize="26" fontWeight="900" fill="#10151f">
        ★
      </text>
    </svg>
  );
}

function PlayerAvatarSvg({ card }: { card: PlayerCard }) {
  const { avatar } = card;
  const skin = CARD_SKIN_TONES[(avatar.skin + 6) % 6];
  const hair = avatar.hairColour;
  const shoulder = 27 + Math.round(avatar.build * 20);
  const eyeMode = avatar.face % 3;
  const mouth = avatar.face % 2 === 0 ? "M52 70 Q60 76 68 70" : "M53 71 Q60 69 67 71";
  return (
    <svg
      className="club-player-avatar-svg"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
      data-avatar-signature={`${avatar.skin}-${avatar.hairStyle}-${avatar.face}-${Math.round(avatar.build * 100)}`}
    >
      <rect width="120" height="120" fill={card.tier.paper} />
      {[18, 36, 54, 72, 90, 108].map((x) =>
        [18, 36, 54, 72, 90, 108].map((y) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill={card.tier.ink} opacity="0.12" />
        )),
      )}
      <path d={`M${60 - shoulder} 120 Q${60 - shoulder} 88 60 86 Q${60 + shoulder} 88 ${60 + shoulder} 120 Z`} fill={card.tier.ink} opacity="0.9" />
      <path d={`M${60 - shoulder + 7} 120 Q${60 - shoulder + 9} 94 60 92 Q${60 + shoulder - 9} 94 ${60 + shoulder - 7} 120 Z`} fill="#f7f1e3" stroke={avatar.kitTrim} strokeWidth="4" />
      <path d="M46 91 L74 91 L70 86 L50 86 Z" fill={avatar.kitTrim} />
      <rect x="54" y="72" width="12" height="16" rx="4" fill={skin} />
      <ellipse cx="60" cy="53" rx="24" ry="27" fill={skin} stroke="#10151f" strokeWidth="2.6" />
      <ellipse cx="36" cy="56" rx="4" ry="7" fill={skin} stroke="#10151f" strokeWidth="2" />
      <ellipse cx="84" cy="56" rx="4" ry="7" fill={skin} stroke="#10151f" strokeWidth="2" />
      {avatar.hairStyle === 0 ? (
        <path d="M36 50 Q35 23 60 23 Q85 23 84 50 Q77 36 60 36 Q43 36 36 50 Z" fill={hair} stroke="#10151f" strokeWidth="2.2" />
      ) : null}
      {avatar.hairStyle === 1 ? (
        <>
          <path d="M36 48 Q38 23 62 24 Q86 25 84 48 Q72 33 55 35 Q44 37 36 48 Z" fill={hair} stroke="#10151f" strokeWidth="2.2" />
          <path d="M68 26 Q84 31 80 48 Q76 37 68 33 Z" fill={hair} opacity="0.7" />
        </>
      ) : null}
      {avatar.hairStyle === 2 ? (
        <>
          <circle cx="45" cy="33" r="13" fill={hair} stroke="#10151f" strokeWidth="2" />
          <circle cx="60" cy="27" r="14" fill={hair} stroke="#10151f" strokeWidth="2" />
          <circle cx="76" cy="34" r="12" fill={hair} stroke="#10151f" strokeWidth="2" />
        </>
      ) : null}
      {avatar.hairStyle === 3 ? (
        <path d="M37 45 Q40 27 60 27 Q80 27 83 45 Q72 38 60 38 Q48 38 37 45 Z" fill={hair} stroke="#10151f" strokeWidth="2.2" />
      ) : null}
      {eyeMode === 0 ? (
        <>
          <circle cx="51" cy="54" r="2.4" fill="#10151f" />
          <circle cx="69" cy="54" r="2.4" fill="#10151f" />
        </>
      ) : null}
      {eyeMode === 1 ? (
        <>
          <path d="M47 54 L55 52" stroke="#10151f" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M65 52 L73 54" stroke="#10151f" strokeWidth="2.2" strokeLinecap="round" />
        </>
      ) : null}
      {eyeMode === 2 ? (
        <>
          <circle cx="51" cy="54" r="3.2" fill="#10151f" />
          <circle cx="69" cy="54" r="3.2" fill="#10151f" />
          <circle cx="52" cy="53" r="1" fill="#fff" />
          <circle cx="70" cy="53" r="1" fill="#fff" />
        </>
      ) : null}
      <path d="M57 61 Q60 64 63 61" stroke="#10151f" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d={mouth} stroke="#10151f" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const PlayerCardView = memo(function PlayerCardView({
  card,
  language,
  condition,
  onOpen,
}: {
  card: PlayerCard;
  language: Language;
  condition?: { fitness: number; injury: number };
  onOpen?: (cardId: string) => void;
}) {
  const tierLabel =
    card.tier.tier === "gold" ? "cardTierGold" : card.tier.tier === "silver" ? "cardTierSilver" : "cardTierBronze";
  const attributes = [
    ["pac", card.attributes.pac],
    ["sho", card.attributes.sho],
    ["pas", card.attributes.pas],
    ["dri", card.attributes.dri],
    ["def", card.attributes.def],
    ["phy", card.attributes.phy],
  ] as const;
  const roleLabel = copy(language, card.starter ? "starters" : "bench");
  const label = `${card.name} · ${card.position} · OVR ${card.ovr} · ${roleLabel}${card.captain ? ` · ${copy(language, "cardCaptain")}` : ""}`;
  return (
    <article
      className={`club-player-card is-${card.tier.tier}${card.starter ? " is-starter" : " is-bench"}`}
      aria-label={label}
      data-card-id={card.id}
      data-tier={card.tier.tier}
      data-starter={card.starter ? "true" : "false"}
      data-avatar-signature={`${card.avatar.skin}-${card.avatar.hairStyle}-${card.avatar.face}-${Math.round(card.avatar.build * 100)}`}
      style={
        {
          "--card-ink": card.tier.ink,
          "--card-paper": card.tier.paper,
          "--card-accent": card.tier.accent,
        } as CSSProperties
      }
    >
      <header className="club-player-card-head">
        <span className="club-player-card-tier">{copy(language, tierLabel)}</span>
        <span className="club-player-card-line">{card.line}</span>
      </header>
      <div className="club-player-card-portrait">
        <PlayerAvatarSvg card={card} />
        <span className="club-player-card-number">{`#${card.number}`}</span>
        {card.captain ? (
          <span className="club-player-card-captain" aria-hidden="true">
            ★
          </span>
        ) : null}
      </div>
      <div className="club-player-card-identity">
        <b>{card.name}</b>
        <span>{`${card.position} · ${card.line}`}</span>
      </div>
      <div className="club-player-card-ovr">
        <b>{card.ovr}</b>
        <small>OVR</small>
      </div>
      <div className="club-player-card-bars">
        {attributes.map(([key, value]) => (
          <span className="club-player-card-bar" key={key}>
            <small>{key.toUpperCase()}</small>
            <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
            <b>{value}</b>
          </span>
        ))}
      </div>
      {condition ? (
        <div className="club-player-card-condition">
          <ConditionBar fitness={condition.fitness} injury={condition.injury} compact language={language} />
          <span className={`club-condition-state${condition.injury > 0 ? " is-injured" : condition.fitness < 35 ? " is-tired" : ""}`}>
            {condition.injury > 0
              ? copy(language, "conditionInjured")
              : condition.fitness < 35
                ? copy(language, "conditionTired")
                : copy(language, "conditionAvailable")}
          </span>
        </div>
      ) : null}
      <div className="club-player-card-foot">
        <span className={`club-player-card-role${card.starter ? " is-starter" : ""}`}>{roleLabel}</span>
        <span className="club-player-card-origin">
          {card.origin === "signed"
            ? card.paidPrice !== null
              ? copy(language, "cardSignedPrice", card.paidPrice)
              : copy(language, "cardSigned")
            : copy(language, "cardAcademy")}
        </span>
      </div>
      {onOpen ? (
        <button
          type="button"
          className="club-player-card-open"
          aria-label={`${label} · ${copy(language, "clubDetailOpen")}`}
          onClick={() => onOpen(card.id)}
        />
      ) : null}
    </article>
  );
});

function RadarDiagram({
  ratings,
  label,
}: {
  ratings: Pick<LineRatings, "DEF" | "MID" | "ATT" | "GK">;
  label: string;
}) {
  const diagram = ratingsRadar(ratings, { x: 70, y: 70 }, 42);
  const outer = diagram.axes.map((axis) => `${axis.outer.x},${axis.outer.y}`).join(" ");
  return (
    <svg className="club-diagram club-radar" viewBox="0 0 140 140" role="img" aria-label={label}>
      <circle cx="70" cy="70" r="42" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25" />
      <circle cx="70" cy="70" r="21" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.18" />
      <polygon points={outer} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.35" />
      {diagram.axes.map((axis) => (
        <line key={axis.label} x1="70" y1="70" x2={axis.outer.x} y2={axis.outer.y} stroke="currentColor" strokeWidth="1" opacity="0.22" />
      ))}
      <polygon points={diagram.points} className="club-radar-area" />
      {diagram.axes.map((axis) => {
        const lx = 70 + (axis.outer.x - 70) * 1.27;
        const ly = 70 + (axis.outer.y - 70) * 1.27;
        return (
          <g key={`${axis.label}-label`}>
            <circle cx={axis.tip.x} cy={axis.tip.y} r="2.4" className="club-radar-point" />
            <text x={lx} y={ly + 3} textAnchor="middle" className="club-radar-label">
              {axis.label}
            </text>
            <text x={lx} y={ly + 14} textAnchor="middle" className="club-radar-value">
              {axis.value.toFixed(1)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BudgetRing({ pct, funds, label }: { pct: number; funds: number; label: string }) {
  const ring = progressRing(pct, 100);
  return (
    <svg className="club-diagram club-budget-ring" viewBox="0 0 96 96" role="img" aria-label={label}>
      <circle cx="48" cy="48" r="34" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.16" />
      <circle
        cx="48"
        cy="48"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset={ring.dashOffset}
        transform="rotate(-90 48 48)"
        className="club-budget-ring-value"
      />
      <text x="48" y="45" textAnchor="middle" className="club-ring-number">
        {funds}
      </text>
      <text x="48" y="58" textAnchor="middle" className="club-ring-caption">
        FC
      </text>
    </svg>
  );
}

function Pips({ filled, total, label, kind }: { filled: number; total: number; label: string; kind: "trophy" | "level" }) {
  return (
    <span className={`club-pips is-${kind}`} role="img" aria-label={label}>
      {Array.from({ length: total }).map((_, index) => (
        <i key={index} className={index < filled ? "is-filled" : undefined} aria-hidden="true">
          {kind === "trophy" ? "★" : "●"}
        </i>
      ))}
    </span>
  );
}

function FormationDiagram({ formation, label }: { formation: ClubFormation; label: string }) {
  const pitch = formationDots(formation as Parameters<typeof formationDots>[0], 105, 68);
  return (
    <svg className="club-diagram club-formation-diagram" viewBox="0 0 105 68" role="img" aria-label={label}>
      <rect x="1" y="1" width="103" height="66" rx="2" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.55" />
      <line x1="52.5" y1="1" x2="52.5" y2="67" stroke="currentColor" strokeWidth="1" opacity="0.35" />
      <circle cx="52.5" cy="34" r="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <rect x="1" y="20" width="14" height="28" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <rect x="90" y="20" width="14" height="28" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {pitch.slots.map((slot, index) => (
        <g key={`${slot.role}-${index}`} className="club-pitch-dot" data-dot-index={index}>
          <circle cx={slot.x} cy={slot.y} r="4.2" />
          <text x={slot.x} y={slot.y + 1.5} textAnchor="middle" className="club-pitch-dot-role">
            {slot.role}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ProgressRing({ done, total, label }: { done: number; total: number; label: string }) {
  const ring = progressRing(done, total);
  return (
    <svg className="club-diagram club-progress-ring" viewBox="0 0 96 96" role="img" aria-label={label}>
      <circle cx="48" cy="48" r="34" fill="none" stroke="currentColor" strokeWidth="8" opacity="0.16" />
      <circle
        cx="48"
        cy="48"
        r="34"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="100"
        strokeDashoffset={ring.dashOffset}
        transform="rotate(-90 48 48)"
        className="club-progress-ring-value"
      />
      <text x="48" y="45" textAnchor="middle" className="club-ring-number">
        {done}
      </text>
      <text x="48" y="58" textAnchor="middle" className="club-ring-caption">
        / {total}
      </text>
    </svg>
  );
}

function BalanceMeter({ label, value, max, display, unit }: { label: string; value: number; max: number; display: string; unit: string }) {
  return (
    <div className="club-balance-meter" role="img" aria-label={`${label}: ${display} ${unit}`}>
      <span className="club-balance-meter-label">{label}</span>
      <span className="club-balance-meter-track"><i style={{ width: `${Math.max(2, Math.min(100, (value / Math.max(1, max)) * 100))}%` }} /></span>
      <b>{display}<small>{unit}</small></b>
    </div>
  );
}

function ConditionBar({ fitness, injury, compact = false, language }: {
  fitness: number;
  injury: number;
  compact?: boolean;
  language: Language;
}) {
  const tone = injury > 0 ? "injured" : fitness < 35 ? "tired" : fitness < 65 ? "low" : "good";
  return (
    <span className={`club-condition-bar is-${tone}${compact ? " is-compact" : ""}`} title={`${copy(language, "columnFitness")} ${fitness}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, fitness))}%` }} />
      <b>{fitness}</b>
      {injury > 0 ? <em className="club-condition-badge">{copy(language, "conditionInjuryBadge", injury)}</em> : null}
    </span>
  );
}

function ConditionDiagram({ report, label }: { report: ConditionReport; label: string }) {
  const total = Math.max(1, report.available + report.injured + report.tired);
  const availableWidth = (report.available / total) * 148;
  const injuredWidth = (report.injured / total) * 148;
  const tiredWidth = (report.tired / total) * 148;
  return (
    <svg className="club-diagram club-condition-diagram" viewBox="0 0 180 50" role="img" aria-label={label}>
      <rect x="8" y="5" width="148" height="14" rx="7" fill="currentColor" opacity="0.16" />
      <rect x="8" y="5" width={availableWidth} height="14" rx="7" className="club-condition-available" />
      <rect x={8 + availableWidth} y="5" width={injuredWidth} height="14" className="club-condition-injured" />
      <rect x={8 + availableWidth + injuredWidth} y="5" width={tiredWidth} height="14" rx="7" className="club-condition-tired" />
      <text x="156" y="37" textAnchor="end" className="club-condition-diagram-avg">
        {`${report.startersAvgFitness}`}
      </text>
      <text x="156" y="47" textAnchor="end" className="club-condition-diagram-caption">XI</text>
    </svg>
  );
}

const ONBOARDING_KEY = "qfc-club-onboarding-v1";

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function conditionSnapshotOf(club: ClubState): { average: number; injured: Set<string> } {
  return {
    average: conditionReport(club).startersAvgFitness,
    injured: new Set(club.players.filter((player) => isInjured(player)).map((player) => player.id)),
  };
}

type MatchConditionSummary = {
  before: number;
  after: number;
  newInjuries: string[];
  kind: "quick" | "live";
};

export default function ClubPreviewPage() {
  const [samplePreview] = useState<ClubPreview>(() => buildClubPreview());
  const [envelope, setEnvelope] = useState<Envelope | null>(null);
  const [source, setSource] = useState<DataSource>("loading");
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [clubTab, setClubTab] = useState<ClubTab>("overview");
  const pendingAnchorRef = useRef<string | null>(null);
  const [decorAnnouncement, setDecorAnnouncement] = useState("");
  const [latestWatchOpen, setLatestWatchOpen] = useState(false);
  const [latestReplayOpen, setLatestReplayOpen] = useState(false);
  const [assistantAnnouncement, setAssistantAnnouncement] = useState("");
  const [matchConditionSummary, setMatchConditionSummary] = useState<MatchConditionSummary | null>(null);
  const [liveFormationAnnouncement, setLiveFormationAnnouncement] = useState("");
  const [tacticSuggestAnnouncement, setTacticSuggestAnnouncement] = useState("");
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingAnnouncement, setOnboardingAnnouncement] = useState("");
  const [exportAnnouncement, setExportAnnouncement] = useState("");
  const conditionBeforeRef = useRef<{ average: number; injured: Set<string> } | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const [celebrationMode, setCelebrationMode] = useState<"pending" | "review">("pending");
  const celebrationAutoShown = useRef(false);
  const celebrationDialogRef = useRef<HTMLDivElement | null>(null);
  const celebrationPriorFocus = useRef<HTMLElement | null>(null);
  const [detailPlayerId, setDetailPlayerId] = useState<string | null>(null);
  const [detailAnnouncement, setDetailAnnouncement] = useState("");
  const [detailError, setDetailError] = useState("");
  const detailDialogRef = useRef<HTMLDivElement | null>(null);
  const detailPriorFocus = useRef<HTMLElement | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [attributeChoice, setAttributeChoice] = useState<{ playerId: string; attribute: TrainableAttribute } | null>(null);
  const [receiptText, setReceiptText] = useState("");
  const [tacticReceipt, setTacticReceipt] = useState("");
  const [facilityReceipt, setFacilityReceipt] = useState("");
  const [pendingAction, setPendingAction] = useState("");
  const [matchTier, setMatchTier] = useState<0 | 1 | 2 | 3>(1);
  const [liveTier, setLiveTier] = useState<0 | 1 | 2 | 3>(0);
  const [confirmingAbandonLive, setConfirmingAbandonLive] = useState(false);
  const [subOutId, setSubOutId] = useState("");
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [subInId, setSubInId] = useState("");
  const [liveFinished, setLiveFinished] = useState<{
    score: [number, number];
    opponent: string;
    home: string;
    matchId: string;
  } | null>(null);
  const liveEventsRef = useRef<HTMLDivElement | null>(null);
  const [scoutingFilters, setScoutingFilters] = useState<ScoutingFilters>({});
  const [scoutDataset, setScoutDataset] = useState<ScoutDataset | null>(null);
  const [scoutLoadState, setScoutLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [scoutLoadError, setScoutLoadError] = useState("");
  const scoutLoadStartedRef = useRef(false);
  const [squadView, setSquadView] = useState<"cards" | "list">("list");
  const [scoutSort, setScoutSort] = useState<ScoutSort>("priceAsc");
  const [scoutWithinCapOnly, setScoutWithinCapOnly] = useState(true);
  const [pendingSellId, setPendingSellId] = useState<string | null>(null);
  const [leagueTier, setLeagueTier] = useState<LeagueTier>(0);
  const [cupTier, setCupTier] = useState<CupTier>(0);
  const [migrateAnnouncement, setMigrateAnnouncement] = useState("");
  const [lastRoundResults, setLastRoundResults] = useState<{
    round: number;
    results: { home: string; away: string; score: [number, number] }[];
  } | null>(null);
  const [createForm, setCreateForm] = useState<CreateForm>({
    name: "",
    shortName: "",
    city: "",
    primary: "#1f4e79",
    secondary: "#c8f56e",
    formation: "4-3-3",
  });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    readEnvelope(controller.signal)
      .then((next) => {
        if (!active) return;
        setEnvelope(next);
        setFailure("");
        setSource("live");
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        setFailure(error instanceof Error ? error.message : "Request failed");
        setSource("sample");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const state = envelope?.state ?? null;
  const club = state?.club ?? null;
  const mode: PageMode = source === "loading" ? "loading" : source === "sample" ? "sample" : club ? "club" : "create";
  const language: Language = source === "live" && state?.settings?.language === "zh" ? "zh" : "en";

  useEffect(() => {
    const requested = tabFromUrl(new URL(window.location.href));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial deep-link hydration from the URL.
    if (requested.tab !== "overview") setClubTab(requested.tab);
    if (requested.anchor) pendingAnchorRef.current = requested.anchor;
    const onHash = () => {
      const next = tabFromUrl(new URL(window.location.href));
      if (next.anchor) pendingAnchorRef.current = next.anchor;
      setClubTab(next.tab);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(ONBOARDING_KEY)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- first-visit onboarding is hydrated from localStorage.
        setOnboardingVisible(true);
      }
    } catch {
      // localStorage can be unavailable in private/sandboxed contexts; the guide is optional.
    }
  }, []);

  useEffect(() => {
    const anchor = pendingAnchorRef.current;
    if (!anchor) return;
    let attempts = 0;
    let timeout = 0;
    const reveal = () => {
      const target = document.getElementById(anchor);
      if (!target) {
        if (attempts < 12) {
          attempts += 1;
          timeout = window.setTimeout(reveal, 80);
        }
        return;
      }
      pendingAnchorRef.current = null;
      const details = target.closest("details");
      if (details instanceof HTMLDetailsElement) details.open = true;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
      target.focus({ preventScroll: true });
    };
    reveal();
    return () => window.clearTimeout(timeout);
  }, [clubTab]);

  useEffect(() => {
    if (mode !== "club" || !club || celebrationAutoShown.current) return;
    const pending = pendingCelebration(club);
    if (!pending) return;
    celebrationAutoShown.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first-load pending trophy celebration.
    setCelebration(pending);
    setCelebrationMode("pending");
  }, [mode, club]);

  useEffect(() => {
    if (!celebration) return;
    celebrationPriorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => celebrationDialogRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setCelebration(null);
        return;
      }
      if (event.key !== "Tab" || !celebrationDialogRef.current) return;
      const focusable = [...celebrationDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const prior = celebrationPriorFocus.current;
      if (prior?.isConnected) window.setTimeout(() => prior.focus(), 0);
    };
  }, [celebration]);

  useEffect(() => {
    if (!detailPlayerId) return;
    detailPriorFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => detailDialogRef.current?.focus(), 40);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetailPlayerId(null);
        return;
      }
      if (event.key !== "Tab" || !detailDialogRef.current) return;
      const focusable = [...detailDialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')].filter((element) => element.offsetParent !== null);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      const prior = detailPriorFocus.current;
      if (prior?.isConnected) window.setTimeout(() => prior.focus(), 0);
    };
  }, [detailPlayerId]);
  const preview = useMemo(
    () => (club && state ? buildLivePreview(club, state) : samplePreview),
    [club, state, samplePreview],
  );
  const funds = state ? clubFunds(state.economy) : 0;
  const clubLevel = state ? level(state) : preview.level;
  const clubXp = state ? totalXP(state) : preview.xp;
  const meta = envelope ? { revision: envelope.revision, updatedAt: envelope.updatedAt } : null;

  const alternativeLanguage: Language = language === "en" ? "zh" : "en";
  const alternativeLangTag = alternativeLanguage === "zh" ? "zh-CN" : "en-GB";
  const pageLangTag = language === "zh" ? "zh-CN" : "en-GB";

  const starterPlayers = useMemo(() => {
    const byId = new Map(preview.squad.map((player) => [player.id, player]));
    return preview.starters
      .map((id) => byId.get(id))
      .filter((player): player is ClubPreviewPlayer => Boolean(player));
  }, [preview]);
  const benchPlayers = useMemo(() => {
    const byId = new Map(preview.squad.map((player) => [player.id, player]));
    return preview.bench
      .map((id) => byId.get(id))
      .filter((player): player is ClubPreviewPlayer => Boolean(player));
  }, [preview]);
  const counts = useMemo(() => squadLineCounts(preview), [preview]);
  const blockedStarters = useMemo(
    () => starterPlayers.filter((player) => Boolean(player.training.blocked)).length,
    [starterPlayers],
  );
  const playerCards = useMemo(() => (club ? squadCards(club) : []), [club]);
  const conditionById = useMemo(() => {
    const map = new Map<string, { fitness: number; injury: number }>();
    for (const player of club?.players ?? []) map.set(player.id, { fitness: fitnessOf(player), injury: injuryMatchesOf(player) });
    return map;
  }, [club]);
  const cardStats = useMemo(() => cardSummary(playerCards), [playerCards]);
  const crest = useMemo(() => (club ? clubCrest(club) : null), [club]);
  const starterCards = useMemo(() => playerCards.filter((card) => card.starter), [playerCards]);
  const benchCards = useMemo(() => playerCards.filter((card) => !card.starter), [playerCards]);
  const detailData = useMemo(
    () => (club && detailPlayerId ? playerDetail(club, detailPlayerId, { x: 70, y: 70 }, 48) : null),
    [club, detailPlayerId],
  );
  const detailCard = useMemo(
    () => (detailPlayerId ? playerCards.find((card) => card.id === detailPlayerId) ?? null : null),
    [detailPlayerId, playerCards],
  );
  const detailPlayer = useMemo(
    () => (club && detailPlayerId ? club.players.find((player) => player.id === detailPlayerId) ?? null : null),
    [club, detailPlayerId],
  );
  const detailFitness = detailPlayer ? fitnessOf(detailPlayer) : 100;
  const detailInjured = detailPlayer ? isInjured(detailPlayer) : false;
  const ratingTiles = useMemo(
    () => [
      { code: "DEF", label: copy(language, "defence"), value: preview.ratings.DEF },
      { code: "MID", label: copy(language, "midfield"), value: preview.ratings.MID },
      { code: "ATT", label: copy(language, "attack"), value: preview.ratings.ATT },
      { code: "GK", label: copy(language, "goalkeeper"), value: preview.ratings.GK },
      { code: "OVR", label: copy(language, "overallValue"), value: preview.ratings.overall },
    ],
    [language, preview.ratings],
  );
  const levelFloor = Math.max(0, (clubLevel - 1) * 100);
  const xpInLevel = Math.max(0, Math.min(100, clubXp - levelFloor));
  const xpToNext = Math.max(0, clubLevel * 100 - clubXp);

  const starterIds = useMemo(() => new Set(club?.lineup ?? []), [club]);
  const lineupPlayers = useMemo(() => {
    if (!club) return [];
    const byId = new Map(club.players.map((player) => [player.id, player]));
    return club.lineup.map((id) => byId.get(id)).filter((player): player is ClubPlayer => Boolean(player));
  }, [club]);
  const assistant = useMemo(
    () => (club ? assistantOf(club) : { autoSquad: true, autoSubs: true }),
    [club],
  );
  const clubCondition = useMemo(() => (club ? conditionReport(club) : null), [club]);
  const unavailableStarters = useMemo(
    () => lineupPlayers.filter((player) => !isAvailable(player)),
    [lineupPlayers],
  );
  const latestMatch = useMemo(() => club?.matches?.[0] ?? null, [club]);
  const recentMatches = useMemo(() => (club?.matches ?? []).slice(0, 10), [club]);
  const overviewActions = useMemo(
    () => (mode === "club" && state ? nextClubActions(state, 3) : []),
    [mode, state],
  );
  const overviewSummary = useMemo(
    () => (mode === "club" && state ? clubHomeSummary(state) : null),
    [mode, state],
  );
  const decorList = useMemo(() => (club ? decorOptions(club) : []), [club]);
  const decorSummaryData = useMemo(
    () => ({
      unlocked: decorList.filter((option) => option.unlocked).length,
      total: decorList.length,
    }),
    [decorList],
  );
  const overviewBudget = useMemo(() => {
    if (!club) return budgetSplit(funds, [0]);
    const prices = club.players
      .map((player) => {
        const price = trainingPrice(player.attributes.pas);
        return typeof price === "number" ? price : Number.POSITIVE_INFINITY;
      })
      .filter((price) => Number.isFinite(price));
    return budgetSplit(funds, prices.length ? prices : [0]);
  }, [club, funds]);

  const trophies = useMemo(
    () => (club?.trophies ? [...club.trophies].sort((a, b) => b.at.localeCompare(a.at)) : []),
    [club],
  );
  const migrationPreview = useMemo(() => (state ? previewClubMigration(state) : null), [state]);
  const migratedAt = club?.migratedAt ?? null;
  const seasonHistory = useMemo(
    () =>
      club?.history ? [...club.history].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 20) : [],
    [club],
  );
  const latestMatchReport = useMemo(() => {
    if (!club || !latestMatch) return null;
    try {
      return simulateClubMatch(teamFromClub(club), opponentFor(latestMatch.tier, latestMatch.seed), latestMatch.seed);
    } catch {
      return null;
    }
  }, [club, latestMatch]);
  const latestMatchReportMatches = Boolean(
    latestMatchReport &&
      latestMatch &&
      latestMatchReport.score[0] === latestMatch.score[0] &&
      latestMatchReport.score[1] === latestMatch.score[1],
  );
  const latestMatchTopRating = latestMatchReport
    ? Math.max(0, ...latestMatchReport.playerRatings.home.map((row) => row.rating))
    : 0;

  const liveMatchState = club?.live ?? null;
  const liveSession = liveMatchState?.session ?? null;
  const liveBriefing = club && liveSession ? matchBriefing(club, liveSession.away) : null;
  const tacticSuggestion = useMemo(() => {
    if (!club) return null;
    try {
      const opponent = opponentFor(matchTier, seedFrom(`${club.id}:${matchTier}:${club.matches?.length ?? 0}`));
      const briefing = matchBriefing(club, opponent);
      return {
        tactic: briefing.suggestedTactic,
        reason: briefing.tacticReason,
        opponentName: opponent.name,
        opponentTactic: opponent.tactic,
        fallback: false,
      };
    } catch {
      return {
        tactic: "balanced" as ClubTactic,
        reason: "",
        opponentName: null,
        opponentTactic: null,
        fallback: true,
      };
    }
  }, [club, matchTier]);
  const liveLatestEvent =
    liveSession && liveSession.events.length ? liveSession.events[liveSession.events.length - 1] : null;
  const liveAnnouncement = liveFinished
    ? copy(
        language,
        "liveFullTime",
        liveFinished.home,
        liveFinished.score[0],
        liveFinished.score[1],
        liveFinished.opponent,
      )
    : liveSession
      ? `${copy(language, "liveBlock", liveSession.block, 18)} · ${liveSession.score[0]} – ${liveSession.score[1]}${
          liveLatestEvent
            ? ` · ${liveLatestEvent.minute}' ${copy(language, replayKindKey(liveLatestEvent.kind))}${
                liveLatestEvent.kind === "sub"
                  ? ` · ${liveLatestEvent.out ?? "—"} → ${liveLatestEvent.scorer ?? "—"}`
                  : liveLatestEvent.scorer
                    ? ` · ${liveLatestEvent.scorer}`
                    : ""
              }`
            : ""
        }`
      : "";

  useEffect(() => {
    const element = liveEventsRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [liveSession?.block, liveSession?.events?.length]);

  const liveStarterPlayers = club
    ? club.lineup
        .map((playerId) => club.players.find((player) => player.id === playerId))
        .filter((player): player is NonNullable<typeof player> => Boolean(player))
    : [];
  const liveBenchPlayers = club ? club.players.filter((player) => !club.lineup.includes(player.id)) : [];
  const effectiveSubOutId = liveStarterPlayers.some((player) => player.id === subOutId)
    ? subOutId
    : (liveStarterPlayers.find((player) => player.position !== "GK") ?? liveStarterPlayers[0])?.id ?? "";
  const effectiveSubOut = liveStarterPlayers.find((player) => player.id === effectiveSubOutId) ?? null;
  const subOutIsKeeper = effectiveSubOut?.position === "GK";
  const compatibleSubBench = liveBenchPlayers.filter((player) =>
    subOutIsKeeper ? player.position === "GK" : player.position !== "GK",
  );
  const effectiveSubInId = compatibleSubBench.some((player) => player.id === subInId)
    ? subInId
    : compatibleSubBench[0]?.id ?? "";
  const effectiveSubIn = compatibleSubBench.find((player) => player.id === effectiveSubInId) ?? null;
  const liveSubsUsed = liveSession?.subs ?? 0;
  const liveSubBlockedReason = !liveSession
    ? null
    : liveSubsUsed >= 5
      ? copy(language, "liveSubLimitReached")
      : !effectiveSubOut
        ? copy(language, "liveSubNoStarter")
        : compatibleSubBench.length === 0
          ? copy(language, subOutIsKeeper ? "liveSubNeedKeeper" : "liveSubNeedOutfield")
          : null;

  const scoutingCap = club ? scoutCap(club.facilities.scoutCentre) : 0;
  const loadScoutDataset = useCallback(async (force = false) => {
    if (!force && scoutLoadStartedRef.current) return;
    scoutLoadStartedRef.current = true;
    setScoutLoadState("loading");
    setScoutLoadError("");
    try {
      const data = await import("@/lib/football-data");
      const targets: ScoutDataset["targets"] = [];
      for (const world of data.FOOTBALL_PLAYERS) {
        try {
          const ovr = worldPlayerOvr(world);
          targets.push({ world, ovr, price: signingPrice(ovr) });
        } catch {
          // Skip identities without enough attribute data to quote.
        }
      }
      setScoutDataset({ clubs: data.FOOTBALL_CLUBS, players: data.FOOTBALL_PLAYERS, targets });
      setScoutLoadState("ready");
    } catch (error) {
      scoutLoadStartedRef.current = false;
      setScoutLoadState("error");
      setScoutLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the roster is loaded only when the Club tab (transfers/scouting) opens.
    if (mode === "club" && clubTab === "club") void loadScoutDataset();
  }, [mode, clubTab, loadScoutDataset]);
  const scoutingChoices = useMemo(
    () => (scoutDataset ? scoutingFilterOptions(scoutDataset.clubs) : { leagues: [], regions: [] }),
    [scoutDataset],
  );
  const scoutingPositions = useMemo(
    () => [...new Set((scoutDataset?.players ?? []).map((player) => player.position))].sort(),
    [scoutDataset],
  );
  const scoutingFilteredPlayers = useMemo(
    () => (scoutDataset ? filterRoster(scoutDataset.players, scoutDataset.clubs, scoutingFilters) : []),
    [scoutDataset, scoutingFilters],
  );
  const scoutingFilteredIds = useMemo(
    () => new Set(scoutingFilteredPlayers.map((player) => player.id)),
    [scoutingFilteredPlayers],
  );
  const scoutingFiltersActive = Boolean(scoutingFilters.league || scoutingFilters.region || scoutingFilters.position);
  const toggleScoutingFilter = (field: keyof ScoutingFilters, value: string) =>
    setScoutingFilters((current) => ({ ...current, [field]: current[field] === value ? undefined : value }));
  const clearScoutingFilters = () => setScoutingFilters({});
  const scoutingLeagueLabel = (id: string) =>
    id === "premier-league"
      ? copy(language, "scoutLeaguePremier")
      : id === "background"
        ? copy(language, "scoutLeagueOther")
        : id;
  const scoutingFilterDescription = describeFilters(scoutingFilters)
    .replace("All players", copy(language, "scoutFilterAll"))
    .replace("background", copy(language, "scoutLeagueOther"));
  const scoutingChoiceLabel = (field: "league" | "region" | "position", id: string) =>
    field === "league" ? scoutingLeagueLabel(id) : id;
  const scoutRows = useMemo(() => {
    if (!club || !scoutDataset) return [];
    const filtered = scoutDataset.targets.filter((entry) => {
      if (scoutWithinCapOnly && entry.ovr > scoutingCap) return false;
      if (!scoutingFilteredIds.has(entry.world.id)) return false;
      return true;
    });
    const sorted = [...filtered];
    if (scoutSort === "ovr") sorted.sort((a, b) => b.ovr - a.ovr || a.world.name.localeCompare(b.world.name));
    else if (scoutSort === "priceAsc") sorted.sort((a, b) => a.price - b.price || b.ovr - a.ovr);
    else sorted.sort((a, b) => b.price - a.price || b.ovr - a.ovr);
    return sorted;
  }, [club, scoutDataset, scoutingFilteredIds, scoutSort, scoutWithinCapOnly, scoutingCap]);
  const visibleScoutRows = scoutRows.slice(0, 24);
  const squadIsFull = (club?.players.length ?? 0) >= 25;
  const scouting = useMemo(
    () =>
      club && scoutDataset
        ? computeScoutingPlan(club, scoutDataset.players, funds, {
            limit: 5,
            clubs: scoutDataset.clubs,
            filters: scoutingFilters,
          })
        : null,
    [club, funds, scoutDataset, scoutingFilters],
  );
  const scoutingWeakestNeed = scouting?.needs.find((need) => need.line === scouting.weakest) ?? null;
  const scoutingHasAffordable = Boolean(scouting?.recommendations.some((entry) => entry.price <= scouting.budget));
  const displayPlan = useMemo(() => (state ? clubDisplay(state) : null), [state]);
  const selectedFrameOption = displayPlan?.options.find((option) => option.kind === "frame" && option.selected) ?? null;
  const selectedBackdropOption = displayPlan?.options.find((option) => option.kind === "backdrop" && option.selected) ?? null;
  const selectedKit = displayPlan?.kits.find((kit) => kit.selected) ?? null;
  const displayHasAnyOwned = Boolean(
    displayPlan?.options.some((option) => (option.kind === "frame" && option.owned) || (option.kind === "backdrop" && option.owned)),
  );

  const season = club?.season ?? null;
  const orderedLeague = useMemo(() => (season ? sortTable(season.table) : []), [season]);
  const leagueTeamsById = useMemo(() => {
    const map = new Map<string, string>();
    if (season) for (const team of season.teams) map.set(team.id, team.name);
    if (club) map.set("club", club.name);
    return map;
  }, [season, club]);
  const leagueNameOf = (teamId: string) => leagueTeamsById.get(teamId) ?? teamId;
  const leagueOutcome = useMemo(() => (season && season.finished ? seasonOutcome(season) : null), [season]);
  const ownLeagueRow = useMemo(
    () => (season ? season.table.find((row) => row.teamId === "club") ?? null : null),
    [season],
  );
  const ownLeaguePosition = useMemo(
    () => Math.max(1, orderedLeague.findIndex((row) => row.teamId === "club") + 1),
    [orderedLeague],
  );
  const reconstructedRound = useMemo(() => {
    if (!club || !season || season.round === 0) return null;
    try {
      let local: ClubSeason = createSeason(club, season.tier, season.seed, season.id);
      let results: { home: string; away: string; score: [number, number] }[] = [];
      for (let index = 0; index < season.round; index += 1) {
        const played = playSeasonRound(club, local);
        local = played.season;
        results = played.results;
      }
      return { round: season.round, results };
    } catch {
      return null;
    }
  }, [club, season]);
  const leagueRecent =
    lastRoundResults && season && lastRoundResults.round === season.round ? lastRoundResults : reconstructedRound;

  const cup = club?.cup ?? null;
  const cupSemiMatches = useMemo(
    () => (cup ? cup.matches.filter((match) => match.round === 1) : []),
    [cup],
  );
  const cupFinalMatch = useMemo(
    () => (cup ? cup.matches.find((match) => match.round === 2) ?? null : null),
    [cup],
  );
  const cupNextRound = useMemo(() => {
    if (!cup || cup.finished) return null;
    const pending = cup.matches.filter((match) => match.score === undefined);
    return pending.length ? (pending[0].round as 1 | 2) : null;
  }, [cup]);
  const cupOutcome = cup?.finished ? (cup.winner === "club" ? "won" : "lost") : null;
  const cupWinnerName = cup?.winner ? cupNameOf(cup, club?.name, cup.winner) : null;
  const cupNextOwnMatch = useMemo(() => {
    if (!cup || !cupNextRound) return null;
    return (
      cup.matches.find(
        (match) => match.round === cupNextRound && (match.home === "club" || match.away === "club"),
      ) ?? null
    );
  }, [cup, cupNextRound]);
  const cupSemiWinners = useMemo(() => {
    const winners = new Map<string, string | undefined>();
    if (!cup || !cupFinalMatch) return winners;
    const semis = cup.matches.filter((match) => match.round === 1);
    if (semis[0]) winners.set(`${semis[0].round}:${semis[0].home}:${semis[0].away}`, cupFinalMatch.home);
    if (semis[1]) winners.set(`${semis[1].round}:${semis[1].home}:${semis[1].away}`, cupFinalMatch.away);
    return winners;
  }, [cup, cupFinalMatch]);

  /* Default the training target to the weakest starting slot (derived, no effect needed). */
  const effectivePlayerId = useMemo(() => {
    if (!club) return "";
    return club.players.some((player) => player.id === selectedPlayerId) ? selectedPlayerId : shortBoardPlayerId(club);
  }, [club, selectedPlayerId]);
  const effectivePlayer = useMemo(() => {
    if (!club || !effectivePlayerId) return null;
    try {
      return clubPlayer(club, effectivePlayerId);
    } catch {
      return club.players[0] ?? null;
    }
  }, [club, effectivePlayerId]);
  const selectedAttribute: TrainableAttribute = useMemo(() => {
    if (!club || !effectivePlayer) return "pas";
    if (attributeChoice && attributeChoice.playerId === effectivePlayerId) return attributeChoice.attribute;
    return defaultTrainableAttribute(effectivePlayer, club.facilities.trainingCentre);
  }, [club, effectivePlayer, effectivePlayerId, attributeChoice]);

  const trainingInjured = Boolean(effectivePlayer && isInjured(effectivePlayer));
  const trainingFitness = effectivePlayer ? fitnessOf(effectivePlayer) : 100;
  const trainingPreview = useMemo(() => {
    if (!club || !state || !effectivePlayer) return null;
    const player = effectivePlayer;
    const quote = quoteTraining(player, selectedAttribute, club.facilities.trainingCentre);
    const trained = trainPlayer(player, selectedAttribute, club.facilities.trainingCentre);
    const beforeRatings = clubRatings(club);
    const afterRatings = clubRatings({
      ...club,
      players: club.players.map((entry) => (entry.id === player.id ? trained : entry)),
    });
    const priceAffordable = quote.price > 0 && funds >= quote.price;
    return { player, quote, trained, beforeRatings, afterRatings, affordable: !quote.blocked && priceAffordable };
  }, [club, state, effectivePlayer, selectedAttribute, funds]);

  const applyEnvelope = (next: Envelope) => {
    setEnvelope(next);
    setSource("live");
    setFailure("");
  };
  const reload = async (silent = false) => {
    setRefreshing(true);
    try {
      const next = await readEnvelope();
      applyEnvelope(next);
      if (!silent) setFeedback({ kind: "info", text: copy(language, "refreshAction") });
    } catch (error) {
      if (!silent) {
        setFeedback({
          kind: "error",
          text: copy(language, "commandFailed", error instanceof Error ? error.message : "HTTP"),
        });
      }
    } finally {
      setRefreshing(false);
    }
  };
  const handleCommandError = (error: unknown, fallbackKey: CopyKey) => {
    if (error instanceof CommandError && error.status === 409) {
      setFeedback({ kind: "error", text: copy(language, "revisionConflict") });
      void reload(true);
      return;
    }
    setFeedback({
      kind: "error",
      text: copy(language, fallbackKey, error instanceof Error ? error.message : String(error)),
    });
  };

  const canCreate =
    createForm.name.trim().length >= 2 &&
    createForm.shortName.trim().length >= 2 &&
    createForm.shortName.trim().length <= 4 &&
    HEX_COLOUR.test(createForm.primary) &&
    HEX_COLOUR.test(createForm.secondary);
  const updateCreateForm = (patch: Partial<CreateForm>) =>
    setCreateForm((current) => ({ ...current, ...patch }));

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !envelope || !canCreate) return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await sendCommand(
        {
          type: "club.create",
          name: createForm.name.trim(),
          shortName: createForm.shortName.trim().toUpperCase(),
          city: createForm.city.trim(),
          colours: { primary: createForm.primary, secondary: createForm.secondary },
          formation: createForm.formation,
        },
        envelope.revision,
      );
      applyEnvelope(next);
      setFeedback({
        kind: "success",
        text: copy(language, "createSuccess", next.state.club?.name ?? createForm.name.trim()),
      });
    } catch (error) {
      handleCommandError(error, "createFailed");
    } finally {
      setBusy(false);
    }
  };

  const handleTrain = async () => {
    if (busy || !envelope || !trainingPreview || trainingPreview.quote.blocked || !trainingPreview.affordable || trainingInjured) return;
    const { player, quote, trained } = trainingPreview;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await sendCommand(
        { type: "club.train", playerId: player.id, attribute: selectedAttribute },
        envelope.revision,
      );
      applyEnvelope(next);
      setAttributeChoice({ playerId: player.id, attribute: selectedAttribute });
      const receipts = next.state.club?.receipts ?? [];
      const receipt: ClubReceipt | undefined = receipts[receipts.length - 1];
      const label = receipt?.label ?? `${player.name} · ${selectedAttribute.toUpperCase()}`;
      const cost = receipt?.cost ?? quote.price;
      const receiptLine = copy(language, "trainingSuccess", label, cost);
      setReceiptText(receiptLine);
      setFeedback({
        kind: "success",
        text: `${receiptLine} · ${copy(language, "trainResult", player.name, selectedAttribute.toUpperCase(), quote.from, quote.to, player.ovr, trained.ovr)}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
    }
  };

  const detailBlockedReason = (blocked: string | null) => {
    if (!blocked) return "";
    if (blocked === "Already at the maximum.") return copy(language, "clubDetailMax");
    if (blocked === "The training centre caps this attribute.") return copy(language, "clubDetailAtCap");
    return blocked;
  };

  const handleDetailTrain = async (attribute: AttributeKey) => {
    if (busy || !club || !envelope || !detailData) return;
    const check = canTrainDetail(club, detailData, attribute);
    const before = detailData.attributes.find((entry) => entry.key === attribute);
    if (!check.ok || typeof check.price !== "number" || !before) {
      setDetailError(check.reason ?? copy(language, "commandFailed"));
      return;
    }
    if (check.price > funds) {
      setDetailError(copy(language, "clubDetailInsufficient", check.price));
      return;
    }
    const fundsBefore = funds;
    setBusy(true);
    setDetailError("");
    try {
      const next = await sendCommand({ type: "club.train", playerId: detailData.id, attribute }, envelope.revision);
      applyEnvelope(next);
      if (next.state.club) {
        const afterDetail = playerDetail(next.state.club, detailData.id, { x: 70, y: 70 }, 48);
        const after = afterDetail.attributes.find((entry) => entry.key === attribute);
        const fundsAfter = clubFunds(next.state.economy);
        setDetailAnnouncement(
          copy(language, "clubDetailTrained", detailData.name, before.label, before.value, after?.value ?? before.value + 1, check.price, fundsBefore, fundsAfter),
        );
        setFeedback({
          kind: "success",
          text: copy(language, "clubDetailTrained", detailData.name, before.label, before.value, after?.value ?? before.value + 1, check.price, fundsBefore, fundsAfter),
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : copy(language, "commandFailed");
      setDetailError(message);
      setFeedback({ kind: "error", text: message });
    } finally {
      setBusy(false);
    }
  };

  const handleLineup = async (formation: ClubFormation) => {
    if (busy || !club || !envelope) return;
    const picked = autoPick(club.players, formation)
      .map((player) => player?.id)
      .filter((id): id is string => Boolean(id));
    const starters = picked.length === 11 ? picked : club.lineup;
    if (starters.length !== 11) {
      setFeedback({ kind: "error", text: copy(language, "lineupFailed", "Need eleven starters.") });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.lineup", formation, starters }, envelope.revision);
      applyEnvelope(next);
      setFeedback({ kind: "success", text: copy(language, "lineupSuccess", formation) });
    } catch (error) {
      handleCommandError(error, "lineupFailed");
    } finally {
      setBusy(false);
    }
  };

  const handleTactic = async (tactic: ClubTactic) => {
    if (busy || !club || !envelope || club.tactics.active === tactic) return;
    const beforeRatings = preview.ratings;
    setBusy(true);
    setPendingAction(`tactic:${tactic}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.tactic", tactic }, envelope.revision);
      applyEnvelope(next);
      const afterRatings = next.state.club ? clubRatings(next.state.club) : beforeRatings;
      const delta = ratingDeltaText(beforeRatings, afterRatings);
      setFeedback({
        kind: "success",
        text: `${copy(language, "tacticSwitched", copy(language, TACTIC_NAME_KEY[tactic]))}${delta ? ` · ${delta}` : ""}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleTacticTrain = async (tactic: ClubTactic) => {
    if (busy || !club || !envelope) return;
    const level = club.tactics.levels[tactic] ?? 0;
    const price = tacticTrainingCost(level);
    if (price === null || funds < price) return;
    const beforeRatings = preview.ratings;
    setBusy(true);
    setPendingAction(`tactic-train:${tactic}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.tactic.train", tactic }, envelope.revision);
      applyEnvelope(next);
      const nextClub = next.state.club;
      const afterRatings = nextClub ? clubRatings(nextClub) : beforeRatings;
      const receipt = lastReceiptOfKind(nextClub, "tactic");
      const receiptLine = receipt
        ? copy(language, "receiptLine", receipt.label, receipt.cost)
        : copy(language, "receiptLine", `Tactic ${tactic} L${level + 1}`, price);
      const delta = ratingDeltaText(beforeRatings, afterRatings);
      const inactiveHint = nextClub && nextClub.tactics.active !== tactic ? ` · ${copy(language, "tacticInactiveHint")}` : "";
      setTacticReceipt(`${receiptLine}${delta ? ` · ${delta}` : ""}`);
      setFeedback({
        kind: "success",
        text: `${copy(language, "tacticBought", copy(language, TACTIC_NAME_KEY[tactic]))} · ${receiptLine}${delta ? ` · ${delta}` : ""}${inactiveHint}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleFacility = async (facility: FacilityKey) => {
    if (busy || !club || !envelope) return;
    const currentLevel = club.facilities[facility];
    const price = facilityUpgradeCost(facility, currentLevel);
    if (price === null) return;
    const nextLevel = currentLevel + 1;
    if (clubLevel < facilityGate(facility, nextLevel) || funds < price) return;
    setBusy(true);
    setPendingAction(`facility:${facility}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.facility", facility }, envelope.revision);
      applyEnvelope(next);
      const nextClub = next.state.club;
      const receipt = lastReceiptOfKind(nextClub, "facility");
      const receiptLine = receipt
        ? copy(language, "receiptLine", receipt.label, receipt.cost)
        : copy(language, "receiptLine", `${facility} L${nextLevel}`, price);
      const capChange =
        facility === "trainingCentre"
          ? ` · ${copy(language, "facilityCapChange", trainingCap(currentLevel), trainingCap(nextLevel))}`
          : "";
      setFacilityReceipt(`${receiptLine}${capChange}`);
      setFeedback({
        kind: "success",
        text: `${copy(language, "facilityUpgraded", copy(language, facility))} · ${receiptLine}${capChange}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const decorUnlockReason = (option: DecorOption) => {
    if (option.unlocked) return "";
    if (option.unlock.trophies !== undefined) {
      return copy(language, "decorUnlockTrophies", option.unlock.trophies);
    }
    const facility = option.unlock.facility === "trainingCentre" ? copy(language, "trainingCentre") : copy(language, "stadium");
    return copy(language, "decorUnlockFacility", facility, option.unlock.level ?? 1);
  };

  const handleDecorSelect = async (option: DecorOption) => {
    if (busy || !club || !envelope || !option.unlocked) return;
    setBusy(true);
    setPendingAction(`decor:${option.id}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.decor", [option.kind]: option.id }, envelope.revision);
      applyEnvelope(next);
      const label = language === "zh" ? option.nameZh : option.name;
      setDecorAnnouncement(copy(language, "decorApplied", label));
      setFeedback({ kind: "success", text: copy(language, "decorApplied", label) });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleAssistantChange = async (field: "autoSquad" | "autoSubs", value: boolean) => {
    if (busy || !club || !envelope) return;
    setBusy(true);
    setPendingAction(`assistant:${field}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.assistant", [field]: value }, envelope.revision);
      applyEnvelope(next);
      const label = field === "autoSquad" ? copy(language, "assistantAutoSquad") : copy(language, "assistantAutoSubs");
      const announcement = copy(language, value ? "assistantOn" : "assistantOff", label);
      setAssistantAnnouncement(announcement);
      setFeedback({ kind: "success", text: announcement });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const finishOnboarding = (messageKey: "onboardingSkipped" | "onboardingDismissed") => {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "1");
    } catch {
      // localStorage can be unavailable; the guide still closes for this visit.
    }
    setOnboardingVisible(false);
    setOnboardingStep(0);
    setOnboardingAnnouncement(copy(language, messageKey));
  };

  const handleOnboardingNext = () => {
    if (onboardingStep >= 2) {
      finishOnboarding("onboardingDismissed");
      return;
    }
    const next = onboardingStep + 1;
    setOnboardingStep(next);
    setOnboardingAnnouncement(copy(language, "onboardingProgress", next + 1));
  };

  const handleOnboardingReplay = () => {
    setOnboardingVisible(true);
    setOnboardingStep(0);
    setOnboardingAnnouncement(copy(language, "onboardingProgress", 1));
  };

  const handleExportClubSummary = () => {
    if (!club) {
      setExportAnnouncement(copy(language, "exportEmpty"));
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    const ratings = clubRatings(club);
    const trophyList = trophies.map((trophy) => ({
      kind: trophy.kind,
      tier: trophy.tier,
      label: trophy.label,
      at: trophy.at,
    }));
    const summary = {
      generatedAt: new Date().toISOString(),
      club: {
        name: club.name,
        shortName: club.shortName,
        city: club.city,
        formation: club.formation,
        colours: club.colours,
      },
      level: clubLevel,
      xp: clubXp,
      funds,
      lineRatings: ratings,
      squad: club.players.map((player) => ({
        name: player.name,
        number: player.number,
        position: player.position,
        ovr: player.ovr,
        origin: player.origin,
        fitness: fitnessOf(player),
        injuryMatches: injuryMatchesOf(player),
      })),
      trophyCount: trophyList.length,
      trophies: trophyList,
      seasonHistory: seasonHistory.map((record) => ({
        id: record.id,
        tier: record.tier,
        position: record.position,
        points: record.points,
        won: record.won,
        drawn: record.drawn,
        lost: record.lost,
        gf: record.gf,
        ga: record.ga,
        outcome: record.outcome,
        at: record.at,
      })),
      recentMatches: (club.matches ?? []).slice(0, 5).map((match) => ({
        at: match.at,
        tier: match.tier,
        teams: match.teams,
        score: match.score,
        opponent: match.opponent.name,
      })),
    };
    const markdown = [
      `# ${club.name} — Club summary`,
      "",
      `Generated: ${summary.generatedAt}`,
      "",
      "## Identity",
      "",
      `- Short name: ${club.shortName}`,
      `- City: ${club.city}`,
      `- Formation: ${club.formation}`,
      `- Level: ${clubLevel}`,
      `- XP: ${clubXp}`,
      `- Funds: ${funds} FC`,
      "",
      "## Line ratings",
      "",
      `- DEF ${ratings.DEF.toFixed(1)}`,
      `- MID ${ratings.MID.toFixed(1)}`,
      `- ATT ${ratings.ATT.toFixed(1)}`,
      `- GK ${ratings.GK.toFixed(1)}`,
      `- OVR ${ratings.overall.toFixed(1)}`,
      "",
      "## Squad",
      "",
      "| # | Player | Position | OVR | Fitness | Injury matches |",
      "| --- | --- | --- | --- | --- | --- |",
      ...club.players.map((player) => `| ${player.number} | ${player.name} | ${player.position} | ${player.ovr} | ${fitnessOf(player)} | ${injuryMatchesOf(player)} |`),
      "",
      `## Trophies (${trophyList.length})`,
      "",
      ...(trophyList.length ? trophyList.map((trophy) => `- ${trophy.kind} · ${trophy.label} · tier ${trophy.tier + 1} · ${trophy.at}`) : ["None"]),
      "",
      "## Season history",
      "",
      ...(summary.seasonHistory.length
        ? summary.seasonHistory.map((record) => `- Tier ${record.tier + 1} · position ${record.position} · ${record.points} pts · ${record.won}W ${record.drawn}D ${record.lost}L`)
        : ["None"]),
      "",
      "## Recent matches",
      "",
      ...(summary.recentMatches.length
        ? summary.recentMatches.map((match) => `- ${match.teams.home} ${match.score[0]} – ${match.score[1]} ${match.teams.away} · tier ${match.tier + 1} · ${match.at}`)
        : ["None"]),
      "",
    ].join("\n");
    downloadTextFile(`questbound-fc-${date}.json`, JSON.stringify(summary, null, 2), "application/json");
    downloadTextFile(`questbound-fc-${date}.md`, markdown, "text/markdown");
    setExportAnnouncement(copy(language, "exportDone", date, date));
  };

  const handleMatch = async () => {
    if (busy || !club || !envelope) return;
    const beforeCondition = conditionSnapshotOf(club);
    conditionBeforeRef.current = beforeCondition;
    setMatchConditionSummary(null);
    setBusy(true);
    setPendingAction("match");
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.match", tier: matchTier }, envelope.revision);
      applyEnvelope(next);
      const nextClub = next.state.club;
      if (nextClub) {
        const after = conditionReport(nextClub);
        const newInjuries = nextClub.players
          .filter((player) => isInjured(player) && !beforeCondition.injured.has(player.id))
          .map((player) => player.name);
        setMatchConditionSummary({
          before: beforeCondition.average,
          after: after.startersAvgFitness,
          newInjuries,
          kind: "quick",
        });
      }
      const record = next.state.club?.matches?.[0];
      const summary = record ? matchScoreline(record) : copy(language, "matchTitle");
      const possession = record
        ? ` · ${copy(language, "matchPossession")} ${Math.round(record.possession[0])}%–${Math.round(record.possession[1])}%`
        : "";
      setFeedback({
        kind: "success",
        text: `${copy(language, "matchFinished", summary)}${possession} · ${copy(language, "matchNoFunds")}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleSign = async (worldPlayerId: string) => {
    if (busy || !club || !envelope) return;
    setBusy(true);
    setPendingAction(`sign:${worldPlayerId}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.sign", worldPlayerId }, envelope.revision);
      applyEnvelope(next);
      const receipt = lastReceiptOfKind(next.state.club, "signing");
      setFeedback({
        kind: "success",
        text: receipt
          ? copy(language, "transferSignSuccess", receipt.label, receipt.cost)
          : copy(language, "transferSignSuccess", worldPlayerId, 0),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleDisplay = async (kind: DisplayKind, itemId: string) => {
    if (busy || !club || !envelope) return;
    setBusy(true);
    setPendingAction(`display:${kind}:${itemId}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.display", [kind]: itemId }, envelope.revision);
      applyEnvelope(next);
      const option = displayPlan?.options.find((entry) => entry.kind === kind && entry.id === itemId) ?? null;
      const kitOption = kind === "kit" ? (displayPlan?.kits.find((entry) => entry.id === itemId) ?? null) : null;
      const optionName = kitOption
        ? kitDisplayName(language, kitOption)
        : option && DISPLAY_OPTION_COPY[option.id]
          ? copy(language, DISPLAY_OPTION_COPY[option.id].name)
          : option?.name ?? itemId;
      setFeedback({
        kind: "success",
        text:
          itemId === "none"
            ? copy(language, "displayCleared", copy(language, DISPLAY_KIND_COPY[kind]))
            : copy(language, "displayApplied", optionName),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleSell = async (playerId: string) => {
    if (busy || !club || !envelope) return;
    const player = club.players.find((entry) => entry.id === playerId);
    setBusy(true);
    setPendingAction(`sell:${playerId}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.sell", playerId }, envelope.revision);
      applyEnvelope(next);
      const receipt = lastReceiptOfKind(next.state.club, "sale");
      setPendingSellId(null);
      setFeedback({
        kind: "success",
        text: receipt
          ? copy(language, "sellSuccess", receipt.label, receipt.cost)
          : copy(language, "sellSuccess", player?.name ?? playerId, 0),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleStartLeague = async (tier: LeagueTier) => {
    if (busy || !club || !envelope) return;
    setBusy(true);
    setPendingAction(`league-start:${tier}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.league.start", tier }, envelope.revision);
      applyEnvelope(next);
      setLastRoundResults(null);
      setFeedback({
        kind: "success",
        text: copy(language, "leagueStarted", copy(language, MATCH_TIER_NAME_KEY[tier])),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handlePlayLeagueRound = async () => {
    if (busy || !club || !season || !envelope || season.finished) return;
    let preview: ReturnType<typeof playSeasonRound> | null = null;
    try {
      preview = playSeasonRound(club, season);
    } catch {
      preview = null;
    }
    setBusy(true);
    setPendingAction("league-play");
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.league.play" }, envelope.revision);
      applyEnvelope(next);
      if (preview) setLastRoundResults({ round: preview.season.round, results: preview.results });
      const nextSeason = next.state.club?.season;
      const nextPosition = nextSeason
        ? Math.max(1, sortTable(nextSeason.table).findIndex((row) => row.teamId === "club") + 1)
        : null;
      const ownFixture = preview?.results.find((result) => result.home === "club" || result.away === "club");
      const round = preview?.season.round ?? season.round + 1;
      const ownText = ownFixture ? ` · ${leagueFixtureText(ownFixture, leagueNameOf)}` : "";
      const positionText = nextPosition ? ` · ${copy(language, "leagueFinalPosition", nextPosition)}` : "";
      setFeedback({
        kind: "success",
        text: `${copy(language, "leagueRoundDone", round)}${ownText}${positionText}`,
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleNextLeagueSeason = async () => {
    if (busy || !club || !envelope || !leagueOutcome) return;
    await handleStartLeague(leagueOutcome.nextTier);
  };

  const handleStartCup = async (tier: CupTier) => {
    if (busy || !club || !envelope) return;
    setBusy(true);
    setPendingAction(`cup-start:${tier}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.cup.start", tier }, envelope.revision);
      applyEnvelope(next);
      setFeedback({
        kind: "success",
        text: copy(language, "cupStarted", copy(language, MATCH_TIER_NAME_KEY[tier])),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handlePlayCupRound = async () => {
    if (busy || !club || !cup || !envelope || cup.finished || cupNextRound === null) return;
    const playingRound = cupNextRound;
    setBusy(true);
    setPendingAction("cup-play");
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.cup.play" }, envelope.revision);
      applyEnvelope(next);
      const nextCup = next.state.club?.cup;
      const nextClubName = next.state.club?.name ?? club.name;
      const ownMatch = nextCup?.matches.find(
        (match) => match.round === playingRound && (match.home === "club" || match.away === "club"),
      );
      const roundText = copy(language, playingRound === 1 ? "cupSemiDone" : "cupFinalDone");
      const ownText =
        ownMatch && ownMatch.score
          ? ` · ${cupNameOf(nextCup, nextClubName, ownMatch.home)} ${ownMatch.score[0]} – ${ownMatch.score[1]} ${cupNameOf(nextCup, nextClubName, ownMatch.away)}`
          : "";
      let outcomeText = "";
      if (nextCup?.finished) {
        outcomeText =
          nextCup.winner === "club"
            ? ` · ${copy(language, "cupWonFlash")}`
            : ` · ${copy(language, "cupLostFlash", cupNameOf(nextCup, nextClubName, nextCup.winner ?? ""))}`;
      }
      setFeedback({ kind: "success", text: `${roundText}${ownText}${outcomeText}` });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleReplayCup = async () => {
    if (!cup) return;
    await handleStartCup(cup.tier);
  };

  const handleStartLive = async (tier: 0 | 1 | 2 | 3) => {
    if (busy || !club || !envelope) return;
    conditionBeforeRef.current = conditionSnapshotOf(club);
    setMatchConditionSummary(null);
    setBusy(true);
    setPendingAction(`live-start:${tier}`);
    setFeedback(null);
    setLiveFinished(null);
    setConfirmingAbandonLive(false);
    try {
      const next = await sendCommand({ type: "club.live.start", tier }, envelope.revision);
      applyEnvelope(next);
      setFeedback({
        kind: "success",
        text: copy(language, "liveStarted", copy(language, MATCH_TIER_NAME_KEY[tier])),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleAdvanceLive = async () => {
    if (busy || !club || !envelope || !liveSession) return;
    setBusy(true);
    setPendingAction("live-advance");
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.live.advance" }, envelope.revision);
      applyEnvelope(next);
      const nextLive = next.state.club?.live;
      if (nextLive?.session) {
        const session = nextLive.session;
        const latest = session.events[session.events.length - 1];
        const latestText = latest
          ? ` · ${latest.minute}' ${copy(
              language,
              latest.kind === "goal" ? "replayGoal" : latest.kind === "save" ? "replaySave" : "replayChance",
            )}${latest.scorer ? ` · ${latest.scorer}` : ""}`
          : "";
        setFeedback({
          kind: "success",
          text: `${copy(language, "liveBlockDone", session.block, session.score[0], session.score[1])}${latestText}`,
        });
      } else {
        const record = next.state.club?.matches?.[0];
        if (record) {
          setLiveFinished({
            score: record.score,
            opponent: record.opponent.name,
            home: record.teams?.home ?? club.name,
            matchId: record.id,
          });
          const nextClub = next.state.club;
          const beforeCondition = conditionBeforeRef.current;
          if (nextClub && beforeCondition) {
            const after = conditionReport(nextClub);
            setMatchConditionSummary({
              before: beforeCondition.average,
              after: after.startersAvgFitness,
              newInjuries: nextClub.players
                .filter((player) => isInjured(player) && !beforeCondition.injured.has(player.id))
                .map((player) => player.name),
              kind: "live",
            });
          }
          setFeedback({
            kind: "success",
            text: copy(
              language,
              "liveFullTime",
              record.teams?.home ?? club.name,
              record.score[0],
              record.score[1],
              record.opponent.name,
            ),
          });
        }
      }
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleLiveTactic = async (tactic: ClubTactic) => {
    if (busy || !club || !envelope || !liveSession || liveSession.home.tactic === tactic) return;
    setBusy(true);
    setPendingAction(`live-tactic:${tactic}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.live.tactic", tactic }, envelope.revision);
      applyEnvelope(next);
      setFeedback({
        kind: "success",
        text: copy(language, "liveTacticChanged", copy(language, TACTIC_NAME_KEY[tactic])),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleLiveFormation = async (formation: ClubFormation) => {
    if (busy || !club || !envelope || !liveSession) return;
    if ((liveSession.home.formation ?? club.formation) === formation) return;
    setBusy(true);
    setPendingAction(`live-formation:${formation}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.live.formation", formation }, envelope.revision);
      applyEnvelope(next);
      const announcement = copy(language, "liveFormationChanged", formation);
      setLiveFormationAnnouncement(announcement);
      setFeedback({ kind: "success", text: announcement });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleApplySuggestedTactic = async (tactic: ClubTactic) => {
    if (busy || !club || !envelope || club.tactics.active === tactic) return;
    setBusy(true);
    setPendingAction(`suggested-tactic:${tactic}`);
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.tactic", tactic }, envelope.revision);
      applyEnvelope(next);
      const announcement = copy(language, "tacticSuggestApplied", copy(language, TACTIC_NAME_KEY[tactic]));
      setTacticSuggestAnnouncement(announcement);
      setFeedback({ kind: "success", text: announcement });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleAbandonLive = async () => {
    if (busy || !club || !envelope || !liveSession) return;
    setBusy(true);
    setPendingAction("live-abandon");
    setFeedback(null);
    try {
      const next = await sendCommand({ type: "club.live.abandon" }, envelope.revision);
      applyEnvelope(next);
      setConfirmingAbandonLive(false);
      setLiveFinished(null);
      setFeedback({ kind: "success", text: copy(language, "liveAbandoned") });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const handleLiveSub = async () => {
    if (busy || !club || !envelope || !liveSession || liveSubBlockedReason) return;
    const outgoing = effectiveSubOut;
    const incoming = effectiveSubIn;
    if (!outgoing || !incoming) return;
    setBusy(true);
    setPendingAction("live-sub");
    setFeedback(null);
    try {
      const next = await sendCommand(
        { type: "club.live.sub", outId: outgoing.id, inId: incoming.id },
        envelope.revision,
      );
      applyEnvelope(next);
      setSubOutId("");
      setSubInId("");
      setFeedback({
        kind: "success",
        text: copy(language, "liveSubDone", outgoing.name, incoming.name),
      });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const persistTabUrl = (next: ClubTab, anchor: string | null) => {
    try {
      const url = new URL(window.location.href);
      if (next === "overview") url.searchParams.delete("tab");
      else url.searchParams.set("tab", next);
      if (anchor) url.hash = anchor;
      else url.hash = "";
      window.history.replaceState(null, "", url.toString());
    } catch {
      // URL updates are cosmetic; the tab change already happened.
    }
  };

  const openClubSection = (sectionId: string) => {
    const nextTab = TAB_FOR_ANCHOR[sectionId] ?? clubTab;
    pendingAnchorRef.current = sectionId;
    if (nextTab !== clubTab) setClubTab(nextTab);
    persistTabUrl(nextTab, sectionId);
  };

  const selectClubTab = (next: ClubTab) => {
    pendingAnchorRef.current = null;
    setClubTab(next);
    persistTabUrl(next, null);
  };

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const key = event.key;
    let nextIndex = index;
    if (key === "ArrowRight") nextIndex = (index + 1) % CLUB_TABS.length;
    else if (key === "ArrowLeft") nextIndex = (index - 1 + CLUB_TABS.length) % CLUB_TABS.length;
    else if (key === "Home") nextIndex = 0;
    else if (key === "End") nextIndex = CLUB_TABS.length - 1;
    else return;
    event.preventDefault();
    const next = CLUB_TABS[nextIndex];
    selectClubTab(next.id);
    window.setTimeout(() => document.getElementById(`club-tab-${next.id}`)?.focus(), 0);
  };

  const handleBaseNav = (event: { preventDefault: () => void }, sectionId: string) => {
    event.preventDefault();
    openClubSection(sectionId);
  };

  const openCelebrationReview = (trophy: ClubTrophy) => {
    if (!club) return;
    setCelebrationMode("review");
    setCelebration(celebrationFor(club, trophy));
  };

  const handleClaimCelebration = async () => {
    if (busy || !club || !envelope || !celebration || celebrationMode !== "pending") return;
    setBusy(true);
    setFeedback(null);
    try {
      const next = await sendCommand(
        { type: "club.celebrate", trophyId: celebration.trophyId },
        envelope.revision,
      );
      applyEnvelope(next);
      setFeedback({ kind: "success", text: copy(language, "celebrationClaimed") });
      setCelebration(null);
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
    }
  };

  const handleCelebrationHonours = () => {
    setCelebration(null);
    openClubSection("club-honours");
  };

  const handleMigrate = async () => {
    if (busy || !club || !envelope) return;
    const fundsBefore = funds;
    setBusy(true);
    setPendingAction("club-migrate");
    setFeedback(null);
    setMigrateAnnouncement("");
    try {
      const next = await sendCommand({ type: "club.migrate", confirm: true }, envelope.revision);
      applyEnvelope(next);
      const fundsAfter = clubFunds(next.state.economy);
      const timestamp = next.state.club?.migratedAt;
      const announcement = `${copy(
        language,
        "migrateDone",
        timestamp ? dateTime(language, timestamp) : "—",
      )} · ${copy(language, "migrateFundsAnnounce", fundsBefore, fundsAfter)}${
        fundsAfter > fundsBefore ? ` · ${copy(language, "migrateGranted")}` : ""
      }`;
      setMigrateAnnouncement(announcement);
      setFeedback({ kind: "success", text: announcement });
    } catch (error) {
      handleCommandError(error, "commandFailed");
    } finally {
      setBusy(false);
      setPendingAction("");
    }
  };

  const renderSellAction = (player: ClubPreviewPlayer): ReactNode => {
    const refund = playerSaleValue(player);
    const pending = pendingAction === `sell:${player.id}`;
    if (pendingSellId === player.id) {
      return (
        <span className="club-sell-confirm">
          <button
            type="button"
            className="club-button club-button-primary club-sell-button"
            onClick={() => void handleSell(player.id)}
            disabled={busy}
          >
            {pending ? copy(language, "sellConfirming") : copy(language, "sellConfirm", refund)}
          </button>
          <button
            type="button"
            className="club-button club-button-secondary club-sell-button"
            onClick={() => setPendingSellId(null)}
            disabled={busy}
          >
            {copy(language, "sellCancel")}
          </button>
        </span>
      );
    }
    return (
      <button
        type="button"
        className="club-button club-button-secondary club-sell-button"
        onClick={() => {
          setPendingSellId(player.id);
          setFeedback(null);
        }}
        disabled={busy}
      >
        {copy(language, "sellAction", refund)}
      </button>
    );
  };

  const renderCupMatch = (match: CupMatch, winnerId: string | undefined): ReactNode => {
    const score = match.score;
    const tied = Boolean(score && score[0] === score[1]);
    const own = match.home === "club" || match.away === "club";
    const homeWin = winnerId === match.home;
    const awayWin = winnerId === match.away;
    return (
      <li key={`${match.round}:${match.home}:${match.away}`} className={`club-cup-match${own ? " is-own" : ""}`}>
        <span className={`club-cup-team${homeWin ? " is-winner" : ""}`}>{cupNameOf(cup, club?.name, match.home)}</span>
        <b className="club-cup-score">{score ? `${score[0]} – ${score[1]}` : copy(language, "cupVs")}</b>
        <span className={`club-cup-team club-cup-team-away${awayWin ? " is-winner" : ""}`}>
          {cupNameOf(cup, club?.name, match.away)}
        </span>
        {match.pens ? (
          <div
            className="club-cup-pens"
            data-cup-pens={`${match.pens[0]}-${match.pens[1]}`}
            aria-label={copy(language, "cupPensAria", match.pens[0], match.pens[1])}
          >
            <span className="club-cup-pens-score">
              {copy(language, "cupPensScore", match.pens[0], match.pens[1])}
            </span>
            <span className="club-cup-pens-dots" aria-hidden="true">
              <span className="club-cup-pens-side">
                {Array.from({ length: 5 }).map((_, index) => (
                  <i key={`home-${index}`} className={index < Math.min(5, match.pens![0]) ? "is-scored" : undefined} />
                ))}
              </span>
              <span className="club-cup-pens-divider">–</span>
              <span className="club-cup-pens-side club-cup-pens-side-away">
                {Array.from({ length: 5 }).map((_, index) => (
                  <i key={`away-${index}`} className={index < Math.min(5, match.pens![1]) ? "is-scored" : undefined} />
                ))}
              </span>
            </span>
          </div>
        ) : tied ? (
          <span className="club-cup-pens">{copy(language, "cupPenalties")}</span>
        ) : null}
      </li>
    );
  };

  const sourceLabel =
    mode === "sample" ? copy(language, "badgeSample") : mode === "loading" ? copy(language, "badgeLoading") : copy(language, "badgeLive");
  const sourceDescription =
    mode === "sample" ? copy(language, "sourceSample") : mode === "loading" ? copy(language, "sourceLoading") : copy(language, "sourceLive");
  const sourceMetaSuffix =
    mode !== "sample" && meta
      ? ` · ${copy(
          language,
          "sourceMeta",
          meta.revision,
          meta.updatedAt ? dateTime(language, meta.updatedAt) : "—",
        )}`
      : "";
  const sampleReason =
    mode === "sample" && failure ? ` · ${copy(language, "sourceSampleReason")}: ${failure}` : "";
  const sourceBody =
    mode === "sample"
      ? `${copy(language, "badgeSample")} · ${sourceDescription}${sampleReason}`
      : `${sourceDescription}${sourceMetaSuffix}`;
  const topbarMeta =
    mode === "sample"
      ? `${translate(language, "Not saved")} · ${copy(language, "badgeReadonly")}`
      : mode === "loading"
        ? copy(language, "loadingClub")
        : copy(language, "savedToPlanner");

  const createSection = mode === "create" ? (
    <section className="club-section" aria-labelledby="club-create-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{translate(language, "Club")}</p>
          <h2 id="club-create-heading">{copy(language, "createTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "createIntro")}</p></details>
      </div>
      <div className="club-panel club-create-panel">
        <form className="club-form" onSubmit={handleCreate}>
          <div className="club-form-grid">
            <label className="club-field">
              <span>{copy(language, "createName")}</span>
              <input
                value={createForm.name}
                onChange={(event) => updateCreateForm({ name: event.target.value })}
                placeholder={copy(language, "createNamePlaceholder")}
                maxLength={40}
                minLength={2}
                required
                disabled={busy}
                autoComplete="off"
              />
              <small>{copy(language, "createNameHint")}</small>
            </label>
            <label className="club-field">
              <span>{copy(language, "createShortName")}</span>
              <input
                value={createForm.shortName}
                onChange={(event) => updateCreateForm({ shortName: event.target.value.toUpperCase() })}
                placeholder={copy(language, "createShortPlaceholder")}
                maxLength={4}
                minLength={2}
                required
                disabled={busy}
                autoComplete="off"
              />
              <small>{copy(language, "createShortHint")}</small>
            </label>
            <label className="club-field">
              <span>{copy(language, "createCity")}</span>
              <input
                value={createForm.city}
                onChange={(event) => updateCreateForm({ city: event.target.value })}
                placeholder={copy(language, "createCityPlaceholder")}
                maxLength={40}
                disabled={busy}
                autoComplete="off"
              />
            </label>
            <label className="club-field">
              <span>{copy(language, "createFormation")}</span>
              <select
                value={createForm.formation}
                onChange={(event) => updateCreateForm({ formation: event.target.value as ClubFormation })}
                disabled={busy}
              >
                {(Object.keys(CLUB_FORMATIONS) as ClubFormation[]).map((formation) => (
                  <option key={formation} value={formation}>
                    {formation}
                  </option>
                ))}
              </select>
            </label>
            <div className="club-field club-colour-field">
              <span>{copy(language, "createPrimary")}</span>
              <span className="club-colour-input">
                <input
                  type="color"
                  value={createForm.primary}
                  onChange={(event) => updateCreateForm({ primary: event.target.value })}
                  disabled={busy}
                  aria-label={copy(language, "createPrimary")}
                />
                <code>{createForm.primary}</code>
              </span>
            </div>
            <div className="club-field club-colour-field">
              <span>{copy(language, "createSecondary")}</span>
              <span className="club-colour-input">
                <input
                  type="color"
                  value={createForm.secondary}
                  onChange={(event) => updateCreateForm({ secondary: event.target.value })}
                  disabled={busy}
                  aria-label={copy(language, "createSecondary")}
                />
                <code>{createForm.secondary}</code>
              </span>
            </div>
          </div>
          <div className="club-create-preview">
            <span className="club-crest" style={{ background: createForm.primary, color: createForm.secondary }} aria-hidden="true">
              {createForm.shortName.trim().toUpperCase().slice(0, 4) || "FC"}
            </span>
            <div className="club-create-preview-copy">
              <b>{createForm.name.trim() || copy(language, "createNamePlaceholder")}</b>
              <span>{`${createForm.city.trim() || copy(language, "createCityPlaceholder")} · ${createForm.formation}`}</span>
            </div>
            <span className="club-kit-list">
              <span className="club-kit">
                <i className="club-swatch" style={{ background: createForm.primary }} aria-hidden="true" />
                <span>{copy(language, "homeKit")}</span>
              </span>
              <span className="club-kit">
                <i className="club-swatch" style={{ background: createForm.secondary }} aria-hidden="true" />
                <span>{copy(language, "awayKit")}</span>
              </span>
            </span>
          </div>
          <div className="club-form-actions">
            <button className="club-button club-button-primary" type="submit" disabled={busy || !canCreate}>
              {busy ? copy(language, "creating") : copy(language, "createSubmit")}
            </button>
            <span className="club-note">{copy(language, "createShortHint")}</span>
          </div>
        </form>
      </div>
    </section>
  ) : null;

  const trainingSection = mode === "club" && club && trainingPreview ? (
    <section className="club-section" id="club-training" aria-labelledby="club-training-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{translate(language, "Training")}</p>
          <h2 id="club-training-heading">{copy(language, "trainingTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "trainingIntro")}</p></details>
      </div>
      <div className="club-panel club-train-panel">
        <div className="club-train-grid">
          <div className="club-train-controls">
            <label className="club-field">
              <span>{copy(language, "trainingPlayer")}</span>
              <select
                value={effectivePlayerId}
                onChange={(event) => {
                  setSelectedPlayerId(event.target.value);
                  setAttributeChoice(null);
                }}
                disabled={busy}
              >
                {club.players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {`#${player.number} ${player.name} · ${player.position} · ${player.ovr} OVR${starterIds.has(player.id) ? " ★" : ""}`}
                  </option>
                ))}
              </select>
              <small>{copy(language, "trainingDefaultHint")}</small>
            </label>
            <div className="club-train-condition" data-train-injured={trainingInjured ? "true" : "false"}>
              <ConditionBar fitness={trainingFitness} injury={effectivePlayer ? injuryMatchesOf(effectivePlayer) : 0} language={language} />
              <span className={`club-condition-state${trainingInjured ? " is-injured" : trainingFitness < 35 ? " is-tired" : ""}`}>
                {trainingInjured
                  ? copy(language, "trainingInjured")
                  : trainingFitness < 35
                    ? copy(language, "conditionTired")
                    : copy(language, "conditionAvailable")}
              </span>
            </div>
            <fieldset className="club-attr-fieldset" disabled={busy || trainingInjured}>
              <legend>{copy(language, "trainingAttribute")}</legend>
              <div className="club-attr-picker">
                {TRAINABLE_ATTRIBUTES.map((entry) => {
                  const selected = selectedAttribute === entry.key;
                  const blocked = Boolean(quoteTraining(trainingPreview.player, entry.key, club.facilities.trainingCentre).blocked);
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      className={`club-attr-button${selected ? " is-selected" : ""}${blocked ? " is-blocked" : ""}`}
                      aria-pressed={selected}
                      onClick={() => setAttributeChoice({ playerId: effectivePlayerId, attribute: entry.key })}
                    >
                      <span>{entry.code}</span>
                      <b>{trainingPreview.player.attributes[entry.key]}</b>
                      <small>{copy(language, entry.label)}</small>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </div>
          <div className="club-train-preview">
            <dl className="club-preview-grid">
              <div>
                <dt>{copy(language, "trainingCurrent")}</dt>
                <dd>{`${selectedAttribute.toUpperCase()} ${trainingPreview.quote.from} → ${trainingPreview.quote.blocked ? trainingPreview.quote.from : trainingPreview.quote.to}`}</dd>
              </div>
              <div>
                <dt>{copy(language, "trainingPrice")}</dt>
                <dd>{trainingPreview.quote.price > 0 ? `${trainingPreview.quote.price} FC` : "—"}</dd>
              </div>
              <div>
                <dt>{copy(language, "trainingCentreCap")}</dt>
                <dd>{copy(language, "capValue", `Lv ${club.facilities.trainingCentre}`, trainingCap(club.facilities.trainingCentre))}</dd>
              </div>
              <div>
                <dt>{copy(language, "trainingOvr")}</dt>
                <dd className={trainingPreview.player.ovr !== trainingPreview.trained.ovr ? "is-changed" : undefined}>
                  {`${trainingPreview.player.ovr} → ${trainingPreview.trained.ovr}`}
                </dd>
              </div>
            </dl>
            <div className="club-lines-delta">
              {(["DEF", "MID", "ATT", "GK", "overall"] as const).map((line) => {
                const before = trainingPreview.beforeRatings[line];
                const after = trainingPreview.afterRatings[line];
                return (
                  <div className={`club-delta${before !== after ? " is-changed" : ""}`} key={line}>
                    <span>{line === "overall" ? "OVR" : line}</span>
                    <b>{`${before.toFixed(1)} → ${after.toFixed(1)}`}</b>
                  </div>
                );
              })}
            </div>
            <p className={`club-status-line${trainingPreview.quote.blocked || trainingInjured ? " is-blocked" : ""}`}>
              {trainingInjured ? (
                <>
                  <span className="club-pill club-pill-blocked">{copy(language, "conditionInjured")}</span>
                  <span className="club-blocked-reason">{copy(language, "clubDetailInjured")}</span>
                </>
              ) : trainingPreview.quote.blocked ? (
                <>
                  <span className="club-pill club-pill-blocked">{copy(language, "trainingBlocked")}</span>
                  <span className="club-blocked-reason" lang={language === "zh" ? "en-GB" : undefined}>
                    {trainingPreview.quote.blocked}
                  </span>
                </>
              ) : (
                <span className="club-pill club-pill-ok">{copy(language, "trainingAvailable")}</span>
              )}
              {!trainingPreview.quote.blocked && !trainingPreview.affordable ? (
                <span className="club-warning-inline">{copy(language, "trainingInsufficient")}</span>
              ) : null}
            </p>
            <div className="club-train-actions">
              <button
                type="button"
                className="club-button club-button-primary"
                onClick={() => void handleTrain()}
                disabled={busy || !trainingPreview.affordable || trainingInjured}
              >
                {busy
                  ? copy(language, "trainingSaving")
                  : trainingInjured
                    ? copy(language, "trainingInjured")
                    : trainingPreview.quote.blocked
                      ? copy(language, "trainingBlockedAction")
                      : copy(language, "trainingConfirm", trainingPreview.quote.price)}
              </button>
              {receiptText ? (
                <p className="club-receipt" role="status" aria-live="polite">
                  {receiptText}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="club-receipts-block">
          <h3 className="club-subheading">{copy(language, "recentReceipts")}</h3>
          {club.receipts.length ? (
            <ul className="club-receipts">
              {[...club.receipts]
                .reverse()
                .slice(0, 4)
                .map((entry) => (
                  <li key={entry.id}>
                    <span className="club-receipt-label">{entry.label}</span>
                    <span className="club-receipt-cost">{`−${entry.cost} FC`}</span>
                    <time dateTime={entry.at}>{dateTime(language, entry.at)}</time>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="club-note">{copy(language, "noReceipts")}</p>
          )}
          <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "trainingReceiptNote")}</p></details>
        </div>
      </div>
    </section>
  ) : null;

  const lineupSection = mode === "club" && club ? (
    <section className="club-section" id="club-lineup" aria-labelledby="club-lineup-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{`${club.formation} · 11`}</p>
          <h2 id="club-lineup-heading">{copy(language, "lineupTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "lineupIntro")}</p></details>
      </div>
      <div className="club-panel club-lineup-panel">
        <div className="club-lineup-toolbar">
          <label className="club-field club-field-inline">
            <span>{copy(language, "lineupFormation")}</span>
            <select
              value={club.formation}
              onChange={(event) => {
                const next = event.target.value as ClubFormation;
                if (next !== club.formation) void handleLineup(next);
              }}
              disabled={busy}
            >
              {(Object.keys(CLUB_FORMATIONS) as ClubFormation[]).map((formation) => (
                <option key={formation} value={formation}>
                  {formation}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="club-button club-button-primary"
            onClick={() => void handleLineup(club.formation)}
            disabled={busy}
          >
            {busy ? copy(language, "lineupSaving") : copy(language, "lineupAutoPick")}
          </button>
        </div>
        <div className="club-lineup-diagram-wrap">
          <FormationDiagram formation={club.formation} label={`${copy(language, "formationLabel")} · ${club.formation}`} />
          <span className="club-diagram-caption">{`${club.formation} · ${lineupPlayers.length}/11`}</span>
        </div>
        <details className="club-details club-lineup-details">
          <summary>{copy(language, "moreDetails")}</summary>
          <p className="club-note">{copy(language, "lineupFormationNote")}</p>
          <ol className="club-lineup-list">
            {lineupPlayers.map((player, index) => {
              const slot = CLUB_FORMATIONS[club.formation][index];
              return (
                <li key={player.id}>
                  <span className="club-slot">{slot?.position ?? player.position}</span>
                  <span className="club-slot-player">{`${player.number} · ${player.name}`}</span>
                  <b className="club-slot-ovr">{player.ovr}</b>
                </li>
              );
            })}
          </ol>
        </details>
      </div>
    </section>
  ) : null;

  const tacticsSection = mode === "club" && club ? (
    <section className="club-section" id="club-tactics" aria-labelledby="club-tactics-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{`${copy(language, "tacticsTitle")} · ${copy(language, TACTIC_NAME_KEY[club.tactics.active])}`}</p>
          <h2 id="club-tactics-heading">{copy(language, "tacticsTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "tacticsIntro")}</p></details>
      </div>
      <div className="club-tactic-ratings">
        {(["DEF", "MID", "ATT", "GK", "overall"] as const).map((line) => (
          <span className="club-tactic-rating" key={line}>
            <span>{line === "overall" ? "OVR" : line}</span>
            <b>{preview.ratings[line].toFixed(1)}</b>
          </span>
        ))}
        <span className="club-note">{copy(language, "tacticRatingsNote")}</span>
      </div>
      <div className="club-tactic-grid">
        {CLUB_TACTICS.map((tactic) => {
          const level = club.tactics.levels[tactic] ?? 0;
          const active = club.tactics.active === tactic;
          const price = tacticTrainingCost(level);
          const affordable = price !== null && funds >= price;
          const bonus = TACTIC_BONUS[tactic];
          const linesText = bonus.lines.map((line) => copy(language, LINE_LABEL_KEY[line])).join(" · ");
          const attributeText = copy(language, ATTRIBUTE_LABEL_KEY[bonus.attribute]);
          const pendingTrain = pendingAction === `tactic-train:${tactic}`;
          const pendingSwitch = pendingAction === `tactic:${tactic}`;
          return (
            <article
              className={`club-panel club-tactic-card${active ? " is-active" : ""}`}
              key={tactic}
              aria-current={active ? "true" : undefined}
            >
              <div className="club-tactic-head">
                <h3>{copy(language, TACTIC_NAME_KEY[tactic])}</h3>
                {active ? <span className="club-pill club-pill-active">{copy(language, "tacticActive")}</span> : null}
              </div>
              <p className="club-tactic-bonus">{copy(language, "tacticBonus", level, attributeText, linesText)}</p>
              <div className="club-tactic-level">
                <span className="club-tactic-dots" aria-hidden="true">
                  {Array.from({ length: TACTIC_MAX_LEVEL }, (_, index) => (
                    <i key={index} className={index < level ? "is-filled" : undefined} />
                  ))}
                </span>
                <span className="club-tactic-level-text">{copy(language, "tacticLevel", level, TACTIC_MAX_LEVEL)}</span>
              </div>
              <div className="club-tactic-actions">
                <button
                  type="button"
                  className="club-button club-button-secondary"
                  onClick={() => void handleTactic(tactic)}
                  disabled={busy || active}
                >
                  {pendingSwitch ? copy(language, "savingAction") : active ? copy(language, "tacticActive") : copy(language, "tacticActivate")}
                </button>
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleTacticTrain(tactic)}
                  disabled={busy || price === null || !affordable}
                >
                  {price === null
                    ? copy(language, "tacticMax")
                    : pendingTrain
                      ? copy(language, "savingAction")
                      : copy(language, "tacticTrain", price, level + 1)}
                </button>
              </div>
              {price !== null && !affordable && !busy ? <p className="club-warning-inline">{copy(language, "insufficientFunds")}</p> : null}
              {active && tacticReceipt ? (
                <p className="club-receipt" role="status" aria-live="polite">
                  {tacticReceipt}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  ) : null;

  const facilitiesSection = mode === "club" && club ? (
    <section className="club-section" id="club-facilities" aria-labelledby="club-facilities-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{`${translate(language, "Level")} ${clubLevel}`}</p>
          <h2 id="club-facilities-heading">{copy(language, "facilitiesTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "facilitiesIntro")}</p></details>
      </div>
      <div className="club-facility-grid">
        {FACILITY_ORDER.map((facility) => {
          const current = club.facilities[facility];
          const max = FACILITY_MAX[facility];
          const price = facilityUpgradeCost(facility, current);
          const nextLevel = Math.min(max, current + 1);
          const gate = price === null ? 0 : facilityGate(facility, nextLevel);
          const gated = price !== null && clubLevel < gate;
          const affordable = price !== null && funds >= price;
          const pending = pendingAction === `facility:${facility}`;
          const lastFacilityReceipt = lastReceiptOfKind(club, "facility");
          const showReceipt = facilityReceipt && lastFacilityReceipt?.label.startsWith(facility);
          return (
            <div className={`club-panel club-facility-row${price === null ? " is-max" : ""}`} key={facility}>
              <div className="club-facility-head">
                <div>
                  <h3>{copy(language, facility)}</h3>
                  <p className="club-note">{copy(language, FACILITY_EFFECT_KEY[facility])}</p>
                </div>
                <span className="club-facility-level">{copy(language, "facilityLevel", current, max)}</span>
              </div>
              <div className="club-facility-meta">
                {price === null ? (
                  <span className="club-pill club-pill-ok">{copy(language, "facilityMax")}</span>
                ) : (
                  <>
                    <span>{copy(language, "facilityNext", price)}</span>
                    {gate > 0 ? (
                      <span className={`club-pill${gated ? " club-pill-blocked" : " club-pill-ok"}`}>
                        {copy(language, "facilityGate", gate)}
                      </span>
                    ) : null}
                    {facility === "trainingCentre" ? (
                      <span className="club-muted">{copy(language, "facilityCapChange", trainingCap(current), trainingCap(nextLevel))}</span>
                    ) : null}
                  </>
                )}
              </div>
              <div className="club-facility-actions">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleFacility(facility)}
                  disabled={busy || price === null || gated || !affordable}
                >
                  {price === null
                    ? copy(language, "facilityMax")
                    : pending
                      ? copy(language, "facilityUpgrading")
                      : copy(language, "facilityUpgrade")}
                </button>
                {gated ? (
                  <span className="club-warning-inline">{copy(language, "facilityGateHint", gate)}</span>
                ) : price !== null && !affordable ? (
                  <span className="club-warning-inline">{copy(language, "insufficientFunds")}</span>
                ) : null}
              </div>
              {showReceipt ? (
                <p className="club-receipt" role="status" aria-live="polite">
                  {facilityReceipt}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  ) : null;

  const transfersSection = mode === "club" && club ? (
    <section className="club-section" id="club-transfers" aria-labelledby="club-transfers-heading" data-scout-state={scoutLoadState}>
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{`${copy(language, "scoutTitle")} · ${copy(language, "scoutCapInfo", club.facilities.scoutCentre, scoutingCap)}`}</p>
          <h2 id="club-transfers-heading">{copy(language, "transfersTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "transfersIntro")}</p></details>
      </div>

      {scoutLoadState !== "ready" ? (
        <div className="club-panel club-scout-loading" role="status" aria-live="polite">
          {scoutLoadState === "error" ? (
            <>
              <b>{copy(language, "scoutLoadFailed", scoutLoadError)}</b>
              <button type="button" className="club-button club-button-secondary" onClick={() => void loadScoutDataset(true)}>
                {copy(language, "scoutRetry")}
              </button>
            </>
          ) : (
            <>
              <span className="club-watch3d-spinner" aria-hidden="true" />
              <b>{copy(language, "scoutLoading")}</b>
            </>
          )}
        </div>
      ) : (
        <>
      <div className="club-scout-filterbar" role="group" aria-label={copy(language, "scoutFiltersTitle")}>
        {([
          ["league", "scoutLeague", scoutingChoices.leagues],
          ["region", "scoutRegion", scoutingChoices.regions],
          ["position", "scoutPositionFilter", scoutingPositions.map((position) => ({ id: position, label: position }))],
        ] as const).map(([field, labelKey, options]) => (
          <div className="club-scout-filter-row" key={field} data-scout-filter={field}>
            <span className="club-scout-filter-label">{copy(language, labelKey)}</span>
            <div className="club-scout-filter-chips">
              <button
                type="button"
                className={`club-scout-chip${!scoutingFilters[field] ? " is-selected" : ""}`}
                aria-pressed={!scoutingFilters[field]}
                data-scout-value=""
                onClick={() => setScoutingFilters((current) => ({ ...current, [field]: undefined }))}
              >
                {copy(language, "scoutFilterAll")}
              </button>
              {options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`club-scout-chip${scoutingFilters[field] === option.id ? " is-selected" : ""}`}
                  aria-pressed={scoutingFilters[field] === option.id}
                  data-scout-value={option.id}
                  onClick={() => toggleScoutingFilter(field, option.id)}
                >
                  {scoutingChoiceLabel(field, option.id)}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div
          className="club-scout-filter-meta"
          data-scout-filtered={scoutingFilteredPlayers.length}
          data-scout-list={scoutRows.length}
          data-scout-recommendations={scouting?.recommendations.length ?? 0}
          data-scout-filters={describeFilters(scoutingFilters)}
        >
          <span aria-live="polite">
            {copy(
              language,
              "scoutFilterSummary",
              scoutingFilterDescription,
              scoutingFilteredPlayers.length,
              scouting?.recommendations.length ?? 0,
            )}
          </span>
          {scoutingFiltersActive ? (
            <button type="button" className="club-button club-button-secondary club-scout-clear" onClick={clearScoutingFilters}>
              {copy(language, "scoutClearFilters")}
            </button>
          ) : null}
        </div>
      </div>

      {scouting ? (
      <div className="club-panel club-scouting-panel" aria-live="polite">
        <div className="club-scouting-head">
          <div>
            <p className="club-eyebrow">{copy(language, "scoutingTitle")}</p>
            <p className="club-scouting-weakest">
              {copy(
                language,
                "scoutingWeakestValue",
                copy(language, SCOUT_LINE_COPY[scouting.weakest]),
                scoutingWeakestNeed ? scoutingWeakestNeed.rating.toFixed(1) : "—",
                scoutingWeakestNeed ? String(scoutingWeakestNeed.gap) : "—",
              )}
            </p>
          </div>
          <div className="club-scouting-meta">
            <span>{`${copy(language, "scoutingBudget")}: ${scouting.budget} FC`}</span>
            <span>{`${copy(language, "scoutingCap")}: ${scouting.scoutCap} OVR`}</span>
            <span>{`${copy(language, "scoutingSquad")}: ${scouting.squadSize}`}</span>
          </div>
        </div>
        <p className="club-scouting-readonly">{copy(language, "scoutingReadOnly")}</p>
        <div className="club-scouting-needs-block">
          <h4 className="club-subheading">{copy(language, "scoutingNeedsTitle")}</h4>
          <ul className="club-scouting-needs">
            {scouting.needs.map((need) => (
              <li
                key={need.line}
                className={`club-scouting-need${need.line === scouting.weakest ? " is-weakest" : ""}`}
                data-line={need.line}
                data-rating={need.rating}
                data-gap={need.gap}
              >
                <b>{copy(language, SCOUT_LINE_COPY[need.line])}</b>
                <span>{`${copy(language, "scoutingRating")} ${need.rating.toFixed(1)}`}</span>
                <span>{`${copy(language, "scoutingGap")} ${need.gap}`}</span>
                <span className="club-muted">{`${copy(language, "scoutingTarget")} ${need.target}`}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="club-scouting-list-block">
          <h4 className="club-subheading">{copy(language, "scoutingRecommendations")}</h4>
          {scouting.recommendations.length ? (
            <ul className="club-scouting-list">
              {scouting.recommendations.map((entry) => {
                const inSquad = club.players.some((player) => player.id === entry.id);
                const capped = entry.ovr > scouting.scoutCap;
                const blockedReason = inSquad
                  ? copy(language, "transferReasonInSquad")
                  : capped
                    ? copy(language, "transferReasonCapped", scouting.scoutCap)
                    : squadIsFull
                      ? copy(language, "transferReasonSquadFull")
                      : entry.price > funds
                        ? copy(language, "transferReasonFunds")
                        : null;
                const pendingSign = pendingAction === `sign:${entry.id}`;
                return (
                  <li
                    key={entry.id}
                    className="club-scouting-row"
                    data-recommendation-id={entry.id}
                    data-line={entry.line}
                    data-ovr={entry.ovr}
                    data-price={entry.price}
                    data-reason={entry.reason}
                    data-blocked-reason={blockedReason ?? ""}
                    data-affordable={entry.price <= funds}
                  >
                    <span className="club-scouting-main">
                      <b>{entry.name}</b>
                      <small>{`${entry.position} · ${copy(language, SCOUT_LINE_COPY[entry.line])}`}</small>
                    </span>
                    <span className="club-scouting-facts">
                      <span>{`${copy(language, "columnOvr")} ${entry.ovr}`}</span>
                      <span>{`${entry.price} FC`}</span>
                      <span className={`club-scouting-reason is-${entry.reason}`}>
                        {copy(language, SCOUT_REASON_COPY[entry.reason])}
                      </span>
                    </span>
                    <span className="club-scouting-action">
                      <button
                        type="button"
                        className="club-button club-button-primary club-sign-button"
                        onClick={() => void handleSign(entry.id)}
                        disabled={busy || Boolean(blockedReason)}
                      >
                        {pendingSign
                          ? copy(language, "transferSigning")
                          : copy(language, "transferSignAction", entry.price)}
                      </button>
                      {blockedReason ? <span className="club-sign-reason">{blockedReason}</span> : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="club-note" role="status">
              {copy(language, scoutingFiltersActive ? "scoutRecommendEmpty" : "scoutingNoTargets")}
              {scoutingFiltersActive ? (
                <button type="button" className="club-link-button" onClick={clearScoutingFilters}>
                  {copy(language, "scoutClearFilters")}
                </button>
              ) : null}
            </p>
          )}
          {!scoutingHasAffordable ? (
            <p className="club-note club-scouting-honest">{copy(language, "scoutingNoAffordable")}</p>
          ) : null}
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary>
        <p className="club-note club-scouting-note">
          <b>{`${copy(language, "scoutingNoteLabel")}: `}</b>
          {scouting.note}
        </p>
        </details>
      </div>
      ) : null}

      <div className="club-panel club-transfer-panel">
        <div className="club-scout-toolbar">
          <label className="club-field club-field-inline club-scout-sort">
            <span>{copy(language, "scoutSortLabel")}</span>
            <select
              value={scoutSort}
              onChange={(event) => setScoutSort(event.target.value as ScoutSort)}
              disabled={busy}
            >
              <option value="ovr">{copy(language, "scoutSortOvr")}</option>
              <option value="priceAsc">{copy(language, "scoutSortPriceAsc")}</option>
              <option value="priceDesc">{copy(language, "scoutSortPriceDesc")}</option>
            </select>
          </label>
          <label className="club-scout-check">
            <input
              type="checkbox"
              checked={scoutWithinCapOnly}
              onChange={(event) => setScoutWithinCapOnly(event.target.checked)}
              disabled={busy}
            />
            <span>{copy(language, "scoutCapFilter")}</span>
          </label>
        </div>
        <p className="club-scout-meta">
          {`${copy(language, "scoutCapInfo", club.facilities.scoutCentre, scoutingCap)} · ${copy(
            language,
            "scoutCount",
            visibleScoutRows.length,
            scoutRows.length,
          )}`}
        </p>
        {visibleScoutRows.length ? (
          <div className="club-table-wrap">
            <table className="club-table club-scout-table">
              <caption className="club-visually-hidden">{copy(language, "scoutTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy(language, "columnPlayer")}</th>
                  <th scope="col">{copy(language, "columnPosition")}</th>
                  <th scope="col">{copy(language, "columnOvr")}</th>
                  <th scope="col">{copy(language, "transferPrice")}</th>
                  <th scope="col">{copy(language, "transferSign")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleScoutRows.map((entry) => {
                  const inSquad = club.players.some((player) => player.id === entry.world.id);
                  const capped = entry.ovr > scoutingCap;
                  const affordable = funds >= entry.price;
                  const reason = inSquad
                    ? copy(language, "transferReasonInSquad")
                    : capped
                      ? copy(language, "transferReasonCapped", scoutingCap)
                      : squadIsFull
                        ? copy(language, "transferReasonSquadFull")
                        : !affordable
                          ? copy(language, "transferReasonFunds")
                          : null;
                  const pendingSign = pendingAction === `sign:${entry.world.id}`;
                  return (
                    <tr key={entry.world.id}>
                      <td data-col="name" data-label={copy(language, "columnPlayer")}>
                        <span className="club-player-name">{entry.world.name}</span>
                        <span className="club-player-meta">{`${entry.world.position} · ${entry.world.nationality}`}</span>
                      </td>
                      <td data-col="position" data-label={copy(language, "columnPosition")}>
                        {entry.world.position}
                      </td>
                      <td data-col="ovr" data-label={copy(language, "columnOvr")}>
                        <b className="club-ovr">{entry.ovr}</b>
                      </td>
                      <td data-col="price" data-label={copy(language, "transferPrice")}>
                        <span className="club-transfer-price">{`${entry.price} FC`}</span>
                      </td>
                      <td data-col="sign" data-label={copy(language, "transferSign")}>
                        <span className="club-sign-cell">
                          <button
                            type="button"
                            className="club-button club-button-primary club-sign-button"
                            onClick={() => void handleSign(entry.world.id)}
                            disabled={busy || Boolean(reason)}
                          >
                            {pendingSign
                              ? copy(language, "transferSigning")
                              : copy(language, "transferSignAction", entry.price)}
                          </button>
                          {reason ? <span className="club-sign-reason">{reason}</span> : null}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="club-note" role="status">
            {copy(language, "scoutEmpty")}
            {scoutingFiltersActive ? (
              <button type="button" className="club-link-button" onClick={clearScoutingFilters}>
                {copy(language, "scoutClearFilters")}
              </button>
            ) : null}
          </p>
        )}
      </div>
        </>
      )}
    </section>
  ) : null;

  const leagueSection = mode === "club" && club ? (
    <section className="club-section" id="club-league" aria-labelledby="club-league-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "leagueTitle")}</p>
          <h2 id="club-league-heading">{copy(language, "leagueTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "leagueIntro")}</p></details>
      </div>
      <div className="club-panel club-league-panel">
        {season ? (
          <>
            <div className="club-league-head">
              <span className="club-pill club-pill-active">{copy(language, MATCH_TIER_NAME_KEY[season.tier])}</span>
              <p className="club-league-live" role="status" aria-live="polite">
                {copy(
                  language,
                  "leagueSummary",
                  season.round,
                  14,
                  ownLeaguePosition,
                  ownLeagueRow?.points ?? 0,
                )}
              </p>
              <span className="club-muted">{copy(language, "leagueNoFunds")}</span>
            </div>
            <div className="club-round-progress">
              <ProgressRing done={season.round} total={14} label={`${copy(language, "roundProgressLabel")} ${season.round}/14`} />
              <span>{copy(language, "leagueSummary", season.round, 14, ownLeaguePosition, ownLeagueRow?.points ?? 0)}</span>
            </div>

            <div className="club-table-wrap">
              <table className="club-table club-league-table">
                <caption className="club-visually-hidden">{copy(language, "leagueTable")}</caption>
                <thead>
                  <tr>
                    <th scope="col">{copy(language, "leagueRank")}</th>
                    <th scope="col">{copy(language, "leagueTeam")}</th>
                    <th scope="col">{copy(language, "leaguePlayed")}</th>
                    <th scope="col">{copy(language, "leagueWon")}</th>
                    <th scope="col">{copy(language, "leagueDrawn")}</th>
                    <th scope="col">{copy(language, "leagueLost")}</th>
                    <th scope="col">{copy(language, "leagueGoals")}</th>
                    <th scope="col">{copy(language, "leaguePoints")}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedLeague.map((row, index) => {
                    const own = row.teamId === "club";
                    const promoted = index < 2;
                    const relegated = index >= orderedLeague.length - 2;
                    return (
                      <tr
                        key={row.teamId}
                        className={`${own ? "is-own" : ""}${promoted ? " is-promotion" : ""}${relegated ? " is-relegation" : ""}`}
                        aria-current={own ? "true" : undefined}
                      >
                        <td data-col="rank" data-label={copy(language, "leagueRank")}>
                          <span className="club-league-rank">{index + 1}</span>
                        </td>
                        <td data-col="team" data-label={copy(language, "leagueTeam")}>
                          <span className="club-league-team">{leagueNameOf(row.teamId)}</span>
                          {own ? <span className="club-pill club-pill-active">{copy(language, "leagueYou")}</span> : null}
                          {promoted ? <span className="club-league-zone">{copy(language, "leaguePromotion")}</span> : null}
                          {relegated ? (
                            <span className="club-league-zone club-league-zone-down">{copy(language, "leagueRelegation")}</span>
                          ) : null}
                        </td>
                        <td data-col="played" data-label={copy(language, "leaguePlayed")}>
                          {row.played}
                        </td>
                        <td data-col="won" data-label={copy(language, "leagueWon")}>
                          {row.won}
                        </td>
                        <td data-col="drawn" data-label={copy(language, "leagueDrawn")}>
                          {row.drawn}
                        </td>
                        <td data-col="lost" data-label={copy(language, "leagueLost")}>
                          {row.lost}
                        </td>
                        <td data-col="goals" data-label={copy(language, "leagueGoals")}>
                          {`${row.gf}:${row.ga}`}
                        </td>
                        <td data-col="points" data-label={copy(language, "leaguePoints")}>
                          <b className="club-league-points">{row.points}</b>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="club-league-recent" aria-live="polite">
              <div className="club-league-recent-head">
                <h3 className="club-subheading">{copy(language, "leagueRecent")}</h3>
                {leagueRecent ? (
                  <span className="club-muted">{copy(language, "leagueRoundDone", leagueRecent.round)}</span>
                ) : null}
              </div>
              {leagueRecent ? (
                <ul className="club-league-results">
                  {leagueRecent.results.map((result, index) => (
                    <li
                      key={`${result.home}:${result.away}:${index}`}
                      className={result.home === "club" || result.away === "club" ? "is-own" : undefined}
                    >
                      <span className="club-league-result-team">{leagueNameOf(result.home)}</span>
                      <b className="club-league-result-score">{`${result.score[0]} – ${result.score[1]}`}</b>
                      <span className="club-league-result-team club-league-result-away">{leagueNameOf(result.away)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="club-note">{copy(language, "leagueNoResults")}</p>
              )}
              {reconstructedRound && !lastRoundResults ? (
                <p className="club-note">{copy(language, "leagueRebuiltNote")}</p>
              ) : null}
            </div>

            {season.finished && leagueOutcome ? (
              <div className={`club-league-outcome is-${leagueOutcome.status}`} role="status" aria-live="polite">
                <b>
                  {copy(
                    language,
                    leagueOutcome.status === "promoted"
                      ? "leaguePromoted"
                      : leagueOutcome.status === "relegated"
                        ? "leagueRelegated"
                        : "leagueStayed",
                    copy(language, MATCH_TIER_NAME_KEY[leagueOutcome.nextTier]),
                  )}
                </b>
                <span>{copy(language, "leagueFinalPosition", leagueOutcome.position)}</span>
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleNextLeagueSeason()}
                  disabled={busy}
                >
                  {pendingAction?.startsWith("league-start")
                    ? copy(language, "leagueStarting")
                    : copy(language, "leagueNextSeason", copy(language, MATCH_TIER_NAME_KEY[leagueOutcome.nextTier]))}
                </button>
              </div>
            ) : (
              <div className="club-match-actions">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handlePlayLeagueRound()}
                  disabled={busy}
                >
                  {pendingAction === "league-play" ? copy(language, "leagueSimulating") : copy(language, "leagueNextRound")}
                </button>
                <span className="club-note">{copy(language, "leagueNoFunds")}</span>
              </div>
            )}
          </>
        ) : (
          <div className="club-league-start">
            <h3 className="club-subheading">{copy(language, "leagueStartTitle")}</h3>
            <fieldset className="club-league-tiers" disabled={busy}>
              <legend>{copy(language, "leagueTierLabel")}</legend>
              <div className="club-match-tiers">
                {([0, 1, 2, 3] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`club-tier-button${leagueTier === tier ? " is-selected" : ""}`}
                    aria-pressed={leagueTier === tier}
                    onClick={() => setLeagueTier(tier)}
                  >
                    <b>{copy(language, MATCH_TIER_NAME_KEY[tier])}</b>
                    <small>{copy(language, "leagueTierBaseline", TIER_OVR[tier])}</small>
                    <small className="club-tier-hint">{copy(language, MATCH_TIER_DESC_KEY[tier])}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="club-match-actions">
              <button
                type="button"
                className="club-button club-button-primary"
                onClick={() => void handleStartLeague(leagueTier)}
                disabled={busy}
              >
                {pendingAction?.startsWith("league-start") ? copy(language, "leagueStarting") : copy(language, "leagueStartButton")}
              </button>
              <span className="club-note">{copy(language, "leagueNoFunds")}</span>
            </div>
          </div>
        )}
      </div>
      <div className="club-panel club-history-panel" aria-live="polite">
        <div className="club-table-heading">
          <h3>{copy(language, "historyTitle")}</h3>
          <span className="club-muted">{copy(language, "historyCount", seasonHistory.length)}</span>
        </div>
        {seasonHistory.length ? (
          <div className="club-table-wrap">
            <table className="club-table club-history-table">
              <caption className="club-visually-hidden">{copy(language, "historyTitle")}</caption>
              <thead>
                <tr>
                  <th scope="col">{copy(language, "historyTier")}</th>
                  <th scope="col">{copy(language, "historyPosition")}</th>
                  <th scope="col">{copy(language, "historyPoints")}</th>
                  <th scope="col">{copy(language, "historyRecord")}</th>
                  <th scope="col">{copy(language, "historyGoals")}</th>
                  <th scope="col">{copy(language, "historyOutcome")}</th>
                  <th scope="col">{copy(language, "historyDate")}</th>
                </tr>
              </thead>
              <tbody>
                {seasonHistory.map((record) => {
                  const expanded = expandedHistoryId === record.id;
                  const tierLabel = copy(language, MATCH_TIER_NAME_KEY[matchTierIndex(record.tier)]);
                  return (
                    <Fragment key={record.id}>
                      <tr data-history-id={record.id} data-history-lineup={record.lineup?.length ?? 0}>
                        <td data-col="tier" data-label={copy(language, "historyTier")}>
                          <button
                            type="button"
                            className="club-history-toggle"
                            aria-expanded={expanded}
                            aria-controls={`history-lineup-${record.id}`}
                            onClick={() => setExpandedHistoryId(expanded ? null : record.id)}
                          >
                            <span>{tierLabel}</span>
                            <span className="club-history-chevron" aria-hidden="true">
                              {expanded ? "−" : "+"}
                            </span>
                            <span className="club-visually-hidden">
                              {copy(language, expanded ? "historyHideLineup" : "historyShowLineup", tierLabel)}
                            </span>
                          </button>
                        </td>
                        <td data-col="position" data-label={copy(language, "historyPosition")}>
                          {record.position}
                        </td>
                        <td data-col="points" data-label={copy(language, "historyPoints")}>
                          <b>{record.points}</b>
                        </td>
                        <td data-col="record" data-label={copy(language, "historyRecord")}>
                          {copy(language, "historyRecordFormat", record.won, record.drawn, record.lost)}
                        </td>
                        <td data-col="goals" data-label={copy(language, "historyGoals")}>
                          {`${record.gf}:${record.ga}`}
                        </td>
                        <td data-col="outcome" data-label={copy(language, "historyOutcome")}>
                          <span className={`club-history-outcome is-${record.outcome}`}>
                            {copy(language, SEASON_OUTCOME_KEY[record.outcome])}
                          </span>
                        </td>
                        <td data-col="date" data-label={copy(language, "historyDate")}>
                          <time dateTime={record.at}>{dateTime(language, record.at)}</time>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr className="club-history-expanded">
                          <td colSpan={7} data-col="lineup" data-label={copy(language, "historyLineupTitle")}>
                            <div
                              className="club-history-lineup"
                              id={`history-lineup-${record.id}`}
                              role="region"
                              aria-label={copy(language, "historyLineupTitle")}
                            >
                              <h4 className="club-subheading">{copy(language, "historyLineupTitle")}</h4>
                              {record.lineup?.length ? (
                                <ul className="club-history-lineup-list">
                                  {record.lineup.map((player) => (
                                    <li key={player.id}>
                                      <b>{player.name}</b>
                                      <span>{player.position}</span>
                                      <span>{`OVR ${player.ovr}`}</span>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <p className="club-note">{copy(language, "historyLineupMissing")}</p>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="club-note club-history-empty">{copy(language, "historyEmpty")}</p>
        )}
      </div>
    </section>
  ) : null;

  const cupSection = mode === "club" && club ? (
    <section className="club-section" id="club-cup" aria-labelledby="club-cup-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "cupTitle")}</p>
          <h2 id="club-cup-heading">{copy(language, "cupTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "cupIntro")}</p></details>
      </div>
      <div className="club-panel club-cup-panel">
        <p className="club-cup-disclaimer">{copy(language, "cupDisclaimer")}</p>
        {cup ? (
          <>
            <div className="club-cup-head">
              <span className="club-pill club-pill-active">{copy(language, MATCH_TIER_NAME_KEY[cup.tier])}</span>
              <span className="club-muted">
                {copy(
                  language,
                  cup.finished
                    ? "cupRoundFinished"
                    : cupNextRound === 2
                      ? "cupRoundSemisDone"
                      : "cupRoundSemisPending",
                )}
              </span>
              <span className="club-muted">{copy(language, "cupNoFunds")}</span>
            </div>
            <div className="club-round-progress">
              <ProgressRing done={cup.finished ? 2 : cupNextRound === 2 ? 1 : 0} total={2} label={`${copy(language, "cupProgressLabel")} ${cup.finished ? 2 : cupNextRound === 2 ? 1 : 0}/2`} />
              <span>{copy(language, cup.finished ? "cupRoundFinished" : cupNextRound === 2 ? "cupRoundSemisDone" : "cupRoundSemisPending")}</span>
            </div>
            {cupNextOwnMatch ? (
              <p className="club-cup-opponent">
                {copy(
                  language,
                  "cupYourOpponent",
                  cupNameOf(
                    cup,
                    club?.name,
                    cupNextOwnMatch.home === "club" ? cupNextOwnMatch.away : cupNextOwnMatch.home,
                  ),
                  cupNextRound === 2 ? copy(language, "cupFinal") : copy(language, "cupSemiFinal"),
                )}
              </p>
            ) : !cup.finished ? (
              <p className="club-cup-opponent">{copy(language, "cupEliminatedWaiting")}</p>
            ) : null}
            <div className="club-cup-rounds" aria-live="polite">
              <div className="club-cup-round">
                <h3 className="club-subheading">{copy(language, "cupSemiFinal")}</h3>
                <ul className="club-cup-matches">
                  {cupSemiMatches.map((match) =>
                    renderCupMatch(match, cupSemiWinners.get(`${match.round}:${match.home}:${match.away}`)),
                  )}
                </ul>
              </div>
              <div className="club-cup-round">
                <h3 className="club-subheading">{copy(language, "cupFinal")}</h3>
                {cupFinalMatch ? (
                  <ul className="club-cup-matches">{renderCupMatch(cupFinalMatch, cup.winner)}</ul>
                ) : (
                  <p className="club-note">{copy(language, "cupFinalTbd")}</p>
                )}
              </div>
            </div>
            {cup.finished && cupOutcome ? (
              <div className={`club-cup-outcome is-${cupOutcome}`} role="status" aria-live="polite">
                <b>{copy(language, cupOutcome === "won" ? "cupWon" : "cupLost")}</b>
                <span>{copy(language, "cupChampion", cupWinnerName ?? "")}</span>
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleReplayCup()}
                  disabled={busy}
                >
                  {pendingAction?.startsWith("cup-start")
                    ? copy(language, "cupStarting")
                    : copy(language, "cupReplay", copy(language, MATCH_TIER_NAME_KEY[cup.tier]))}
                </button>
              </div>
            ) : (
              <div className="club-match-actions">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handlePlayCupRound()}
                  disabled={busy}
                >
                  {pendingAction === "cup-play"
                    ? copy(language, "cupSimulating")
                    : cupNextRound === 2
                      ? copy(language, "cupPlayFinal")
                      : copy(language, "cupPlaySemis")}
                </button>
                <span className="club-note">{copy(language, "cupNoFunds")}</span>
              </div>
            )}
          </>
        ) : (
          <div className="club-cup-start">
            <fieldset className="club-league-tiers" disabled={busy}>
              <legend>{copy(language, "cupTierLabel")}</legend>
              <div className="club-match-tiers">
                {([0, 1, 2, 3] as const).map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    className={`club-tier-button${cupTier === tier ? " is-selected" : ""}`}
                    aria-pressed={cupTier === tier}
                    onClick={() => setCupTier(tier)}
                  >
                    <b>{copy(language, MATCH_TIER_NAME_KEY[tier])}</b>
                    <small className="club-tier-hint">{copy(language, MATCH_TIER_DESC_KEY[tier])}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="club-match-actions">
              <button
                type="button"
                className="club-button club-button-primary"
                onClick={() => void handleStartCup(cupTier)}
                disabled={busy}
              >
                {pendingAction?.startsWith("cup-start")
                  ? copy(language, "cupStarting")
                  : copy(language, "cupStartButton")}
              </button>
              <span className="club-note">{copy(language, "cupNoFunds")}</span>
            </div>
          </div>
        )}
      </div>
    </section>
  ) : null;

  const migrateSection = mode === "club" && club && state && migrationPreview ? (
    <section className="club-section" id="club-migrate" aria-labelledby="club-migrate-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">PLAN 4.3</p>
          <h2 id="club-migrate-heading">{copy(language, "migrateSummaryTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "migrateSummaryIntro")}</p></details>
      </div>
      <div className="club-migration-grid">
        <div className="club-panel">
          <h3 className="club-subheading">{copy(language, "migrationDetails")}</h3>
          <dl className="club-migration-dl">
            <div className="club-migration-row">
              <dt>{copy(language, "migrationXp")}</dt>
              <dd>
                <span>{migrationPreview.xp}</span>
                <span className="club-none">{copy(language, "migrateXpNote")}</span>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "migrationFunds")}</dt>
              <dd>
                <span>{`${migrationPreview.funds} FC`}</span>
                <span className="club-none">{copy(language, "migrateFundsNote")}</span>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "migrationGrant")}</dt>
              <dd>
                <span>{`${migrationPreview.initialGrant} FC`}</span>
                <span className="club-none">{copy(language, "migrationGrantNote")}</span>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "displayRights")}</dt>
              <dd>
                <ul className="club-subfacts">
                  <li>
                    <span>{copy(language, "frames")}</span>
                    <RawList values={migrationPreview.displayRights.frames} empty={copy(language, "none")} />
                  </li>
                  <li>
                    <span>{copy(language, "backdrops")}</span>
                    <RawList values={migrationPreview.displayRights.backdrops} empty={copy(language, "none")} />
                  </li>
                  <li>
                    <span>{copy(language, "kits")}</span>
                    <RawList values={migrationPreview.displayRights.kits} empty={copy(language, "none")} />
                  </li>
                </ul>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "frozen")}</dt>
              <dd>
                <ul className="club-subfacts">
                  <li>
                    <span>{copy(language, "personalAttributes")}</span>
                    <code className="club-code">{rawValue(migrationPreview.frozen.personalAttributes)}</code>
                  </li>
                  <li>
                    <span>{copy(language, "skillPoints")}</span>
                    <code className="club-code">{rawValue(migrationPreview.frozen.skillPoints)}</code>
                  </li>
                  <li>
                    <span>{copy(language, "matchHistory")}</span>
                    <code className="club-code">{rawValue(migrationPreview.frozen.matchHistory)}</code>
                  </li>
                </ul>
                <span className="club-none">{copy(language, "migrateFrozenNote")}</span>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "rewardBaseline")}</dt>
              <dd>
                <ul className="club-subfacts">
                  <li>
                    <span>{copy(language, "rewardIdentities")}</span>
                    <b>{migrationPreview.baseline.rewardIdentities}</b>
                  </li>
                  <li>
                    <span>{copy(language, "sessionIdentities")}</span>
                    <b>{migrationPreview.baseline.sessionIdentities}</b>
                  </li>
                  <li>
                    <span>{copy(language, "activeSession")}</span>
                    <code className="club-code">{rawValue(migrationPreview.baseline.activeSession)}</code>
                  </li>
                </ul>
                <span className="club-none">{copy(language, "migrateBaselineNote")}</span>
              </dd>
            </div>
            <div className="club-migration-row">
              <dt>{copy(language, "warnings")}</dt>
              <dd>
                {migrationPreview.warnings.length ? (
                  <ul className="club-warning-list">
                    {migrationPreview.warnings.map((warning, index) => (
                      <li key={`${index}-${warning}`} lang={language === "zh" ? "en-GB" : undefined}>
                        {warning}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="club-none">{copy(language, "noWarnings")}</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
        <aside className={`club-panel club-migrate-panel${migratedAt ? " is-migrated" : ""}`}>
          <h3 className="club-subheading">{copy(language, "migrateStatusTitle")}</h3>
          <p className="club-readonly-main">{copy(language, "migratePreviewNote")}</p>
          <p className="club-readonly-alt" lang={alternativeLangTag}>
            {COPY.migratePreviewNote[alternativeLanguage]}
          </p>
          {migratedAt ? (
            <>
              <p className="club-migrate-status" role="status" aria-live="polite">
                {copy(language, "migratedStatus", dateTime(language, migratedAt))}
              </p>
              <p className="club-note">{copy(language, "migrateOnceNote")}</p>
            </>
          ) : (
            <>
              <p className="club-note">{copy(language, "migrateConfirmHint")}</p>
              <button
                type="button"
                className="club-button club-button-primary club-migrate-button"
                onClick={() => void handleMigrate()}
                disabled={busy}
              >
                {pendingAction === "club-migrate" ? copy(language, "migrateApplying") : copy(language, "migrateConfirm")}
              </button>
              <p className="club-note">{copy(language, "migrateOnceNote")}</p>
            </>
          )}
          {migrateAnnouncement ? (
            <p className="club-migrate-result" role="status" aria-live="polite">
              {migrateAnnouncement}
            </p>
          ) : null}
        </aside>
      </div>
    </section>
  ) : null;

  const honoursSection = mode === "club" && club ? (
    <section className="club-section" id="club-honours" aria-labelledby="club-honours-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "honoursTitle")}</p>
          <h2 id="club-honours-heading">{copy(language, "honoursTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "honoursIntro")}</p></details>
      </div>
      <div className="club-panel club-honours-panel">
        <div className="club-honours-pips" data-trophy-pips={trophies.length}>
          <Pips filled={trophyPips(trophies.length, 5).filled} total={trophyPips(trophies.length, 5).total} label={copy(language, "trophyLabel")} kind="trophy" />
          <b>{`${trophies.length} ${copy(language, "overviewTrophies")}`}</b>
        </div>
        {trophies.length ? (
          <ul className="club-trophy-list" aria-live="polite">
            {trophies.map((trophy: ClubTrophy) => (
              <li key={trophy.id}>
                <span className={`club-trophy-icon is-${trophy.kind}`} aria-hidden="true">
                  {trophy.kind === "cup" ? "CUP" : "LG"}
                </span>
                <div className="club-trophy-copy">
                  <b>{copy(language, trophy.kind === "cup" ? "cupTitle" : "honourLeagueTitle")}</b>
                  <span>
                    {copy(
                      language,
                      "honourMeta",
                      copy(language, MATCH_TIER_NAME_KEY[matchTierIndex(trophy.tier)]),
                      dateTime(language, trophy.at),
                    )}
                  </span>
                </div>
                {(() => {
                  const kit = kitForTrophy(trophy);
                  return kit ? (
                    <span className="club-trophy-kit" data-kit-id={kit.id} data-kit-kind={kit.kind}>
                      <span
                        className="club-trophy-kit-swatch"
                        style={{ background: `linear-gradient(90deg, ${kit.colours[0]} 0 50%, ${kit.colours[1]} 50% 100%)` }}
                        aria-hidden="true"
                      />
                      <span className="club-trophy-kit-copy">
                        <b>{kitDisplayName(language, kit)}</b>
                        <small>{copy(language, kit.kind === "cup" ? "displayKitKindCup" : "displayKitKindLeague")}</small>
                      </span>
                    </span>
                  ) : (
                    <span className="club-trophy-kit is-legacy" data-kit-missing="true">
                      {copy(language, "trophyLegacyKit")}
                    </span>
                  );
                })()}
                <button
                  type="button"
                  className="club-button club-button-secondary club-trophy-replay"
                  onClick={() => openCelebrationReview(trophy)}
                >
                  {copy(language, "celebrationRewatch")}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="club-note club-honours-empty">{copy(language, "honoursEmpty")}</p>
        )}
      </div>
    </section>
  ) : null;

  const matchSection = mode === "club" && club ? (
    <section className="club-section" id="club-match" aria-labelledby="club-match-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{`${copy(language, "matchTitle")} · ${copy(language, "matchTierLabel")}`}</p>
          <h2 id="club-match-heading">{copy(language, "matchTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "matchIntro")}</p></details>
      </div>
      <div className="club-panel club-match-panel">
        <div className="club-match-assistant-row">
          <details className="club-assistant" id="club-assistant" data-assistant-panel>
            <summary>{copy(language, "assistantTitle")}</summary>
            <div className="club-assistant-body">
              <label className="club-assistant-toggle">
                <input
                  type="checkbox"
                  checked={assistant.autoSquad}
                  onChange={(event) => void handleAssistantChange("autoSquad", event.target.checked)}
                  disabled={busy}
                  data-assistant-auto-squad
                />
                <span>
                  <b>{copy(language, "assistantAutoSquad")}</b>
                  <small>{copy(language, "assistantSettingsHint")}</small>
                </span>
              </label>
              <label className="club-assistant-toggle">
                <input
                  type="checkbox"
                  checked={assistant.autoSubs}
                  onChange={(event) => void handleAssistantChange("autoSubs", event.target.checked)}
                  disabled={busy}
                  data-assistant-auto-subs
                />
                <span>
                  <b>{copy(language, "assistantAutoSubs")}</b>
                </span>
              </label>
              <p className="club-assistant-note">{copy(language, "assistantNote")}</p>
              <p className="club-assistant-announcement" role="status" aria-live="polite">{assistantAnnouncement}</p>
            </div>
          </details>
          {unavailableStarters.length ? (
            <p className="club-pre-match-note" role="status" data-unavailable-starters={unavailableStarters.length}>
              {assistant.autoSquad
                ? copy(language, "assistantPreMatch", unavailableStarters.length)
                : copy(language, "assistantPreMatchManual", unavailableStarters.length)}
            </p>
          ) : null}
        </div>
        <details className="club-new-match" id="club-new-match-controls">
          <summary>{copy(language, "newMatch")}</summary>
          {tacticSuggestion ? (
            <div
              className={`club-tactic-suggest${tacticSuggestion.fallback ? " is-fallback" : ""}`}
              data-tactic-suggest
              data-tactic-suggested={tacticSuggestion.tactic}
              data-tactic-active={club?.tactics.active ?? ""}
            >
              <div className="club-tactic-suggest-head">
                <b>{copy(language, "tacticSuggestTitle")}</b>
                <span>
                  {tacticSuggestion.opponentName
                    ? copy(language, "tacticSuggestOpponent", tacticSuggestion.opponentName)
                    : copy(language, "tacticSuggestFallback")}
                </span>
              </div>
              <p className="club-tactic-suggest-reason">
                <b>{copy(language, TACTIC_NAME_KEY[tacticSuggestion.tactic])}</b>
                {tacticSuggestion.fallback
                  ? ""
                  : ` — ${briefingText(language, tacticSuggestion.reason, BRIEFING_REASON_ZH)}`}
              </p>
              <div className="club-tactic-suggest-actions">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleApplySuggestedTactic(tacticSuggestion.tactic)}
                  disabled={busy || club?.tactics.active === tacticSuggestion.tactic}
                >
                  {pendingAction === `suggested-tactic:${tacticSuggestion.tactic}`
                    ? copy(language, "briefingApplying")
                    : club?.tactics.active === tacticSuggestion.tactic
                      ? copy(language, "briefingAlready")
                      : copy(language, "tacticSuggestApply")}
                </button>
                <span className="club-tactic-suggest-announcement" role="status" aria-live="polite">
                  {tacticSuggestAnnouncement}
                </span>
              </div>
            </div>
          ) : null}
        <fieldset className="club-match-controls" disabled={busy}>
          <legend>{copy(language, "matchTierLabel")}</legend>
          <div className="club-match-tiers">
            {([0, 1, 2, 3] as const).map((tier) => (
              <button
                key={tier}
                type="button"
                className={`club-tier-button${matchTier === tier ? " is-selected" : ""}`}
                aria-pressed={matchTier === tier}
                onClick={() => setMatchTier(tier)}
              >
                <b>{copy(language, MATCH_TIER_NAME_KEY[tier])}</b>
                <small>{copy(language, MATCH_TIER_DESC_KEY[tier])}</small>
              </button>
            ))}
          </div>
          <div className="club-match-actions">
            <button
              type="button"
              className="club-button club-button-primary"
              onClick={() => void handleMatch()}
              disabled={busy}
            >
              {pendingAction === "match" ? copy(language, "matchSimulating") : copy(language, "matchSimulate")}
            </button>
            <span className="club-note">{copy(language, "matchNoFunds")}</span>
          </div>
        </fieldset>
        </details>

        {latestMatch ? (
          <div className="club-match-result club-match-hero" role="status" aria-live="polite">
            <div className="club-match-result-head">
              <h3 className="club-subheading">{copy(language, "matchResultTitle")}</h3>
              <span className="club-match-tier">{copy(language, MATCH_TIER_NAME_KEY[matchTierIndex(latestMatch.tier)])}</span>
            </div>
            <div className="club-match-scoreboard">
              <span className="club-match-side">
                <span className="club-match-tag">{copy(language, "matchHomeShort")}</span>
                <b>{club.name}</b>
              </span>
              <span className="club-match-score">{`${latestMatch.score[0]} – ${latestMatch.score[1]}`}</span>
              <span className="club-match-side club-match-side-away">
                <span className="club-match-tag">{copy(language, "matchAwayShort")}</span>
                <b>{latestMatch.opponent.name}</b>
              </span>
            </div>
            <p className="club-match-when">
              <time dateTime={latestMatch.at}>{dateTime(language, latestMatch.at)}</time>
            </p>
            <div className="club-match-stats">
              <div className="club-match-stat">
                <span>{copy(language, "matchPossession")}</span>
                <div className="club-possession-bar" aria-hidden="true">
                  <i style={{ width: `${Math.max(0, Math.min(100, latestMatch.possession[0]))}%` }} />
                </div>
                <b>{`${Math.round(latestMatch.possession[0])}% – ${Math.round(latestMatch.possession[1])}%`}</b>
              </div>
              <div className="club-match-stat">
                <span>{copy(language, "matchShots")}</span>
                <b>{`${latestMatch.shots[0]} (${latestMatch.onTarget[0]}) – ${latestMatch.shots[1]} (${latestMatch.onTarget[1]})`}</b>
              </div>
            </div>
            <div className="club-match-hero-actions">
              <button type="button" className="club-button club-button-primary club-match-hero-watch" onClick={() => setLatestWatchOpen(true)}>
                {`▶ ${copy(language, "watchHero")}`}
              </button>
              <button
                type="button"
                className="club-button club-button-secondary club-match-hero-secondary"
                onClick={() => {
                  setLatestReplayOpen(true);
                  window.setTimeout(() => document.getElementById("club-replay-panel")?.scrollIntoView({ block: "start", behavior: "smooth" }), 140);
                }}
              >
                {copy(language, "matchTextReplay")}
              </button>
              <button
                type="button"
                className="club-button club-button-secondary club-match-hero-secondary"
                onClick={() => {
                  const details = document.getElementById("club-new-match-controls");
                  if (details instanceof HTMLDetailsElement) details.open = true;
                  details?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
              >
                {copy(language, "matchPlayAgain")}
              </button>
            </div>
            {matchConditionSummary ? (
              <div
                className="club-condition-summary"
                role="status"
                aria-live="polite"
                data-condition-summary
                data-condition-before={matchConditionSummary.before}
                data-condition-after={matchConditionSummary.after}
                data-condition-new-injuries={matchConditionSummary.newInjuries.join("|")}
                data-condition-kind={matchConditionSummary.kind}
              >
                <div className="club-condition-summary-head">
                  <b>{copy(language, "conditionSummaryTitle")}</b>
                  <span>{copy(language, matchConditionSummary.kind === "quick" ? "conditionSummaryQuick" : "conditionSummaryLive")}</span>
                </div>
                <div className="club-condition-summary-row">
                  <span>{copy(language, "conditionSummaryAverage", matchConditionSummary.before, matchConditionSummary.after)}</span>
                  <ConditionBar fitness={matchConditionSummary.after} injury={0} compact language={language} />
                </div>
                <p className={matchConditionSummary.newInjuries.length ? "is-injured" : undefined}>
                  {matchConditionSummary.newInjuries.length
                    ? copy(language, "conditionSummaryNewInjuries", matchConditionSummary.newInjuries.join(" · "))
                    : copy(language, "conditionSummaryNoInjuries")}
                </p>
              </div>
            ) : null}
            <details className="club-section-more">
              <summary>{copy(language, "moreDetails")}</summary>
            <dl className="club-match-explanation">
              <div>
                <dt>{copy(language, "matchDominant")}</dt>
                <dd>
                  <span
                    className={`club-line-dot club-line-dot-${latestMatch.explanation.dominantLine.toLowerCase()}`}
                    aria-hidden="true"
                  />
                  <span>{explainedLineLabel(language, latestMatch.explanation.dominantLine)}</span>
                  <span className="club-pill club-pill-ok">
                    {latestMatch.explanation.dominantSide === "home"
                      ? club.shortName
                      : latestMatch.explanation.dominantSide === "away"
                        ? latestMatch.opponent.shortName
                        : copy(language, "matchEven")}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{copy(language, "matchChances")}</dt>
                <dd>{explainText(language, latestMatch.explanation.chancesFrom)}</dd>
              </div>
              <div>
                <dt>{copy(language, "matchConceded")}</dt>
                <dd>{explainText(language, latestMatch.explanation.concededBecause)}</dd>
              </div>
              <div>
                <dt>{copy(language, "matchTacticNote")}</dt>
                <dd>{explainText(language, latestMatch.explanation.tacticNote)}</dd>
              </div>
              <div>
                <dt>{copy(language, "matchNextStep")}</dt>
                <dd>{explainText(language, latestMatch.explanation.nextStep)}</dd>
              </div>
            </dl>
            </details>
            {latestMatchReport ? (
              <div className="club-match-ratings" aria-live="polite">
                <div className="club-match-ratings-head">
                  <h4 className="club-subheading">{copy(language, "matchPlayerRatings")}</h4>
                  <span className="club-note">{copy(language, "matchRatingsNote")}</span>
                </div>
                <div className="club-table-wrap">
                  <table className="club-table club-ratings-table">
                    <caption className="club-visually-hidden">{copy(language, "matchPlayerRatings")}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{copy(language, "columnPlayer")}</th>
                        <th scope="col">{copy(language, "columnLine")}</th>
                        <th scope="col">{copy(language, "columnGoals")}</th>
                        <th scope="col">{copy(language, "columnRating")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {latestMatchReport.playerRatings.home.map((row) => {
                        const top = row.rating === latestMatchTopRating;
                        return (
                          <tr key={`${row.name}:${row.line}`} className={top ? "is-top" : undefined}>
                            <td data-col="name" data-label={copy(language, "columnPlayer")}>
                              <span className="club-player-name">{row.name}</span>
                            </td>
                            <td data-col="line" data-label={copy(language, "columnLine")}>
                              <span className="club-line">
                                <i
                                  className={`club-line-dot club-line-dot-${row.line.toLowerCase()}`}
                                  aria-hidden="true"
                                />
                                {row.line}
                              </span>
                            </td>
                            <td data-col="goals" data-label={copy(language, "columnGoals")}>
                              {row.goals}
                            </td>
                            <td data-col="rating" data-label={copy(language, "columnRating")}>
                              <b className="club-rating-badge">{row.rating.toFixed(1)}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {!latestMatchReportMatches ? (
                  <p className="club-note">{copy(language, "matchRatingsMismatch")}</p>
                ) : null}
              </div>
            ) : (
              <p className="club-note">{copy(language, "matchRatingsUnavailable")}</p>
            )}
            <MatchReplay
              key={latestMatch.id}
              record={latestMatch}
              language={language}
              homeName={club.name}
              awayName={latestMatch.opponent.name}
              homeColor={club.colours.primary}
              awayColor={club.colours.secondary}
              homeShortName={club.shortName}
              awayShortName={latestMatch.opponent.shortName}
              homeTrophies={club.trophies?.length ?? 0}
              decor={resolveDecor(club)}
              watchOpen={latestWatchOpen}
              onWatchOpenChange={setLatestWatchOpen}
              replayOpen={latestReplayOpen}
              onReplayOpenChange={setLatestReplayOpen}
            />
          </div>
        ) : (
          <p className="club-match-empty">{copy(language, "matchEmpty")}</p>
        )}

        <div className="club-match-history" aria-live="polite">
          <h3 className="club-subheading">{copy(language, "matchRecent")}</h3>
          {recentMatches.length ? (
            <ul className="club-match-list">
              {recentMatches.map((record) => {
                const tierIndex = matchTierIndex(record.tier);
                return (
                  <li key={record.id}>
                    <time dateTime={record.at}>{dateTime(language, record.at)}</time>
                    <span className="club-match-opponent">{`${record.opponent.shortName} · ${record.opponent.name}`}</span>
                    <span className="club-match-line-score">{`${record.score[0]} – ${record.score[1]}`}</span>
                    <span className="club-match-tier">{copy(language, MATCH_TIER_NAME_KEY[tierIndex])}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="club-note">{copy(language, "matchEmpty")}</p>
          )}
        </div>

        <details className="club-new-match club-live-details" open={Boolean(liveSession)}>
          <summary>{copy(language, "liveTitle")}</summary>
        <div className="club-live-panel">
          <div className="club-table-heading">
            <h3>{copy(language, "liveTitle")}</h3>
            <span className="club-muted">{copy(language, "liveParity")}</span>
          </div>
          <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "liveIntro")}</p></details>
          {liveSession ? (
            <>
              {liveBriefing ? (
                <section className="club-briefing" aria-labelledby="club-briefing-title">
                  <div className="club-briefing-head">
                    <div className="club-briefing-opponent">
                      <p className="club-eyebrow">{copy(language, "briefingTitle")}</p>
                      <h4 className="club-briefing-title" id="club-briefing-title">{liveBriefing.opponent.name}</h4>
                      <p className="club-briefing-sub">
                        {`${copy(language, "briefingTactic")}: `}
                        <b>{copy(language, TACTIC_NAME_KEY[liveBriefing.opponent.tactic])}</b>
                      </p>
                    </div>
                    <p className="club-briefing-headline">
                      {briefingText(language, liveBriefing.headline, BRIEFING_HEADLINE_ZH)}
                    </p>
                  </div>
                  <div className="club-briefing-comparison">
                    <div className="club-briefing-compare-head">
                      <span>{copy(language, "briefingCompare")}</span>
                      <span>{`${copy(language, "briefingOurs")} / ${copy(language, "briefingTheirs")}`}</span>
                    </div>
                    {liveBriefing.comparison.map((row) => (
                      <div className={`club-briefing-line is-${row.edge}`} key={row.line}>
                        <b className="club-briefing-line-code">{row.line}</b>
                        <span className="club-briefing-line-track club-briefing-line-ours">
                          <i style={{ width: `${Math.max(0, Math.min(100, row.ours))}%` }} />
                          <em>{row.ours.toFixed(1)}</em>
                        </span>
                        <span className="club-briefing-line-track club-briefing-line-theirs">
                          <i style={{ width: `${Math.max(0, Math.min(100, row.theirs))}%` }} />
                          <em>{row.theirs.toFixed(1)}</em>
                        </span>
                        <span className={`club-briefing-line-diff is-${row.edge}`}>
                          {`${row.diff > 0 ? "+" : ""}${row.diff.toFixed(1)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="club-briefing-notes">
                    <p className={`club-briefing-caution is-${liveBriefing.weakest.edge}`}>
                      <b>{copy(language, "briefingWeakest")}</b>
                      {` ${copy(language, "briefingCaution", liveBriefing.weakest.line, liveBriefing.weakest.ours.toFixed(1), liveBriefing.weakest.theirs.toFixed(1))}`}
                    </p>
                    <p className="club-briefing-suggest">
                      <b>{copy(language, "briefingSuggested")}</b>
                      {` ${copy(language, TACTIC_NAME_KEY[liveBriefing.suggestedTactic])} — `}
                      {briefingText(language, liveBriefing.tacticReason, BRIEFING_REASON_ZH)}
                    </p>
                  </div>
                  <div className="club-briefing-actions">
                    <button
                      type="button"
                      className="club-button club-button-primary"
                      onClick={() => void handleLiveTactic(liveBriefing.suggestedTactic)}
                      disabled={busy || liveSession.home.tactic === liveBriefing.suggestedTactic}
                    >
                      {pendingAction === `live-tactic:${liveBriefing.suggestedTactic}`
                        ? copy(language, "briefingApplying")
                        : liveSession.home.tactic === liveBriefing.suggestedTactic
                          ? copy(language, "briefingAlready")
                          : copy(language, "briefingApply")}
                    </button>
                    <span className="club-muted">
                      {copy(language, "liveTacticChanged", copy(language, TACTIC_NAME_KEY[liveBriefing.suggestedTactic]))}
                    </span>
                  </div>
                </section>
              ) : null}
              <div className="club-live-head">
                <span className="club-pill club-pill-active">{copy(language, "liveBlock", liveSession.block, 18)}</span>
                <span className="club-live-score">
                  {`${liveSession.home.name} ${liveSession.score[0]} – ${liveSession.score[1]} ${liveSession.away.name}`}
                </span>
                <span className="club-muted">
                  {`${copy(language, "liveCurrentTactic")}: ${copy(language, TACTIC_NAME_KEY[liveSession.home.tactic])}`}
                </span>
                <span className="club-muted" data-live-formation>
                  {`${copy(language, "liveCurrentFormation")}: ${liveSession.home.formation ?? club.formation}`}
                </span>
              </div>
              <div className="club-live-progress" aria-hidden="true">
                <i style={{ width: `${Math.round((liveSession.block / 18) * 100)}%` }} />
              </div>
              <div className="club-live-stats">
                <span>
                  {`${copy(language, "livePossession")} ${Math.round(liveSession.possession[0])}% – ${Math.round(liveSession.possession[1])}%`}
                </span>
                <span>
                  {`${copy(language, "liveShots")} ${liveSession.shots[0]} (${liveSession.onTarget[0]}) – ${liveSession.shots[1]} (${liveSession.onTarget[1]})`}
                </span>
              </div>
              <div className="club-live-controls">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleAdvanceLive()}
                  disabled={busy}
                >
                  {pendingAction === "live-advance" ? copy(language, "liveAdvancing") : copy(language, "liveNextBlock")}
                </button>
                <label className="club-field club-field-inline club-live-tactic">
                  <span>{copy(language, "liveCurrentTactic")}</span>
                  <select
                    value={liveSession.home.tactic}
                    onChange={(event) => void handleLiveTactic(event.target.value as ClubTactic)}
                    disabled={busy}
                  >
                    {CLUB_TACTICS.map((tactic) => (
                      <option key={tactic} value={tactic}>
                        {copy(language, TACTIC_NAME_KEY[tactic])}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="club-field club-field-inline club-live-formation">
                  <span>{copy(language, "liveCurrentFormation")}</span>
                  <select
                    value={(liveSession.home.formation ?? club.formation) as ClubFormation}
                    onChange={(event) => void handleLiveFormation(event.target.value as ClubFormation)}
                    disabled={busy}
                    data-live-formation-select
                  >
                    {(Object.keys(CLUB_FORMATIONS) as ClubFormation[]).map((formation) => (
                      <option key={formation} value={formation}>
                        {formation}
                      </option>
                    ))}
                  </select>
                </label>
                {confirmingAbandonLive ? (
                  <span className="club-live-abandon-confirm">
                    <button
                      type="button"
                      className="club-button club-button-secondary"
                      onClick={() => void handleAbandonLive()}
                      disabled={busy}
                    >
                      {pendingAction === "live-abandon"
                        ? copy(language, "liveAbandoning")
                        : copy(language, "liveAbandonConfirmAction")}
                    </button>
                    <button
                      type="button"
                      className="club-button club-button-secondary"
                      onClick={() => setConfirmingAbandonLive(false)}
                      disabled={busy}
                    >
                      {copy(language, "liveCancel")}
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className="club-button club-button-secondary"
                    onClick={() => setConfirmingAbandonLive(true)}
                    disabled={busy}
                  >
                    {copy(language, "liveAbandon")}
                  </button>
                )}
              </div>
              <p className="club-live-formation-announcement" role="status" aria-live="polite">
                {liveFormationAnnouncement}
              </p>
              <div className="club-live-subs">
                <div className="club-live-subs-head">
                  <h4 className="club-subheading">{copy(language, "liveSubsTitle")}</h4>
                  <span className="club-pill">{copy(language, "liveSubsCounter", liveSubsUsed, 5)}</span>
                </div>
                <div className="club-live-subs-grid">
                  <label className="club-field club-live-sub-field">
                    <span>{copy(language, "liveSubOutLabel")}</span>
                    <select
                      value={effectiveSubOutId}
                      onChange={(event) => setSubOutId(event.target.value)}
                      disabled={busy || liveStarterPlayers.length === 0}
                    >
                      {liveStarterPlayers.map((player) => (
                        <option key={player.id} value={player.id}>
                          {`${player.name} · ${player.position}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="club-field club-live-sub-field">
                    <span>{copy(language, "liveSubInLabel")}</span>
                    <select
                      value={effectiveSubInId}
                      onChange={(event) => setSubInId(event.target.value)}
                      disabled={busy || compatibleSubBench.length === 0}
                    >
                      {compatibleSubBench.map((player) => (
                        <option key={player.id} value={player.id}>
                          {`${player.name} · ${player.position}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="club-button club-button-secondary club-live-sub-button"
                    onClick={() => void handleLiveSub()}
                    disabled={busy || liveSubBlockedReason !== null}
                  >
                    {pendingAction === "live-sub" ? copy(language, "liveSubBusy") : copy(language, "liveSubButton")}
                  </button>
                </div>
                {liveSubBlockedReason ? <p className="club-note club-live-sub-reason">{liveSubBlockedReason}</p> : null}
              </div>
              <div className="club-live-events" ref={liveEventsRef}>
                <h4 className="club-subheading">{copy(language, "liveEvents")}</h4>
                {liveSession.events.length ? (
                  <ol className="club-replay-events">
                    {liveSession.events.map((event, index) => {
                      const latest = index === liveSession.events.length - 1;
                      return (
                        <li
                          key={`${event.minute}:${event.side}:${event.kind}:${index}`}
                          className={`club-replay-comment${latest ? " is-current" : ""}`}
                        >
                          <span className="club-replay-comment-minute">{`${event.minute}'`}</span>
                          <span className={`club-replay-comment-kind is-${event.kind}`}>
                            {copy(language, replayKindKey(event.kind))}
                          </span>
                          <span className="club-replay-comment-body">
                            <b>{event.side === "home" ? liveSession.home.name : liveSession.away.name}</b>
                            {event.kind === "sub"
                              ? ` · ${event.out ?? "—"} → ${event.scorer ?? "—"}`
                              : event.scorer
                                ? ` · ${event.scorer}`
                                : ""}
                            {event.label && event.kind !== "goal" && event.kind !== "sub" ? ` · ${event.label}` : ""}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="club-note">{copy(language, "liveNoEvents")}</p>
                )}
              </div>
            </>
          ) : (
            <>
              {liveFinished ? (
                <div className="club-live-finished" role="status" aria-live="polite">
                  <b>{copy(language, "liveFinishedTitle")}</b>
                  <span>
                    {copy(
                      language,
                      "liveFinalScore",
                      liveFinished.home,
                      liveFinished.score[0],
                      liveFinished.score[1],
                      liveFinished.opponent,
                    )}
                  </span>
                  <a
                    className="club-button club-button-secondary"
                    href="#club-match"
                    onClick={(event) => handleBaseNav(event, "club-match")}
                  >
                    {copy(language, "liveViewResult")}
                  </a>
                </div>
              ) : null}
              <fieldset className="club-league-tiers" disabled={busy}>
                <legend>{copy(language, "liveTierLabel")}</legend>
                <div className="club-match-tiers">
                  {([0, 1, 2, 3] as const).map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      className={`club-tier-button${liveTier === tier ? " is-selected" : ""}`}
                      aria-pressed={liveTier === tier}
                      onClick={() => setLiveTier(tier)}
                    >
                      <b>{copy(language, MATCH_TIER_NAME_KEY[tier])}</b>
                      <small className="club-tier-hint">{copy(language, MATCH_TIER_DESC_KEY[tier])}</small>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="club-match-actions">
                <button
                  type="button"
                  className="club-button club-button-primary"
                  onClick={() => void handleStartLive(liveTier)}
                  disabled={busy}
                >
                  {pendingAction?.startsWith("live-start")
                    ? copy(language, "liveStarting")
                    : copy(language, "liveStart")}
                </button>
                <span className="club-note">{copy(language, "liveQuickSimNote")}</span>
              </div>
            </>
          )}
          <p className="club-live-live" role="status" aria-live="polite">
            {liveAnnouncement}
          </p>
        </div>
        </details>
      </div>
    </section>
  ) : null;

  const decorSection = mode === "club" && club ? (
    <section className="club-section" id="club-decor" aria-labelledby="club-decor-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "decorUnlockedCount", decorSummaryData.unlocked, decorSummaryData.total)}</p>
          <h2 id="club-decor-heading">{copy(language, "decorTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "decorIntro")}</p></details>
      </div>
      <div className="club-panel club-decor-panel">
        <div className="club-decor-groups">
          {(["pitch", "stands", "lights"] as DecorKind[]).map((kind) => (
            <div className="club-decor-group" key={kind}>
              <h3>{copy(language, DECOR_KIND_KEY[kind])}</h3>
              <ul className="club-decor-list">
                {decorList
                  .filter((option) => option.kind === kind)
                  .map((option) => {
                    const label = language === "zh" ? option.nameZh : option.name;
                    const description = language === "zh" ? option.descriptionZh : option.description;
                    const reason = decorUnlockReason(option);
                    const pending = pendingAction === `decor:${option.id}`;
                    const swatchStyle: CSSProperties | undefined =
                      kind === "stands"
                        ? option.id === "stands.home"
                          ? { background: `linear-gradient(90deg, ${club.colours.primary} 0 50%, ${club.colours.secondary} 50% 100%)` }
                          : option.id === "stands.gold"
                            ? { background: "linear-gradient(90deg, #f4c445 0 50%, #8a5a1f 50% 100%)" }
                            : { background: "linear-gradient(90deg, #5b6b80 0 50%, #8fa0b5 50% 100%)" }
                        : kind === "lights"
                          ? { background: option.id === "lights.warm" ? "#ffd7a1" : option.id === "lights.cool" ? "#cfe6ff" : "#ffffff" }
                          : undefined;
                    return (
                      <li
                        key={option.id}
                        className={`club-decor-option${option.selected ? " is-selected" : ""}${option.unlocked ? "" : " is-locked"}`}
                        data-decor-id={option.id}
                        data-decor-kind={option.kind}
                        data-decor-unlocked={option.unlocked ? "true" : "false"}
                        data-decor-selected={option.selected ? "true" : "false"}
                      >
                        <span
                          className={`club-decor-swatch is-${kind} is-${option.id.split(".")[1]}`}
                          style={swatchStyle}
                          aria-hidden="true"
                        />
                        <span className="club-decor-copy">
                          <b>{label}</b>
                          <span>{description}</span>
                          {!option.unlocked ? (
                            <small className="club-decor-lock" data-decor-reason={reason}>{reason}</small>
                          ) : null}
                        </span>
                        {option.unlocked ? (
                          <button
                            type="button"
                            className={`club-button ${option.selected ? "club-button-secondary" : "club-button-primary"} club-decor-button`}
                            onClick={() => void handleDecorSelect(option)}
                            disabled={busy || option.selected}
                          >
                            {option.selected ? copy(language, "decorInUse") : pending ? copy(language, "decorUse") : copy(language, "decorUse")}
                          </button>
                        ) : (
                          <span className="club-decor-locked-pill">{copy(language, "decorLocked")}</span>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </div>
        <p className="club-visually-hidden" role="status" aria-live="polite">{decorAnnouncement}</p>
      </div>
    </section>
  ) : null;

  const balance = useMemo(() => {
    const daily = dailyIncome(PLAN_EXAMPLE_DAY);
    const weekly = weeklyPlan();
    const goals = weeklyGoalProgress(weekly.weeklyFunds);
    const summary = balanceSummary();
    return { daily, weekly, goals, summary };
  }, []);
  const balanceGoalLabels: Record<string, CopyKey> = {
    trainingPoint: "balanceGoalTraining",
    tacticLevel1: "balanceGoalTactic",
    facilityUpgrade: "balanceGoalFacility",
    signing65Ovr: "balanceGoalSigning",
    stadiumL2: "balanceGoalStadium",
  };
  const balanceSection = mode === "club" && club ? (
    <section className="club-section club-balance-section" id="club-balance" aria-labelledby="club-balance-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "balanceTitle")}</p>
          <h2 id="club-balance-heading">{copy(language, "balanceTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "balancePace")}</p></details>
      </div>
      <div
        className="club-panel club-balance-panel"
        data-balance-daily-xp={balance.daily.xp}
        data-balance-daily-funds={balance.daily.totalFunds}
        data-balance-weekly-funds={balance.summary.weeklyFunds}
        data-balance-weekly-xp={balance.weekly.weeklyXp}
        data-balance-days-1000={balance.summary.daysTo1000}
        data-balance-days-signing={balance.summary.daysToSigning}
      >
        <p className="club-balance-pace" role="note">{copy(language, "balancePace")}</p>
        <div className="club-balance-grid">
          <section className="club-balance-group" aria-labelledby="club-balance-daily-heading">
            <h3 id="club-balance-daily-heading">{copy(language, "balanceDailyTitle")}</h3>
            <div className="club-balance-meters">
              <BalanceMeter label={copy(language, "balanceXp")} value={balance.daily.xp} max={Math.max(balance.daily.xp, balance.daily.totalFunds)} display={`${balance.daily.xp}`} unit="XP" />
              <BalanceMeter label={copy(language, "balanceFunds")} value={balance.daily.totalFunds} max={Math.max(balance.daily.xp, balance.daily.totalFunds)} display={`${balance.daily.totalFunds}`} unit="FC" />
            </div>
          </section>
          <section className="club-balance-group" aria-labelledby="club-balance-weekly-heading">
            <h3 id="club-balance-weekly-heading">{copy(language, "balanceWeeklyTitle")}</h3>
            <div className="club-balance-meters">
              <BalanceMeter label={copy(language, "balanceFunds")} value={balance.weekly.weeklyFunds} max={balance.weekly.weeklyFunds} display={`${balance.weekly.weeklyFunds}`} unit="FC" />
              <BalanceMeter label={copy(language, "balanceXp")} value={balance.weekly.weeklyXp} max={balance.weekly.weeklyFunds} display={`${balance.weekly.weeklyXp}`} unit="XP" />
            </div>
          </section>
          <section className="club-balance-group club-balance-days" aria-labelledby="club-balance-days-heading">
            <h3 id="club-balance-days-heading">{copy(language, "balanceDaysTitle")}</h3>
            <div className="club-balance-stat-row">
              <div className="club-balance-stat"><b>{balance.summary.daysTo1000}</b><span>{copy(language, "balanceDays1000")}</span></div>
              <div className="club-balance-stat"><b>{balance.summary.daysToSigning}</b><span>{copy(language, "balanceDaysSigning")}</span></div>
            </div>
          </section>
        </div>
        <section className="club-balance-goals" aria-labelledby="club-balance-goals-heading">
          <h3 id="club-balance-goals-heading">{copy(language, "balanceGoalsTitle")}</h3>
          <div className="club-balance-goal-list">
            {balance.goals.map((goal) => (
              <div className="club-balance-goal" key={goal.goal} data-balance-goal={goal.goal} data-balance-cost={goal.cost} data-balance-weeks={goal.weeks} data-balance-affordable={goal.affordable}>
                <span className="club-balance-goal-label">{copy(language, balanceGoalLabels[goal.goal] ?? "balanceGoalsTitle")}</span>
                <span className="club-balance-goal-bar" role="img" aria-label={`${copy(language, balanceGoalLabels[goal.goal] ?? "balanceGoalsTitle")} ${goal.cost} FC · ${goal.weeks} weeks`}>
                  <i style={{ width: `${Math.min(100, (goal.cost / Math.max(1, balance.weekly.weeklyFunds)) * 100)}%` }} className={goal.affordable ? "is-affordable" : "is-short"} />
                </span>
                <b>{`${goal.cost} FC`}</b>
                <span className={`club-balance-weeks${goal.affordable ? " is-ok" : ""}`}>
                  {goal.affordable ? copy(language, "balanceAffordable") : copy(language, "balanceNotAffordable", goal.weeks)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  ) : null;

  const exportSection = mode === "club" && club ? (
    <section className="club-section club-export-section" id="club-export" aria-labelledby="club-export-heading">
      <div className="club-section-head">
        <div>
          <p className="club-eyebrow">{copy(language, "exportTitle")}</p>
          <h2 id="club-export-heading">{copy(language, "exportTitle")}</h2>
        </div>
        <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "exportIntro")}</p></details>
      </div>
      <div className="club-panel club-export-panel">
        <div className="club-export-actions">
          <button
            type="button"
            className="club-button club-button-primary"
            onClick={handleExportClubSummary}
            aria-label={copy(language, "exportAria")}
            data-export-button
          >
            {copy(language, "exportButton")}
          </button>
          <span className="club-note">{copy(language, "exportButton")} · JSON + MD</span>
        </div>
        <p className="club-export-announcement" role="status" aria-live="polite">{exportAnnouncement}</p>
      </div>
    </section>
  ) : null;

  const overviewSection = mode === "club" ? (
    <div className="club-overview">
      {onboardingVisible ? (
        <section className="club-onboarding" role="region" aria-labelledby="club-onboarding-title" data-onboarding>
          <div className="club-onboarding-head">
            <div>
              <p className="club-eyebrow">{copy(language, "onboardingTitle")}</p>
              <h2 id="club-onboarding-title">{copy(language, "onboardingTitle")}</h2>
            </div>
            <button
              type="button"
              className="club-onboarding-skip"
              onClick={() => finishOnboarding("onboardingSkipped")}
              aria-label={copy(language, "onboardingSkip")}
            >
              {copy(language, "onboardingSkip")}
            </button>
          </div>
          <ol className="club-onboarding-steps">
            {[
              ["onboardingStep1Title", "onboardingStep1Body"],
              ["onboardingStep2Title", "onboardingStep2Body"],
              ["onboardingStep3Title", "onboardingStep3Body"],
            ].map(([titleKey, bodyKey], index) => (
              <li
                key={titleKey}
                className={`club-onboarding-step${index === onboardingStep ? " is-current" : ""}${index < onboardingStep ? " is-done" : ""}`}
              >
                <b className="club-onboarding-index">{index + 1}</b>
                <div>
                  <strong>{copy(language, titleKey as CopyKey)}</strong>
                  <span>{copy(language, bodyKey as CopyKey)}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="club-onboarding-actions">
            <span className="club-pill">{copy(language, "onboardingStep", onboardingStep + 1)}</span>
            <button type="button" className="club-button club-button-primary" onClick={handleOnboardingNext}>
              {onboardingStep >= 2 ? copy(language, "onboardingFinish") : copy(language, "onboardingNext")}
            </button>
          </div>
          <p className="club-visually-hidden" role="status" aria-live="polite">{onboardingAnnouncement}</p>
        </section>
      ) : null}
      <section className="club-panel club-overview-card" aria-labelledby="club-overview-heading">
        <div className="club-overview-identity">
          {crest ? <ClubCrestSvg crest={crest} size={72} className="club-overview-crest" /> : null}
          <div className="club-overview-copy">
            <p className="club-eyebrow">{copy(language, "overviewTitle")}</p>
            <h2 id="club-overview-heading">{preview.identity.name}</h2>
            <p className="club-overview-sub">
              {`${preview.identity.shortName} · ${preview.identity.city}`}
              {overviewSummary ? ` · ${overviewSummary.detail}` : ""}
            </p>
            <div className="club-overview-chips">
              <span>{`${translate(language, "Level")} ${clubLevel}`}</span>
              <span>{`${funds} FC`}</span>
              <span>{preview.formation}</span>
              <span>{club ? copy(language, TACTIC_NAME_KEY[club.tactics.active]) : ""}</span>
            </div>
          </div>
        </div>
        <div className="club-overview-diagrams">
          <figure className="club-diagram-figure">
            <RadarDiagram ratings={preview.ratings} label={copy(language, "radarLabel")} />
            <figcaption>{copy(language, "radarLabel")}</figcaption>
          </figure>
          <figure className="club-diagram-figure">
            <BudgetRing pct={overviewBudget.pct} funds={funds} label={copy(language, "budgetLabel")} />
            <figcaption>{copy(language, "budgetLabel")}</figcaption>
          </figure>
          <div className="club-overview-pips">
            <span className="club-pips-group">
              <Pips filled={levelPips(clubLevel, 5).filled} total={levelPips(clubLevel, 5).total} label={copy(language, "levelLabel")} kind="level" />
              <small>{copy(language, "levelLabel")}</small>
            </span>
            <span className="club-pips-group">
              <Pips filled={trophyPips(club?.trophies?.length ?? 0, 5).filled} total={trophyPips(club?.trophies?.length ?? 0, 5).total} label={copy(language, "trophyLabel")} kind="trophy" />
              <small>{copy(language, "trophyLabel")}</small>
            </span>
            <span className="club-overview-formation">
              <FormationDiagram formation={club?.formation ?? preview.formation} label={copy(language, "formationLabel")} />
              <small>{copy(language, "formationLabel")}</small>
            </span>
          </div>
        </div>
      </section>

      {clubCondition ? (
        <section className="club-overview-condition-strip" aria-label={copy(language, "conditionTitle")}>
          <span className="club-overview-condition-label">{copy(language, "conditionTitle")}</span>
          <ConditionDiagram
            report={clubCondition}
            label={copy(language, "conditionOverviewLabel", clubCondition.available, clubCondition.injured, clubCondition.tired, clubCondition.startersAvgFitness)}
          />
          <span className="club-overview-condition-legend">
            <span className="is-available"><i aria-hidden="true" />{`${clubCondition.available} ${copy(language, "conditionAvailable")}`}</span>
            <span className="is-injured"><i aria-hidden="true" />{`${clubCondition.injured} ${copy(language, "conditionInjured")}`}</span>
            <span className="is-tired"><i aria-hidden="true" />{`${clubCondition.tired} ${copy(language, "conditionTired")}`}</span>
          </span>
          <span className="club-overview-condition-avg">{copy(language, "conditionStarterAvg", clubCondition.startersAvgFitness)}</span>
        </section>
      ) : null}

      <section className="club-overview-actions" aria-labelledby="club-overview-next-heading">
        <div className="club-overview-actions-head">
          <h3 id="club-overview-next-heading">{copy(language, "overviewNext")}</h3>
          <button
            type="button"
            className="club-onboarding-replay"
            aria-label={copy(language, "onboardingReplay")}
            title={copy(language, "onboardingReplay")}
            onClick={handleOnboardingReplay}
            data-onboarding-replay
          >
            ?
          </button>
        </div>
        <div className="club-overview-action-grid">
          {overviewActions.map((action, index) => {
            const anchor = action.href.includes("#") ? action.href.split("#")[1] : "";
            return (
              <button
                key={action.id}
                type="button"
                className={`club-action-card${action.urgent ? " is-urgent" : ""}`}
                data-action-id={action.id}
                data-action-anchor={anchor}
                onClick={() => anchor && openClubSection(anchor)}
              >
                <span className="club-action-index">{String(index + 1).padStart(2, "0")}</span>
                <b>{language === "zh" ? action.titleZh : action.title}</b>
                <span>{language === "zh" ? action.detailZh : action.detail}</span>
                <em>{copy(language, "overviewContinue")} →</em>
              </button>
            );
          })}
        </div>
      </section>

      <div className="club-overview-split">
        <section className="club-panel club-overview-latest" aria-labelledby="club-overview-latest-heading">
          <h3 id="club-overview-latest-heading">{copy(language, "overviewLatest")}</h3>
          {latestMatch ? (
            <>
              <div className="club-overview-score">
                <span>{club?.name ?? preview.identity.name}</span>
                <b>{`${latestMatch.score[0]} – ${latestMatch.score[1]}`}</b>
                <span>{latestMatch.opponent.name}</span>
              </div>
              <p className="club-overview-meta">{`${copy(language, MATCH_TIER_NAME_KEY[matchTierIndex(latestMatch.tier)])} · ${dateTime(language, latestMatch.at)}`}</p>
              {(() => {
                const bars = compareBars(latestMatch.possession[0], latestMatch.possession[1], 100);
                return (
                  <div className="club-overview-possession" role="img" aria-label={`${copy(language, "matchPossession")} ${Math.round(latestMatch.possession[0])}% – ${Math.round(latestMatch.possession[1])}%`}>
                    <i style={{ width: `${bars.oursPct}%` }} />
                    <i style={{ width: `${bars.theirsPct}%` }} />
                  </div>
                );
              })()}
              <button type="button" className="club-button club-button-secondary" onClick={() => openClubSection("club-match")}>
                {copy(language, "overviewViewMatch")}
              </button>
            </>
          ) : (
            <p className="club-overview-meta">{copy(language, "overviewNoMatch")}</p>
          )}
        </section>
        <section className="club-panel club-overview-quick" aria-labelledby="club-overview-quick-heading">
          <h3 id="club-overview-quick-heading">{copy(language, "overviewQuick")}</h3>
          <div className="club-quick-grid">
            <button type="button" onClick={() => openClubSection("club-squad")}>{copy(language, "overviewQuickSquad")}</button>
            <button type="button" onClick={() => openClubSection("club-tactics")}>{copy(language, "overviewQuickTactics")}</button>
            <button type="button" onClick={() => openClubSection("club-transfers")}>{copy(language, "overviewQuickTransfers")}</button>
            <button type="button" onClick={() => openClubSection("club-league")}>{copy(language, "overviewQuickLeague")}</button>
          </div>
        </section>
      </div>

      <section className="club-overview-stats" aria-label={copy(language, "overviewStats")}>
        <div><b>{club?.players.length ?? preview.squad.length}</b><span>{copy(language, "overviewPlayers")}</span></div>
        <div><b>{club?.trophies?.length ?? 0}</b><span>{copy(language, "overviewTrophies")}</span></div>
        <div><b>{club?.history?.length ?? 0}</b><span>{copy(language, "overviewSeasons")}</span></div>
      </section>
    </div>
  ) : null;

  return (
    <div className="club-page" lang={pageLangTag}>
      {mode !== "club" ? (
      <header className="club-topbar">
        <Link className="club-back-link" href="/">
          {`← ${copy(language, "backToPlanner")}`}
        </Link>
        <p className="club-topbar-meta">{topbarMeta}</p>
      </header>
      ) : null}

      <div className="club-shell">
        {mode === "club" && club ? (
          <header className="club-compact-bar">
            <div className="club-compact-brand">
              {crest ? <ClubCrestSvg crest={crest} size={34} className="club-compact-crest" /> : null}
              <div className="club-compact-name">
                <b>{club.name}</b>
                <small>{club.shortName}</small>
              </div>
              <span className="club-compact-stat">{`Lv ${clubLevel}`}</span>
              <span className="club-compact-stat">{`${funds} FC`}</span>
            </div>
            <div className="club-compact-actions">
              <Link href="/">{copy(language, "backToPlanner")}</Link>
              <a href="/club/base">{language === "zh" ? "基地总览" : "Base overview"}</a>
            </div>
            <nav className="club-compact-tabs" role="tablist" aria-label={copy(language, "tabAria")}>
              {CLUB_TABS.map((tab, index) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`club-tab-${tab.id}`}
                  className={`club-tab${clubTab === tab.id ? " is-selected" : ""}`}
                  aria-selected={clubTab === tab.id}
                  aria-controls={`club-tabpanel-${tab.id}`}
                  tabIndex={clubTab === tab.id ? 0 : -1}
                  onClick={() => selectClubTab(tab.id)}
                  onKeyDown={(event) => handleTabKeyDown(event, index)}
                >
                  {copy(language, tab.label)}
                </button>
              ))}
            </nav>
          </header>
        ) : null}
        {mode !== "club" ? (
        <header className="club-header">
          <div className="club-topline">
            <p className="club-eyebrow">{copy(language, "eyebrow")}</p>
            <div className="club-badges">
              {mode === "create" ? (
                <span className="club-badge club-badge-live">{copy(language, "interactiveBadge")}</span>
              ) : (
                <span className="club-badge club-badge-readonly">{copy(language, "badgeReadonly")}</span>
              )}
              <span
                className={`club-badge ${
                  mode === "create"
                    ? "club-badge-live"
                    : mode === "sample"
                      ? "club-badge-sample"
                      : "club-badge-loading"
                }`}
              >
                {sourceLabel}
              </span>
            </div>
          </div>
          <h1 className="club-title">{copy(language, "title")}</h1>
          <p className="club-title-alt" lang={alternativeLangTag}>
            {COPY.title[alternativeLanguage]}
          </p>
          <p className="club-short-sub">{copy(language, "shortSubtitle")}</p>
          <details className="club-header-details">
            <summary>{copy(language, "dataDetails")}</summary>
            <p className={`club-source${mode === "sample" ? " is-sample" : ""}`} aria-live="polite">
              <span className="club-source-label">{`${copy(language, "dataSourceTitle")}:`}</span>
              <span>{sourceBody}</span>
            </p>
            <p className="club-lede">{copy(language, "lede")}</p>
          </details>
          {mode === "create" ? (
            <div className="club-wallet club-wallet-compact" aria-label={copy(language, "walletFunds")}>
              <b>{`${funds} FC · Lv ${clubLevel} · ${clubXp} XP`}</b>
            </div>
          ) : null}
        </header>
        ) : null}

        <div
          className={`club-flash${feedback ? ` club-flash-${feedback.kind}` : ""}`}
          role="status"
          aria-live="polite"
        >
          {feedback?.text}
        </div>

        {mode === "sample" || mode === "loading" ? (
          <nav className="club-tabbar" role="tablist" aria-label={copy(language, "tabAria")}>
            {CLUB_TABS.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`club-tab-${tab.id}`}
                className={`club-tab${clubTab === tab.id ? " is-selected" : ""}`}
                aria-selected={clubTab === tab.id}
                aria-controls={`club-tabpanel-${tab.id}`}
                tabIndex={clubTab === tab.id ? 0 : -1}
                onClick={() => selectClubTab(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, index)}
              >
                {copy(language, tab.label)}
              </button>
            ))}
          </nav>
        ) : null}

        <main className="club-main">
          {mode === "create" ? (
            createSection
          ) : (
            <>
          <div
            className="club-tabpanel"
            role="tabpanel"
            id={`club-tabpanel-${clubTab}`}
            aria-labelledby={`club-tab-${clubTab}`}
            tabIndex={0}
          >
          {clubTab === "overview" ? overviewSection : null}
          {/* 1 · club card */}
          {mode !== "club" || clubTab === "club" ? (
          <section className="club-section" id="club-card" aria-labelledby="club-card-heading">
            <div className="club-section-head">
              <div>
                <p className="club-eyebrow">{`${translate(language, "Club")} · ${translate(language, "Level")}`}</p>
                <h2 id="club-card-heading">{copy(language, "clubCardTitle")}</h2>
              </div>
              <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "clubCardIntro")}</p></details>
            </div>

            <div
              className={`club-panel club-card${selectedFrameOption ? " has-frame" : ""}${selectedBackdropOption ? " has-backdrop" : ""}`}
              data-frame={selectedFrameOption?.id}
              data-backdrop={selectedBackdropOption?.id}
              style={
                {
                  ...(selectedFrameOption ? { borderColor: selectedFrameOption.colours[0] } : {}),
                  ...(selectedBackdropOption
                    ? {
                        "--club-display-a": selectedBackdropOption.colours[0],
                        "--club-display-b": selectedBackdropOption.colours[1],
                      }
                    : {}),
                } as CSSProperties
              }
            >
              {selectedKit ? (
                <div className="club-card-kit" data-kit-id={selectedKit.id} data-kit-kind={selectedKit.kind}>
                  <span className="club-card-kit-swatches" aria-hidden="true">
                    <i style={{ background: selectedKit.colours[0] }} />
                    <i style={{ background: selectedKit.colours[1] }} />
                  </span>
                  <span className="club-card-kit-copy">
                    <b>{kitDisplayName(language, selectedKit)}</b>
                    <small>{copy(language, "displayKitSelectedLabel")}</small>
                  </span>
                </div>
              ) : null}
              <div className="club-card-left">
                <div className="club-identity">
                  {crest ? (
                    <ClubCrestSvg crest={crest} size={54} className="club-card-crest" />
                  ) : (
                    <span
                      className="club-crest"
                      style={{ background: preview.identity.crest.primary, color: preview.identity.crest.secondary }}
                      aria-hidden="true"
                    >
                      {preview.identity.shortName}
                    </span>
                  )}
                  <div className="club-identity-copy">
                    <h3 className="club-name">{preview.identity.name}</h3>
                    <p className="club-subname">
                      {`${preview.identity.shortName} · ${preview.identity.city}`}
                    </p>
                    <p className="club-formation-line">
                      <span className="club-formation-badge">{preview.formation}</span>
                      <span className="club-none">{copy(language, "currentFormation")}</span>
                    </p>
                  </div>
                </div>

                <dl className="club-facts">
                  <div className="club-fact">
                    <dt>{translate(language, "Level")}</dt>
                    <dd>{preview.level}</dd>
                  </div>
                  <div className="club-fact">
                    <dt>{translate(language, "XP")}</dt>
                    <dd>{preview.xp}</dd>
                  </div>
                  <div className="club-fact club-fact-wide">
                    <dt>{copy(language, "kitColours")}</dt>
                    <dd>
                      <span className="club-kit-list">
                        <span className="club-kit">
                          <i className="club-swatch" style={{ background: preview.identity.homeKit }} aria-hidden="true" />
                          <span>{copy(language, "homeKit")}</span>
                          <code>{preview.identity.homeKit}</code>
                        </span>
                        <span className="club-kit">
                          <i className="club-swatch" style={{ background: preview.identity.awayKit }} aria-hidden="true" />
                          <span>{copy(language, "awayKit")}</span>
                          <code>{preview.identity.awayKit}</code>
                        </span>
                      </span>
                    </dd>
                  </div>
                </dl>

                <div className="club-progress">
                  <div className="club-progress-head">
                    <span>{copy(language, "progressToNext")}</span>
                    <span>{copy(language, "nextLevel", xpToNext, preview.level + 1)}</span>
                  </div>
                  <div
                    className="club-progress-track"
                    role="progressbar"
                    aria-label={copy(language, "progressToNext")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={xpInLevel}
                  >
                    <i style={{ width: `${xpInLevel}%` }} />
                  </div>
                </div>
              </div>

              <div className="club-ratings">
                <div className="club-rating-grid">
                  {ratingTiles.map((tile) => (
                    <div
                      className={`club-rating${tile.code === "OVR" ? " club-rating-overall" : ""}`}
                      key={tile.code}
                    >
                      <span className="club-rating-code">{tile.code}</span>
                      {tile.code === "OVR" ? null : <span className="club-rating-label">{tile.label}</span>}
                      <b className="club-rating-value">{tile.value.toFixed(1)}</b>
                      {tile.code === "OVR" ? <span className="club-rating-label">{tile.label}</span> : null}
                      <span className="club-rating-track" aria-hidden="true">
                        <i style={{ width: `${Math.max(0, Math.min(100, tile.value))}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
                <p className="club-formula">{copy(language, "formula")}</p>
              </div>

              <div className="club-card-foot">
                <div className="club-foot-block">
                  <h4>{copy(language, "formationOptions")}</h4>
                  <ul className="club-formations">
                    {FORMATION_OPTIONS.map((option) => (
                      <li
                        key={option}
                        className={option === preview.formation ? "is-current" : undefined}
                        aria-current={option === preview.formation ? "true" : undefined}
                      >
                        <span>{option}</span>
                        {option === preview.formation ? <small>{copy(language, "current")}</small> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="club-foot-block">
                  <h4>{copy(language, "facilitiesTitle")}</h4>
                  <ul className="club-facilities">
                    <li>
                      <span>{copy(language, "trainingCentre")}</span>
                      <b>{`Lv ${preview.facilities.trainingCentre}`}</b>
                    </li>
                    <li>
                      <span>{copy(language, "scoutCentre")}</span>
                      <b>{`Lv ${preview.facilities.scoutCentre}`}</b>
                    </li>
                    <li>
                      <span>{copy(language, "stadium")}</span>
                      <b>{`Lv ${preview.facilities.stadium}`}</b>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {displayPlan ? (
              <div className="club-panel club-display-panel" aria-live="polite">
                <div className="club-display-head">
                  <div>
                    <p className="club-eyebrow">{copy(language, "displayTitle")}</p>
                    <p className="club-display-legacy">{copy(language, "displayLegacyNote")}</p>
                  </div>
                  <span className="club-muted club-display-credits">
                    {copy(language, "displayCredits", displayPlan.availableCredits)}
                  </span>
                </div>
                <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "displayIntro")}</p></details>
                {!displayHasAnyOwned ? (
                  <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note club-display-empty">{copy(language, "displayNoRights")}</p></details>
                ) : null}
                {(["frame", "backdrop"] as DisplayKind[]).map((kind) => {
                  const options = displayPlan.options.filter((option) => option.kind === kind);
                  const current = options.find((option) => option.selected) ?? null;
                  const clearing = pendingAction === `display:${kind}:none`;
                  return (
                    <div className="club-display-group" key={kind}>
                      <div className="club-display-group-head">
                        <h4 className="club-subheading">
                          {copy(language, kind === "frame" ? "displayFrames" : "displayBackdrops")}
                        </h4>
                        {current ? (
                          <button
                            type="button"
                            className="club-button club-button-secondary club-display-clear"
                            onClick={() => void handleDisplay(kind, "none")}
                            disabled={busy}
                          >
                            {clearing
                              ? copy(language, "displayClearing")
                              : copy(language, kind === "frame" ? "displayClearFrame" : "displayClearBackdrop")}
                          </button>
                        ) : null}
                      </div>
                      <ul className="club-display-options">
                        {options.map((option) => {
                          const info = DISPLAY_OPTION_COPY[option.id];
                          const applying = pendingAction === `display:${kind}:${option.id}`;
                          return (
                            <li
                              key={option.id}
                              className={`club-display-option${option.selected ? " is-selected" : ""}${option.owned ? "" : " is-locked"}`}
                              data-display-id={option.id}
                              data-kind={kind}
                              data-owned={option.owned}
                              data-selected={option.selected}
                            >
                              <span
                                className={`club-display-swatch is-${kind}`}
                                style={{
                                  borderColor: option.colours[0],
                                  background: `linear-gradient(135deg, ${option.colours[0]}, ${option.colours[1]})`,
                                }}
                                aria-hidden="true"
                              />
                              <span className="club-display-copy">
                                <b>{info ? copy(language, info.name) : option.name}</b>
                                <small>{info ? copy(language, info.description) : option.description}</small>
                              </span>
                              <button
                                type="button"
                                className={`club-button club-button-secondary club-display-button${option.selected ? " is-selected" : ""}`}
                                onClick={() => void handleDisplay(kind, option.id)}
                                disabled={busy || !option.owned || option.selected}
                              >
                                {option.selected
                                  ? copy(language, "displaySelected")
                                  : option.owned
                                    ? applying
                                      ? copy(language, "displayApplying")
                                      : copy(language, "displayUse")
                                    : copy(language, "displayUnowned")}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                <div className="club-display-group club-display-kit-group">
                  <div className="club-display-group-head">
                    <h4 className="club-subheading">{copy(language, "displayKits")}</h4>
                    {selectedKit ? (
                      <button
                        type="button"
                        className="club-button club-button-secondary club-display-clear"
                        onClick={() => void handleDisplay("kit", "none")}
                        disabled={busy}
                      >
                        {pendingAction === "display:kit:none"
                          ? copy(language, "displayClearing")
                          : copy(language, "displayKitClear")}
                      </button>
                    ) : null}
                  </div>
                  <ul className="club-display-options club-display-kit-list">
                    {displayPlan.kits.map((kit) => {
                      const applying = pendingAction === `display:kit:${kit.id}`;
                      return (
                        <li
                          key={kit.id}
                          className={`club-display-option${kit.selected ? " is-selected" : ""}${kit.owned ? "" : " is-locked"}`}
                          data-display-id={kit.id}
                          data-kind="kit"
                          data-owned={kit.owned}
                          data-selected={kit.selected}
                          data-kit-kind={kit.kind}
                          data-kit-tier={kit.tier ?? ""}
                        >
                          <span
                            className={`club-display-swatch is-kit${kit.kind !== "base" ? " is-commemorative" : ""}`}
                            style={{
                              borderColor: kit.colours[0],
                              background: `linear-gradient(90deg, ${kit.colours[0]} 0 50%, ${kit.colours[1]} 50% 100%)`,
                            }}
                            aria-hidden="true"
                          />
                          <span className="club-display-copy">
                            <b>{kitDisplayName(language, kit)}</b>
                            <small>
                              {kit.kind === "base"
                                ? copy(language, "displayKitBaseNote")
                                : `${copy(language, kit.kind === "cup" ? "displayKitKindCup" : "displayKitKindLeague")} · ${dateTime(language, kit.at ?? "")}`}
                            </small>
                          </span>
                          <button
                            type="button"
                            className={`club-button club-button-secondary club-display-button${kit.selected ? " is-selected" : ""}`}
                            onClick={() => void handleDisplay("kit", kit.id)}
                            disabled={busy || !kit.owned || kit.selected}
                          >
                            {kit.selected
                              ? copy(language, "displaySelected")
                              : kit.owned
                                ? applying
                                  ? copy(language, "displayApplying")
                                  : copy(language, "displayUse")
                                : copy(language, "displayUnowned")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {displayPlan.kits.every((kit) => kit.kind === "base") ? (
                    <p className="club-note club-display-kit-note">{copy(language, "displayKitNoCommemorative")}</p>
                  ) : null}
                  <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note club-display-kit-legacy">{copy(language, "displayKitLegacyNote")}</p></details>
                </div>
              </div>
            ) : null}
          </section>
          ) : null}

          {clubTab === "club" ? honoursSection : null}
          {clubTab === "match" ? (
            <>
              {matchSection}
              {leagueSection}
              {cupSection}
            </>
          ) : null}

          {clubTab === "team" ? (
            <>
              {lineupSection}
              {trainingSection}
              {tacticsSection}
            </>
          ) : null}
          {clubTab === "club" ? (
            <>
              {balanceSection}
              {exportSection}
              {decorSection}
              {transfersSection}
              {facilitiesSection}
              {migrateSection}
            </>
          ) : null}

          {mode !== "club" || clubTab === "team" ? (
            <>
          {/* 2 · squad */}
          <section className="club-section" id="club-squad" aria-labelledby="club-squad-heading">
            <div className="club-section-head">
              <div>
                <p className="club-eyebrow">
                  {copy(language, "counts", counts.GK, counts.DEF, counts.MID, counts.ATT)}
                </p>
                <h2 id="club-squad-heading">{translate(language, "Squad")}</h2>
              </div>
              <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "squadIntro")}</p></details>
            </div>

            {mode === "club" && club ? (
              <div className="club-squad-toolbar">
                <span className="club-eyebrow">{copy(language, "squadViewLabel")}</span>
                <div className="club-squad-view-toggle" role="group" aria-label={copy(language, "squadViewLabel")}>
                  <button
                    type="button"
                    className={`club-squad-view-button${squadView === "cards" ? " is-selected" : ""}`}
                    aria-pressed={squadView === "cards"}
                    onClick={() => setSquadView("cards")}
                  >
                    {copy(language, "squadCardsView")}
                  </button>
                  <button
                    type="button"
                    className={`club-squad-view-button${squadView === "list" ? " is-selected" : ""}`}
                    aria-pressed={squadView === "list"}
                    onClick={() => setSquadView("list")}
                  >
                    {copy(language, "squadListView")}
                  </button>
                </div>
                {squadView === "cards" ? (
                  <span className="club-muted">{copy(language, "cardsStarterAvg", cardStats.startersAvg)}</span>
                ) : null}
              </div>
            ) : null}

            {squadView === "cards" && mode === "club" && club ? (
              <div className="club-player-cards">
                <div className="club-player-cards-head">
                  {crest ? <ClubCrestSvg crest={crest} size={68} className="club-cards-crest" /> : null}
                  <div className="club-player-cards-heading">
                    <h3>{copy(language, "cardsTitle")}</h3>
                    <p>
                      {copy(language, "cardsSummary", cardStats.total, cardStats.starters, cardStats.bench)}
                      {" · "}
                      {copy(language, "cardsStarterAvg", cardStats.startersAvg)}
                    </p>
                  </div>
                  <div className="club-player-cards-tiers">
                    <span className="club-card-tally is-gold">{copy(language, "cardsGold", cardStats.gold)}</span>
                    <span className="club-card-tally is-silver">{copy(language, "cardsSilver", cardStats.silver)}</span>
                    <span className="club-card-tally is-bronze">{copy(language, "cardsBronze", cardStats.bronze)}</span>
                  </div>
                </div>

                <section className="club-player-cards-group" aria-labelledby="club-cards-starters-heading">
                  <div className="club-table-heading">
                    <h3 id="club-cards-starters-heading">
                      {translate(language, "Starting XI")}
                      <span className="club-count-pill">{starterCards.length}</span>
                    </h3>
                    <span className="club-muted">{copy(language, "counts", counts.GK, counts.DEF, counts.MID, counts.ATT)}</span>
                  </div>
                  <div className="club-player-card-grid">
                    {starterCards.map((card) => (
                      <PlayerCardView key={card.id} card={card} language={language} condition={conditionById.get(card.id)} onOpen={setDetailPlayerId} />
                    ))}
                  </div>
                </section>

                <section className="club-player-cards-group" aria-labelledby="club-cards-bench-heading">
                  <div className="club-table-heading">
                    <h3 id="club-cards-bench-heading">
                      {copy(language, "bench")}
                      <span className="club-count-pill">{benchCards.length}</span>
                    </h3>
                    <span className="club-muted">{copy(language, "benchNote")}</span>
                  </div>
                  <div className="club-player-card-grid">
                    {benchCards.map((card) => (
                      <PlayerCardView key={card.id} card={card} language={language} condition={conditionById.get(card.id)} onOpen={setDetailPlayerId} />
                    ))}
                  </div>
                </section>
              </div>
            ) : (
              <>
                <div className="club-panel club-squad-panel">
                  <div className="club-table-heading">
                    <h3>
                      {translate(language, "Starting XI")}
                      <span className="club-count-pill">{starterPlayers.length}</span>
                    </h3>
                    <span className="club-muted">{copy(language, "counts", counts.GK, counts.DEF, counts.MID, counts.ATT)}</span>
                  </div>
                  <SquadTable
                    caption={`${translate(language, "Starting XI")} (${starterPlayers.length})`}
                    players={starterPlayers}
                    language={language}
                    starters
                    renderAction={mode === "club" ? renderSellAction : undefined}
                  />
                  <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "fitNote")}</p></details>
                </div>

                <div className="club-panel club-squad-panel">
                  <div className="club-table-heading">
                    <h3>
                      {copy(language, "bench")}
                      <span className="club-count-pill">{benchPlayers.length}</span>
                    </h3>
                    <span className="club-muted">{copy(language, "benchNote")}</span>
                  </div>
                  <SquadTable
                    caption={`${copy(language, "bench")} (${benchPlayers.length})`}
                    players={benchPlayers}
                    language={language}
                    starters={false}
                    renderAction={mode === "club" ? renderSellAction : undefined}
                  />
                  <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "sellNote")}</p></details>
                </div>
              </>
            )}

            <p className="club-note">
              {blockedStarters
                ? copy(language, "blockedNote", blockedStarters)
                : copy(language, "noBlockedNote")}
            </p>
          </section>

          {/* 3 · line explanation */}
          <section className="club-section" id="club-lines" aria-labelledby="club-lines-heading">
            <div className="club-section-head">
              <div>
                <p className="club-eyebrow">DEF · MID · ATT · GK</p>
                <h2 id="club-lines-heading">{copy(language, "linesTitle")}</h2>
              </div>
              <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "linesIntro")}</p></details>
            </div>

            <div className="club-lines-grid">
              {LINE_WEIGHT_TABLE.map((group) => (
                <div className="club-panel club-weight-panel" key={group.key}>
                  <h3>{copy(language, group.key)}</h3>
                  <table className="club-weight-table">
                    <caption className="club-visually-hidden">{copy(language, group.key)}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{copy(language, "weightAttribute")}</th>
                        <th scope="col">{copy(language, "weightWeight")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => (
                        <tr key={row.attribute}>
                          <th scope="row">
                            <span className="club-attr-code">{ATTRIBUTE_CODE[row.attribute]}</span>
                            <span className="club-attr-name">{copy(language, row.attribute)}</span>
                          </th>
                          <td>
                            <span className="club-weight-value">{`${row.weight}%`}</span>
                            <span className="club-weight-bar" aria-hidden="true">
                              <i style={{ width: `${row.weight}%` }} />
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            <div className="club-panel club-fit-panel">
              <div className="club-fit-copy">
                <h3>{copy(language, "fitTitle")}</h3>
                <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "fitIntro")}</p></details>
              </div>
              <table className="club-fit-table">
                <caption className="club-visually-hidden">{copy(language, "fitTitle")}</caption>
                <tbody>
                  {FIT_RULES.map((rule) => (
                    <tr key={rule.key}>
                      <th scope="row">{copy(language, rule.key)}</th>
                      <td>
                        <b>{`${rule.percent}%`}</b>
                        <span className="club-fit-bar" aria-hidden="true">
                          <i style={{ width: `${rule.percent}%` }} />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p className="club-note">{copy(language, "gkNote")}</p></details>
            </div>
          </section>

          </>
          ) : null}

          {mode !== "club" || clubTab === "club" ? (
            <>
          {/* 4 · migration preview */}
          {mode === "sample" || mode === "loading" ? (
          <section className="club-section" id="club-migration-sample" aria-labelledby="club-migration-heading">
            <div className="club-section-head">
              <div>
                <p className="club-eyebrow">{`${translate(language, "Level")} · ${translate(language, "XP")}`}</p>
                <h2 id="club-migration-heading">{copy(language, "migrationTitle")}</h2>
              </div>
              <details className="club-section-more"><summary>{copy(language, "moreDetails")}</summary><p>{copy(language, "migrationIntro")}</p></details>
            </div>

            <div className="club-migration-grid">
              <div className="club-panel">
                <h3 className="club-subheading">{copy(language, "migrationDetails")}</h3>
                <dl className="club-migration-dl">
                  <div className="club-migration-row">
                    <dt>{copy(language, "migrationXp")}</dt>
                    <dd>{preview.migration.xp}</dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "migrationFunds")}</dt>
                    <dd>{preview.migration.funds}</dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "migrationGrant")}</dt>
                    <dd>
                      <span>{preview.migration.initialGrant}</span>
                      <span className="club-none">{copy(language, "migrationGrantNote")}</span>
                    </dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "displayRights")}</dt>
                    <dd>
                      <ul className="club-subfacts">
                        <li>
                          <span>{copy(language, "frames")}</span>
                          <RawList values={preview.migration.displayRights.frames} empty={copy(language, "none")} />
                        </li>
                        <li>
                          <span>{copy(language, "backdrops")}</span>
                          <RawList values={preview.migration.displayRights.backdrops} empty={copy(language, "none")} />
                        </li>
                        <li>
                          <span>{copy(language, "kits")}</span>
                          <RawList values={preview.migration.displayRights.kits} empty={copy(language, "none")} />
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "frozen")}</dt>
                    <dd>
                      <ul className="club-subfacts">
                        <li>
                          <span>{copy(language, "personalAttributes")}</span>
                          <code className="club-code">{rawValue(preview.migration.frozen.personalAttributes)}</code>
                        </li>
                        <li>
                          <span>{copy(language, "skillPoints")}</span>
                          <code className="club-code">{rawValue(preview.migration.frozen.skillPoints)}</code>
                        </li>
                        <li>
                          <span>{copy(language, "matchHistory")}</span>
                          <code className="club-code">{rawValue(preview.migration.frozen.matchHistory)}</code>
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "rewardBaseline")}</dt>
                    <dd>
                      <ul className="club-subfacts">
                        <li>
                          <span>{copy(language, "rewardIdentities")}</span>
                          <b>{preview.migration.baseline.rewardIdentities}</b>
                        </li>
                        <li>
                          <span>{copy(language, "sessionIdentities")}</span>
                          <b>{preview.migration.baseline.sessionIdentities}</b>
                        </li>
                        <li>
                          <span>{copy(language, "activeSession")}</span>
                          <code className="club-code">{rawValue(preview.migration.baseline.activeSession)}</code>
                        </li>
                      </ul>
                    </dd>
                  </div>
                  <div className="club-migration-row">
                    <dt>{copy(language, "warnings")}</dt>
                    <dd>
                      {preview.migration.warnings.length ? (
                        <ul className="club-warning-list">
                          {preview.migration.warnings.map((warning, index) => (
                            <li key={`${index}-${warning}`} lang={language === "zh" ? "en-GB" : undefined}>
                              {warning}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="club-none">{copy(language, "noWarnings")}</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <aside className="club-panel club-readonly-panel">
                <h3 className="club-readonly-title">{copy(language, "readonlyTitle")}</h3>
                <p className="club-readonly-main">{copy(language, "readonlyMain")}</p>
                <p className="club-readonly-alt" lang={alternativeLangTag}>
                  {COPY.readonlyMain[alternativeLanguage]}
                </p>
                <p className="club-note">{copy(language, "migrationIntro")}</p>
                <details className="club-raw">
                  <summary>{copy(language, "rawJson")}</summary>
                  <p className="club-raw-hint">{copy(language, "rawJsonHint")}</p>
                  <pre>{JSON.stringify(preview.migration, null, 2)}</pre>
                </details>
              </aside>
            </div>
          </section>
          ) : null}
            </>
          ) : null}
          </div>
            </>
          )}
        </main>

        {mode !== "club" ? (
        <footer className="club-footer">
          <details className="club-footer-details">
            <summary>{copy(language, "footerDetails")}</summary>
            <p>{mode === "create" ? copy(language, "footerNoteLive") : copy(language, "footerNote")}</p>
          </details>
          <div className="club-footer-meta">
            {mode === "create" ? (
              <button
                type="button"
                className="club-button club-button-secondary"
                onClick={() => void reload()}
                disabled={busy || refreshing}
              >
                {refreshing ? copy(language, "refreshing") : copy(language, "refreshAction")}
              </button>
            ) : null}
            <Link className="club-back-link" href="/">
              {`← ${copy(language, "backToPlanner")}`}
            </Link>
            <span>{`${copy(language, "footerLanguage")} ${translate(language, "Language")}: ${language === "zh" ? "中文" : "English"}`}</span>
          </div>
        </footer>
        ) : null}
      </div>

      {detailData && detailCard ? (
        <div className="club-player-detail-layer">
          <div
            className="club-player-detail-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-player-detail-title"
            tabIndex={-1}
            ref={detailDialogRef}
            data-player-id={detailData.id}
          >
            <button
              type="button"
              className="club-player-detail-close"
              aria-label={copy(language, "clubDetailClose")}
              onClick={() => setDetailPlayerId(null)}
            >
              ×
            </button>
            <div className="club-player-detail-head">
              <div className="club-player-detail-avatar">
                <PlayerAvatarSvg card={detailCard} />
              </div>
              <div className="club-player-detail-copy">
                <p className="club-eyebrow">{`${copy(language, "clubDetailTitle")} · ${copy(language, detailData.starter ? "starters" : "bench")}`}</p>
                <h2 id="club-player-detail-title">{`#${detailData.number} ${detailData.name}`}</h2>
                <p className="club-player-detail-meta">
                  {`${detailData.position} · ${detailData.line} · OVR ${detailData.ovr}`}
                </p>
                <div className="club-player-detail-badges">
                  <span>{copy(language, cardTierLabel(detailData.tier.tier))}</span>
                  <span>{detailData.starter ? copy(language, "starters") : copy(language, "bench")}</span>
                  <span>
                    {detailData.origin === "signed"
                      ? detailData.paidPrice !== null
                        ? copy(language, "clubDetailOriginSigned", detailData.paidPrice)
                        : copy(language, "cardSigned")
                      : copy(language, "clubDetailOriginAcademy")}
                  </span>
                </div>
                <div className="club-player-detail-condition" data-detail-injured={detailInjured ? "true" : "false"}>
                  <ConditionBar fitness={detailFitness} injury={detailPlayer ? injuryMatchesOf(detailPlayer) : 0} language={language} />
                  <span className={`club-condition-state${detailInjured ? " is-injured" : detailFitness < 35 ? " is-tired" : ""}`}>
                    {detailInjured
                      ? copy(language, "conditionInjured")
                      : detailFitness < 35
                        ? copy(language, "conditionTired")
                        : copy(language, "conditionAvailable")}
                  </span>
                </div>
              </div>
            </div>
            <div className="club-player-detail-body">
              <section className="club-player-detail-radar" aria-labelledby="club-player-detail-radar-heading">
                <h3 id="club-player-detail-radar-heading">{copy(language, "clubDetailRadar")}</h3>
                {(() => {
                  const centre = detailData.radarCenter;
                  const outer = detailData.spiderPoints.map((_, index) => polar(centre, detailData.radarRadius, index * 60));
                  return (
                    <svg className="club-player-radar" viewBox="0 0 140 140" role="img" aria-label={`${copy(language, "clubDetailRadar")} ${detailData.name}`}>
                      <circle cx={centre.x} cy={centre.y} r={detailData.radarRadius} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.24" />
                      <circle cx={centre.x} cy={centre.y} r={detailData.radarRadius / 2} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.16" />
                      <polygon points={outer.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.25" />
                      {outer.map((point, index) => (
                        <line key={index} x1={centre.x} y1={centre.y} x2={point.x} y2={point.y} stroke="currentColor" strokeWidth="1" opacity="0.18" />
                      ))}
                      <polygon points={detailData.spider} className="club-player-radar-area" />
                      {detailData.spiderPoints.map((point, index) => {
                        const labelPoint = polar(centre, detailData.radarRadius * 1.22, index * 60);
                        return (
                          <g key={point.label}>
                            <circle cx={point.x} cy={point.y} r="2.5" className="club-player-radar-point" />
                            <text x={labelPoint.x} y={labelPoint.y + 3} textAnchor="middle" className="club-player-radar-label">
                              {point.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()}
                <p className="club-player-detail-line">{copy(language, "clubDetailLineRating", detailData.lineRating.toFixed(1), detailData.line)}</p>
              </section>
              <section className="club-player-detail-training" aria-labelledby="club-player-detail-training-heading">
                <div className="club-player-detail-cap-head">
                  <h3 id="club-player-detail-training-heading">{copy(language, "clubDetailCap")}</h3>
                  <b>{copy(language, "clubDetailProgress", detailData.capProgress, detailData.cap)}</b>
                </div>
                <div className="club-player-detail-cap" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={detailData.capProgress} aria-label={copy(language, "clubDetailCap")}>
                  <i style={{ width: `${detailData.capProgress}%` }} />
                </div>
                <p className="club-player-detail-funds" data-detail-funds={funds}>{copy(language, "clubDetailFunds", funds)}</p>
                <ul className="club-player-detail-attributes">
                  {detailData.attributes.map((attribute) => {
                    const check = canTrainDetail(club!, detailData, attribute.key);
                    const price = attribute.price;
                    const insufficient = typeof price === "number" && price > funds;
                    const disabled = busy || !check.ok || insufficient || detailInjured;
                    const status = detailInjured
                      ? copy(language, "clubDetailInjured")
                      : attribute.blocked
                        ? detailBlockedReason(attribute.blocked)
                        : typeof price === "number"
                          ? insufficient
                            ? copy(language, "clubDetailInsufficient", price)
                            : copy(language, "clubDetailNext", price)
                          : copy(language, "clubDetailNoTrain");
                    return (
                      <li key={attribute.key} className={`club-player-detail-row${disabled ? " is-disabled" : ""}`} data-attribute-key={attribute.key}>
                        <span className="club-player-detail-attribute-label">{attribute.label}</span>
                        <b className="club-player-detail-attribute-value">{attribute.value}</b>
                        <span className="club-player-detail-attribute-status">{status}</span>
                        <button
                          type="button"
                          className="club-button club-button-primary club-player-detail-train"
                          aria-label={`${copy(language, "clubDetailTrain")} ${attribute.label}`}
                          onClick={() => void handleDetailTrain(attribute.key)}
                          disabled={disabled}
                        >
                          {busy ? copy(language, "clubDetailTraining") : copy(language, "clubDetailTrain")}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {(() => {
                  const suggested = nextTrainingAttribute(detailData);
                  if (!suggested) return null;
                  const attribute = detailData.attributes.find((entry) => entry.key === suggested);
                  return <p className="club-player-detail-suggested">{copy(language, "clubDetailSuggested", attribute?.label ?? suggested)}</p>;
                })()}
                {detailError ? <p className="club-player-detail-error" role="alert">{detailError}</p> : null}
                <p className="club-visually-hidden" role="status" aria-live="polite">{detailAnnouncement}</p>
              </section>
            </div>
          </div>
        </div>
      ) : null}
      {celebration ? (
        <div className="club-celebration-layer">
          <div className="club-celebration-confetti" aria-hidden="true">
            {celebrationStars(celebration.seed, 18).map((piece, index) => (
              <i
                key={index}
                style={
                  {
                    left: `${50 + Math.cos((piece.angle * Math.PI) / 180) * piece.radius * 46}%`,
                    top: `${38 + Math.sin((piece.angle * Math.PI) / 180) * piece.radius * 42}%`,
                    width: `${Math.round(piece.size)}px`,
                    height: `${Math.round(piece.size * 1.6)}px`,
                    background: index % 3 === 0 ? club?.colours.primary : index % 3 === 1 ? club?.colours.secondary : "#f4c445",
                    animationDelay: `${piece.delay}s`,
                    "--club-confetti-rotation": `${Math.round(piece.rotation)}deg`,
                  } as CSSProperties
                }
              />
            ))}
          </div>
          <div
            className="club-celebration-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-celebration-title"
            aria-describedby="club-celebration-subtitle"
            tabIndex={-1}
            ref={celebrationDialogRef}
            data-trophy-id={celebration.trophyId}
            data-celebration-mode={celebrationMode}
          >
            <p className="club-celebration-eyebrow">{copy(language, "celebrationEyebrow")}</p>
            <h2 id="club-celebration-title">{language === "zh" ? celebration.titleZh : celebration.title}</h2>
            <p id="club-celebration-subtitle" className="club-celebration-subtitle">
              {language === "zh" ? celebration.subtitleZh : celebration.subtitle}
            </p>
            {celebrationMode === "review" ? (
              <p className="club-celebration-readonly">{copy(language, "celebrationReadonly")}</p>
            ) : null}
            <div className="club-celebration-visual">
              <div className="club-celebration-cup-wrap">
                <span className="club-celebration-rays" aria-hidden="true" />
                <CelebrationCupSvg />
              </div>
              {crest ? <ClubCrestSvg crest={crest} size={82} className="club-celebration-crest" /> : null}
            </div>
            <div className="club-celebration-stars">
              <Pips
                filled={celebration.stars}
                total={5}
                label={copy(language, "celebrationStarsLabel", celebration.stars)}
                kind="trophy"
              />
              <small>{copy(language, "celebrationStarsLabel", celebration.stars)}</small>
            </div>
            <div className={`club-celebration-kit${celebration.kit ? " is-kit" : " is-legacy"}`} data-kit-id={celebration.kit?.id ?? ""} data-kit-missing={celebration.kit ? "false" : "true"}>
              {celebration.kit ? (
                <>
                  <span className="club-celebration-kit-swatch" aria-hidden="true">
                    <i style={{ background: celebration.kit.colours[0] }} />
                    <i style={{ background: celebration.kit.colours[1] }} />
                  </span>
                  <span className="club-celebration-kit-copy">
                    <small>{copy(language, "celebrationKit")}</small>
                    <b>{kitDisplayName(language, celebration.kit)}</b>
                  </span>
                </>
              ) : (
                <p>{copy(language, "celebrationNoKit")}</p>
              )}
            </div>
            <p className="club-celebration-announce" role="status" aria-live="polite">
              {language === "zh" ? celebration.titleZh : celebration.title}
            </p>
            <div className="club-celebration-actions">
              {celebrationMode === "pending" ? (
                <button type="button" className="club-button club-button-primary" onClick={() => void handleClaimCelebration()} disabled={busy}>
                  {copy(language, "celebrationClaim")}
                </button>
              ) : null}
              <button type="button" className="club-button club-button-secondary" onClick={handleCelebrationHonours}>
                {copy(language, "celebrationHonours")}
              </button>
              <button
                type="button"
                className="club-button club-button-secondary"
                onClick={() => setCelebration(null)}
              >
                {celebrationMode === "pending" ? copy(language, "celebrationLater") : copy(language, "celebrationClose")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
