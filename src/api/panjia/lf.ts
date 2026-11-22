import panjiaRequest from './index';
import { download } from '@/utils/request';
import type { PageQuery, PageResult } from './types';

type LfId = string | number;

export interface LfAccount {
  id?: LfId;
  storeDeptId?: LfId | null;
  storeName?: string;
  filePrefix?: string;
  accountName?: string;
  status?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}

export interface LfStatementQuery {
  period?: string;
  storeDeptId?: LfId;
  accountId?: LfId;
  incomeExpenseType?: string;
  transactionType?: string;
  category?: string;
  subjectId?: LfId;
  /** true=去化（售前房屋美化）流水；false=普通流水 */
  decorationFlag?: boolean;
  allocStatus?: string;
  matchStatus?: string;
  businessDesc?: string;
  transactionRemark?: string;
  contractNo?: string;
  keyword?: string;
}

export interface LfStatement {
  id: LfId;
  period: string;
  storeName?: string;
  storeDeptId?: LfId;
  accountName?: string;
  transactionTime?: string;
  incomeExpenseType?: string;
  transactionType?: string;
  transactionAmount?: number;
  accountBalance?: number;
  businessDesc?: string;
  address?: string;
  houseNo?: string;
  contractNo?: string;
  transactionRemark?: string;
  counterpartyName?: string;
  bizOrderNo?: string;
  voucherNo?: string;
  paymentNo?: string;
  category?: string;
  decorationFlag?: boolean;
  subjectId?: LfId;
  subjectName?: string;
  expenseDeptId?: LfId;
  expenseDeptName?: string;
  allocStatus?: string;
  matchStatus?: string;
  matchDiffAmount?: number;
  matchTime?: string;
}

export interface LfImportResult {
  batchId?: LfId;
  fileName?: string;
  status?: 'PROCESSING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  totalRows: number;
  successRows: number;
  failRows: number;
  insertRows: number;
  updateRows: number;
  skippedRows: number;
  matchContractCount: number;
  matchedCount: number;
  diffCount: number;
  notFoundCount: number;
  pendingSignRoleCount: number;
  pendingAllocCount: number;
  pendingSubjectCount: number;
  unmappedSubjects: string[];
  errors: string[];
}

export interface LfMatchResult {
  id: LfId;
  contractNo: string;
  flowAmount?: number;
  receivedAmount?: number;
  diffAmount?: number;
  flowRowCount?: number;
  matchStatus?: string;
  lastMatchTime?: string;
}

export interface LfDiffDetail {
  contractNo: string;
  flowAmount?: number;
  receivedAmount?: number;
  diffAmount?: number;
  matchStatus?: string;
  flowLines: LfDiffFlowLine[];
  receivedLines: LfDiffReceivedLine[];
}

export interface LfDiffFlowLine {
  id: LfId;
  period?: string;
  storeName?: string;
  transactionTime?: string;
  incomeExpenseType?: string;
  businessDesc?: string;
  transactionRemark?: string;
  transactionAmount?: number;
  voucherNo?: string;
}

export interface LfDiffReceivedLine {
  id: LfId;
  period?: string;
  employeeId?: LfId;
  deptName?: string;
  roleName?: string;
  roleType?: string;
  performanceAmount?: number;
  sourceType?: string;
  applyStatus?: string;
}

const unwrap = <T>(promise: Promise<any>): Promise<T> =>
  promise.then((res: any) => (res && 'code' in res ? res.data : res) as T);

export const lfApi = {
  listAccounts(params?: { keyword?: string; status?: string } & PageQuery) {
    return unwrap<PageResult<LfAccount>>(panjiaRequest.get('/ledger/lfAccount/list', params));
  },
  createAccount(data: Partial<LfAccount>) {
    return unwrap<LfId>(panjiaRequest.post('/ledger/lfAccount', data));
  },
  updateAccount(data: Partial<LfAccount>) {
    return unwrap<void>(panjiaRequest.put('/ledger/lfAccount', data));
  },
  deleteAccount(id: LfId) {
    return unwrap<void>(panjiaRequest.delete(`/ledger/lfAccount/${id}`));
  },

  listStatements(params: LfStatementQuery & PageQuery) {
    return unwrap<PageResult<LfStatement>>(
      panjiaRequest.get('/ledger/lf/list', params as Record<string, unknown>)
    );
  },
  listTransactionTypes() {
    return unwrap<string[]>(panjiaRequest.get('/ledger/lf/transactionTypes'));
  },
  listExpenseSubjects() {
    return unwrap<Array<{ id: LfId; subjectName: string }>>(panjiaRequest.get('/ledger/lf/expenseSubjects'));
  },
  importStatements(file: File, storeDeptId: LfId) {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap<LfImportResult>(
      panjiaRequest.post('/ledger/lf/import', formData, { params: { storeDeptId } })
    );
  },
  getImportResult(batchId: LfId) {
    return unwrap<LfImportResult>(panjiaRequest.get('/ledger/lf/import/result', { batchId }));
  },
  allocate(ids: LfId[], expenseDeptId: LfId) {
    return unwrap<number>(panjiaRequest.put('/ledger/lf/alloc', { ids, expenseDeptId }));
  },
  pendingSubjects(params: { storeDeptId?: LfId } & PageQuery) {
    return unwrap<PageResult<{ desc: string; cnt: number; amount: number }>>(
      panjiaRequest.get('/ledger/lf/pendingSubjects', params)
    );
  },
  rematchSubject(storeDeptId?: LfId) {
    return unwrap<number>(panjiaRequest.post('/ledger/lf/rematchSubject', null, { params: { storeDeptId } }));
  },
  diffList(params?: { matchStatus?: string; contractNo?: string } & PageQuery) {
    return unwrap<PageResult<LfMatchResult>>(panjiaRequest.get('/ledger/lf/diff/list', params));
  },
  diffDetail(contractNo: string) {
    return unwrap<LfDiffDetail>(panjiaRequest.get('/ledger/lf/diff/detail', { contractNo }));
  },
  exportStatements(params: LfStatementQuery) {
    return download('/api/panjia/ledger/lf/export', params, '理房通流水.xlsx');
  }
};
