import panjiaRequest from './index';
import type { BonusApproval, BonusQuery, PageResult } from './types';

export const bonusApi = {
  list(params: BonusQuery) {
    return panjiaRequest.get<PageResult<BonusApproval>>('/bonus/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<BonusApproval>(`/bonus/${id}`);
  },
  create(data: Partial<BonusApproval>) {
    return panjiaRequest.post('/bonus', data);
  },
  update(id: string, data: Partial<BonusApproval>) {
    return panjiaRequest.put(`/bonus/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/bonus/${id}`);
  },
  approve(id: string) {
    return panjiaRequest.put(`/bonus/approve/${id}`);
  },
  reject(id: string, reason: string) {
    return panjiaRequest.put(`/bonus/reject/${id}`, { reason });
  }
};
