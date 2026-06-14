import { PageErrorBoundary } from "@/components/system/ErrorBoundary";
import { PageContainer } from "@/components/layout/PageContainer";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";
import BottomNav from "@/components/navigation/BottomNav";
import GlobalModals from "@/components/modals/GlobalModals";
import FinancialActionHub from "@/components/actions/FinancialActionHub";
import PageTransition from "@/components/navigation/PageTransition";
import Breadcrumbs from "@/components/navigation/Breadcrumbs";
import LastPageTracker from "@/components/navigation/LastPageTracker";
import SchedulerTrigger from "@/components/layout/SchedulerTrigger";
import { FinancialEventBridge } from "@/components/system/FinancialEventBridge";
import MutationErrorToast from "@/components/system/MutationErrorToast";
import AuthGate from "@/components/system/AuthGate";
import AuthStatusBadge from "@/components/system/AuthStatusBadge";
import SessionRestorer from "@/components/system/SessionRestorer";
import PullToRefreshWrapper from "@/components/layout/PullToRefreshWrapper";
import LiveBackground from "@/components/layout/LiveBackground";
import RoomGuard from "@/components/layout/RoomGuard";
import { GuestProvider } from "@/contexts/GuestContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { GlobalActionsProvider } from "@/contexts/GlobalActionsContext";
import { LedgerProvider } from "@/contexts/LedgerContext";
import { RoomLockProvider } from "@/contexts/RoomLockContext";
import { CurrencyProvider } from "@/lib/currency";
import { PlanProvider } from "@/contexts/PlanContext";
import { NavigationProvider } from "@/lib/navigation/manager";
import { OfflineBanner } from "@/components/offline/OfflineBanner";
import { PWAUpdatePrompt } from "@/components/offline/PWAUpdatePrompt";
import { ModeProvider } from "@/contexts/ModeContext";
import { FrontendErrorReporter } from "@/components/system/FrontendErrorReporter";
import { FeedbackWidget } from "@/components/feedback/FeedbackWidget";
import { PerformanceTracker } from "@/components/monitoring/PerformanceTracker";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <NavigationProvider>
    <ModeProvider>
    <CurrencyProvider>
      <PlanProvider>
      <GuestProvider>
        <LedgerProvider>
          <GlobalActionsProvider>
            <RoomLockProvider>
              <SidebarProvider>
                <div className="app-shell relative flex h-dvh overflow-hidden">
                  <LiveBackground />
                  {/* Sidebar — desktop only */}
                  <div className="hidden lg:flex shrink-0">
                    <Sidebar />
                  </div>

                  {/* Main column */}
                  <div className="app-main-panel relative z-10 flex-1 flex flex-col overflow-hidden min-w-0">
                    <TopBar />
                    <main className="flex-1 overflow-y-auto overflow-x-hidden">
                      <PageTransition>
                        <PageContainer>
                          <Breadcrumbs />
                          <AuthGate>
                            <RoomGuard>
                              <PageErrorBoundary>
                                {children}
                              </PageErrorBoundary>
                            </RoomGuard>
                          </AuthGate>
                        </PageContainer>
                      </PageTransition>
                    </main>
                  </div>
                </div>

                {/* Bottom nav — hidden on desktop */}
                <div className="lg:hidden">
                  <BottomNav />
                </div>

                <GlobalModals />
                <FinancialActionHub />
                <LastPageTracker />
                <SchedulerTrigger />
                <FinancialEventBridge />
                <MutationErrorToast />
                <AuthStatusBadge />
                <SessionRestorer />
                <PullToRefreshWrapper />
                <OfflineBanner />
                <PWAUpdatePrompt />
                <FrontendErrorReporter />
                <FeedbackWidget />
                <PerformanceTracker />
              </SidebarProvider>
            </RoomLockProvider>
          </GlobalActionsProvider>
        </LedgerProvider>
      </GuestProvider>
      </PlanProvider>
    </CurrencyProvider>
    </ModeProvider>
    </NavigationProvider>
  );
}
