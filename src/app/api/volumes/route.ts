
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { DockerVolume } from '@/types';

export async function GET() {
  try {
    const command = 'docker volume ls --format "{{json .}}"';
    const stdout = execSync(command).toString();
    
    const rawVolumes = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));

    const volumes: DockerVolume[] = rawVolumes.map((raw: any) => ({
      driver: raw.Driver || 'N/A',
      name: raw.Name || 'N/A',
      mountpoint: raw.Mountpoint || 'N/A',
      rawDriver: raw.Driver || '',
      rawLabels: raw.Labels || '',
      rawLinks: raw.Links || '',
      rawMountpoint: raw.Mountpoint || '',
      rawName: raw.Name || '',
      rawScope: raw.Scope || '',
      rawSize: raw.Size || '', // Usually "N/A" from `docker volume ls`
    }));

    return NextResponse.json(volumes);
  } catch (error: any) {
    console.error("Failed to fetch Docker volumes:", error);
    let errorMessage = "Failed to fetch Docker volumes.";
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
