import panjiaRequest from './index';
import type { CommissionImport, CommissionRecord, CommissionQuery, PageResult } from './types';

export const commissionApi = {
  // 导入批次列表
  batchList(params: CommissionQuery) {
    return panjiaRequest.get<PageResult<CommissionImport>>('/commission/batch/page', params);
  },
  // 导入贝壳数据
  importFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post('/commission/import', formData);
  },
  // 佣金记录列表
  recordList(params: CommissionQuery) {
    return panjiaRequest.get<PageResult<CommissionRecord>>('/commission/record/page', params);
  },
  // 结佣审批列表
  approvalList(params: CommissionQuery) {
    return panjiaRequest.get<PageResult<CommissionRecord>>('/commission/approval/page', params);
  },
  // 审批通过
  approve(id: string) {
    return panjiaRequest.put(`/commission/approve/${id}`);
  },
  // 审批驳回
  reject(id: string, reason: string) {
    return panjiaRequest.put(`/commission/reject/${id}`, { reason });
  }
};
