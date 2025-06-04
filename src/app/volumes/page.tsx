
"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal, Loader2, Terminal, HardDrive, Trash2, Search, Home, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ChevronsUpDown } from "lucide-react";
import type { DockerVolume } from "@/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from '@/lib/utils';

const ROWS_PER_PAGE_OPTIONS = [5, 10, 20, 50, 100];
type SortableColumn = keyof Pick<DockerVolume, 'name' | 'driver' | 'mountpoint'>;
type SortDirection = 'ascending' | 'descending';

interface SortConfig {
  key: SortableColumn | null;
  direction: SortDirection;
}

export default function VolumesPage() {
  const [searchTerm, setSearchTerm] = React.useState("");
  const [volumes, setVolumes] = React.useState<DockerVolume[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [actionStates, setActionStates] = useState<Record<string, { remove?: boolean }>>({});
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [volumeToDelete, setVolumeToDelete] = useState<DockerVolume | null>(null);
  const [isConfirmingBatchDelete, setIsConfirmingBatchDelete] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]);
  const [pageInput, setPageInput] = useState("1");

  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'ascending' });
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  const fetchVolumes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/volumes');
      if (!response.ok) {
        let errorMsg = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.error || errorMsg;
        } catch (jsonError) {
          // Try to read as text if JSON parsing fails
          try {
            const textError = await response.text();
            if (textError) errorMsg += ` - ${textError.substring(0, 150)}`;
          } catch (textParseError) {
            // Ignore if reading as text also fails
          }
        }
        throw new Error(errorMsg);
      }
      const data: DockerVolume[] = await response.json();
      setVolumes(data);
    } catch (e: any) {
      setError(e.message || "An unknown error occurred while fetching volumes.");
      setVolumes([]); 
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
      fetchVolumes();
    }
  }, [isAuthenticated, fetchVolumes]);

  const handleVolumeAction = useCallback(async (volumeName: string, action: 'remove', isBatch: boolean = false) => {
    if (!isBatch) {
        setActionStates(prev => ({ ...prev, [volumeName]: { ...prev[volumeName], [action]: true } }));
    }
    try {
      const response = await fetch(`/api/volumes/${volumeName}/action`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to ${action} volume ${volumeName}.`);
      }
      return { success: true, message: result.message || `Volume ${action}d successfully.`, volumeName };
    } catch (e: any) {
      return { success: false, message: e.message || `Could not ${action} volume ${volumeName}.`, volumeName };
    } finally {
      if (!isBatch) {
        setActionStates(prev => ({ ...prev, [volumeName]: { ...prev[volumeName], [action]: false } }));
        setIsConfirmingDelete(false);
        setVolumeToDelete(null);
      }
    }
  }, []);

  const handleBatchAction = async (action: 'remove') => {
    if (selectedRowIds.size === 0) {
        toast({ title: "No volumes selected", description: "Please select volumes to perform batch action.", variant: "destructive" });
        return;
    }
    setBatchActionLoading(true);

    const results = await Promise.allSettled(
        Array.from(selectedRowIds).map(name => handleVolumeAction(name, action, true))
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
            else if (result.status === 'rejected') errorMessages.push(result.reason.message || `Unknown error for one volume.`);
        }
    });
    
    toast({
        title: `Batch ${action} completed`,
        description: `${successCount} successful, ${failureCount} failed. ${errorMessages.length > 0 ? 'Errors: ' + errorMessages.slice(0,2).join('; ') + (errorMessages.length > 2 ? '...' : '') : ''}`,
        variant: failureCount > 0 ? "destructive" : "default"
    });

    setBatchActionLoading(false);
    setSelectedRowIds(new Set());
    fetchVolumes();
    if (action === 'remove') setIsConfirmingBatchDelete(false);
  };


  const confirmDeleteVolume = (volume: DockerVolume) => {
    setVolumeToDelete(volume);
    setIsConfirmingDelete(true);
  };

  const requestSort = (key: SortableColumn) => {
    let direction: SortDirection = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const sortedVolumes = useMemo(() => {
    let sortableItems = [...volumes];
    if (sortConfig.key !== null) {
      sortableItems.sort((a, b) => {
        const aVal = a[sortConfig.key!];
        const bVal = b[sortConfig.key!];

        if (aVal === null || aVal === undefined) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (bVal === null || bVal === undefined) return sortConfig.direction === 'ascending' ? 1 : -1;
        
        let comparison = 0;
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          comparison = aVal.localeCompare(bVal);
        } else if (typeof aVal === 'number' && typeof bVal === 'number') {
          comparison = aVal - bVal;
        }
        return sortConfig.direction === 'ascending' ? comparison : -comparison;
      });
    }
    return sortableItems;
  }, [volumes, sortConfig]);

  const filteredVolumes = useMemo(() => sortedVolumes.filter(volume =>
    (volume.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (volume.driver?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  ), [sortedVolumes, searchTerm]);

  const totalItems = filteredVolumes.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / rowsPerPage));

  const paginatedVolumes = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredVolumes.slice(start, end);
  }, [filteredVolumes, currentPage, rowsPerPage]);

  const handleSelectRow = (name: string) => {
    setSelectedRowIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(name)) {
        newSet.delete(name);
      } else {
        newSet.add(name);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRowIds.size === filteredVolumes.length) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(filteredVolumes.map(vol => vol.rawName)));
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

  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Volumes", isCurrent: true }
  ];

  if (authIsLoading || (isLoading && isAuthenticated && volumes.length === 0)) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading Docker volume data...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; 
  }
  
  const SortableHeader: React.FC<{ columnKey: SortableColumn; title: string; className?: string }> = ({ columnKey, title, className }) => (
    <TableHead className={cn("cursor-pointer hover:bg-muted/50", className)} onClick={() => requestSort(columnKey)}>
      <div className="flex items-center gap-2">
        {title}
        {sortConfig.key === columnKey ? (
          sortConfig.direction === 'ascending' ? <ArrowUpDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />
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
        <div className="w-full md:w-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search volumes (name, driver)..."
            className="w-full md:w-64 lg:w-80 pl-10"
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
          <AlertTitle>Error Fetching Volumes</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="border rounded-lg shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                 <Checkbox
                  checked={selectedRowIds.size > 0 && selectedRowIds.size === filteredVolumes.length}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all volumes"
                  disabled={filteredVolumes.length === 0}
                />
              </TableHead>
              <SortableHeader columnKey="name" title="Name" />
              <SortableHeader columnKey="driver" title="Driver" />
              <SortableHeader columnKey="mountpoint" title="Mountpoint" className="hidden md:table-cell" />
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!error && paginatedVolumes.length > 0 ? (
              paginatedVolumes.map((volume) => (
                <TableRow key={volume.rawName} data-state={selectedRowIds.has(volume.rawName) ? "selected" : ""}>
                   <TableCell>
                    <Checkbox
                      checked={selectedRowIds.has(volume.rawName)}
                      onCheckedChange={() => handleSelectRow(volume.rawName)}
                      aria-label={`Select volume ${volume.name}`}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{volume.name}</TableCell>
                  <TableCell>{volume.driver}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{volume.mountpoint}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={actionStates[volume.rawName]?.remove || batchActionLoading}>
                          <span className="sr-only">Open menu</span>
                          {actionStates[volume.rawName]?.remove ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => confirmDeleteVolume(volume)}
                          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                          disabled={actionStates[volume.rawName]?.remove}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove Volume
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                 {isLoading ? "Loading..." : (error ? "Could not load volume data." : (volumes.length === 0 ? "No Docker volumes found." : "No volumes match your search/filters."))}
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
            Showing {Math.min((currentPage - 1) * rowsPerPage + 1, totalItems)}-{Math.min(currentPage * rowsPerPage, totalItems)} of {totalItems} volumes.
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

      {!error && volumes.length === 0 && !isLoading && isAuthenticated &&(
         <div className="text-center text-muted-foreground py-4">
           No Docker volumes found on your local system.
         </div>
       )}
      <AlertDialog open={isConfirmingDelete} onOpenChange={setIsConfirmingDelete}>
        <AlertDialogContent>
            <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the volume
                <span className="font-semibold"> {volumeToDelete?.name}</span>.
                Any data stored in this volume will be lost. Running containers using this volume may error.
            </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setVolumeToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
                onClick={async () => {
                  if (volumeToDelete) {
                    const res = await handleVolumeAction(volumeToDelete.rawName, 'remove');
                     if (res.success) { toast({ title: "Success", description: res.message }); fetchVolumes(); }
                           else { toast({ variant: "destructive", title: "Error", description: res.message }); }
                  }
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
                    Are you sure you want to delete {selectedRowIds.size} selected volume(s)? 
                    This action cannot be undone.
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
    

    