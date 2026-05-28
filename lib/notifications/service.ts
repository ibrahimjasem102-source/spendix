/**
 * Central Notification Service
 * Called from API routes (server-side) to create notifications.
 * Never create notifications directly in pages or components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreateNotificationData } from "@/types";

/** Create a single notification. Errors are logged but never thrown (best-effort). */
export async function createNotification(
  supabase: SupabaseClient,
  data: CreateNotificationData
): Promise<void> {
  const { error } = await supabase.from("notifications").insert({
    user_id:           data.user_id,
    title:             data.title,
    message:           data.message,
    type:              data.type,
    source:            data.source,
    priority:          data.priority ?? "normal",
    related_source_id: data.related_source_id ?? null,
    action_url:        data.action_url ?? null,
    metadata:          data.metadata ?? {},
    scheduled_for:     data.scheduled_for ?? null,
    status:            "unread",
  });
  if (error) console.error("[notifications] create error:", error.message);
}

/** Pre-built helpers for common financial events */
export const notify = {
  debtCreated: (supabase: SupabaseClient, userId: string, debtId: string, entity: string, payable: boolean) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             payable ? "دين جديد مسجّل" : "مستحق جديد مسجّل",
      message:           payable ? `دين جديد على: ${entity}` : `مستحق من: ${entity}`,
      type:              "debt",
      source:            "debt",
      priority:          "normal",
      related_source_id: debtId,
      action_url:        "/debts",
    }),

  debtPaid: (supabase: SupabaseClient, userId: string, debtId: string, entity: string) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             "تم سداد الدين بالكامل 🎉",
      message:           `تم سداد الدين مع: ${entity} بالكامل`,
      type:              "success",
      source:            "debt",
      priority:          "high",
      related_source_id: debtId,
      action_url:        "/debts",
    }),

  debtPaymentMade: (supabase: SupabaseClient, userId: string, debtId: string, amount: string, entity: string) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             "دفعة مسجّلة",
      message:           `دفعة ${amount} إلى ${entity}`,
      type:              "info",
      source:            "debt_payment",
      priority:          "low",
      related_source_id: debtId,
      action_url:        "/debts",
    }),

  debtPaymentReceived: (supabase: SupabaseClient, userId: string, debtId: string, amount: string, entity: string) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             "دفعة مستلمة",
      message:           `استلمت ${amount} من ${entity}`,
      type:              "success",
      source:            "debt_payment",
      priority:          "normal",
      related_source_id: debtId,
      action_url:        "/debts",
    }),

  investmentAdded: (supabase: SupabaseClient, userId: string, investmentId: string, name: string, amount: string) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             "استثمار جديد",
      message:           `تم إضافة استثمار في ${name} بمبلغ ${amount}`,
      type:              "investment",
      source:            "investment",
      priority:          "normal",
      related_source_id: investmentId,
      action_url:        "/investments",
    }),

  workPaymentReceived: (supabase: SupabaseClient, userId: string, paymentId: string, amount: string, client: string) =>
    createNotification(supabase, {
      user_id:           userId,
      title:             "دفعة عمل مستلمة",
      message:           `استلمت ${amount} من ${client}`,
      type:              "work",
      source:            "work",
      priority:          "normal",
      related_source_id: paymentId,
      action_url:        "/work",
    }),

  goalCreated: (supabase: SupabaseClient, userId: string, title: string, target: string) =>
    createNotification(supabase, {
      user_id:  userId,
      title:    "هدف مالي جديد 🎯",
      message:  `تم إنشاء هدف "${title}" بمبلغ ${target}. ابدأ بالادخار لتحقيقه!`,
      type:     "goal",
      source:   "goal",
      priority: "normal",
      action_url: "/goals",
    }),

  goalCompleted: (supabase: SupabaseClient, userId: string, title: string) =>
    createNotification(supabase, {
      user_id:  userId,
      title:    `هدف "${title}" مكتمل! 🎉`,
      message:  `تهانينا! لقد حققت هدفك المالي بالكامل. حدد هدفاً جديداً لمواصلة النمو.`,
      type:     "goal",
      source:   "goal",
      priority: "high",
      action_url: "/goals",
    }),
};
