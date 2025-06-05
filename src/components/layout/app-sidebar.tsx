
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, useEffect } from "react";
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  LayoutDashboard,
  Archive,
  FileText,
  Settings,
  LogOut,
  PackageSearch,
  Edit3,
  Moon,
  Sun,
  Layers, 
  HardDrive, 
  TerminalSquare,
  Combine,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogTrigger } from "@/components/ui/dialog";
import { EditProfileDialog, type ProfileFormValues } from "@/components/layout/EditProfileDialog";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useTheme } from "next-themes";


const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/containers", label: "Containers", icon: Archive },
  { href: "/images", label: "Images", icon: Layers },
  { href: "/volumes", label: "Volumes", icon: HardDrive },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/actions", label: "Actions", icon: TerminalSquare },
  { href: "/compose", label: "Compose", icon: Combine },
];

const getInitials = (name: string) => {
  if (!name) return 'U';
  const names = name.split(' ');
  if (!names[0]) return 'U';
  let initials = names[0].substring(0, 1).toUpperCase();
  if (names.length > 1 && names[names.length - 1]) {
    initials += names[names.length - 1].substring(0, 1).toUpperCase();
  }
  return initials;
};

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout, updateUser, isAuthenticated, isLoading: authIsLoading } = useAuth();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true); 
  }, []);
  
  const handleProfileSave = (data: ProfileFormValues) => {
    if (user) {
      updateUser(data);
    }
    setIsEditDialogOpen(false); 
  };

  if (authIsLoading) {
      return (
        <Sidebar collapsible="icon" variant="sidebar" side="left" className="opacity-50 pointer-events-none flex-shrink-0">
            <SidebarHeader className="h-auto p-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full"><PackageSearch size={28} /></Button>
                </div>
            </SidebarHeader>
             <SidebarContent className="p-2 space-y-2">
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div>
                <div className="h-8 bg-muted rounded w-full opacity-50"></div> 
            </SidebarContent>
            <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
                 <div className="h-8 bg-muted rounded w-full opacity-50 mb-2"></div>
                 <div className="h-8 bg-muted rounded w-full opacity-50"></div>
            </SidebarFooter>
        </Sidebar>
      );
  }
  
  if ((!isAuthenticated && pathname !== '/login') || pathname === '/login') {
    return null; 
  }

  const currentUserName = user?.name || "User";
  const currentUserEmail = user?.email || "user@example.com";

  return (
    <Sidebar collapsible="icon" variant="sidebar" side="left" className="flex-shrink-0">
      <SidebarHeader className="h-auto p-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10 text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent rounded-full">
             <PackageSearch size={28} />
          </Button>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <h1 className="text-xl font-semibold text-sidebar-foreground font-headline">
              Dockerimon
            </h1>
            <span className="text-xs text-sidebar-foreground/70 -mt-0.5">Preview Edition</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navItems.map((item) => (
             <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === item.href}
                  tooltip={{ children: item.label, side: "right", align:"center", className: "group-data-[collapsible=icon]:block hidden" }}
                  className={cn(
                    "justify-start",
                    pathname === item.href && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <Link href={item.href}>
                    <item.icon className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2 mt-auto border-t border-sidebar-border">
        <SidebarMenu>
           <SidebarMenuItem>
            <Popover>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                    tooltip={{ children: "Settings", side: "right", align:"center", className: "group-data-[collapsible=icon]:block hidden" }}
                    className="justify-start w-full">
                    <Settings className="h-5 w-5" />
                    <span className="group-data-[collapsible=icon]:hidden">Settings</span>
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent className="w-auto min-w-[220px] p-3 bg-popover text-popover-foreground border-border shadow-xl rounded-lg" side="top" align="start">
                <div className="space-y-2">
                  <h4 className="font-medium leading-none text-sm mb-2">Theme Settings</h4>
                  <div className="flex items-center justify-between p-2 rounded-md hover:bg-muted transition-colors">
                    <Label htmlFor="dark-mode-switch" className="flex items-center gap-2 text-sm cursor-pointer select-none">
                      {mounted && (theme === 'dark' ? <Moon className="h-4 w-4 text-muted-foreground" /> : <Sun className="h-4 w-4 text-muted-foreground" />)}
                      {!mounted && <Sun className="h-4 w-4 text-muted-foreground" />}
                      <span>Dark Mode</span>
                    </Label>
                    {mounted ? (
                       <Switch
                        id="dark-mode-switch"
                        checked={theme === "dark"}
                        onCheckedChange={() => setTheme(theme === "dark" ? "light" : "dark")}
                        aria-label="Toggle dark mode"
                      />
                    ) : (
                      <div className="h-6 w-11 rounded-full bg-input" /> 
                    )}
                  </div>
                </div>
              </PopoverContent>
            </Popover>
           </SidebarMenuItem>
           <SidebarMenuItem>
             <SidebarMenuButton
                onClick={logout}
                tooltip={{ children: "Logout", side: "right", align:"center", className: "group-data-[collapsible=icon]:block hidden" }}
                className="justify-start">
                <LogOut className="h-5 w-5" />
                <span className="group-data-[collapsible=icon]:hidden">Logout</span>
             </SidebarMenuButton>
           </SidebarMenuItem>
        </SidebarMenu>
        <Separator className="my-2 group-data-[collapsible=icon]:hidden bg-sidebar-border" />
        
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:justify-center w-full text-left hover:bg-sidebar-accent/20 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
              <Avatar className="h-8 w-8">
                <AvatarImage src="https://placehold.co/40x40.png" alt="User Avatar" data-ai-hint="user avatar" />
                <AvatarFallback>{getInitials(currentUserName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col group-data-[collapsible=icon]:hidden">
                <span className="text-sm font-medium text-sidebar-foreground truncate max-w-[120px]">{currentUserName}</span>
                <span className="text-xs text-sidebar-foreground/70 truncate max-w-[120px]">{currentUserEmail}</span>
              </div>
              <Edit3 className="ml-auto h-4 w-4 text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden group-hover:text-sidebar-foreground transition-colors" />
            </button>
          </DialogTrigger>
          <EditProfileDialog
            currentName={currentUserName}
            currentEmail={currentUserEmail}
            onSave={handleProfileSave}
          />
        </Dialog>
      </SidebarFooter>
    </Sidebar>
  );
}
