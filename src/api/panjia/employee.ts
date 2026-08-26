import panjiaRequest from './index';
import type { Employee, EmployeeQuery, EmployeeForm, PageResult } from './types';

export const employeeApi = {
  // 列表（分页）
  list(params: EmployeeQuery) {
    return panjiaRequest.get<PageResult<Employee>>('/employee/page', params);
  },
  // 详情
  getById(id: string) {
    return panjiaRequest.get<Employee>(`/employee/${id}`);
  },
  // 新建
  create(data: EmployeeForm) {
    return panjiaRequest.post('/employee', data);
  },
  // 更新
  update(id: string, data: EmployeeForm) {
    return panjiaRequest.put(`/employee/${id}`, data);
  },
  // 删除
  remove(id: string) {
    return panjiaRequest.delete(`/employee/${id}`);
  },
  // 批量删除
  batchRemove(ids: string[]) {
    return panjiaRequest.delete('/employee/batch', { ids });
  },
  // 批量导入
  importFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return panjiaRequest.post('/employee/import', formData);
  },
  // 导出
  export(params: EmployeeQuery) {
    return panjiaRequest.post('/employee/export', params);
  }
};
