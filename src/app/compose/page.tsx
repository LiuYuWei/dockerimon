
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Terminal, TerminalSquare, UploadCloud, ArrowDownCircle, Info, Home, Combine } from "lucide-react";
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { BreadcrumbNav, type BreadcrumbItem } from '@/components/common/BreadcrumbNav';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area";

const initialComposeYaml = `version: '3.8'

services:
  web:
    image: nginx:latest
    ports:
      - "8080:80"
# Add more services here
`;

export default function DockerComposePage() {
  const { isAuthenticated, isLoading: authIsLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [composeYaml, setComposeYaml] = useState(initialComposeYaml);
  const [output, setOutput] = useState("");
  const [isLoadingUp, setIsLoadingUp] = useState(false);
  const [isLoadingDown, setIsLoadingDown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authIsLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [authIsLoading, isAuthenticated, router]);

  const breadcrumbItems: BreadcrumbItem[] = [
    { icon: <Home />, href: "/" },
    { label: "Compose", isCurrent: true }
  ];

  const handleSubmit = async (actionType: 'up' | 'down') => {
    setError(null);
    setOutput(""); 

    if (!composeYaml.trim()) {
      toast({
        variant: "destructive",
        title: "Input Required",
        description: "Please provide docker-compose.yaml content.",
      });
      return;
    }

    if (actionType === 'up') setIsLoadingUp(true);
    if (actionType === 'down') setIsLoadingDown(true);

    try {
      const response = await fetch('/api/docker-compose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, composeYaml }),
      });

      const result = await response.json();

      if (!response.ok || result.error) {
        const errorMessage = result.error || `Failed to perform docker-compose ${actionType}. Status: ${response.status}`;
        setError(errorMessage);
        setOutput(result.output || ''); 
        toast({
            variant: "destructive",
            title: `Compose ${actionType} Failed`,
            description: errorMessage.substring(0, 100) + (errorMessage.length > 100 ? "..." : ""),
        });
      } else {
        setOutput(result.output);
        toast({
            title: `Compose ${actionType} Successful`,
            description: `Command executed. Check output below.`,
        });
      }
    } catch (e: any) {
      const catchError = e.message || `An unexpected error occurred during the compose ${actionType} operation.`;
      setError(catchError);
      toast({
        variant: "destructive",
        title: "Operation Error",
        description: catchError,
      });
    } finally {
      if (actionType === 'up') setIsLoadingUp(false);
      if (actionType === 'down') setIsLoadingDown(false);
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
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Combine className="h-6 w-6 text-primary" />
            Docker Compose
          </CardTitle>
          <CardDescription>
            Paste your docker-compose.yaml content below and run 'up' or 'down'.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="compose-yaml">docker-compose.yaml Content</Label>
            <Textarea
              id="compose-yaml"
              placeholder="Paste your docker-compose.yaml content here..."
              value={composeYaml}
              onChange={(e) => setComposeYaml(e.target.value)}
              rows={15}
              disabled={isLoadingUp || isLoadingDown}
              className="font-mono text-sm"
            />
          </div>
          <Alert variant="default" className="mt-2">
            <Info className="h-4 w-4" />
            <AlertTitle>Important Note</AlertTitle>
            <AlertDescription>
              Local build contexts (e.g., <code className="bg-muted px-1 rounded-sm">build: ./app</code>) in the YAML might not work as expected unless the paths are accessible from the server's execution environment. Prefer using pre-built images from a registry if possible.
            </AlertDescription>
          </Alert>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row gap-2 justify-start">
          <Button onClick={() => handleSubmit('up')} disabled={isLoadingUp || isLoadingDown || !composeYaml.trim()} className="w-full sm:w-auto">
            {isLoadingUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <UploadCloud className="mr-2 h-4 w-4" /> Up (-d)
          </Button>
          <Button onClick={() => handleSubmit('down')} disabled={isLoadingUp || isLoadingDown || !composeYaml.trim()} variant="outline" className="w-full sm:w-auto">
            {isLoadingDown && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ArrowDownCircle className="mr-2 h-4 w-4" /> Down
          </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
              <TerminalSquare className="h-6 w-6" />
              Command Output
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingUp || isLoadingDown ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-lg">Executing docker-compose command...</p>
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
                  <p>Output from docker-compose commands will appear here.</p>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
