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
  expectedAmount?: number;    // 应收合计（展示实时值：ACTIVE PERF_EXPECT 含已生效调整）
  /** 应收已被调整（当前应收 ≠ 提交时快照，展示「已调整」标记） */
  expectedAdjusted?: boolean;
  /** 提交时快照应收（即「调整前」值，仅在 expectedAdjusted=true 时有意义） */
  originalExpectedAmount?: number;
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 调整前新签业绩的折算后金额（originalExpectedAmount × 同一折算因子） */
  originalExpectedConvertedAmount?: number;
  /** 实收业绩折算后金额（receivedAmount × 当前生效折算因子） */
  receivedConvertedAmount?: number;
  itemCount: number;
  /** 业务类型（建单时快照落库，列表直接读列；「类型」筛选已下推 SQL） */
  bizType?: string;
  /** 涉及人数（列表接口回填：该合同本期间实收事实去重员工数） */
  employeeCount?: number;
  status: string;             // DRAFT / SUBMITTED / APPROVED / REJECTED / CANCELLED
  currentNode?: string;       // FINANCE / DIRECTOR
  processInstanceId?: string;
  applicantId?: string;
  /** 发起人昵称（后端 @Translation 按 applicantId 翻译；为空表示系统自动发起） */
  applicantName?: string;
  approverId?: string;
  /** 终审人昵称（后端按 approverId 翻译） */
  approverName?: string;
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
  /** 新签业绩（同 sourceKey 的 PERF_EXPECT 事实金额，已含调整） */
  expectedAmount?: number;
  /** 新签业绩原值（调整前；未调整时 = expectedAmount） */
  originalExpectedAmount?: number;
  /** 该行应收已被调整（同 sourceKey 存在 REVERSED 的 PERF_EXPECT 事实） */
  expectedAdjusted?: boolean;
  /** 实收业绩（PERF_REAL 事实金额） */
  amount: number;
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 新签业绩原值折算后金额（originalExpectedAmount × 同一折算因子） */
  originalConvertedAmount?: number;
  /** 实收业绩折算后金额（amount × 当前生效折算因子） */
  convertedAmount?: number;
}

export interface ReceivedQuery extends PageQuery {
  period?: string;
  status?: string;
  currentNode?: string;
  batchId?: string;
  keyword?: string;
  /** 门店/组别（含下级组别，后端按部门子树过滤） */
  deptId?: string;
  /** 员工 ID */
  employeeId?: string;
  /** 业务类型 */
  bizType?: string;
}

export type ReceivedPage = PageResult<ReceivedApply>;
export type ReceivedDetail = { apply: ReceivedApply; facts: ReceivedFact[] };

/** 批量审批结果 */
export interface BatchApproveResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  successContracts: string[];
  skippedContracts: string[];
  failedContracts: string[];
}

export const receivedApi = {
  list: (params: ReceivedQuery) =>
    panjiaRequest.get<ReceivedPage>('/performance/received/list', params),
  getDetail: (id: string | number) =>
    panjiaRequest.get<ReceivedDetail>(`/performance/received/${id}`),
  /** 按审批单 ID 查流程实例 ID（绕过 workflow:instance:query 权限） */
  getInstanceId: (id: string | number) =>
    panjiaRequest.get<{ instanceId: string | number }>(`/performance/received/${id}/instance`),
  /** 手工提交（无单自动建单，§2.2 按发起人角色路由），返回审批单 ID */
  submit: (period: string, contractNo: string) =>
    panjiaRequest.post<number>('/performance/received/submit', { period, contractNo }),
  /** 驳回后重新提交 */
  resubmit: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/resubmit`),
  cancel: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/cancel`),
  /** 按合同号批量审批（CompletableFuture 挂起等待，返回每张单处理结果） */
  batchApproveByContractAsync: (period: string, contractNos: string[]) =>
    panjiaRequest.post<BatchApproveResult>('/performance/received/batch-approve-by-contract-async', {
      period,
      contractNos,
    }, { timeout: 300000 }),
};
