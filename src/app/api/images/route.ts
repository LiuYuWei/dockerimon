
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { DockerImage } from '@/types';

// Function to parse the "Size" string (e.g., 1.23GB, 500MB) into bytes for potential sorting, though not used in this basic version
// function parseSizeToBytes(sizeStr: string): number {
//   if (!sizeStr) return 0;
//   const lowerSizeStr = sizeStr.toLowerCase();
//   const value = parseFloat(lowerSizeStr);
//   if (isNaN(value)) return 0;

//   if (lowerSizeStr.includes('gb')) return value * 1024 * 1024 * 1024;
//   if (lowerSizeStr.includes('mb')) return value * 1024 * 1024;
//   if (lowerSizeStr.includes('kb')) return value * 1024;
//   return value; // Assuming bytes if no unit
// }

export async function GET() {
  try {
    const command = 'docker images --format "{{json .}}"';
    const stdout = execSync(command).toString();
    
    const rawImages = stdout
      .trim()
      .split('\n')
      .filter(line => line.trim() !== '')
      .map(line => JSON.parse(line));

    const images: DockerImage[] = rawImages.map((raw: any) => ({
      id: (raw.ID || '').substring(0, 12),
      repository: raw.Repository || 'N/A',
      tag: raw.Tag || 'N/A',
      createdSince: raw.CreatedSince || 'N/A',
      size: raw.Size || 'N/A',
      rawId: raw.ID || '',
      rawRepository: raw.Repository || '',
      rawTag: raw.Tag || '',
      rawDigest: raw.Digest || '',
      rawCreatedSince: raw.CreatedSince || '',
      rawCreatedAt: raw.CreatedAt || '',
      rawSize: raw.Size || '',
    }));

    return NextResponse.json(images);
  } catch (error: any) {
    console.error("Failed to fetch Docker images:", error);
    let errorMessage = "Failed to fetch Docker images.";
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
