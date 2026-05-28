import type { Metadata } from "next";
import Providers from "./providers";
import CapacitorInit from "@/components/system/CapacitorInit";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spendix",
  description: "Smart personal finance tracker",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Spendix",
  },
};

// Inline script runs synchronously before React hydrates — prevents flash of wrong theme
const noFlickerScript = `
(function(){
  try{
    var t=localStorage.getItem('spendix_theme')||'dark';
    if(t==='light'){document.documentElement.classList.remove('dark');document.documentElement.classList.add('light');}
    else{document.documentElement.classList.add('dark');document.documentElement.classList.remove('light');}
    var l=localStorage.getItem('spendix_locale')||'ar';
    if(!localStorage.getItem('spendix_locale'))localStorage.setItem('spendix_locale','ar');
    document.documentElement.lang=l;
    document.documentElement.dir=l==='ar'?'rtl':'ltr';
    document.documentElement.dataset.locale=l;
    document.documentElement.dataset.direction=l==='ar'?'rtl':'ltr';
  }catch(e){document.documentElement.classList.add('dark');}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0B0F14" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: noFlickerScript }} />
      </head>
      <body>
        <CapacitorInit />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
