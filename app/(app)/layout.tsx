import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import GuestBanner from "@/components/layout/GuestBanner";
import BottomNav from "@/components/navigation/BottomNav";
import GlobalModals from "@/components/modals/GlobalModals";
import PageTransition from "@/components/navigation/PageTransition";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import LastPageTracker from "@/components/navigation/LastPageTracker";
import SchedulerTrigger from "@/components/layout/SchedulerTrigger";
import LiveBackground from "@/components/layout/LiveBackground";
import RoomGuard from "@/components/layout/RoomGuard";
import { GuestProvider } from "@/contexts/GuestContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { GlobalActionsProvider } from "@/contexts/GlobalActionsContext";
import { LedgerProvider } from "@/contexts/LedgerContext";
import { RoomLockProvider } from "@/contexts/RoomLockContext";
import { CurrencyProvider } from "@/lib/currency";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <GuestProvider>
        <LedgerProvider>
          <GlobalActionsProvider>
            <RoomLockProvider>
              <SidebarProvider>
                <div className="app-shell relative flex h-screen overflow-hidden">
                  <LiveBackground />
                  {/* Sidebar — desktop only */}
                  <div className="hidden lg:flex shrink-0">
                    <Sidebar />
                  </div>

                  {/* Main column */}
                  <div className="app-main-panel relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
                    <TopBar />
                    <GuestBanner />
                    <main className="flex-1 overflow-y-auto overflow-x-hidden">
                      <PageTransition>
                        {/* Responsive container:
                            mobile  → 16px sides, 16px top
                            sm      → 20px sides, 20px top
                            lg      → 24px sides, 24px top
                            xl      → centered, max 1280px
                            bottom  → clears bottom nav on mobile/tablet, normal on desktop
                        */}
                        <div className="
                          w-full mx-auto
                          px-3 sm:px-5 lg:px-7 xl:px-8
                          pt-3 sm:pt-5 lg:pt-7
                          pb-[calc(88px+env(safe-area-inset-bottom,0px))] lg:pb-8
                          max-w-none 2xl:max-w-[1500px]
                        ">
                          <Breadcrumbs />
                          <RoomGuard>
                            {children}
                          </RoomGuard>
                        </div>
                      </PageTransition>
                    </main>
                  </div>
                </div>

                {/* Bottom nav — hidden on desktop */}
                <div className="lg:hidden">
                  <BottomNav />
                </div>

                <GlobalModals />
                <LastPageTracker />
                <SchedulerTrigger />
              </SidebarProvider>
            </RoomLockProvider>
          </GlobalActionsProvider>
        </LedgerProvider>
      </GuestProvider>
    </CurrencyProvider>
  );
}
