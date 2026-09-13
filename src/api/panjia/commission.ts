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
  approverId?: number;
  createTime: string;
  updateTime?: string;
}

export interface CommissionAdjustQuery extends PageQuery {
  adjustType?: string;
  status?: string;
  period?: string;
  applicationId?: number;
}

export interface CommissionAdjustCreateDTO {
  applicationId: number;
  itemId: number;
  adjustType: string;    // DISCOUNT / DIFF / VOID
  newAmount?: number;
  diffAmount?: number;
  targetPeriod?: string;
  reason: string;
}

// ==================== 结佣申请单 ====================

export interface CommissionApplication {
  id: number;
  applyNo: string;
  period: string;
  deptId: number;
  itemCount: number;
  totalAmount: number;
  status: string;        // DRAFT / SUBMITTED / APPROVED / LOCKED / REJECTED / CANCELLED
  approvedMonth?: string;
  processInstanceId?: string;
  applicantId?: number;
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
  status: string;        // PENDING / APPROVED / REVERSED
  originReversed?: boolean;
  adjustId?: number;
  createTime: string;
}

export interface CommissionApplyQuery extends PageQuery {
  period?: string;
  deptId?: number;
  status?: string;
}

export interface CommissionApplyCreateDTO {
  period: string;
  deptId: number;
}

// 结佣申请「合同」维度行
export interface CommissionContractVO {
  applicationId: number;
  applyNo: string;
  contractNo?: string;
  orderNo?: string;
  bizType?: string;
  propertyAddress?: string;
  businessDate?: string;
  amount: number;
  employeeCount: number;
  detailCount: number;
  period: string;
  deptId: number;
  status: string;
  applicantId?: number;
  createTime?: string;
}

export const commissionApi = {
  // 结佣申请单
  listApplications: (params: CommissionApplyQuery) =>
    panjiaRequest.get<PageResult<CommissionApplication>>('/commission/apply/list', params),
  listContracts: (params: CommissionApplyQuery) =>
    panjiaRequest.get<PageResult<CommissionContractVO>>('/commission/apply/contract-list', params),
  getApplication: (id: number) =>
    panjiaRequest.get<{ application: CommissionApplication; items: CommissionItem[] }>(`/commission/apply/${id}`),
  createApplication: (data: CommissionApplyCreateDTO) =>
    panjiaRequest.post<number>('/commission/apply', data),
  submitApplication: (id: number) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/submit`),
  refreshApplication: (id: number) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/refresh`),
  approveApplication: (id: number, approve: boolean) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/callback`, { approve }),
  cancelApplication: (id: number) =>
    panjiaRequest.post<void>(`/commission/apply/${id}/cancel`),

  // 结佣调整
  listAdjusts: (params: CommissionAdjustQuery) =>
    panjiaRequest.get<PageResult<CommissionAdjust>>('/commission/adjust/list', params),
  getAdjust: (id: number) =>
    panjiaRequest.get<CommissionAdjust>(`/commission/adjust/${id}`),
  createAdjust: (data: CommissionAdjustCreateDTO) =>
    panjiaRequest.post<number>('/commission/adjust', data),
  cancelAdjust: (id: number) =>
    panjiaRequest.post<void>(`/commission/adjust/${id}/cancel`),
};
