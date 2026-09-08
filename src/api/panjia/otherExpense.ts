import panjiaRequest from './index';
import type { OtherExpense, OtherExpenseQuery, PageResult } from './types';

export const otherExpenseApi = {
  list(params: OtherExpenseQuery) {
    return panjiaRequest.get<PageResult<OtherExpense>>('/other-expense/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<OtherExpense>(`/other-expense/${id}`);
  },
  create(data: Partial<OtherExpense>) {
    return panjiaRequest.post('/other-expense', data);
  },
  update(id: string, data: Partial<OtherExpense>) {
    return panjiaRequest.put(`/other-expense/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/other-expense/${id}`);
  }
};
