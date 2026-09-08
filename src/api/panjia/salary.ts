import panjiaRequest from './index';
import type { SalaryBatch, SalaryRecord, SalaryQuery, PageResult } from './types';

export const salaryApi = {
  // 工资批次列表
  batchList(params: SalaryQuery) {
    return panjiaRequest.get<PageResult<SalaryBatch>>('/salary/batch/page', params);
  },
  // 创建工资批次
  createBatch(month: string) {
    return panjiaRequest.post('/salary/batch', { month });
  },
  // 工资计算
  calculate(batchId: string) {
    return panjiaRequest.post(`/salary/calculate/${batchId}`);
  },
  // 工资明细列表
  detailList(params: SalaryQuery) {
    return panjiaRequest.get<PageResult<SalaryRecord>>('/salary/detail/page', params);
  },
  // 员工工资明细
  getByEmployee(employeeId: string, month: string) {
    return panjiaRequest.get<SalaryRecord>(`/salary/detail/employee/${employeeId}`, { month });
  },
  // 导出工资单
  export(batchId: string) {
    return panjiaRequest.post(`/salary/export/${batchId}`);
  },
  // 发放工资
  payout(batchId: string) {
    return panjiaRequest.put(`/salary/payout/${batchId}`);
  }
};
