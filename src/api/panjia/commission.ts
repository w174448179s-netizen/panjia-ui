import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

export interface CommissionAdjust {
  id: number;
  adjustNo: string;
  applicationId: number;
  itemId?: number;
  period?: string;
  adjustType: string;    // DISCOUNT / DIFF / VOID
  newAmount?: number;
  diffAmount?: number;
  targetPeriod?: string;
  reason: string;
  status: string;        // SUBMITTED / APPROVED / REJECTED / CANCELLED / EXECUTED
  processInstanceId?: string;
  applicantId?: number;
  applicantName?: string;   // 后端 @Translation 翻译产物（非入库字段）
  approverId?: number;
  createTime: string;
  updateTime?: string;
}

export interface CommissionAdjustQuery extends PageQuery {
  adjustType?: string;
  status?: string;
  period?: string;
  applicationId?: number | string;   // 19 位雪花 ID 以字符串下发/输入
}

export interface CommissionAdjustCreateDTO {
  applicationId: number | string;    // 雪花 ID 以字符串透传，禁止 Number() 丢精度
  itemId: number | string;
  adjustType: string;    // DISCOUNT / DIFF / VOID
  newAmount?: number;
  diffAmount?: number;
  targetPeriod?: string;
  reason: string;
}

// ==================== 结佣明细 ====================

export interface CommissionApplication {
  id: number;
  applyNo: string;
  period: string;
  contractNo?: string;
  orderNo?: string;
  propertyAddress?: string;
  businessDate?: string;
  deptId?: number;     // 跨门店合作单为空
  itemCount: number;
  totalAmount: number;
  expectedAmount?: number;   // 应收合计（§3.4/3.5）
  aligned?: boolean;         // 是否已实收对齐应收
  currentNode?: string;      // DIRECTOR / FINANCE
  status: string;        // DRAFT / SUBMITTED / APPROVED / LOCKED / REJECTED / CANCELLED
  approvedMonth?: string;
  processInstanceId?: string;
  applicantId?: number;
  applicantName?: string;   // 后端 @Translation 翻译产物（非入库字段）
  approverId?: number;
  lockTime?: string;
  createTime: string;
  updateTime?: string;
}

export interface CommissionItem {
  id: number;
  applicationId: number;
  performanceFactId?: number;
  period: string;
  approvedMonth?: string;
  employeeId?: number;
  deptId?: number;
  bizType?: string;
  roleType?: string;
  feeItem?: string;
  amount: number;
  status: string;        // DRAFT / PENDING / APPROVED / REVERSED
  originReversed?: boolean;
  adjustId?: number;
  createTime: string;
}

/** 结佣申请单详情·每人明细行（列口径对齐实收明细详情） */
export interface CommissionItemDetail {
  itemId: number;
  factId?: number;
  employeeId?: number;
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
  /** 结佣金额 */
  amount: number;
  feeItem?: string;
  status: string;        // DRAFT / PENDING / APPROVED / REVERSED
}

export interface CommissionApplyQuery extends PageQuery {
  period?: string;
  deptId?: number | string;   // 19 位雪花 ID 由后端以字符串下发，禁止 Number() 转换
  status?: string;
  keyword?: string;
  applicationId?: number | string;
}

export interface CommissionApplyCreateDTO {
  period: string;
  contractNo?: string;   // 单个发起必填；批量发起不传
  deptId?: number | string;   // 仅批量发起使用（19 位雪花 ID 以字符串下发）
}

// 结佣明细「合同」维度行
export interface CommissionContractVO {
  applicationId?: number;   // 未发起（NONE）时为空
  applyNo?: string;
  contractNo?: string;
  orderNo?: string;
  bizType?: string;
  propertyAddress?: string;
  businessDate?: string;
  amount: number;
  expectedAmount?: number;   // 应收合计
  aligned?: boolean;
  currentNode?: string;      // DIRECTOR / FINANCE
  employeeCount: number;
  detailCount: number;
  period: string;
  deptId?: number;
  status: string;           // NONE / DRAFT / SUBMITTED / LOCKED / REJECTED / CANCELLED
  receivedStatus?: string;   // 实收审批状态 APPROVED / SUBMITTED / DRAFT / null
  applicantId?: number;
  createTime?: string;
}

/** Excel 批量操作结果 */
export interface CommissionBatchResult {
  successCount: number;
  failedRows: Array<{ contractNo: string; amount: string; reason: string }>;
}

export const commissionApi = {
  // 结佣明细
  listApplications: (params: CommissionApplyQuery) =>
    panjiaRequest.get<PageResult<CommissionApplication>>('/commission/apply/list', params),
  listContracts: (params: CommissionApplyQuery) =>
    panjiaRequest.get<PageResult<CommissionContractVO>>('/commission/apply/contract-list', params),
  /** id 接受字符串：雪花 ID 由后端以字符串下发，Number() 转换 19 位会丢精度 */
  getApplication: (id: number | string) =>
    panjiaRequest.get<{ application: CommissionApplication; items: CommissionItemDetail[] }>(`/commission/apply/${id}`),
  createApplication: (data: CommissionApplyCreateDTO) =>
    panjiaRequest.post<number>('/commission/apply', data),
  batchCreateApplications: (data: CommissionApplyCreateDTO) =>
    panjiaRequest.post<number>('/commission/apply/batch', data),
  cancelApplication: (id: number | string) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/cancel`),
  /** Excel 批量发起（§3.2，按合同号自动发起+提交） */
  batchInitiate: (file: File, period: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post<CommissionBatchResult>(
      `/commission/apply/batch-initiate?period=${encodeURIComponent(period)}`, formData);
  },
  /** Excel 批量审批（§3.3，匹配合同号+金额） */
  batchApprove: (file: File, period: string) => {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post<CommissionBatchResult>(
      `/commission/apply/batch-approve?period=${encodeURIComponent(period)}`, formData);
  },

  // 结佣调整
  listAdjusts: (params: CommissionAdjustQuery) =>
    panjiaRequest.get<PageResult<CommissionAdjust>>('/commission/adjust/list', params),
  getAdjust: (id: number | string) =>
    panjiaRequest.get<CommissionAdjust>(`/commission/adjust/${id}`),
  createAdjust: (data: CommissionAdjustCreateDTO) =>
    panjiaRequest.post<number>('/commission/adjust', data),
  cancelAdjust: (id: number) =>
    panjiaRequest.post<void>(`/commission/adjust/${id}/cancel`),
};
