import panjiaRequest from './index';
import type { Adjustment, AdjustmentQuery, PageResult } from './types';

export const adjustmentApi = {
  list(params: AdjustmentQuery) {
    return panjiaRequest.get<PageResult<Adjustment>>('/adjustment/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<Adjustment>(`/adjustment/${id}`);
  },
  create(data: Partial<Adjustment>) {
    return panjiaRequest.post('/adjustment', data);
  },
  update(id: string, data: Partial<Adjustment>) {
    return panjiaRequest.put(`/adjustment/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/adjustment/${id}`);
  },
  approve(id: string) {
    return panjiaRequest.put(`/adjustment/approve/${id}`);
  }
};
