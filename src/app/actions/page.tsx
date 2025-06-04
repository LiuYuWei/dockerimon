
"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Terminal, TerminalSquare, DownloadCloud, Play } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { Home } from 'lucide-react'; // Icon for breadcrumb
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";

export default function DockerActionsPage() {
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [pullImageName, setPullImageName] = useState("");
  const [runArguments, setRunArguments] = useState("");
  const [output, setOutput] = useState("");
  const [isLoadingPull, setIsLoadingPull] = useState(false);
  const [isLoadingRun, setIsLoadingRun] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Actions", isCurrent: true }
  ];

  const handleSubmit = async (actionType: 'pull' | 'run') => {
    setError(null);
    setOutput(""); // Clear previous output
    const payload = actionType === 'pull' ? pullImageName : runArguments;

    if (!payload.trim()) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: `Please enter the ${actionType === 'pull' ? 'image name' : 'run arguments'}.`,
      });
      return;
    }

    if (actionType === 'pull') setIsLoadingPull(true);
    if (actionType === 'run') setIsLoadingRun(true);

    try {
      const response = await fetch('/api/docker-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, payload }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        const errorMessage = result.error || `Failed to perform ${actionType} action. Status: ${response.status}`;
        setError(errorMessage);
        setOutput(result.output || ''); // Show output even if there's an error
        toast({
            variant: "destructive",
            title: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Failed`,
            description: errorMessage.substring(0, 100) + (errorMessage.length > 100 ? "..." : ""),
        });
      } else {
        setOutput(result.output);
        toast({
            title: `${actionType.charAt(0).toUpperCase() + actionType.slice(1)} Successful`,
            description: `Command executed. Check output below.`,
        });
        if (actionType === 'pull') setPullImageName("");
        // Do not clear run arguments, user might want to tweak and re-run
      }
    } catch (e: any) {
      const catchError = e.message || `An unexpected error occurred during the ${actionType} operation.`;
      setError(catchError);
      toast({
        variant: "destructive",
        title: "Operation Error",
        description: catchError,
      });
    } finally {
      if (actionType === 'pull') setIsLoadingPull(false);
      if (actionType === 'run') setIsLoadingRun(false);
    }
  };
  
  if (authIsLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 space-y-4 w-full">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading page...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="w-full space-y-6">
      <BreadcrumbNav items={breadcrumbItems} />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DownloadCloud className="h-6 w-6 text-primary" />
              Docker Pull
            </CardTitle>
            <CardDescription>Pull an image from a registry (e.g., Docker Hub).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="pull-image-name">Image Name</Label>
              <Input
                id="pull-image-name"
                placeholder="e.g., nginx:latest or ubuntu"
                value={pullImageName}
                onChange={(e) => setPullImageName(e.target.value)}
                disabled={isLoadingPull || isLoadingRun}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => handleSubmit('pull')} disabled={isLoadingPull || isLoadingRun || !pullImageName.trim()} className="w-full sm:w-auto">
              {isLoadingPull && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Pull Image
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-6 w-6 text-primary" />
              Docker Run
            </CardTitle>
            <CardDescription>Run a command in a new container. Enter only the arguments after "docker run".</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="run-arguments">Arguments</Label>
              <Textarea
                id="run-arguments"
                placeholder="e.g., -d -p 8080:80 --name my-nginx nginx"
                value={runArguments}
                onChange={(e) => setRunArguments(e.target.value)}
                rows={4}
                disabled={isLoadingPull || isLoadingRun}
                className="font-mono text-sm"
              />
               <p className="text-xs text-muted-foreground mt-1">
                Example: To run <code className="bg-muted px-1 rounded-sm">docker run -it ubuntu bash</code>, enter <code className="bg-muted px-1 rounded-sm">-it ubuntu bash</code>.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={() => handleSubmit('run')} disabled={isLoadingPull || isLoadingRun || !runArguments.trim()} className="w-full sm:w-auto">
              {isLoadingRun && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Run Container
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
              <TerminalSquare className="h-6 w-6" />
              Command Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingPull || isLoadingRun ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-lg">Executing command...</p>
              <p className="text-sm">Please wait for the output.</p>
            </div>
          ) : (
            <>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {output ? (
                <ScrollArea className="h-[300px] w-full rounded-md border p-4 bg-muted/50">
                  <pre className="text-sm whitespace-pre-wrap break-all">{output}</pre>
                </ScrollArea>
              ) : !error ? (
                <div className="text-center text-muted-foreground py-10 h-[300px] flex flex-col justify-center items-center">
                  <TerminalSquare className="h-10 w-10 mb-2 text-muted-foreground/70" />
                  <p>Output from commands will appear here.</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
