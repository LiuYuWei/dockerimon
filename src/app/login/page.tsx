
"use client";

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label"; // Label not used directly in form but good to keep
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { PackageSearch, LogIn } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEFAULT_ADMIN_EMAIL = "admin@dockerimon.com";
const DEFAULT_ADMIN_PASSWORD = "password";

export default function LoginPage() {
  const { login, isLoading: authIsLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });
  
  React.useEffect(() => {
    if (!authIsLoading && isAuthenticated) {
      router.push('/');
    }
  }, [authIsLoading, isAuthenticated, router]);


  const onSubmit = (data: LoginFormValues) => {
    let expectedPassword = DEFAULT_ADMIN_PASSWORD;
    let storedUser = null;

    try {
      const storedAuth = localStorage.getItem('dockerimonAuth');
      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        if (parsedAuth.user && parsedAuth.user.email === data.email && parsedAuth.user.password) {
          storedUser = parsedAuth.user;
          expectedPassword = parsedAuth.user.password;
        }
      }
    } catch (e) {
      console.error("Error reading auth from local storage", e);
      // Fallback to default if localStorage is corrupted or inaccessible
    }

    if (data.email === DEFAULT_ADMIN_EMAIL && data.password === expectedPassword) {
      const userName = storedUser?.name || "Admin User"; // Use stored name if available
      login({ name: userName, email: data.email }, data.password); // Pass the password used for login
      router.push('/');
      toast({
        title: "Login Successful",
        description: "Welcome back!",
      });
    } else {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: "Invalid email or password.",
      });
      form.setError("root", { message: "Invalid email or password." })
    }
  };
  
  // If already authenticated and not loading, redirect away from login
  if (!authIsLoading && isAuthenticated) {
    return null; // Or a loading spinner while redirecting
  }
  // If auth is loading, show nothing or a minimal loader to prevent flash of login form
  if (authIsLoading) {
     return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <PackageSearch size={64} className="text-primary animate-pulse" />
        </div>
     );
  }


  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-sm shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-4">
            <PackageSearch size={48} className="text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Welcome to Dockerimon</CardTitle>
          <CardDescription>Enter your credentials to access your dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@dockerimon.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <p className="text-sm font-medium text-destructive">{form.formState.errors.root.message}</p>
              )}
              <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Logging in..." : "Login"}
                <LogIn className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </Form>
        </CardContent>
        <CardFooter className="text-center text-xs text-muted-foreground">
          <p>Default credentials: admin@dockerimon.com / password</p>
        </CardFooter>
      </Card>
    </div>
  );
}
