import panjiaRequest from './index';
import type { OtherIncome, OtherIncomeQuery, PageResult } from './types';

export const otherIncomeApi = {
  list(params: OtherIncomeQuery) {
    return panjiaRequest.get<PageResult<OtherIncome>>('/other-income/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<OtherIncome>(`/other-income/${id}`);
  },
  create(data: Partial<OtherIncome>) {
    return panjiaRequest.post('/other-income', data);
  },
  update(id: string, data: Partial<OtherIncome>) {
    return panjiaRequest.put(`/other-income/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/other-income/${id}`);
  }
};
