
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { Container } from '@/types';

function mapDockerStateToStatus(dockerStatus: string): Container['status'] {
  const lowerCaseStatus = dockerStatus.toLowerCase();
  if (lowerCaseStatus.includes('restarting')) return 'restarting';
  if (lowerCaseStatus.startsWith('up')) return 'running';
  if (lowerCaseStatus.startsWith('exited')) return 'stopped';
  if (lowerCaseStatus.startsWith('created')) return 'stopped';
  if (lowerCaseStatus.includes('pause')) return 'stopped'; // Consider 'paused' as a distinct status if needed later
  return 'stopped'; // Default fallback
}

export async function GET() {
  try {
    // The command 'docker ps --all --format "{{json .}}"' returns a stream of JSON objects, one per line.
    const stdout = execSync('docker ps --all --format "{{json .}}"').toString();
    
    // Split by newline, filter out empty lines, then parse each JSON string.
    const rawContainers = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));

    const containers: Container[] = rawContainers.map((raw: any) => {
      const name = raw.Names || 'unknown_container';
      const status = mapDockerStateToStatus(raw.Status || raw.State || '');

      return {
        id: raw.ID,
        name: name,
        image: raw.Image,
        status: status,
        cpuUsage: "N/A",
        memoryUsage: "N/A",
        memoryTotal: "N/A",
        networkRx: "N/A",
        networkTx: "N/A",
        diskRead: "N/A",
        diskWrite: "N/A",
      };
    });

    return NextResponse.json(containers);
  } catch (error: any) {
    console.error("Failed to fetch containers:", error);
    let errorMessage = "Failed to fetch Docker containers.";
    if (error.message && error.message.includes('command not found')) {
      errorMessage = "Docker command not found. Is Docker installed and in your PATH?";
    } else if (error.message && error.message.toLowerCase().includes('cannot connect to the docker daemon')) {
      errorMessage = "Cannot connect to the Docker daemon. Is Docker running?";
    } else if (error.stderr) {
       errorMessage = `Docker command failed: ${error.stderr.toString()}`;
    }
    
    return NextResponse.json({ error: errorMessage, details: error.message }, { status: 500 });
  }
}
