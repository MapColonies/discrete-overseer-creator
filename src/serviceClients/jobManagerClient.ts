import { Logger } from '@map-colonies/js-logger';
import { HttpClient, IHttpRetryConfig } from '@map-colonies/mc-utils';
import { inject, injectable } from 'tsyringe';
import { IngestionParams, ProductType } from '@map-colonies/mc-model-types';
import { IConfig, IMergeTaskParams } from '../common/interfaces';
import { SERVICES } from '../common/constants';
import { ITaskParameters } from '../layers/interfaces';
import { OperationStatus } from '../common/enums';
import { ICompletedTasks, IGetTaskResponse } from '../tasks/interfaces';

interface ICreateTaskBody {
    description?: string;
    parameters: ITaskParameters | IMergeTaskParams;
    reason?: string;
    type?: string;
    status?: OperationStatus;
    attempts?: number;
  }
  
  interface ICreateJobBody {
    resourceId: string;
    version: string;
    parameters: Record<string, unknown>;
    type: string;
    percentage?: number;
    description?: string;
    status?: OperationStatus;
    reason?: string;
    tasks?: ICreateTaskBody[];
    priority?: number;
    internalId?: string;
    producerName?: string;
    productName?: string;
    productType?: string;
    expirationDate?: Date;
    additionalIdentifiers?: string;
    domain?: string;
  }
  
  interface ICreateJobResponse {
    id: string;
    taskIds: string[];
  }
  
  export interface IGetJobResponse {
    id: string;
    resourceId?: string;
    version?: string;
    description?: string;
    parameters?: Record<string, unknown>;
    reason?: string;
    tasks?: IGetTaskResponse[];
    created: Date;
    updated: Date;
    status?: OperationStatus;
    type: string;
    percentage?: number;
    isCleaned: boolean;
    priority: number;
    internalId?: string;
    producerName?: string;
    productName?: string;
    productType?: string;
    taskCount: number;
    completedTasks: number;
    failedTasks: number;
    expiredTasks: number;
    pendingTasks: number;
    inProgressTasks: number;
    abortedTasks: number;
    additionalIdentifiers?: string;
    expirationDate?: Date;
    domain: string;
  }

@injectable()
export class JobManagerClient extends HttpClient {
  private readonly jobDomain: string;

  public constructor(@inject(SERVICES.CONFIG) private readonly config: IConfig, @inject(SERVICES.LOGGER) protected readonly logger: Logger) {
    super(logger, config.get<string>('jobManagerURL'), 'JobsManager', config.get<IHttpRetryConfig>('httpRetry'));
    this.jobDomain = config.get<string>('jobDomain');
  }

  public async createLayerJob(
    data: IngestionParams,
    layerRelativePath: string,
    jobType: string,
    taskType: string,
    taskParams?: (ITaskParameters | IMergeTaskParams)[],
    managerCallbackUrl?: string
  ): Promise<string> {
    const resourceId = data.metadata.productId as string;
    const version = data.metadata.productVersion as string;
    const createLayerTasksUrl = `/jobs`;
    const createJobRequest: ICreateJobBody = {
      resourceId: resourceId,
      internalId: data.metadata.id as string,
      version: version,
      type: jobType,
      status: OperationStatus.IN_PROGRESS,
      parameters: { ...data, layerRelativePath, managerCallbackUrl } as unknown as Record<string, unknown>,
      producerName: data.metadata.producerName,
      productName: data.metadata.productName,
      productType: data.metadata.productType,
      domain: this.jobDomain,
      tasks: taskParams?.map((params) => {
        return {
          type: taskType,
          parameters: params,
        };
      }),
    };
    const res = await this.post<ICreateJobResponse>(createLayerTasksUrl, createJobRequest);
    return res.id;
  }

  public async createTasks(jobId: string, taskParams: ITaskParameters[] | IMergeTaskParams[], taskType: string): Promise<void> {
    const createTasksUrl = `/jobs/${jobId}/tasks`;
    const parmas = taskParams as (ITaskParameters | IMergeTaskParams)[];
    const req = parmas.map((params) => {
      return {
        type: taskType,
        parameters: params,
      };
    });
    await this.post(createTasksUrl, req);
  }

  public async getJobStatus(jobId: string): Promise<ICompletedTasks> {
    const getJobUrl = `/jobs/${jobId}`;
    const query = {
      shouldReturnTasks: false,
    };
    const res = await this.get<IGetJobResponse>(getJobUrl, query);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    const jobPercentage = Math.trunc((res.completedTasks / res.taskCount) * 100);
    return {
      id: res.id,
      internalId: res.internalId as string,
      status: res.status as OperationStatus,
      isCompleted: res.completedTasks + res.failedTasks + res.expiredTasks + res.abortedTasks === res.taskCount,
      isSuccessful: res.completedTasks === res.taskCount,
      percentage: jobPercentage,
      metadata: (res.parameters as unknown as IngestionParams).metadata,
      relativePath: (res.parameters as unknown as { layerRelativePath: string }).layerRelativePath,
      successTasksCount: res.completedTasks,
      type: res.type,
    };
  }

  public async getTask(jobId: string, taskId: string): Promise<IGetTaskResponse> {
    const getTaskUrl = `/jobs/${jobId}/tasks/${taskId}`;
    const res = await this.get<IGetTaskResponse>(getTaskUrl);
    return res;
  }

  public async updateJobStatus(jobId: string, status: OperationStatus, jobPercentage?: number, reason?: string, catalogId?: string): Promise<void> {
    const updateTaskUrl = `/jobs/${jobId}`;
    await this.put(updateTaskUrl, {
      status: status,
      reason: reason,
      internalId: catalogId,
      percentage: jobPercentage,
    });
  }

  public async findJobs(resourceId: string, productType: ProductType): Promise<IGetJobResponse[]> {
    try {
      const getLayerUrl = `/jobs`;
      const res = await this.get<IGetJobResponse[]>(getLayerUrl, {
        resourceId: encodeURIComponent(resourceId),
        productType: encodeURIComponent(productType),
        shouldReturnTasks: false,
      });
      if (typeof res === 'string' || res.length === 0) {
        return [];
      }
      return res;
    } catch (error) {
      // console.log('asdfasdfsdffasfasdfasdfds 4444');
      // throw error;
      throw new Error(`error from blab: ${(error as Error).message}`);
    }
  }

  public async findJobsByInternalId(internalId: string): Promise<IGetJobResponse[]> {
    try {
      const getLayerUrl = `/jobs`;
      const res = await this.get<IGetJobResponse[]>(getLayerUrl, { internalId, shouldReturnTasks: false });
      if (typeof res === 'string' || res.length === 0) {
        return [];
      }
      return res;
    } catch (error) {
      console.log('asdfasdfsdffasfasdfasdfds');
      throw error;
    }
  }

  public async abortJob(jobId: string): Promise<void> {
    const abortJobUrl = `/tasks/abort/${jobId}`;
    await this.post(abortJobUrl);
  }
}
