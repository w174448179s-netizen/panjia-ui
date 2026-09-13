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

export const commissionApi = {
  listAdjusts: (params: CommissionAdjustQuery) =>
    panjiaRequest.get<PageResult<CommissionAdjust>>('/commission/adjust/list', params),
  getAdjust: (id: number) =>
    panjiaRequest.get<CommissionAdjust>(`/commission/adjust/${id}`),
  createAdjust: (data: CommissionAdjustCreateDTO) =>
    panjiaRequest.post<number>('/commission/adjust', data),
  cancelAdjust: (id: number) =>
    panjiaRequest.post<void>(`/commission/adjust/${id}/cancel`),
};
