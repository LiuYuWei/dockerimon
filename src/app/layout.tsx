
import type { Metadata } from "next";
import "./globals.css";
// import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"; // Moved to LayoutRenderer
// import { AppSidebar } from "@/components/layout/app-sidebar"; // Moved to LayoutRenderer
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "next-themes";
import { LayoutRenderer } from "@/components/layout/LayoutRenderer";


export const metadata: Metadata = {
  title: "Dockerimon - Docker Monitoring Platform",
  description: "Monitor your Docker containers with ease.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <LayoutRenderer>{children}</LayoutRenderer>
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
