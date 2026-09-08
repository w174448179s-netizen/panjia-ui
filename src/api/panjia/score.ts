import panjiaRequest from './index';
import type { ScoreImport, ScoreRecord, ScoreQuery, PageResult } from './types';

export const scoreApi = {
  batchList(params: ScoreQuery) {
    return panjiaRequest.get<PageResult<ScoreImport>>('/score/batch/page', params);
  },
  importFile(file: File, month: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', month);
    return panjiaRequest.post('/score/import', formData);
  },
  recordList(params: ScoreQuery) {
    return panjiaRequest.get<PageResult<ScoreRecord>>('/score/record/page', params);
  }
};
