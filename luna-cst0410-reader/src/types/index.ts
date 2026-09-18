export interface ProcessResult {
  OBIS_480?: number;
  OBIS_490?: number;
  OBIS_180?: number;
  validation: 'PASSED' | 'FAILED';
  consumptionKWh?: number;
  processingTimeMs: number;
  rawOCR: string[];
  timestamp: string;
}

export interface JobStatus {
  jobId: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  result?: ProcessResult;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ProcessRequest {
  videoUrl: string;
  jobId?: string;
  config?: {
    entropyThreshold?: number;
    overlapPercent?: number;
    tesseractConfig?: string;
  };
}

export interface Env {
  R2: R2Bucket;
  KV_JOBS: KVNamespace;
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  API_VERSION: string;
}
