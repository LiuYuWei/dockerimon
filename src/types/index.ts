
export interface Container {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'restarting';
  image: string;
  cpuUsage: string; 
  memoryUsage: string;
  memoryTotal: string;
  networkRx: string;
  networkTx: string;
  diskRead: string;
  diskWrite: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  containerId: string;
  level?: 'info' | 'warn' | 'error' | 'debug';
}

export interface MetricDataPoint {
  name: string;
  value: number;
}

export interface TimeSeriesDataPoint {
  time: string;
  value: number;
}

export interface DockerImage {
  id: string;          // Image ID (shortened)
  repository: string;  // Repository name
  tag: string;         // Tag
  createdSince: string;// e.g., "3 weeks ago"
  size: string;        // Human-readable size, e.g., "1.2GB"
  // Raw fields from docker images --format "{{json .}}"
  rawId: string;       // Full Image ID
  rawRepository: string;
  rawTag: string;
  rawDigest: string;
  rawCreatedSince: string;
  rawCreatedAt: string;
  rawSize: string;
}

export interface DockerVolume {
  driver: string;
  name: string;
  mountpoint: string;
  // Raw fields from docker volume ls --format "{{json .}}"
  rawDriver: string;
  rawLabels: string;
  rawLinks: string; // Typically "N/A"
  rawMountpoint: string;
  rawName: string;
  rawScope: string; // e.g., "local"
  rawSize: string; // Often "N/A" from ls, inspect provides actual usage
}
