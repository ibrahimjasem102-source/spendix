"use client";

import Link from "next/link";
import { Wallet, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(214 60% 8%) 0%, hsl(214 28% 5%) 100%)" }}
    >
      {/* Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] opacity-10 blur-3xl rounded-full"
          style={{ background: "radial-gradient(ellipse, #06B6D4 0%, #7C3AED 60%, transparent 100%)" }}
        />
      </div>

      <div className="text-center relative z-10 space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="relative">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
            >
              <Wallet className="w-8 h-8 text-white" />
            </div>
            <div
              className="absolute -inset-1 rounded-2xl opacity-30 blur-xl"
              style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
            />
          </div>
        </div>

        {/* 404 number */}
        <div>
          <p
            className="text-9xl font-black leading-none"
            style={{
              background: "linear-gradient(135deg, #06B6D4, #7C3AED)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            404
          </p>
          <p className="text-2xl font-bold text-white mt-3">الصفحة غير موجودة</p>
          <p className="text-sm mt-1" style={{ color: "hsl(215 18% 45%)" }}>
            Page Not Found
          </p>
        </div>

        {/* Description */}
        <p className="text-sm max-w-xs mx-auto leading-relaxed" style={{ color: "hsl(215 18% 40%)" }}>
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى مكان آخر
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #06B6D4, #7C3AED)" }}
          >
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors"
            style={{
              background: "hsl(215 26% 10%)",
              border: "1px solid hsl(0 0% 100% / 0.08)",
              color: "hsl(215 18% 65%)",
            }}
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            رجوع
          </button>
        </div>
      </div>
    </div>
  );
}
