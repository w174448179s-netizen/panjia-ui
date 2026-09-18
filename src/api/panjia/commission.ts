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
  /** 折算后折后金额（newAmount × 当前生效折算因子，后端按明细 bizType 计算） */
  convertedNewAmount?: number;
  /** 折算后差额金额（diffAmount × 当前生效折算因子） */
  convertedDiffAmount?: number;
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
  expectedAdjusted?: boolean; // 应收已被调整（当前值与快照不一致）
  /** 调整前应收合计（提交快照；仅 expectedAdjusted=true 时有值，供展示「原值 → 调整后值」） */
  originalExpectedAmount?: number;
  aligned?: boolean;         // 是否已实收对齐应收
  currentNode?: string;      // DIRECTOR / FINANCE / null（T-04 后实收==应收时财务节点跳过，流程直接结束）
  status: string;        // DRAFT / SUBMITTED / APPROVED / LOCKED / REJECTED / CANCELLED
  approvedMonth?: string;
  processInstanceId?: string;
  applicantId?: number;
  applicantName?: string;   // 后端 @Translation 翻译产物（非入库字段）
  approverId?: number;
  approverName?: string;    // 后端 @Translation 翻译产物：最近节点办理人
  approveTime?: string;     // 审批时间（总监通过/终审锁定/驳回留痕）
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
  /** 业务类型（取折算因子的键） */
  bizType?: string;
  /** 新签业绩（同 sourceKey 的 PERF_EXPECT 事实金额） */
  expectedAmount?: number;
  /** 该行应收已被调整（同 sourceKey 存在 REVERSED 的 PERF_EXPECT 事实） */
  expectedAdjusted?: boolean;
  /** 调整前新签业绩（同 sourceKey 最早一条 REVERSED 的 PERF_EXPECT；无调整时 = expectedAmount） */
  originalExpectedAmount?: number;
  /** 结佣业绩 */
  amount: number;
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 调整前新签业绩折算后金额（originalExpectedAmount × 当前生效折算因子） */
  originalConvertedAmount?: number;
  /** 结佣业绩折算后金额（amount × 当前生效折算因子） */
  convertedAmount?: number;
  feeItem?: string;
  status: string;        // DRAFT / PENDING / APPROVED / REVERSED
}

export interface CommissionApplyQuery extends PageQuery {
  period?: string;
  deptId?: number | string;   // 19 位雪花 ID 由后端以字符串下发，禁止 Number() 转换
  status?: string;
  currentNode?: string;
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
  /** 结佣业绩折算后金额（amount × 当前生效折算因子） */
  convertedAmount?: number;
  expectedAmount?: number;   // 应收合计
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 调整前应收合计（申请单提交快照；仅 expectedAdjusted=true 时有值，供展示「原值 → 调整后值」） */
  originalExpectedAmount?: number;
  /** 调整前应收的折算后金额（originalExpectedAmount × 当前生效折算因子） */
  originalExpectedConvertedAmount?: number;
  expectedAdjusted?: boolean; // 应收已被调整
  aligned?: boolean;
  currentNode?: string;      // DIRECTOR / FINANCE / null（T-04 后实收==应收时财务节点跳过，流程直接结束）
  employeeCount: number;
  detailCount: number;
  period: string;
  deptId?: number;
  status: string;           // NONE / DRAFT / SUBMITTED / LOCKED / REJECTED / CANCELLED
  receivedStatus?: string;   // 实收审批状态 APPROVED / SUBMITTED / DRAFT / null
  applicantId?: number;
  createTime?: string;
}

/** 批量操作结果（批量发起 / 批量审批） */
export interface BatchResultDTO {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  successContracts: string[];
  skippedContracts: string[];
  failedContracts: string[];
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
  /** 按申请单 ID 查流程实例 ID（绕过 workflow:instance:query 权限） */
  getInstanceId: (id: number | string) =>
    panjiaRequest.get<{ instanceId: string | number }>(`/commission/apply/${id}/instance`),
  createApplication: (data: CommissionApplyCreateDTO) =>
    panjiaRequest.post<number>('/commission/apply', data),
  cancelApplication: (id: number | string) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/cancel`),
  /** 按合同号批量发起（CompletableFuture 挂起等待，返回每张单处理结果） */
  batchApplyByContract: (period: string, contractNos: string[]) =>
    panjiaRequest.post<BatchResultDTO>('/commission/apply/batch-apply-by-contract', {
      period,
      contractNos,
    }, { timeout: 300000 }),
  /** 按合同号批量审批（CompletableFuture 挂起等待，返回每张单处理结果） */
  batchApproveByContract: (period: string, contractNos: string[]) =>
    panjiaRequest.post<BatchResultDTO>('/commission/apply/batch-approve-by-contract', {
      period,
      contractNos,
    }, { timeout: 300000 }),

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
