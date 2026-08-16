import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NavigationProgress } from "@/components/layout/navigation-progress";
import { TopNavbar } from "@/components/layout/top-navbar";
import { NewOrderSoundWatcher } from "@/components/orders/new-order-sound-watcher";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
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
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <TopNavbar />
          <div className="flex flex-1 flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-6">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
