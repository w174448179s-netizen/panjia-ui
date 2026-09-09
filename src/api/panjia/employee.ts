import panjiaRequest from './index';
import type {
  DeptNode,
  Employee,
  EmployeeChangeLog,
  EmployeeCreateForm,
  EmployeeQuery,
  EmployeeUpdateForm,
  PageResult,
  PostOption,
  ReconcileResult
} from './types';

/**
 * 员工域 V5.2 接口（实际前缀 /api/panjia）。
 * 无删除接口：离职 = status 改 LEFT（账户禁用，数据保留）。
 */
export const employeeApi = {
  /** 分页查询员工列表 */
  list(params: EmployeeQuery) {
    return panjiaRequest.get<PageResult<Employee>>('/people/employee/list', params);
  },
  /** 员工详情 */
  getById(employeeId: string | number) {
    return panjiaRequest.get<Employee>(`/people/employee/${employeeId}`);
  },
  /** 新增员工（建员工 + 系统账户 + 岗位/角色 + 初始算薪事实） */
  create(data: EmployeeCreateForm) {
    return panjiaRequest.post<string>('/people/employee', data);
  },
  /** 修改员工（统一 diff：部门/岗位同步系统，职级/开关走事实变更） */
  update(employeeId: string | number, data: EmployeeUpdateForm) {
    return panjiaRequest.put<void>(`/people/employee/${employeeId}`, data);
  },
  /** 员工变更记录时间线 */
  history(employeeId: string | number) {
    return panjiaRequest.get<EmployeeChangeLog[]>(`/people/employee/${employeeId}/history`);
  },
  /** 岗位选项（职位多选下拉） */
  postOptions() {
    return panjiaRequest.get<PostOption[]>('/people/employee/postOptions');
  },
  /** 部门树选项（门店 → 组别，不含客户根节点） */
  deptTree() {
    return panjiaRequest.get<DeptNode[]>('/people/employee/deptTree');
  },
  /** 员工-系统账户对账（自动修复 dept/岗位角色/离职禁用差异） */
  reconcile() {
    return panjiaRequest.post<ReconcileResult>('/people/reconcile/run');
  }
};
