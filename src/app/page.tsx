
"use client";

import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Cpu, Archive, AlertCircle, CheckCircle, Server, Loader2, Terminal, Home, RefreshCcw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';

interface DashboardStats {
  containerCounts: { total: number; running: number; stopped: number; critical: number };
  overallCpuUsagePercent: number;
  overallMemory: { used: string; total: string; percent: number };
  cpuUsageBreakdown: { name: string; value: number }[];
  memoryUsageBreakdown: { name: string; value: number; usage: string; limit: string }[];
  networkTrafficBreakdown: { name: string; received: number; sent: number; receivedStr: string; sentStr: string }[];
  diskIOBreakdown: { name: string; read: number; write: number; readStr: string; writeStr: string }[];
}

const cpuChartConfig = {
  value: { label: "CPU Usage (%)", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig;

const memoryChartConfig = {
  value: { label: "Memory Usage (%)", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const networkChartConfig = {
  received: { label: "Received", color: "hsl(var(--chart-1))" },
  sent: { label: "Sent", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const diskChartConfig = {
  read: { label: "Read", color: "hsl(var(--chart-1))" },
  write: { label: "Write", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const MIN_REFRESH_INTERVAL_SECONDS = 5;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 30;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(false);
  const [inputDisplayInterval, setInputDisplayInterval] = useState(String(DEFAULT_REFRESH_INTERVAL_SECONDS));
  const [refreshIntervalSetting, setRefreshIntervalSetting] = useState(DEFAULT_REFRESH_INTERVAL_SECONDS);
  const [refreshInputError, setRefreshInputError] = useState<string | null>(null);


  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Dashboard", isCurrent: true }
  ];

  const fetchDashboardStats = useCallback(async (isSilent = false) => {
    if (!isAuthenticated) return;
    if (!isSilent) {
      setIsLoading(true);
    }
    // setError(null); // Keep previous error visible until new data or new error
    try {
      const response = await fetch('/api/dashboard-stats');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: DashboardStats = await response.json();
      setStats(data);
      setError(null); // Clear error on successful fetch
    } catch (e: any) {
      setError(e.message || "An unknown error occurred while fetching dashboard stats.");
      // Do not clear stats on error, keep showing stale data if available
      if (!isSilent) { // Only show toast for user-initiated or first load errors
        toast({
          variant: "destructive",
          title: "Refresh Failed",
          description: e.message || "Could not update dashboard data.",
        });
      }
    } finally {
      if (!isSilent) {
        setIsLoading(false);
      }
    }
  }, [isAuthenticated, toast]);


  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardStats();
    }
  }, [isAuthenticated, fetchDashboardStats]);


  useEffect(() => {
    let intervalId: NodeJS.Timeout | undefined = undefined;

    if (isAutoRefreshEnabled && refreshIntervalSetting >= MIN_REFRESH_INTERVAL_SECONDS) {
      setRefreshInputError(null); 
      intervalId = setInterval(() => {
        fetchDashboardStats(true); // Silent refresh
      }, refreshIntervalSetting * 1000);
    } else if (isAutoRefreshEnabled && refreshIntervalSetting < MIN_REFRESH_INTERVAL_SECONDS) {
      setIsAutoRefreshEnabled(false);
      setRefreshInputError(`Minimum interval is ${MIN_REFRESH_INTERVAL_SECONDS}s. Auto-refresh disabled.`);
      toast({
        variant: "destructive",
        title: "Auto-Refresh Disabled",
        description: `Interval too short. Minimum is ${MIN_REFRESH_INTERVAL_SECONDS} seconds.`,
      });
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isAutoRefreshEnabled, refreshIntervalSetting, fetchDashboardStats, toast]);

  const handleInputIntervalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputDisplayInterval(value);
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue) && numValue >= MIN_REFRESH_INTERVAL_SECONDS) {
      setRefreshIntervalSetting(numValue);
      setRefreshInputError(null);
    } else if (value === "") { // Allow empty input while typing
      setRefreshInputError(null); // Or specific message like "Enter a number"
    } else {
      setRefreshInputError(`Min ${MIN_REFRESH_INTERVAL_SECONDS}s. Invalid input will use last valid interval if auto-refresh is on.`);
      // Don't change refreshIntervalSetting here, let it use the last valid one
    }
  };
  
  const handleAutoRefreshToggle = (checked: boolean) => {
    setIsAutoRefreshEnabled(checked);
    if (checked) {
      // Validate current inputDisplayInterval when enabling
      const numValue = parseInt(inputDisplayInterval, 10);
      if (isNaN(numValue) || numValue < MIN_REFRESH_INTERVAL_SECONDS) {
        setRefreshInputError(`Min interval is ${MIN_REFRESH_INTERVAL_SECONDS}s. Using default ${refreshIntervalSetting}s.`);
         toast({
            title: "Auto-Refresh Started",
            description: `Interval input is invalid. Using ${refreshIntervalSetting}s.`,
        });
      } else {
        setRefreshIntervalSetting(numValue); // Ensure the displayed input is used
        setRefreshInputError(null);
         toast({
            title: "Auto-Refresh Started",
            description: `Refreshing every ${numValue} seconds.`,
        });
      }
    } else {
      toast({
        title: "Auto-Refresh Stopped",
      });
    }
  };


  if (authIsLoading || (isLoading && !stats && isAuthenticated)) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading dashboard data...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const barKey = payload[0].dataKey;
      let tooltipContent = <p>{`${label} : ${payload[0].value}`}</p>;

      if (barKey === 'value' && data.usage && data.limit) {
        tooltipContent = (
          <>
            <p className="font-semibold">{data.name}</p>
            <p>{`Usage: ${data.value.toFixed(2)}%`}</p>
            <p className="text-sm text-muted-foreground">{`${data.usage} / ${data.limit}`}</p>
          </>
        );
      } else if (barKey === 'value') {
         tooltipContent = (
          <>
            <p className="font-semibold">{data.name}</p>
            <p>{`CPU: ${data.value.toFixed(2)}%`}</p>
          </>
        );
      } else if (data.receivedStr && data.sentStr) {
         tooltipContent = (
          <>
            <p className="font-semibold">{data.name}</p>
            <p className="text-[hsl(var(--chart-1))]">{`Received: ${data.receivedStr}`}</p>
            <p className="text-[hsl(var(--chart-2))]">{`Sent: ${data.sentStr}`}</p>
          </>
        );
      } else if (data.readStr && data.writeStr) {
         tooltipContent = (
          <>
            <p className="font-semibold">{data.name}</p>
            <p className="text-[hsl(var(--chart-1))]">{`Read: ${data.readStr}`}</p>
            <p className="text-[hsl(var(--chart-2))]">{`Write: ${data.writeStr}`}</p>
          </>
        );
      }

      return (
        <div className="bg-background/90 p-2 border border-border rounded-md shadow-lg text-xs">
          {tooltipContent}
        </div>
      );
    }
    return null;
  };


  return (
    <div className="w-full space-y-6">
      <BreadcrumbNav items={breadcrumbItems} />

      <div className="flex flex-col sm:flex-row justify-end items-center gap-2 sm:gap-4 -mb-2 sm:mb-0 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchDashboardStats(false)} // Explicitly not silent
          disabled={isLoading}
        >
          <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading && !isAutoRefreshEnabled ? 'animate-spin' : ''}`} />
          Refresh Now
        </Button>
        <div className="flex items-center gap-2">
          <Label htmlFor="refresh-interval" className="text-sm shrink-0">Interval (s):</Label>
          <Input
            id="refresh-interval"
            type="number"
            value={inputDisplayInterval}
            onChange={handleInputIntervalChange}
            className="w-20 h-9 text-sm"
            min={String(MIN_REFRESH_INTERVAL_SECONDS)}
            placeholder={String(MIN_REFRESH_INTERVAL_SECONDS)}
          />
        </div>
        <div className="flex items-center space-x-2">
          <Switch
            id="auto-refresh-switch"
            checked={isAutoRefreshEnabled}
            onCheckedChange={handleAutoRefreshToggle}
          />
          <Label htmlFor="auto-refresh-switch" className="text-sm">Auto</Label>
        </div>
      </div>
      {refreshInputError && <p className="text-destructive text-xs text-right mt-1 mb-2">{refreshInputError}</p>}


      {error && !isLoading && ( // Show error only if not actively loading new data
        <Alert variant="destructive" className="shadow-md mt-4">
          <Terminal className="h-5 w-5" />
          <AlertTitle>Error Fetching Dashboard Stats</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!stats && !isLoading && !error && isAuthenticated && (
        <div className="text-center text-muted-foreground py-10 w-full">
          <Server className="mx-auto h-12 w-12 mb-4" />
          <p className="text-lg">No dashboard data could be loaded.</p>
          <p>Ensure Docker is running and accessible, then try refreshing.</p>
        </div>
      )}
      
      {stats && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 pt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Containers</CardTitle>
                <Archive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.containerCounts.total}</div>
                <p className="text-xs text-muted-foreground">&nbsp;</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Running Containers</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.containerCounts.running}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.containerCounts.total > 0
                    ? `${((stats.containerCounts.running / stats.containerCounts.total) * 100).toFixed(1)}% of total`
                    : "0% of total"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Stopped Containers</CardTitle>
                <AlertCircle className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.containerCounts.stopped}</div>
                <p className="text-xs text-muted-foreground">{stats.containerCounts.critical > 0 ? `${stats.containerCounts.critical} exited with error` : "All exited cleanly"}</p>
              </CardContent>
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall CPU (Containers)</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.overallCpuUsagePercent.toFixed(2)}%</div>
                <p className="text-xs text-muted-foreground">Avg. across running containers</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CPU Usage by Container (%)</CardTitle>
                <CardDescription>Top running containers by CPU utilization.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.cpuUsageBreakdown && stats.cpuUsageBreakdown.length > 0 ? (
                  <ChartContainer config={cpuChartConfig} className="h-[300px] w-full">
                    <BarChart data={stats.cpuUsageBreakdown} layout="vertical" margin={{ right: 20, left:30 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} dataKey="value" />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 12}} width={80} interval={0} />
                      <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={4} barSize={20} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">No running containers to display CPU stats.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Memory Usage by Container (%)</CardTitle>
                <CardDescription>Top running containers by memory utilization.</CardDescription>
              </CardHeader>
              <CardContent>
                 {stats.memoryUsageBreakdown && stats.memoryUsageBreakdown.length > 0 ? (
                  <ChartContainer config={memoryChartConfig} className="h-[300px] w-full">
                    <BarChart data={stats.memoryUsageBreakdown} layout="vertical" margin={{ right: 20, left:30 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} dataKey="value" />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 12}} width={80} interval={0} />
                      <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<CustomTooltip />} />
                      <Bar dataKey="value" fill="var(--color-value)" radius={4} name="Memory Usage" barSize={20} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">No running containers to display memory stats.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Network Traffic</CardTitle>
                <CardDescription>Received vs Sent data by top containers.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.networkTrafficBreakdown && stats.networkTrafficBreakdown.length > 0 ? (
                  <ChartContainer config={networkChartConfig} className="h-[300px] w-full">
                    <BarChart data={stats.networkTrafficBreakdown} layout="vertical" margin={{ right: 20, left:30}}>
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 12}} width={80} interval={0} />
                      <XAxis type="number" tickFormatter={(value) => `${(value / (1024*1024)).toFixed(1)}MB`} />
                      <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<CustomTooltip />} />
                      <Bar dataKey="received" fill="var(--color-received)" radius={4} name="Received" stackId="a" barSize={20} />
                      <Bar dataKey="sent" fill="var(--color-sent)" radius={4} name="Sent" stackId="a" barSize={20} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">No network traffic data available.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Disk I/O</CardTitle>
                <CardDescription>Read vs Write operations by top containers.</CardDescription>
              </CardHeader>
              <CardContent>
                {stats.diskIOBreakdown && stats.diskIOBreakdown.length > 0 ? (
                  <ChartContainer config={diskChartConfig} className="h-[300px] w-full">
                    <BarChart data={stats.diskIOBreakdown} layout="vertical" margin={{ top: 5, right: 20, left:30, bottom: 5 }}>
                      <CartesianGrid horizontal={false} />
                      <YAxis dataKey="name" type="category" tick={{fontSize: 12}} width={80} interval={0} />
                      <XAxis type="number" tickFormatter={(value) => `${(value / (1024*1024)).toFixed(1)}MB`} />
                      <ChartTooltip cursor={{fill: 'hsl(var(--muted))'}} content={<CustomTooltip />} />
                      <Bar dataKey="read" fill="var(--color-read)" radius={4} name="Read" stackId="a" barSize={20}/>
                      <Bar dataKey="write" fill="var(--color-write)" radius={4} name="Write" stackId="a" barSize={20}/>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-10">No disk I/O data available.</p>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

