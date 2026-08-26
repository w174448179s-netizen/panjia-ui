import panjiaRequest from './index';
import type { RankRule, RankRuleQuery, PageResult } from './types';

export const rankApi = {
  list(params: RankRuleQuery) {
    return panjiaRequest.get<PageResult<RankRule>>('/rank/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<RankRule>(`/rank/${id}`);
  },
  create(data: Partial<RankRule>) {
    return panjiaRequest.post('/rank', data);
  },
  update(id: string, data: Partial<RankRule>) {
    return panjiaRequest.put(`/rank/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/rank/${id}`);
  },
  listAll() {
    return panjiaRequest.get<RankRule[]>('/rank/list');
  }
};
