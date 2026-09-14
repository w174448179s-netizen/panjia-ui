import panjiaRequest from './index';
import type {
  DeptNode,
  Employee,
  EmployeeChangeLog,
  EmployeeCreateForm,
  EmployeeQuery,
  EmployeeUpdateForm,
  PageResult,
  PeopleImportBatch,
  PeopleImportIssue,
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
  },
  // ==================== V6.0 员工导入 ====================
  /** 上传文件导入员工（阶段A同步诊断，阶段B异步落地，返回 batchId 供轮询） */
  importEmployees(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post<string>('/people/employee/import', formData);
  },
  /** 员工导入批次详情（轮询进度用） */
  importBatch(batchId: string | number) {
    return panjiaRequest.get<PeopleImportBatch>(`/people/employee/import/batches/${batchId}`);
  },
  /** 员工导入批次列表 */
  importBatches() {
    return panjiaRequest.get<PeopleImportBatch[]>('/people/employee/import/batches');
  },
  /** 员工导入批次问题清单 */
  importIssues(batchId: string | number) {
    return panjiaRequest.get<PeopleImportIssue[]>(`/people/employee/import/${batchId}/issues`);
  },
  /** 下载员工导入模板（Excel，含表头+示例行） */
  async downloadImportTemplate() {
    const { getToken } = await import('@/utils/auth');
    const baseApi = import.meta.env.VITE_APP_BASE_API;
    const res = await fetch(`${baseApi}/api/panjia/people/employee/import/template?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${getToken()}`, clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e' }
    });
    if (!res.ok) throw new Error('模板下载失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = '员工导入模板.xlsx';
    link.click();
    window.URL.revokeObjectURL(url);
  }
};
