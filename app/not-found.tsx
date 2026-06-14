"use client";

import Link from "next/link";
import { Wallet, Home, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "hsl(216 30% 7%)" }}
    >
      <div className="text-center relative z-10 space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center bg-cyan-500">
            <Wallet className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* 404 number */}
        <div>
          <p className="text-9xl font-black leading-none text-cyan-400">
            404
          </p>
          <p className="text-2xl font-bold text-[hsl(210_20%_94%)] mt-3">الصفحة غير موجودة</p>
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
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-[#0D1117] transition-colors hover:bg-cyan-400"
            style={{ background: "#06B6D4" }}
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
