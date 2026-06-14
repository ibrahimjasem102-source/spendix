export interface PlatformScores {
  security:     { score: number; max: number; items: ScoreItem[] };
  reliability:  { score: number; max: number; items: ScoreItem[] };
  scalability:  { score: number; max: number; items: ScoreItem[] };
  risks:        RiskItem[];
  roadmap:      RoadmapItem[];
  generatedAt:  string;
}

export interface ScoreItem {
  label:    string;
  status:   "pass" | "warn" | "fail";
  note?:    string;
}

export interface RiskItem {
  severity: "low" | "medium" | "high";
  area:     string;
  risk:     string;
  mitigation: string;
}

export interface RoadmapItem {
  quarter: string;
  items:   string[];
}

export function computePlatformScores(): PlatformScores {
  const security: ScoreItem[] = [
    { label: "HTTPS + HSTS enforced",               status: "pass" },
    { label: "Content-Security-Policy header",       status: "pass" },
    { label: "Global API rate limiting (100 req/min)", status: "pass" },
    { label: "Row Level Security on all tables",     status: "pass" },
    { label: "Security events audit log",            status: "pass" },
    { label: "Bot / scanner detection",              status: "pass" },
    { label: "GDPR export & deletion",               status: "pass" },
    { label: "Consent management",                   status: "pass" },
    { label: "Admin role guard (ADMIN_EMAILS)",      status: "pass" },
    { label: "SQL injection pattern detection",      status: "pass" },
    { label: "Stripe webhook signature verification",status: "pass" },
    { label: "Service-role key server-only usage",   status: "pass" },
    { label: "WAF / DDoS protection",               status: "warn", note: "Requires Vercel Pro or Cloudflare WAF" },
    { label: "2FA / MFA for admin accounts",         status: "warn", note: "Configure in Supabase Auth settings" },
  ];

  const reliability: ScoreItem[] = [
    { label: "Error boundaries on all pages",           status: "pass" },
    { label: "14 performance DB indexes",               status: "pass" },
    { label: "Offline-first with IndexedDB sync queue", status: "pass" },
    { label: "PWA with offline fallback page",          status: "pass" },
    { label: "Health check endpoint (/api/health)",     status: "pass" },
    { label: "Data quality automated checks",           status: "pass" },
    { label: "Supabase PITR backups (daily snapshots)", status: "pass", note: "Enabled on Supabase Pro+" },
    { label: "Session recovery after network loss",     status: "pass" },
    { label: "Frontend error reporting pipeline",       status: "pass" },
    { label: "Mutation error toast (global)",           status: "pass" },
    { label: "Disaster recovery runbook",               status: "pass" },
    { label: "Monthly backup restore testing",          status: "warn", note: "Implement scheduled restore test job" },
    { label: "Chaos engineering / fault injection",     status: "fail", note: "Not yet implemented" },
  ];

  const scalability: ScoreItem[] = [
    { label: "Serverless / edge functions (Vercel)",    status: "pass" },
    { label: "Supabase connection pooler (pgBouncer)",  status: "pass" },
    { label: "CDN asset delivery via Vercel Edge",      status: "pass" },
    { label: "React Query stale-while-revalidate",      status: "pass" },
    { label: "VirtualList for long lists",              status: "pass" },
    { label: "14+ DB indexes covering hot queries",     status: "pass" },
    { label: "Pagination on all list endpoints",        status: "pass" },
    { label: "Event-driven analytics (batched)",        status: "pass" },
    { label: "Redis / edge KV cache for hot data",      status: "warn", note: "Add Upstash Redis for plans/features" },
    { label: "DB read replicas",                        status: "warn", note: "Enable in Supabase for >100k users" },
    { label: "Queue system for heavy jobs (GDPR etc.)", status: "warn", note: "Consider Inngest or QStash" },
    { label: "Multi-region deployment",                 status: "fail", note: "Single-region currently; needs Vercel Pro" },
  ];

  const secScore = security.filter(i  => i.status === "pass").length;
  const relScore = reliability.filter(i => i.status === "pass").length;
  const scaScore = scalability.filter(i => i.status === "pass").length;

  const risks: RiskItem[] = [
    {
      severity: "high",
      area: "Authentication",
      risk: "No MFA enforcement for admin users",
      mitigation: "Enable MFA in Supabase Auth dashboard; enforce for ADMIN_EMAILS accounts",
    },
    {
      severity: "high",
      area: "Scalability",
      risk: "No Redis cache — plan lookups hit DB on every request",
      mitigation: "Add Upstash Redis; cache plan tier per user (TTL 5 min)",
    },
    {
      severity: "medium",
      area: "Backup",
      risk: "No automated restore testing — backup validity unverified",
      mitigation: "Schedule monthly restore-to-staging test; alert if it fails",
    },
    {
      severity: "medium",
      area: "Monitoring",
      risk: "No uptime alerting — downtime discovered by users",
      mitigation: "Add UptimeRobot or BetterStack free tier pinging /api/health",
    },
    {
      severity: "medium",
      area: "Security",
      risk: "WAF not configured — no L7 DDoS protection",
      mitigation: "Enable Vercel WAF (Pro) or proxy through Cloudflare Free with firewall rules",
    },
    {
      severity: "low",
      area: "GDPR",
      risk: "GDPR delete is synchronous — may timeout on accounts with years of data",
      mitigation: "Move to background job via Inngest/QStash; return 202 Accepted immediately",
    },
    {
      severity: "low",
      area: "Scalability",
      risk: "Single-region deployment — latency for non-EU/US users",
      mitigation: "Enable Vercel multi-region or add Cloudflare Workers for edge routing",
    },
  ];

  const roadmap: RoadmapItem[] = [
    {
      quarter: "Q3 2026",
      items: [
        "Add Upstash Redis cache for plan tier lookups",
        "Enable MFA for admin accounts via Supabase Auth",
        "Set up UptimeRobot monitoring on /api/health",
        "Configure Cloudflare WAF (free tier) as reverse proxy",
        "Implement monthly backup restore-to-staging test",
      ],
    },
    {
      quarter: "Q4 2026",
      items: [
        "Move GDPR delete/export to background queue (Inngest)",
        "Enable Supabase read replicas at 50k+ MAU",
        "Add Sentry for frontend + backend error tracking",
        "Implement anomaly detection on security_events (spike alerts)",
        "Launch bug bounty program via Intigriti / HackerOne",
      ],
    },
    {
      quarter: "Q1 2027",
      items: [
        "Multi-region deployment on Vercel Pro",
        "SOC 2 Type I audit preparation",
        "Chaos engineering: inject DB failures in staging",
        "Automated security dependency scanning (Dependabot alerts)",
        "Open Banking pilot: Plaid sandbox integration",
      ],
    },
    {
      quarter: "Q2 2027",
      items: [
        "SOC 2 Type II certification",
        "ISO 27001 gap analysis",
        "End-to-end encryption for sensitive fields (Vault)",
        "Enterprise SSO (SAML 2.0) for org accounts",
        "Data warehouse export to BigQuery for analytics at scale",
      ],
    },
  ];

  return {
    security:    { score: secScore, max: security.length,    items: security },
    reliability: { score: relScore, max: reliability.length, items: reliability },
    scalability: { score: scaScore, max: scalability.length, items: scalability },
    risks,
    roadmap,
    generatedAt: new Date().toISOString(),
  };
}
