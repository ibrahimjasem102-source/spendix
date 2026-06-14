import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/auth";
import { getRequestId } from "@/lib/api/responses";
import { rateLimit } from "@/lib/api/rate-limit";
import { buildRichFinancialContext } from "@/lib/ai/financialContextBuilder";
import { buildRichContextString } from "@/lib/ai/aiPromptTemplates";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

type CoachPeriod = "daily" | "weekly" | "monthly";

const PERIOD_LABELS: Record<CoachPeriod, string> = {
  daily:   "يومي",
  weekly:  "أسبوعي",
  monthly: "شهري",
};

function buildCoachPrompt(period: CoachPeriod, contextString: string, language = "ar"): string {
  const isAr = language === "ar";

  const periodInstructions: Record<CoachPeriod, string> = {
    daily: isAr
      ? `أنت مدرب مالي يومي. قدّم:
1. تحية مشجعة (2 جملة)
2. إنجاز أمس الإيجابي (إن وجد)
3. تركيز اليوم: شيء واحد مالي واضح يجب فعله اليوم
4. تحذير صغير إن وجد (إنفاق مرتفع، ميزانية مشددة)
5. دافع ختامي (جملة قصيرة)
الحجم: 150-200 كلمة.`
      : `Daily financial coach. Provide: morning encouragement, yesterday's win, today's single financial focus, one warning if needed, closing motivation. 150-200 words.`,

    weekly: isAr
      ? `أنت مدرب مالي أسبوعي. قدّم:
1. ملخص الأسبوع: إيرادات، نفقات، صافي
2. 3 إنجازات هذا الأسبوع
3. 2 مجالات للتحسين الأسبوع القادم
4. هدف واحد محدد للأسبوع القادم
5. مقارنة مع الأسبوع السابق
الحجم: 250-300 كلمة.`
      : `Weekly financial coach. Weekly income/expense summary, 3 wins, 2 improvement areas, one specific next-week goal. 250-300 words.`,

    monthly: isAr
      ? `أنت مدرب مالي شهري. قدّم تحليلاً عميقاً:
1. أداء الشهر: إيرادات، نفقات، ادخار، نسبة الادخار
2. مقارنة مع الأشهر السابقة
3. تقدم الأهداف المالية
4. أبرز 3 قرارات مالية هذا الشهر (إيجابية وسلبية)
5. خطة الشهر القادم (3 أهداف واضحة)
6. نصيحة استثمار أو ادخار مناسبة للوضع
الحجم: 400-500 كلمة.`
      : `Monthly financial coach. Deep monthly analysis: performance vs previous months, goal progress, top 3 financial decisions, next month plan with 3 clear objectives. 400-500 words.`,
  };

  return `أنت مدرب مالي شخصي من Spendix. تقدم إرشادات مخصصة بناءً على البيانات المالية الفعلية للمستخدم.

${contextString}

${periodInstructions[period]}

تحدّث ${isAr ? "بالعربية" : "in English"} بأسلوب محفز ومهني. كن محدداً بالأرقام الفعلية. لا تخترع بيانات.`;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const { supabase, user, response } = await requireUser(requestId);
  if (response || !user) return response!;

  const limited = rateLimit(req, { key: "ai_coach", limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  let body: { period?: CoachPeriod; language?: string };
  try { body = await req.json(); }
  catch { body = {}; }

  const period   = body.period   ?? "daily";
  const language = body.language ?? "ar";

  if (!["daily","weekly","monthly"].includes(period)) {
    return NextResponse.json({ ok: false, error: "invalid_period" }, { status: 400 });
  }

  const richContext = await buildRichFinancialContext(user.id, supabase);
  const contextStr  = buildRichContextString(richContext);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ ok: false, error: "AI not configured" }, { status: 503 });

  const client   = new Anthropic({ apiKey });
  const systemPrompt = buildCoachPrompt(period as CoachPeriod, contextStr, language);

  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 1200,
    system:     systemPrompt,
    messages:   [{ role: "user", content: `قدّم لي جلسة التدريب ال${PERIOD_LABELS[period as CoachPeriod]} الآن.` }],
  });

  const coaching = (message.content[0] as { type: string; text: string }).text ?? "";

  return NextResponse.json({
    ok: true,
    period,
    coaching,
    model: message.model,
    generatedAt: new Date().toISOString(),
  });
}
