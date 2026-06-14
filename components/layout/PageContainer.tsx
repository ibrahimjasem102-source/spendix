import { cn } from "@/lib/utils";

interface PageContainerProps {
  children:   React.ReactNode;
  className?: string;
  /** Override max-width (defaults to max-w-none 2xl:max-w-[1500px]) */
  maxWidth?:  string;
  /** Disable horizontal padding (for full-bleed pages) */
  noPadX?:    boolean;
}

/**
 * Standard page content wrapper.
 *
 * Bottom clearance formula on mobile/tablet:
 *   pb = NAV_H (68px) + NAV_MARGIN (6px) + BREATHING (14px) = 88px
 *   + env(safe-area-inset-bottom, 0px) for notched devices
 * If you change NAV_H in BottomNav.tsx, update the literal below too.
 */
export function PageContainer({
  children,
  className,
  maxWidth = "max-w-none 2xl:max-w-[1500px]",
  noPadX   = false,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "w-full mx-auto",
        !noPadX && "px-3 sm:px-5 lg:px-7 xl:px-8",
        "pt-3 sm:pt-5 lg:pt-7",
        // Mobile/tablet: clear the fixed BottomNav + device safe-area-inset-bottom.
        // Desktop (lg+): normal 32px bottom padding — no BottomNav.
        "pb-[calc(88px+env(safe-area-inset-bottom,0px))] lg:pb-8",
        maxWidth,
        className,
      )}
    >
      {children}
    </div>
  );
}
