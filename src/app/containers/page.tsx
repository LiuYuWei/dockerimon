
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, PlayCircle, StopCircle, RefreshCcw, Eye, Loader2, Terminal, Trash2, Home, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ChevronsUpDown } from "lucide-react";
import type { Container } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

const StatusBadge: React.FC<{ status: Container['status'] }> = ({ status }) => {
  switch (status) {
    case 'running':
      return <Badge variant="default" className="bg-green-500 hover:bg-green-600 text-white"><PlayCircle className="mr-1 h-3 w-3" />Running</Badge>;
    case 'stopped':
      return <Badge variant="destructive"><StopCircle className="mr-1 h-3 w-3" />Stopped</Badge>;
    case 'restarting':
      return <Badge variant="secondary" className="bg-yellow-500 hover:bg-yellow-600 text-black"><RefreshCcw className="mr-1 h-3 w-3 animate-spin" />Restarting</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
};

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];
type SortableColumn = keyof Pick<Container, 'name' | 'status' | 'image' | 'id'>;
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableColumn | null;
  direction: SortDirection;
}

export default function ContainersPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [containers, setContainers] = React.useState<Container[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [actionStates, setActionStates] = useState<Record<string, { [action: string]: boolean }>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [containerToDelete, setContainerToDelete] = useState<Container | null>(null);
  const [isConfirmingBatchDelete, setIsConfirmingBatchDelete] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]); 
  const [pageInput, setPageInput] = useState("1");
  
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [batchActionLoading, setBatchActionLoading] = useState(false);


  const fetchContainers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/containers');
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const data: Container[] = await response.json();
      setContainers(data);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred while fetching containers.");
      setContainers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchContainers();
    }
  }, [isAuthenticated, fetchContainers]);

  const handleContainerAction = useCallback(async (containerId: string, action: 'start' | 'stop' | 'restart' | 'remove', isBatch: boolean = false) => {
    if (!isBatch) {
      setActionStates(prev => ({ ...prev, [containerId]: { ...prev[containerId], [action]: true } }));
    }
    try {
      const response = await fetch(`/api/containers/${containerId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, force: (action === 'remove') }),
      });

      const contentType = response.headers.get("content-type");
      const result = contentType && contentType.includes("application/json") ? await response.json() : { error: `Server returned non-JSON response: ${await response.text()}`};
      
      if (!response.ok || result.error) {
        throw new Error(result.error || `Failed to ${action} container ${containerId.substring(0,12)}. Status: ${response.status}`);
      }
      return { success: true, message: result.message || `Container ${action}ed successfully.`, containerId };
    } catch (e: any) {
      return { success: false, message: e.message || `Could not ${action} container ${containerId.substring(0,12)}.`, containerId };
    } finally {
      if (!isBatch) {
        setActionStates(prev => ({ ...prev, [containerId]: { ...prev[containerId], [action]: false } }));
        if (action === 'remove') {
          setIsConfirmingDelete(false);
          setContainerToDelete(null);
        }
      }
    }
  }, []);

  const handleBatchAction = async (action: 'start' | 'stop' | 'restart' | 'remove') => {
    if (selectedRowIds.size === 0) {
        toast({ title: "No containers selected", description: "Please select containers to perform batch action.", variant: "destructive" });
        return;
    }
    setBatchActionLoading(true);

    const results = await Promise.allSettled(
        Array.from(selectedRowIds).map(id => handleContainerAction(id, action, true))
    );

    let successCount = 0;
    let failureCount = 0;
    const errorMessages: string[] = [];

    results.forEach(result => {
        if (result.status === 'fulfilled' && result.value.success) {
            successCount++;
        } else {
            failureCount++;
            if (result.status === 'fulfilled') errorMessages.push(result.value.message);
            else if (result.status === 'rejected') errorMessages.push(result.reason.message || `Unknown error for one container.`);
        }
    });
    
    toast({
        title: `Batch ${action} completed`,
        description: `${successCount} successful, ${failureCount} failed. ${errorMessages.length > 0 ? 'Errors: ' + errorMessages.slice(0,2).join('; ') + (errorMessages.length > 2 ? '...' : '') : ''}`,
        variant: failureCount > 0 ? "destructive" : "default"
    });

    setBatchActionLoading(false);
    setSelectedRowIds(new Set()); // Clear selection
    fetchContainers(); // Refresh list
    if (action === 'remove') setIsConfirmingBatchDelete(false);
  };

  const requestSort = (key: SortableColumn) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const statusSortOrder: Record<Container['status'], number> = {
    running: 1,
    restarting: 2,
    stopped: 3,
  };

  const sortedContainers = useMemo(() => {
    let sortableItems = [...containers];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];

        if (aVal === null || aVal === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        
        let comparison = 0;
        if (sortConfig.key === 'status') {
          comparison = statusSortOrder[aVal as Container['status']] - statusSortOrder[bVal as Container['status']];
        } else if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        }

        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [containers, sortConfig]);

  const filteredContainers = useMemo(() => sortedContainers.filter(container =>
    (container.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (container.image?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (container.id?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [sortedContainers, searchTerm]);

  const totalItems = filteredContainers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const paginatedContainers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredContainers.slice(start, end);
  }, [filteredContainers, currentPage, rowsPerPage]);

  const handleSelectRow = (id: string) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRowIds.size === filteredContainers.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredContainers.map(c => c.id)));
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    setPageInput("1");
  }, [rowsPerPage, searchTerm, sortConfig]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const handleRowsPerPageChange = (value: string) => {
    setRowsPerPage(Number(value));
  };

  const goToPage = (page: number) => {
    const pageNumber = Math.max(1, Math.min(totalPages, page));
    setCurrentPage(pageNumber);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPageInput(e.target.value);
  };

  const handleGoToPage = () => {
    const pageNum = parseInt(pageInput, 10);
    if (!isNaN(pageNum)) {
      goToPage(pageNum);
    } else {
      setPageInput(String(currentPage)); 
    }
  };

  const confirmDeleteContainer = (container: Container) => {
    setContainerToDelete(container);
    setIsConfirmingDelete(true);
  };
  
  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Containers", isCurrent: true }
  ];

  if (authIsLoading || (isLoading && isAuthenticated && containers.length === 0)) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading container data...</p>
      </div>
    );
  }

  if (!isAuthenticated && !authIsLoading) {
    return null;
  }
  
  const SortableHeader: React.FC<{ columnKey: SortableColumn; title: string; className?: string }> = ({ columnKey, title, className }) => (
    <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => requestSort(columnKey)}>
      <div className="flex items-center gap-2">
        {title}
        {sortConfig.key === columnKey ? (
          sortConfig.direction === 'ascending' ? <ArrowUpDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" /> // Using same icon, ideally ArrowUp/ArrowDown
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </TableHead>
  );


  return (
    <div className="w-full space-y-6">
      <BreadcrumbNav items={breadcrumbItems} />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <Input
            type="search"
            placeholder="Search containers (name, image, ID)..."
            className="w-full md:w-64 lg:w-80"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {selectedRowIds.size > 0 && (
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{selectedRowIds.size} selected</span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" disabled={batchActionLoading}>
                            {batchActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Batch Actions
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Apply to selected</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => handleBatchAction('start')} disabled={batchActionLoading}>
                            <PlayCircle className="mr-2 h-4 w-4" /> Start
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchAction('stop')} disabled={batchActionLoading}>
                            <StopCircle className="mr-2 h-4 w-4" /> Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleBatchAction('restart')} disabled={batchActionLoading}>
                            <RefreshCcw className="mr-2 h-4 w-4" /> Restart
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setIsConfirmingBatchDelete(true)} disabled={batchActionLoading} className="text-destructive focus:text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="shadow-md">
          <Terminal className="h-5 w-5" />
          <AlertTitle>Error Fetching Containers</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedRowIds.size > 0 && selectedRowIds.size === filteredContainers.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all containers"
                  disabled={filteredContainers.length === 0}
                />
              </TableHead>
              <SortableHeader columnKey="name" title="Name" />
              <SortableHeader columnKey="status" title="Status" />
              <SortableHeader columnKey="image" title="Image" />
              <SortableHeader columnKey="id" title="ID" className="hidden md:table-cell" />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!error && paginatedContainers.length > 0 ? (
              paginatedContainers.map((container) => (
                <TableRow key={container.id} data-state={selectedRowIds.has(container.id) ? "selected" : ""}>
                  <TableCell>
                    <Checkbox
                      checked={selectedRowIds.has(container.id)}
                      onCheckedChange={() => handleSelectRow(container.id)}
                      aria-label={`Select container ${container.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    {container.name}
                  </TableCell>
                  <TableCell><StatusBadge status={container.status} /></TableCell>
                  <TableCell>{container.image}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{(container.id || '').substring(0,12)}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={Object.values(actionStates[container.id] || {}).some(Boolean) || batchActionLoading}>
                          <span className="sr-only">Open menu</span>
                          {Object.values(actionStates[container.id] || {}).some(Boolean) ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await handleContainerAction(container.id, 'start');
                            if (res.success) { toast({ title: "Success", description: res.message }); fetchContainers(); }
                            else { toast({ variant: "destructive", title: "Error", description: res.message }); }
                          }}
                          disabled={container.status === 'running' || container.status === 'restarting' || actionStates[container.id]?.start}
                        >
                          <PlayCircle className="mr-2 h-4 w-4" /> Start
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await handleContainerAction(container.id, 'stop');
                             if (res.success) { toast({ title: "Success", description: res.message }); fetchContainers(); }
                            else { toast({ variant: "destructive", title: "Error", description: res.message }); }
                          }}
                          disabled={container.status === 'stopped' || actionStates[container.id]?.stop}
                        >
                          <StopCircle className="mr-2 h-4 w-4" /> Stop
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={async () => {
                            const res = await handleContainerAction(container.id, 'restart');
                            if (res.success) { toast({ title: "Success", description: res.message }); fetchContainers(); }
                            else { toast({ variant: "destructive", title: "Error", description: res.message }); }
                          }}
                          disabled={actionStates[container.id]?.restart}
                        >
                          <RefreshCcw className="mr-2 h-4 w-4" /> Restart
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/logs?containerId=${container.id}&containerName=${encodeURIComponent(container.name)}`)}
                        >
                          <Eye className="mr-2 h-4 w-4" /> View Logs
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => confirmDeleteContainer(container)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          disabled={actionStates[container.id]?.remove}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  {isLoading ? "Loading..." : (error ? "Could not load container data." : (containers.length === 0 ? "No Docker containers found." : "No containers match your search/filters."))}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {!error && totalItems > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <Select value={String(rowsPerPage)} onValueChange={handleRowsPerPageChange}>
              <SelectTrigger className="w-[70px] h-8">
                <SelectValue placeholder={rowsPerPage} />
              </SelectTrigger>
              <SelectContent>
                {ROWS_PER_PAGE_OPTIONS.map(option => (
                  <SelectItem key={option} value={String(option)}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 text-center sm:text-left">
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalItems)}-{Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} containers.
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(1)} disabled={currentPage === 1}>
              <ChevronsLeft className="h-4 w-4" /> <span className="sr-only">First page</span>
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>
              <ChevronLeft className="h-4 w-4" /> <span className="sr-only">Previous page</span>
            </Button>
            <div className="flex items-center gap-1">
              <span>Page</span>
              <Input
                type="number"
                min="1"
                max={totalPages}
                value={pageInput}
                onChange={handlePageInputChange}
                onBlur={handleGoToPage}
                onKeyPress={(e) => e.key === 'Enter' && handleGoToPage()}
                className="w-12 h-8 text-center px-1"
              />
              <span>of {totalPages}</span>
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages}>
              <ChevronRight className="h-4 w-4" /> <span className="sr-only">Next page</span>
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
              <ChevronsRight className="h-4 w-4" /> <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      )}

       {!error && containers.length === 0 && !isLoading && isAuthenticated &&(
         <div className="text-center text-muted-foreground py-4">
           No Docker containers found on your local system.
         </div>
       )}

       <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the container
                    <span className="font-semibold"> {containerToDelete?.name}</span> (and its data unless stored in a volume). This action is forced.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setContainerToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={async () => {
                        if (containerToDelete) {
                           const res = await handleContainerAction(containerToDelete.id, 'remove');
                           if (res.success) { toast({ title: "Success", description: res.message }); fetchContainers(); }
                           else { toast({ variant: "destructive", title: "Error", description: res.message }); }
                        }
                        setIsConfirmingDelete(false);
                        setContainerToDelete(null);
                    }}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                >
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={isConfirmingBatchDelete} onOpenChange={setIsConfirmingBatchDelete}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Confirm Batch Delete</AlertDialogTitle>
                <AlertDialogDescription>
                    Are you sure you want to delete {selectedRowIds.size} selected container(s)? 
                    This action cannot be undone and is forced.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={() => handleBatchAction('remove')}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                    disabled={batchActionLoading}
                >
                    {batchActionLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Delete Selected
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}

    