import { LayerMetadata } from '@map-colonies/mc-model-types';
import { OperationStatus } from '@map-colonies/mc-priority-queue';

export interface ICompletedJobs {
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
