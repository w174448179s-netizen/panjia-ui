import type { AxiosPromise } from '@/utils/api-types';
import panjiaRequest from '@/api/panjia';

/** 钉钉同步类型：考勤 / 积分 */
export type DingTalkSyncType = 'ATTENDANCE' | 'SCORE';

/** 钉钉同步记录（一次同步一行，按月可查） */
export interface DingTalkSyncLog {
  id: string;
  /** ATTENDANCE / SCORE */
  syncType: string;
  /** 归属期间 YYYY-MM */
  period?: string;
  /** MANUAL / SCHEDULE */
  triggerType: string;
  /** RUNNING / SUCCESS / PARTIAL / FAILED */
  status: string;
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  message?: string;
  startTime?: string;
  endTime?: string;
}

export interface DingTalkLogQuery {
  pageNum: number;
  pageSize: number;
  /** ATTENDANCE(考勤) / SCORE(积分) */
  syncType: DingTalkSyncType;
}

/**
 * 钉钉同步接口（panjia-im-dingtalk 业务模块，前缀 /api/panjia）。
 * 考勤需 dingtalk:sync:attendance，积分需 dingtalk:sync:score。
 */
export const dingtalkApi = {
  /** 手动同步考勤（异步任务，立即返回 RUNNING 记录） */
  syncAttendance(period: string): AxiosPromise<DingTalkSyncLog> {
    return panjiaRequest.post<DingTalkSyncLog>(
      '/dingtalk/sync/attendance?period=' + encodeURIComponent(period),
      undefined,
      { timeout: 30000 }
    );
  },
  /** 手动同步积分（异步任务，立即返回 RUNNING 记录） */
  syncScore(period: string): AxiosPromise<DingTalkSyncLog> {
    return panjiaRequest.post<DingTalkSyncLog>(
      '/dingtalk/sync/score?period=' + encodeURIComponent(period),
      undefined,
      { timeout: 30000 }
    );
  },
  /** 同步记录分页 */
  logs(query: DingTalkLogQuery): AxiosPromise<{ rows: DingTalkSyncLog[]; total: number }> {
    return panjiaRequest.get('/dingtalk/sync/logs', query);
  }
};
