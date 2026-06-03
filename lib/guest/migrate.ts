import { createClient } from "@/lib/supabase/client";
import {
  getGuestTransactions,
  getGuestGoals,
  getGuestContacts,
  getGuestTags,
  getGuestDebts,
  getGuestInvestments,
  getGuestWorkSessions,
  getGuestWorkPayments,
  clearGuestData,
} from "./storage";
import { GUEST_CATEGORIES } from "./categories";

// Read raw stored budgets (all months) directly from localStorage
// to avoid the runtime stats that getGuestBudgets() injects.
function getRawStoredBudgets(): Array<{
  id: string;
  category_id: string;
  monthly_limit: number;
  month: number;
  year: number;
}> {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem("spendix_guest_budgets") ?? "[]");
  } catch {
    return [];
  }
}

export async function migrateGuestData(options?: { saveSettings?: boolean }): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // ── Migrate guest settings (locale, theme, currency) ────────────────────────
  if (options?.saveSettings && typeof window !== "undefined") {
    const locale   = window.localStorage.getItem("spendix_locale");
    const currency = window.localStorage.getItem("spendix_currency");
    const theme    = window.localStorage.getItem("spendix_theme");

    // Read current profile to detect whether the user ever customised settings.
    // Only overwrite fields that are still at their bootstrap defaults so we
    // never clobber a returning user's deliberate choices.
    const { data: currentProfile } = await supabase
      .from("profile_settings")
      .select("language, currency, theme")
      .eq("user_id", user.id)
      .maybeSingle();

    const patch: Record<string, string> = { user_id: user.id, updated_at: new Date().toISOString() };

    if (locale && (locale === "ar" || locale === "en" || locale === "de")
        && (!currentProfile || currentProfile.language === "ar"))
      patch.language = locale;

    if (currency && ["EUR", "USD", "GBP", "CHF", "JPY"].includes(currency)
        && (!currentProfile || currentProfile.currency === "EUR"))
      patch.currency = currency;

    if ((theme === "dark" || theme === "light")
        && (!currentProfile || currentProfile.theme === "dark"))
      patch.theme = theme;

    if (Object.keys(patch).length > 2) {   // more than just user_id + updated_at
      const { error: settingsErr } = await supabase
        .from("profile_settings")
        .upsert(patch, { onConflict: "user_id" });
      if (settingsErr) console.error("[migrate] settings:", settingsErr);
    }
  }

  const guestTx           = getGuestTransactions();
  const guestGoals        = getGuestGoals();
  const guestContacts     = getGuestContacts();
  const guestTags         = getGuestTags();
  const guestInvestments  = getGuestInvestments();
  const guestDebts        = getGuestDebts();
  const guestWorkSessions = getGuestWorkSessions();
  const guestWorkPayments = getGuestWorkPayments();
  const rawBudgets        = getRawStoredBudgets();

  const hasData =
    guestTx.length > 0 ||
    guestGoals.length > 0 ||
    guestContacts.length > 0 ||
    guestTags.length > 0 ||
    guestInvestments.length > 0 ||
    guestDebts.length > 0 ||
    guestWorkSessions.length > 0 ||
    rawBudgets.length > 0;

  if (!hasData) return;

  // ── Category mapping ──────────────────────────────────────────
  const { data: realCats, error: catsError } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", user.id);

  if (catsError) {
    console.error("[migrate] categories fetch failed:", catsError);
    return;
  }

  const nameToRealId = new Map<string, string>(
    (realCats ?? []).map((c: { id: string; name: string }) => [c.name, c.id]),
  );

  const guestIdToRealId = new Map<string, string>();
  for (const gc of GUEST_CATEGORIES) {
    const realId = nameToRealId.get(gc.name);
    if (realId) guestIdToRealId.set(gc.id, realId);
  }

  let anyError = false;

  // ── 1. Transactions ───────────────────────────────────────────
  if (guestTx.length > 0) {
    const rows = guestTx.map((tx) => ({
      user_id:          user.id,
      title:            tx.title,
      notes:            tx.notes ?? null,
      amount:           tx.amount,
      type:             tx.type,
      source:           tx.source ?? "manual",
      category_id:      tx.category?.name ? (nameToRealId.get(tx.category.name) ?? null) : null,
      transaction_date: tx.transaction_date,
    }));
    const { error } = await supabase.from("transactions").insert(rows);
    if (error) { console.error("[migrate] transactions:", error); anyError = true; }
  }

  // ── 2. Goals ──────────────────────────────────────────────────
  if (guestGoals.length > 0) {
    const baseRows = guestGoals.map((g) => ({
      user_id:              user.id,
      title:                g.title,
      target_amount:        g.target_amount,
      saved_amount:         g.saved_amount,
      monthly_contribution: g.monthly_contribution ?? 0,
      due_date:             g.due_date ?? null,
      category:             g.category ?? "other",
      tracking_type:        g.tracking_type ?? "manual",
      start_date:           g.start_date,
      notes:                g.notes ?? null,
      color:                g.color ?? null,
      completed_at:         g.completed_at ?? null,
    }));

    // Try with milestones first (requires 20260602_goal_milestones migration).
    // Fall back to insert without milestones if the column doesn't exist yet.
    const rowsWithMilestones = baseRows.map((r, i) => ({
      ...r,
      milestones: guestGoals[i].milestones ?? [],
    }));

    const { error: goalErr } = await supabase.from("goals").insert(rowsWithMilestones);

    if (goalErr) {
      const isMissingColumn =
        goalErr.message.includes("milestones") ||
        goalErr.message.includes("Could not find") ||
        goalErr.message.includes("schema cache");

      if (isMissingColumn) {
        // Retry without milestones
        const { error: retryErr } = await supabase.from("goals").insert(baseRows);
        if (retryErr) { console.error("[migrate] goals (retry):", retryErr); anyError = true; }
      } else {
        console.error("[migrate] goals:", goalErr);
        anyError = true;
      }
    }
  }

  // ── 3. Budgets ────────────────────────────────────────────────
  if (rawBudgets.length > 0) {
    const rows = rawBudgets
      .map((b) => ({
        user_id:       user.id,
        category_id:   guestIdToRealId.get(b.category_id) ?? null,
        monthly_limit: b.monthly_limit,
        month:         b.month,
        year:          b.year,
      }))
      .filter((b) => b.category_id !== null);

    if (rows.length > 0) {
      const { error } = await supabase.from("budgets").insert(rows);
      if (error) { console.error("[migrate] budgets:", error); anyError = true; }
    }
  }

  // ── 4. Tags ───────────────────────────────────────────────────
  if (guestTags.length > 0) {
    const rows = guestTags.map((tag) => ({
      user_id: user.id,
      name:    tag.name,
      color:   tag.color,
    }));
    const { error } = await supabase.from("tags").insert(rows);
    if (error) { console.error("[migrate] tags:", error); anyError = true; }
  }

  // ── 5. Contacts ───────────────────────────────────────────────
  if (guestContacts.length > 0) {
    const rows = guestContacts.map((c) => ({
      user_id: user.id,
      name:    c.name,
      type:    c.type,
      phone:   c.phone ?? null,
      email:   c.email ?? null,
      notes:   c.notes ?? null,
    }));
    const { error } = await supabase.from("financial_contacts").insert(rows);
    if (error) { console.error("[migrate] contacts:", error); anyError = true; }
  }

  // ── 6. Investments ────────────────────────────────────────────
  if (guestInvestments.length > 0) {
    const rows = guestInvestments.map((inv) => ({
      user_id:         user.id,
      asset_name:      inv.asset_name,
      asset_type:      inv.asset_type,
      amount_invested: inv.amount_invested,
      current_value:   inv.current_value ?? null,
      investment_date: inv.investment_date,
      notes:           inv.notes ?? null,
    }));
    const { error } = await supabase.from("investments").insert(rows);
    if (error) { console.error("[migrate] investments:", error); anyError = true; }
  }

  // ── 7. Debts + payments ───────────────────────────────────────
  if (guestDebts.length > 0) {
    for (const debt of guestDebts) {
      const { data: newDebt, error: debtError } = await supabase
        .from("debts")
        .insert({
          user_id:            user.id,
          person_or_entity:   debt.person_or_entity,
          debt_type:          debt.debt_type,
          total_amount:       debt.total_amount,
          paid_amount:        debt.paid_amount,
          due_date:           debt.due_date ?? null,
          status:             debt.status,
          notes:              debt.notes ?? null,
        })
        .select("id")
        .single();

      if (debtError || !newDebt) {
        console.error("[migrate] debt:", debtError);
        anyError = true;
        continue;
      }

      const payments = debt.payments ?? [];
      if (payments.length > 0) {
        const paymentRows = payments.map((p) => ({
          user_id:      user.id,
          debt_id:      newDebt.id,
          amount:       p.amount,
          payment_date: p.payment_date,
          notes:        p.notes ?? null,
          transaction_id: null,
        }));
        const { error: pmtError } = await supabase.from("debt_payments").insert(paymentRows);
        if (pmtError) { console.error("[migrate] debt payments:", pmtError); anyError = true; }
      }
    }
  }

  // ── 8. Work sessions + payments ───────────────────────────────
  if (guestWorkSessions.length > 0) {
    const guestSessionIdToRealId = new Map<string, string>();

    for (const session of guestWorkSessions) {
      const { data: newSession, error: sessionError } = await supabase
        .from("work_sessions")
        .insert({
          user_id:              user.id,
          title:                session.title,
          employer_or_client:   session.employer_or_client,
          hourly_rate:          session.hourly_rate,
          hours_worked:         session.hours_worked,
          expected_amount:      session.expected_amount,
          work_date:            session.work_date,
          due_date:             session.due_date ?? null,
          notes:                session.notes ?? null,
          recurrence:           session.recurrence,
          recurrence_end_date:  session.recurrence_end_date ?? null,
          status:               session.status,
        })
        .select("id")
        .single();

      if (sessionError || !newSession) {
        console.error("[migrate] work session:", sessionError);
        anyError = true;
        continue;
      }

      guestSessionIdToRealId.set(session.id, newSession.id);
    }

    if (guestWorkPayments.length > 0) {
      const paymentRows = guestWorkPayments.map((p) => ({
        user_id:            user.id,
        work_session_id:    p.work_session_id ? (guestSessionIdToRealId.get(p.work_session_id) ?? null) : null,
        employer_or_client: p.employer_or_client,
        amount:             p.amount,
        payment_date:       p.payment_date,
        notes:              p.notes ?? null,
        transaction_id:     null,
      }));
      const { error: pmtError } = await supabase.from("work_payments").insert(paymentRows);
      if (pmtError) { console.error("[migrate] work payments:", pmtError); anyError = true; }
    }
  }

  // Only clear local data if everything migrated without errors
  if (!anyError) {
    clearGuestData();
  }
}
