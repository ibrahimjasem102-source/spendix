"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGuest } from "@/contexts/GuestContext";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isGuest, isLoading } = useGuest();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isGuest) {
      router.replace("/login");
    }
  }, [isGuest, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-cyan-400/20 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
