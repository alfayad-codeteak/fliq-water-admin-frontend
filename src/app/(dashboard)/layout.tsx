import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { TopNavbar } from "@/components/layout/top-navbar";
import { NewOrderSoundWatcher } from "@/components/orders/new-order-sound-watcher";
import { TooltipProvider } from "@/components/ui/tooltip";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <TooltipProvider>
      <NavigationProgress />
      <NewOrderSoundWatcher />
      <div className="flex h-svh min-h-0 flex-col bg-white">
        <TopNavbar />
        <div className="flex min-h-0 flex-1">
          <AppSidebar />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-slate-50">
            <div className="mx-auto w-full max-w-[1400px] px-4 py-5 font-semibold text-slate-900 sm:px-6 sm:py-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
