import panjiaRequest from './index';
import type {
  AttendanceQuery,
  AttendanceRecord,
  AttendanceSaveForm,
  PageResult
} from './types';

/**
 * 考勤汇总接口（员工域，实际前缀 /api/panjia）。
 * 人月维度：一员工一月一行，服务薪酬扣款。
 * 管理端方法需 people:attendance:* 权限（人事/总监）；
 * my 系列全员可访问，服务端强制只返回本人数据。
 */
export const attendanceApi = {
  /** 管理端分页查询 */
  list(params: AttendanceQuery) {
    return panjiaRequest.get<PageResult<AttendanceRecord>>('/people/attendance/list', params);
  },
  /** 管理端详情 */
  getById(id: string | number) {
    return panjiaRequest.get<AttendanceRecord>(`/people/attendance/${id}`);
  },
  /** 新增（人工登记） */
  create(data: AttendanceSaveForm) {
    return panjiaRequest.post<string>('/people/attendance', data);
  },
  /** 修改 */
  update(id: string | number, data: AttendanceSaveForm) {
    return panjiaRequest.put<void>(`/people/attendance/${id}`, data);
  },
  /** 删除（单个或批量） */
  remove(ids: string | number | Array<string | number>) {
    const idPath = Array.isArray(ids) ? ids.join(',') : ids;
    return panjiaRequest.delete<void>(`/people/attendance/${idPath}`);
  },
  /** 本人考勤分页查询（仅月份条件生效） */
  myList(params: AttendanceQuery) {
    return panjiaRequest.get<PageResult<AttendanceRecord>>('/people/attendance/my/list', params);
  },
  /** 本人考勤详情 */
  myGetById(id: string | number) {
    return panjiaRequest.get<AttendanceRecord>(`/people/attendance/my/${id}`);
  }
};
