import { LayerMetadata } from '@map-colonies/mc-model-types';
import { OperationStatus } from '../common/enums';

export interface ICompletedTasks {
  id: string;
  internalId: string;
  isCompleted: boolean;
  isSuccessful: boolean;
  metadata: LayerMetadata;
  relativePath: string;
  status: OperationStatus;
  successTasksCount: number;
  type: string;
  percentage: number;
}

export interface ITaskZoomRange {
  minZoom: number;
  maxZoom: number;
}

export interface IGetTaskResponse {
  id: string;
  jobId: string;
  type: string;
  description?: string;
  parameters?: Record<string, unknown>;
  created: Date;
  updated: Date;
  status: OperationStatus;
  percentage?: number;
  reason?: string;
  attempts: number;
}
