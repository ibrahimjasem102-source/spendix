"use client";

import { I18nProvider, type Locale } from "@/lib/i18n";
import QueryProvider from "@/lib/query/QueryProvider";
import { ThemeProvider } from "@/lib/theme";
import PWAUpdateHandler from "@/components/system/PWAUpdateHandler";
import HapticFeedback from "@/components/system/HapticFeedback";
import QueryEventBridge from "@/components/system/QueryEventBridge";
import OAuthRedirectHandler from "@/components/auth/OAuthRedirectHandler";

export default function Providers({
  children,
  initialLocale,
}: {
  children: React.ReactNode;
  initialLocale?: Locale;
}) {
  return (
    <QueryProvider>
      <ThemeProvider>
        <I18nProvider initialLocale={initialLocale}>
          <PWAUpdateHandler />
          <HapticFeedback />
          <OAuthRedirectHandler />
          <QueryEventBridge />
          {children}
        </I18nProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}
