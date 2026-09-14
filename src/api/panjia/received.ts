import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

/** 实收业绩审批单（§2） */
export interface ReceivedApply {
  id: string;
  applyNo: string;            // RCV 前缀
  period: string;
  contractNo: string;
  orderNo?: string;
  propertyAddress?: string;
  businessDate?: string;
  deptId?: string;
  batchId?: string;
  receivedAmount: number;     // 实收合计
  expectedAmount?: number;    // 应收合计
  itemCount: number;
  status: string;             // DRAFT / SUBMITTED / APPROVED / REJECTED / CANCELLED
  currentNode?: string;       // FINANCE / DIRECTOR
  processInstanceId?: string;
  applicantId?: string;
  approverId?: string;
  approveTime?: string;
  createTime: string;
}

/** 审批单内每人实收明细（ReceivedFactDetailDTO，列口径对齐合同业绩明细） */
export interface ReceivedFact {
  factId: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  /** 门店/组别（「集团-门店-组别」） */
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  /** 角色占比 */
  shareRatio?: number;
  /** 应收金额（同 sourceKey 的 PERF_EXPECT 事实金额） */
  expectedAmount?: number;
  /** 实收金额（PERF_REAL 事实金额） */
  amount: number;
}

export interface ReceivedQuery extends PageQuery {
  period?: string;
  status?: string;
  currentNode?: string;
  batchId?: string;
  keyword?: string;
}

/** Excel 批量审批结果 */
export interface ReceivedBatchResult {
  successCount: number;
  failedRows: Array<{ contractNo: string; amount: string; reason: string }>;
}

export type ReceivedPage = PageResult<ReceivedApply>;
export type ReceivedDetail = { apply: ReceivedApply; facts: ReceivedFact[] };

export const receivedApi = {
  list: (params: ReceivedQuery) =>
    panjiaRequest.get<ReceivedPage>('/performance/received/list', params),
  getDetail: (id: string | number) =>
    panjiaRequest.get<ReceivedDetail>(`/performance/received/${id}`),
  /** 手工提交（无单自动建单，§2.2 按发起人角色路由），返回审批单 ID */
  submit: (period: string, contractNo: string) =>
    panjiaRequest.post<number>('/performance/received/submit', { period, contractNo }),
  /** 驳回后重新提交 */
  resubmit: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/resubmit`),
  approve: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/approve`),
  reject: (id: string | number, message?: string) =>
    panjiaRequest.post<void>(`/performance/received/${id}/reject`, message ? { message } : {}),
  cancel: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/cancel`),
  /** Excel 批量审批（匹配合同号+实收金额，§2.3） */
  batchApprove: (file: File, period: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post<ReceivedBatchResult>(
      `/performance/received/batch-approve?period=${encodeURIComponent(period)}`, formData);
  },
};
