"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

interface Props { children: React.ReactNode }

export default function PageTransition({ children }: Props) {
  const pathname          = usePathname();
  const prevPathnameRef   = useRef(pathname);
  const [opacity, setOpacity] = useState(1);

  useEffect(() => {
    if (prevPathnameRef.current === pathname) return;
    prevPathnameRef.current = pathname;

    // Briefly drop opacity, then restore — creates a crisp crossfade feel
    setOpacity(0);
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setOpacity(1));
    });
    return () => cancelAnimationFrame(t);
  }, [pathname]);

  return (
    <div
      style={{
        opacity,
        transition: opacity === 1 ? "opacity 180ms ease" : "none",
        willChange: "opacity",
      }}
    >
      {children}
    </div>
  );
}
