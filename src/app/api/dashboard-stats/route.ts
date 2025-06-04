
import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import type { Container } from '@/types'; // Re-use container type if needed, or define specific stat types

interface DockerPsItem {
  ID: string;
  Image: string;
  Names: string;
  Status: string;
  State: string; // For older Docker versions, 'State' might be present
}

interface DockerStatsItem {
  BlockIO: string; // "Read / Write" e.g., "0B / 0B"
  CPUPerc: string; // "x.xx%"
  Container: string; // Container ID or Name
  ID: string; // Container ID
  MemPerc: string; // "x.xx%"
  MemUsage: string; // "Usage / Limit" e.g., "10MiB / 1.95GiB"
  Name: string; // Container Name
  NetIO: string; // "Rx / Tx" e.g., "0B / 0B"
  PIDs: string; // Number of processes
}

function parseUnitToBytes(valueWithUnit: string): number {
  if (!valueWithUnit || typeof valueWithUnit !== 'string') return 0;
  const valueStr = valueWithUnit.toLowerCase();
  let value = parseFloat(valueStr);
  if (isNaN(value)) return 0;

  if (valueStr.includes('tib')) value *= Math.pow(1024, 4);
  else if (valueStr.includes('gib')) value *= Math.pow(1024, 3);
  else if (valueStr.includes('mib')) value *= Math.pow(1024, 2);
  else if (valueStr.includes('kib') || valueStr.includes('kb')) value *= 1024;
  // Assuming 'b' or no unit is bytes
  return value;
}

function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  if (i >= sizes.length) return `${(bytes / Math.pow(k, sizes.length -1 )).toFixed(dm)} ${sizes[sizes.length -1]}`;
  return `${(bytes / Math.pow(k, i)).toFixed(dm)} ${sizes[i]}`;
}


function mapDockerStateToStatus(dockerStatus: string): Container['status'] {
  const lowerCaseStatus = dockerStatus.toLowerCase();
  if (lowerCaseStatus.includes('restarting')) return 'restarting';
  if (lowerCaseStatus.startsWith('up')) return 'running';
  if (lowerCaseStatus.startsWith('exited')) return 'stopped';
  if (lowerCaseStatus.startsWith('created')) return 'stopped';
  if (lowerCaseStatus.includes('pause')) return 'stopped';
  return 'stopped';
}

export async function GET() {
  try {
    // Get container counts
    const psStdout = execSync('docker ps --all --format "{{json .}}"').toString();
    const rawContainers = psStdout.trim().split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line) as DockerPsItem);
    
    let runningCount = 0;
    let stoppedCount = 0;
    rawContainers.forEach(c => {
      const status = mapDockerStateToStatus(c.Status || c.State || '');
      if (status === 'running') runningCount++;
      else stoppedCount++;
    });

    const containerCounts = {
      total: rawContainers.length,
      running: runningCount,
      stopped: stoppedCount,
      // "critical" is a placeholder for now, requires more specific logic
      critical: rawContainers.filter(c => (c.Status || c.State || '').toLowerCase().includes('exited (1)')).length || 0, 
    };

    // Get stats for running containers
    // Note: `docker stats --all` includes stopped ones with 0 stats if they ran before.
    // We only want currently running containers for live stats.
    const statsStdout = execSync('docker stats --no-stream --format "{{json .}}"').toString();
    const rawStats: DockerStatsItem[] = statsStdout.trim().split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line));

    let totalCpuPerc = 0;
    let totalMemUsedBytes = 0;
    let totalMemLimitBytes = 0;

    const cpuUsageData: { name: string; value: number }[] = [];
    const memoryUsageData: { name: string; value: number; usage: string; limit: string }[] = [];
    const networkTrafficData: { name: string; received: number; sent: number, receivedStr: string, sentStr: string }[] = [];
    const diskIOData: { name: string; read: number; write: number, readStr: string, writeStr: string }[] = [];

    rawStats.forEach(stat => {
      const cpuPerc = parseFloat(stat.CPUPerc.replace('%', '')) || 0;
      totalCpuPerc += cpuPerc;
      cpuUsageData.push({ name: stat.Name, value: cpuPerc });

      const [memUsedStr, memLimitStr] = stat.MemUsage.split(' / ');
      const memUsedBytes = parseUnitToBytes(memUsedStr);
      const memLimitBytes = parseUnitToBytes(memLimitStr);
      totalMemUsedBytes += memUsedBytes;
      totalMemLimitBytes += memLimitBytes;
      
      const memPerc = memLimitBytes > 0 ? parseFloat(((memUsedBytes / memLimitBytes) * 100).toFixed(2)) : 0;
      memoryUsageData.push({ 
        name: stat.Name, 
        value: memPerc, // This is MemPerc from stats, or calculated if preferred. Using calculated for consistency.
        usage: formatBytes(memUsedBytes), 
        limit: formatBytes(memLimitBytes)
      });
      
      const [netRxStr, netTxStr] = stat.NetIO.split(' / ');
      const netRxBytes = parseUnitToBytes(netRxStr);
      const netTxBytes = parseUnitToBytes(netTxStr);
      networkTrafficData.push({ 
        name: stat.Name, 
        received: netRxBytes, 
        sent: netTxBytes,
        receivedStr: formatBytes(netRxBytes),
        sentStr: formatBytes(netTxBytes)
      });

      const [diskReadStr, diskWriteStr] = stat.BlockIO.split(' / ');
      const diskReadBytes = parseUnitToBytes(diskReadStr);
      const diskWriteBytes = parseUnitToBytes(diskWriteStr);
      diskIOData.push({ 
        name: stat.Name, 
        read: diskReadBytes, 
        write: diskWriteBytes,
        readStr: formatBytes(diskReadBytes),
        writeStr: formatBytes(diskWriteBytes)
      });
    });
    
    const overallCpuUsagePercent = runningCount > 0 ? parseFloat((totalCpuPerc / runningCount).toFixed(2)) : 0;
    const overallMemoryPercent = totalMemLimitBytes > 0 ? parseFloat(((totalMemUsedBytes / totalMemLimitBytes) * 100).toFixed(2)) : 0;


    // Sort by usage for top N display if needed, here returning all
    cpuUsageData.sort((a, b) => b.value - a.value);
    memoryUsageData.sort((a, b) => b.value - a.value);
    // network and disk could be sorted by total traffic, e.g. (b.received + b.sent) - (a.received + a.sent)

    return NextResponse.json({
      containerCounts,
      overallCpuUsagePercent,
      overallMemory: {
        used: formatBytes(totalMemUsedBytes),
        total: formatBytes(totalMemLimitBytes),
        percent: overallMemoryPercent,
      },
      cpuUsageBreakdown: cpuUsageData.slice(0, 10), // Top 10
      memoryUsageBreakdown: memoryUsageData.slice(0, 10), // Top 10
      networkTrafficBreakdown: networkTrafficData.sort((a,b) => (b.received + b.sent) - (a.received + a.sent)).slice(0,10),
      diskIOBreakdown: diskIOData.sort((a,b) => (b.read + b.write) - (a.read + a.write)).slice(0,10),
    });

  } catch (error: any) {
    console.error("Failed to fetch dashboard stats:", error);
    let errorMessage = "Failed to fetch dashboard stats.";
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
