import panjiaRequest from './index';
import type { AttendanceImport, AttendanceRecord, AttendanceQuery, PageResult } from './types';

export const attendanceApi = {
  batchList(params: AttendanceQuery) {
    return panjiaRequest.get<PageResult<AttendanceImport>>('/attendance/batch/page', params);
  },
  importFile(file: File, month: string) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', month);
    return panjiaRequest.post('/attendance/import', formData);
  },
  recordList(params: AttendanceQuery) {
    return panjiaRequest.get<PageResult<AttendanceRecord>>('/attendance/record/page', params);
  }
};
