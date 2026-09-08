import panjiaRequest from './index';
import type { DeptLedger, DeptLedgerQuery, PageResult } from './types';

export const deptLedgerApi = {
  list(params: DeptLedgerQuery) {
    return panjiaRequest.get<PageResult<DeptLedger>>('/dept-ledger/page', params);
  },
  // 汇总数据
  summary(month: string) {
    return panjiaRequest.get('/dept-ledger/summary', { month });
  },
  // 趋势数据
  trend(deptId: string, months: number) {
    return panjiaRequest.get('/dept-ledger/trend', { deptId, months });
  }
};
