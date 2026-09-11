import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

// ========== 类型定义 ==========
export interface PerformanceFact {
  id: string;
  factType: string;           // PERF_REAL / PERF_EXPECT
  factTypeName?: string;      // 显示用
  period: string;             // YYYY-MM
  businessDate: string;       // 业务发生日
  batchId?: string;
  sourceKey: string;
  bizType?: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  deptId: string;
  deptName?: string;
  roleType?: string;
  shareRatio: number;
  originAmount: number;
  conversionRate: number;
  performanceAmount: number;
  factStatus: string;         // ACTIVE / REVERSED
  factStatusName?: string;
  source: string;             // IMPORT / MANUAL
  sourceName?: string;
  reversedReason?: string;
  createTime: string;
}

export interface FactQuery extends PageQuery {
  period?: string;
  factType?: string;
  employeeId?: string;
  deptId?: string;
  bizType?: string;
  factStatus?: string;
  source?: string;
}

export interface PerformanceAdjust {
  id: string;
  adjustNo: string;
  factId?: string;
  period: string;
  employeeId: string;
  employeeName?: string;
  deptId: string;
  deptName?: string;
  adjustType: string;         // AMOUNT / VOID / TRANSFER
  adjustTypeName?: string;
  deltaAmount?: number;
  targetDeptId?: string;
  targetDeptName?: string;
  reason: string;
  status: string;             // SUBMITTED/APPROVED/REJECTED/CANCELLED/EXECUTED
  statusName?: string;
  applicantId?: string;
  applicantName?: string;
  approverId?: string;
  approverName?: string;
  approveTime?: string;
  executeTime?: string;
  createTime: string;
}

export interface AdjustQuery extends PageQuery {
  period?: string;
  adjustType?: string;
  status?: string;
  employeeId?: string;
  deptId?: string;
}

export interface AdjustCreateForm {
  factId?: string;
  period: string;
  employeeId: string;
  deptId: string;
  adjustType: string;
  deltaAmount?: number;
  targetDeptId?: string;
  reason: string;
  payloadJson?: string;
}

export interface PeriodClose {
  id: string;
  period: string;
  status: string;             // OPEN / CLOSED
  statusName?: string;
  closeReason?: string;
  refBatchId?: string;
  operatorId?: string;
  closeTime?: string;
  createTime: string;
}

export interface ManualFactForm {
  factType: string;
  period: string;
  businessDate: string;
  employeeId: string;
  employeeCode?: string;
  deptId: string;
  roleType?: string;
  bizType?: string;
  sourceKey: string;
  shareRatio?: number;
  originAmount: number;
  reason?: string;
}

// ========== API ==========
export const performanceApi = {
  // 业绩事实
  listFacts: (params: FactQuery) =>
    panjiaRequest.get<PageResult<PerformanceFact>>('/perf/fact/list', { params }),
  getFact: (id: string | number) =>
    panjiaRequest.get<PerformanceFact>(`/perf/fact/${id}`),
  buildBatch: (batchId: string | number) =>
    panjiaRequest.post<void>(`/perf/fact/build/${batchId}`),
  getSummary: (params: { period?: string; factType?: string; employeeId?: string; deptId?: string }) =>
    panjiaRequest.get<number>('/perf/fact/summary', { params }),

  // 调整单
  listAdjusts: (params: AdjustQuery) =>
    panjiaRequest.get<PageResult<PerformanceAdjust>>('/perf/adjust/list', { params }),
  getAdjust: (id: string | number) =>
    panjiaRequest.get<PerformanceAdjust>(`/perf/adjust/${id}`),
  createAdjust: (data: AdjustCreateForm) =>
    panjiaRequest.post<string>('/perf/adjust', data),
  approveAdjust: (id: string | number) =>
    panjiaRequest.put<void>(`/perf/adjust/approve/${id}`),
  rejectAdjust: (id: string | number, reason: string) =>
    panjiaRequest.put<void>(`/perf/adjust/reject/${id}?reason=${encodeURIComponent(reason)}`),
  cancelAdjust: (id: string | number) =>
    panjiaRequest.put<void>(`/perf/adjust/cancel/${id}`),
  executeAdjust: (id: string | number) =>
    panjiaRequest.put<void>(`/perf/adjust/execute/${id}`),

  // 期间封账
  listPeriods: () =>
    panjiaRequest.get<PeriodClose[]>('/perf/period/list'),
  getPeriod: (period: string) =>
    panjiaRequest.get<PeriodClose>(`/perf/period/${period}`),
  closePeriod: (period: string, reason?: string) => {
    const url = reason
      ? `/perf/period/close/${period}?reason=${encodeURIComponent(reason)}`
      : `/perf/period/close/${period}`;
    return panjiaRequest.post<void>(url);
  },
  reopenPeriod: (period: string) =>
    panjiaRequest.post<void>(`/perf/period/reopen/${period}`),
};
