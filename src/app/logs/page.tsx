
"use client";

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from '@/components/ui/badge';
import type { LogEntry, Container } from "@/types";
import { cn } from '@/lib/utils';
import { FileText, Search, Loader2, AlertTriangle, Terminal, Download, RotateCcw, Home, Filter } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const LOG_LEVELS: LogEntry['level'][] = ['info', 'warn', 'error', 'debug'];

const LogLevelBadge: React.FC<{ level?: LogEntry['level'] }> = ({ level }) => {
  if (!level) return null;
  const baseClasses = "text-xs px-1.5 py-0.5";
  switch (level) {
    case 'info':
      return <Badge variant="default" className={cn(baseClasses, "bg-blue-500 hover:bg-blue-600 text-white")}>INFO</Badge>;
    case 'warn':
      return <Badge variant="default" className={cn(baseClasses, "bg-yellow-500 hover:bg-yellow-600 text-black")}>WARN</Badge>;
    case 'error':
      return <Badge variant="destructive" className={cn(baseClasses)}>ERROR</Badge>;
    case 'debug':
      return <Badge variant="secondary" className={cn(baseClasses, "bg-gray-500 hover:bg-gray-600 text-white")}>DEBUG</Badge>;
    default:
      return <Badge variant="outline" className={cn(baseClasses)}>{String(level).toUpperCase()}</Badge>;
  }
};


export default function LogsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedContainer, setSelectedContainer] = useState<string | undefined>(searchParams.get('containerId') || undefined);
  const [selectedContainerName, setSelectedContainerName] = useState<string | undefined>(searchParams.get('containerName') || undefined);
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const [availableContainers, setAvailableContainers] = useState<Pick<Container, 'id' | 'name'>[]>([]);
  const [isLoadingContainers, setIsLoadingContainers] = useState(true);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [containersError, setContainersError] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  
  const initialLogLevels = new Set<LogEntry['level']>();
  LOG_LEVELS.forEach(level => initialLogLevels.add(level));
  const [selectedLogLevels, setSelectedLogLevels] = useState<Set<LogEntry['level']>>(initialLogLevels);


  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  const fetchContainersList = async () => {
    setIsLoadingContainers(true);
    setContainersError(null);
    try {
      const response = await fetch('/api/containers');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: Container[] = await response.json();
      const containerOptions = data.map(c => ({ id: c.id, name: c.name || c.id.substring(0,12) }));
      setAvailableContainers(containerOptions);

      const currentContainerId = searchParams.get('containerId');
      if (currentContainerId && containerOptions.some(c => c.id === currentContainerId)) {
        setSelectedContainer(currentContainerId);
        setSelectedContainerName(containerOptions.find(c => c.id === currentContainerId)?.name);
      }
    } catch (e: any) {
      setContainersError(e.message || "Failed to load containers list.");
      setAvailableContainers([]);
    } finally {
      setIsLoadingContainers(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchContainersList();
    }
  }, [isAuthenticated]); 

  const fetchLogsForContainer = async () => {
    if (!selectedContainer) {
      setLogs([]);
      setLogsError(null);
      return;
    }
    setIsLoadingLogs(true);
    setLogsError(null);
    setLogs([]); 
    try {
      const response = await fetch(`/api/logs/${selectedContainer}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: LogEntry[] = await response.json();
      setLogs(data.slice(-200)); 
    } catch (e: any) {
      setLogsError(e.message || `Failed to load logs for ${selectedContainerName || selectedContainer.substring(0,12)}.`);
      setLogs([]);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && selectedContainer) {
      fetchLogsForContainer();
    } else if (!selectedContainer) {
        setLogs([]);
        setLogsError(null);
    }
  }, [selectedContainer, isAuthenticated]);
  
  useEffect(() => {
    if (scrollAreaRef.current) {
        const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTop = viewport.scrollHeight;
        }
    }
  }, [logs, isLoadingLogs]);

  const handleContainerChange = (containerId: string) => {
    const container = availableContainers.find(c => c.id === containerId);
    setSelectedContainer(containerId);
    setSelectedContainerName(container?.name);
    const params = new URLSearchParams(searchParams.toString());
    params.set('containerId', containerId);
    if (container?.name) {
      params.set('containerName', container.name);
    } else {
      params.delete('containerName');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleLogLevelChange = (level: LogEntry['level']) => {
    setSelectedLogLevels(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(level)) {
        newSelected.delete(level);
      } else {
        newSelected.add(level);
      }
      return newSelected;
    });
  };

  const filteredLogs = useMemo(() => {
    if (selectedLogLevels.size === 0) return []; // If no levels selected, show no logs
    return logs.filter(log => {
      const searchTermMatch = log.message.toLowerCase().includes(searchTerm.toLowerCase());
      // Treat logs with undefined level as 'info' for filtering purposes if 'info' is selected.
      const effectiveLevel = log.level || ('info' as LogEntry['level']);
      const logLevelMatch = selectedLogLevels.has(effectiveLevel);
      return searchTermMatch && logLevelMatch;
    });
  }, [logs, searchTerm, selectedLogLevels]);


  const handleDownloadLogs = () => {
    if (filteredLogs.length === 0 || !selectedContainer) return;

    const logText = filteredLogs.map(log => {
      const level = log.level ? `[${log.level.toUpperCase()}]` : '[INFO]'; 
      return `${log.timestamp} ${level} ${log.message}`;
    }).join('\n');

    const blob = new Blob([logText], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    const safeContainerName = (selectedContainerName || selectedContainer.substring(0,8)).replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `${safeContainerName}_logs_${date}.log`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Logs", isCurrent: true }
  ];
  
  if (authIsLoading || (isLoadingContainers && isAuthenticated && !availableContainers.length)) {
     return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading page data...</p>
      </div>
    );
  }
  
  if (!isAuthenticated && !authIsLoading) { 
    return null;
  }


  return (
    <div className="w-full space-y-6 h-[calc(100vh-theme(spacing.24))] flex flex-col">
      <BreadcrumbNav items={breadcrumbItems} />

      {containersError && !isLoadingContainers && (
         <Alert variant="destructive" className="shadow-md">
          <Terminal className="h-5 w-5" />
          <AlertTitle>Error Loading Containers List</AlertTitle>
          <AlertDescription>{containersError}</AlertDescription>
        </Alert>
      )}

      <Card className="flex-grow flex flex-col shadow-lg overflow-hidden">
        <CardHeader className="border-b p-4">
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 items-center">
            <div className="flex-1 min-w-[200px] w-full sm:w-auto">
              <Select 
                value={selectedContainer} 
                onValueChange={handleContainerChange}
                disabled={isLoadingContainers || availableContainers.length === 0}
              >
                <SelectTrigger id="container-select" aria-label="Select container">
                  <SelectValue placeholder={isLoadingContainers ? "Loading containers..." : (availableContainers.length === 0 && !containersError ? "No containers found" : "Select a container")} />
                </SelectTrigger>
                <SelectContent>
                  {!isLoadingContainers && availableContainers.length === 0 && !containersError && (
                    <div className="p-4 text-sm text-muted-foreground text-center">No containers found.</div>
                  )}
                   {!isLoadingContainers && containersError && (
                    <div className="p-4 text-sm text-destructive text-center">Error loading list.</div>
                  )}
                  {availableContainers.map(container => (
                    <SelectItem key={container.id} value={container.id}>
                      {container.name} ({container.id.substring(0,8)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 relative w-full sm:w-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search logs..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={isLoadingLogs || (!selectedContainer && logs.length === 0)}
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto" title="Filter log levels">
                  <Filter className="mr-2 h-4 w-4" />
                  Levels ({selectedLogLevels.size})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Filter by Log Level</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {LOG_LEVELS.map(level => (
                  <DropdownMenuCheckboxItem
                    key={level}
                    checked={selectedLogLevels.has(level)}
                    onCheckedChange={() => handleLogLevelChange(level)}
                    onSelect={(e) => e.preventDefault()} // Prevents menu from closing on item select
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button 
              variant="outline" 
              onClick={fetchLogsForContainer} 
              disabled={isLoadingLogs || !selectedContainer}
              title="Refresh logs"
              className="w-full sm:w-auto"
            >
              <RotateCcw className={cn("mr-2 h-4 w-4", isLoadingLogs && "animate-spin")} />
              Refresh
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDownloadLogs} 
              disabled={isLoadingLogs || filteredLogs.length === 0 || !selectedContainer}
              title="Download current logs"
              className="w-full sm:w-auto"
            >
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-grow overflow-hidden">
          <ScrollArea className="h-full" ref={scrollAreaRef}>
            <div className="p-4 space-y-1.5 font-mono text-xs">
              {isLoadingLogs && (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 space-y-3">
                  <Loader2 className="h-12 w-12 animate-spin text-primary" />
                  <p className="text-lg">Loading logs for {selectedContainerName || selectedContainer?.substring(0,12)}...</p>
                </div>
              )}
              {!isLoadingLogs && logsError && (
                <Alert variant="destructive" className="m-4">
                  <AlertTriangle className="h-5 w-5" />
                  <AlertTitle>Error Loading Logs</AlertTitle>
                  <AlertDescription>{logsError}</AlertDescription>
                </Alert>
              )}
              {!isLoadingLogs && !logsError && filteredLogs.length > 0 && (
                filteredLogs.map(log => (
                  <div key={log.id} className="flex items-start gap-2 py-0.5 border-b border-border/30 last:border-b-0">
                    <span className="text-muted-foreground/80 whitespace-nowrap tabular-nums pt-px">{log.timestamp}</span>
                    <LogLevelBadge level={log.level} />
                    <span className="flex-1 break-all whitespace-pre-wrap pt-px">{log.message}</span>
                  </div>
                ))
              )}
              {!isLoadingLogs && !logsError && filteredLogs.length === 0 && selectedContainer && !searchTerm && logs.length === 0 && (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 space-y-3">
                  <FileText className="h-16 w-16" />
                  <p className="text-lg">No logs found for {selectedContainerName || availableContainers.find(c=>c.id === selectedContainer)?.name}.</p>
                  <p>The container might not have produced any output recently or logs are filtered out.</p>
                </div>
              )}
              {!isLoadingLogs && !logsError && filteredLogs.length === 0 && selectedContainer && (searchTerm || selectedLogLevels.size < LOG_LEVELS.length) && (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 space-y-3">
                  <Search className="h-16 w-16" />
                  <p className="text-lg">No logs match your current filter criteria.</p>
                 {searchTerm && <p className="text-sm">Search term: "{searchTerm}"</p>}
                 {selectedLogLevels.size < LOG_LEVELS.length && <p className="text-sm">Selected levels: {Array.from(selectedLogLevels).join(', ') || "None"}</p>}
                </div>
              )}
               {!isLoadingLogs && !logsError && availableContainers.length > 0 && !selectedContainer && !isLoadingContainers && (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 space-y-3">
                  <FileText className="h-16 w-16" />
                  <p className="text-lg">Please select a container to view its logs.</p>
                </div>
              )}
               {!isLoadingLogs && !logsError && availableContainers.length === 0 && !isLoadingContainers && !containersError && (
                 <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-10 space-y-3">
                  <FileText className="h-16 w-16" />
                  <p className="text-lg">No containers available to display logs.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

    