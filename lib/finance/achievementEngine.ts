// ── Types ─────────────────────────────────────────────────────

export interface Achievement {
  id:         string;
  points:     number;
  unlocked:   boolean;
  progress:   number;    // 0–100
  milestone?: string;    // human-readable progress hint
}

export interface AchievementInput {
  transactionCount:   number;
  savingsRate:        number;
  monthlySavingsRate: number;
  hasInvestments:     boolean;
  workIncome:         number;
  debtPayable:        number;
  monthlyIncome:      number;
  monthlyExpenses:    number;
  overdueDebtsCount:  number;
  balance:            number;
  debtRecoveryRate:   number;
  portfolioGain:      number;
}

export interface LevelInfo {
  level:          number;
  titleKey:       string;   // i18n key, e.g. "hub.level_1"
  nextThreshold:  number;   // points needed for next level
}

// ── Definitions ───────────────────────────────────────────────

const DEFINITIONS: Array<{
  id: string;
  points: number;
  check: (i: AchievementInput) => { unlocked: boolean; progress: number; milestone?: string };
}> = [
  {
    id: "first_step", points: 10,
    check: ({ transactionCount: c }) => ({
      unlocked: c > 0,
      progress: c > 0 ? 100 : 0,
    }),
  },
  {
    id: "active_user", points: 20,
    check: ({ transactionCount: c }) => ({
      unlocked: c >= 20,
      progress: Math.min(100, (c / 20) * 100),
      milestone: `${Math.min(c, 20)} / 20`,
    }),
  },
  {
    id: "saver", points: 25,
    check: ({ savingsRate: r }) => ({
      unlocked: r >= 20,
      progress: Math.min(100, (r / 20) * 100),
      milestone: `${r.toFixed(0)}% / 20%`,
    }),
  },
  {
    id: "super_saver", points: 50,
    check: ({ savingsRate: r }) => ({
      unlocked: r >= 30,
      progress: Math.min(100, (r / 30) * 100),
      milestone: `${r.toFixed(0)}% / 30%`,
    }),
  },
  {
    id: "investor", points: 30,
    check: ({ hasInvestments: h }) => ({
      unlocked: h,
      progress: h ? 100 : 0,
    }),
  },
  {
    id: "profit_maker", points: 40,
    check: ({ portfolioGain: g }) => ({
      unlocked: g > 0,
      progress: g > 0 ? 100 : 0,
    }),
  },
  {
    id: "hard_worker", points: 20,
    check: ({ workIncome: w }) => ({
      unlocked: w > 0,
      progress: w > 0 ? 100 : 0,
    }),
  },
  {
    id: "debt_free", points: 35,
    check: ({ debtPayable: d, transactionCount: c, debtRecoveryRate: r }) => ({
      unlocked: d === 0 && c > 0,
      progress: d === 0 ? 100 : Math.min(90, r),
      milestone: d > 0 ? `${r.toFixed(0)}% paid` : undefined,
    }),
  },
  {
    id: "balanced", points: 15,
    check: ({ monthlyIncome: inc, monthlyExpenses: exp }) => ({
      unlocked: inc > 0 && exp < inc,
      progress: inc > 0 ? Math.min(100, ((inc - exp) / inc) * 500) : 0,
    }),
  },
  {
    id: "positive_balance", points: 20,
    check: ({ balance: b }) => ({
      unlocked: b > 0,
      progress: b > 0 ? 100 : 0,
    }),
  },
  {
    id: "no_overdue", points: 25,
    check: ({ overdueDebtsCount: o, transactionCount: c }) => ({
      unlocked: o === 0 && c > 0,
      progress: o === 0 ? 100 : 0,
    }),
  },
  {
    id: "monthly_saver", points: 20,
    check: ({ monthlySavingsRate: r }) => ({
      unlocked: r >= 15,
      progress: Math.min(100, (r / 15) * 100),
      milestone: `${r}% / 15%`,
    }),
  },
];

// ── Pure functions ─────────────────────────────────────────────

export function computeAchievements(input: AchievementInput): Achievement[] {
  return DEFINITIONS.map(({ id, points, check }) => {
    const result = check(input);
    return { id, points, ...result };
  });
}

export function getTotalPoints(achievements: Achievement[]): number {
  return achievements.filter((a) => a.unlocked).reduce((s, a) => s + a.points, 0);
}

export function getMaxPoints(achievements: Achievement[]): number {
  return achievements.reduce((s, a) => s + a.points, 0);
}

const LEVELS: Array<{ threshold: number; titleKey: string }> = [
  { threshold: 0,   titleKey: "hub.level_1" },
  { threshold: 50,  titleKey: "hub.level_2" },
  { threshold: 120, titleKey: "hub.level_3" },
  { threshold: 200, titleKey: "hub.level_4" },
  { threshold: 280, titleKey: "hub.level_5" },
  { threshold: 350, titleKey: "hub.level_6" },
];

export function getLevel(points: number): LevelInfo {
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].threshold) { idx = i; break; }
  }
  const next = LEVELS[idx + 1]?.threshold ?? Infinity;
  return {
    level:         idx + 1,
    titleKey:      LEVELS[idx].titleKey,
    nextThreshold: next,
  };
}
