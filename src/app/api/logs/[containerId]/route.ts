
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { LogEntry } from '@/types';

// Parses a log line from `docker logs --timestamps`
// Example: 2023-10-26T10:00:05.123456789Z Actual log message
function parseLogLine(line: string, containerId: string, index: number): LogEntry | null {
  const parts = line.split(' ');
  if (parts.length < 2) return null; // Not enough parts for timestamp and message

  const timestampStr = parts.shift(); // Remove and get the first part (timestamp)
  const message = parts.join(' '); // The rest is the message

  if (!timestampStr || !new Date(timestampStr).toISOString()) {
     // If timestamp is invalid or missing, use current time, but mark it as potentially inaccurate.
     return {
        id: `log-${containerId}-${index}-${Date.now()}`,
        containerId,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        message: `(timestamp N/A) ${line}`, // Prepend original line if parsing failed
        level: inferLogLevel(message),
     };
  }
  
  return {
    id: `log-${containerId}-${index}-${new Date(timestampStr).getTime()}`,
    containerId,
    timestamp: new Date(timestampStr).toISOString().replace('T', ' ').substring(0, 19), // Format to YYYY-MM-DD HH:MM:SS
    message,
    level: inferLogLevel(message),
  };
}

function inferLogLevel(message: string): LogEntry['level'] {
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('error') || lowerMessage.includes('err')) return 'error';
  if (lowerMessage.includes('warn') || lowerMessage.includes('warning')) return 'warn';
  if (lowerMessage.includes('debug')) return 'debug';
  if (lowerMessage.includes('info')) return 'info';
  return 'info'; // Default to info
}

export async function GET(
  request: Request,
  { params }: { params: { containerId: string } }
) {
  const { containerId } = params;

  if (!containerId) {
    return NextResponse.json({ error: "Container ID is required" }, { status: 400 });
  }

  try {
    // Fetch last 200 log entries with timestamps
    const command = `docker logs --timestamps --tail 200 ${containerId.trim()}`;
    const stdout = execSync(command).toString();
    
    const logLines = stdout.trim().split('\n');
    const logs: LogEntry[] = logLines
      .map((line, index) => parseLogLine(line, containerId, index))
      .filter((log): log is LogEntry => log !== null); // Filter out any null results from parsing

    return NextResponse.json(logs);
  } catch (error: any) {
    console.error(`Failed to fetch logs for container ${containerId}:`, error);
    let errorMessage = `Failed to fetch logs for container ${containerId}.`;
    if (error.stderr) {
      const stderrStr = error.stderr.toString();
      if (stderrStr.includes('No such container')) {
        errorMessage = `Container ${containerId} not found.`;
      } else {
        errorMessage = `Docker command failed: ${stderrStr}`;
      }
    } else if (error.message) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
