
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton'; // For loading state

interface User {
  name: string;
  email: string;
  password?: string; // Password is now part of the user object for local storage
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  login: (userData: User, passwordUsed: string) => void; // login now takes password used
  logout: () => void;
  updateUser: (newUserData: Partial<User> & { newPassword?: string }) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      const storedAuth = localStorage.getItem('dockerimonAuth');
      if (storedAuth) {
        const parsedAuth = JSON.parse(storedAuth);
        if (parsedAuth.isAuthenticated && parsedAuth.user) {
          setUser(parsedAuth.user); // User object from localStorage might contain the password
          setIsAuthenticated(true);
        }
      }
    } catch (error) {
      console.error("Failed to parse auth data from localStorage", error);
      localStorage.removeItem('dockerimonAuth');
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading && !isAuthenticated && pathname !== '/login') {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router, pathname]);

  const login = useCallback((userData: User, passwordUsed: string) => {
    const userToStore: User = { ...userData, password: passwordUsed };
    setUser(userToStore);
    setIsAuthenticated(true);
    localStorage.setItem('dockerimonAuth', JSON.stringify({ isAuthenticated: true, user: userToStore }));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    // localStorage.removeItem('dockerimonAuth'); // <-- This line is removed/commented out
    router.push('/login');
  }, [router]);
  
  const updateUser = useCallback((newUserData: Partial<User> & { newPassword?: string }) => {
    setUser(prevUser => {
      if (prevUser) {
        const updatedUser: User = { 
          ...prevUser, 
          name: newUserData.name || prevUser.name,
          email: newUserData.email || prevUser.email,
        };
        if (newUserData.newPassword) {
          updatedUser.password = newUserData.newPassword;
        }
        localStorage.setItem('dockerimonAuth', JSON.stringify({ isAuthenticated: true, user: updatedUser }));
        return updatedUser;
      }
      return null;
    });
  }, []);


  if (isLoading) {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="h-16 bg-muted/40 border-b p-4 flex items-center">
          <Skeleton className="h-8 w-32" />
        </header>
        <div className="flex flex-1">
          <aside className="w-16 md:w-64 bg-muted/40 border-r p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </aside>
          <main className="flex-1 p-6 space-y-6">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </main>
        </div>
      </div>
    );
  }
  
  if (!isAuthenticated && pathname !== '/login') {
     return null;
  }


  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
