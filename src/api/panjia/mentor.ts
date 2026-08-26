import panjiaRequest from './index';
import type { MentorRelation, MentorQuery, PageResult } from './types';

export const mentorApi = {
  list(params: MentorQuery) {
    return panjiaRequest.get<PageResult<MentorRelation>>('/mentor/page', params);
  },
  getById(id: string) {
    return panjiaRequest.get<MentorRelation>(`/mentor/${id}`);
  },
  create(data: Partial<MentorRelation>) {
    return panjiaRequest.post('/mentor', data);
  },
  update(id: string, data: Partial<MentorRelation>) {
    return panjiaRequest.put(`/mentor/${id}`, data);
  },
  remove(id: string) {
    return panjiaRequest.delete(`/mentor/${id}`);
  }
};
