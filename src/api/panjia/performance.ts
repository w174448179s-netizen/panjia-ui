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

/** 业绩管理明细行（人→合同→明细 树表的明细层，后端 /perf/fact/manage 返回） */
export interface PerformanceManageRow {
  id: string;
  factType: string;          // PERF_REAL / PERF_EXPECT
  period: string;
  businessDate: string;      // 签约/认购日期
  orderNo?: string;          // 订单号
  contractNo?: string;       // 合同号
  bizType?: string;          // 类型
  propertyAddress?: string;  // 房源地址
  employeeId: string;
  employeeName?: string;     // 签约人
  employeeCode?: string;
  storeName?: string;        // 门店
  groupName?: string;        // 店组
  roleType?: string;         // 所属角色
  roleName?: string;         // 角色名
  shareRatio?: number;       // 角色占比
  amount: number;            // 业绩金额（PERF_EXPECT=应收 / PERF_REAL=实收）
  settled: boolean;          // 是否已结算
  settleDate?: string;       // 结算日期
  sourceKey: string;
}

/** 业绩管理查询参数 */
export interface ManageQuery {
  period: string;
  factType: string;          // PERF_REAL / PERF_EXPECT
  deptId?: string;
  bizType?: string;
  settled?: boolean;
}

// ========== API ==========
export const performanceApi = {
  // 业绩事实
  listFacts: (params: FactQuery) =>
    panjiaRequest.get<PageResult<PerformanceFact>>('/perf/fact/list', params),
  getFact: (id: string | number) =>
    panjiaRequest.get<PerformanceFact>(`/perf/fact/${id}`),
  buildBatch: (batchId: string | number) =>
    panjiaRequest.post<void>(`/perf/fact/build/${batchId}`),
  getSummary: (params: { period?: string; factType?: string; employeeId?: string; deptId?: string }) =>
    panjiaRequest.get<number>('/perf/fact/summary', params),

  // 业绩明细（人→合同→明细 树表）
  listManage: (params: ManageQuery) =>
    panjiaRequest.get<PerformanceManageRow[]>('/perf/fact/manage', params),
  // 有业绩数据的期间（倒序）
  listManagePeriods: () =>
    panjiaRequest.get<string[]>('/perf/fact/manage/periods'),

  // 调整单
  listAdjusts: (params: AdjustQuery) =>
    panjiaRequest.get<PageResult<PerformanceAdjust>>('/perf/adjust/list', params),
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
