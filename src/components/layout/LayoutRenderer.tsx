
"use client";

import { usePathname } from 'next/navigation';
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import type { ReactNode } from 'react';

export function LayoutRenderer({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    // For the login page, render children directly without the sidebar layout
    // The LoginPage component itself handles its full-screen flex centering
    return <>{children}</>;
  }

  // Default layout for authenticated pages
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex flex-1 min-h-screen bg-background"> {/* Added flex-1 to make this div expand */}
        <AppSidebar />
        <SidebarInset className="flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto"> {/* flex-1 here ensures main content takes space within this div */}
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

    
