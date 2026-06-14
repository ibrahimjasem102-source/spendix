"use client";

import { useRouter } from "next/navigation";
import GoalFormModal, { type GoalFormData } from "@/components/goals/GoalFormModal";
import { useCreateGoal } from "@/lib/query/hooks";
import type { GoalCategory } from "@/types";

export default function NewGoalPage() {
  const router           = useRouter();
  const { mutateAsync }  = useCreateGoal();

  async function handleSubmit(data: GoalFormData) {
    await mutateAsync({
      title:                data.title,
      target_amount:        data.targetAmount,
      saved_amount:         data.savedAmount,
      monthly_contribution: data.monthlyContribution,
      due_date:             data.dueDate || null,
      category:             data.category as GoalCategory,
      tracking_type:        "manual",
      start_date:           new Date().toISOString().slice(0, 10),
      color:                null,
    });
    router.back();
  }

  return (
    <GoalFormModal
      onSubmit={handleSubmit}
      onClose={() => router.back()}
    />
  );
}
