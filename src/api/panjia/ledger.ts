import panjiaRequest from './index';
import { download } from '@/utils/request';

/** 收入 / 支出方向 */
export type LedgerDirection = 'INCOME' | 'EXPENSE';

/** 数据来源：手工录入 / 实收明细自动 / 工资应发自动 */
export type LedgerDataSource = 'MANUAL' | 'RECEIVED_DETAIL' | 'PAYROLL_GROSS';

/** 雪花 ID 由后端以字符串下发，避免 JS 精度丢失 */
type LedgerId = string | number;

export interface LedgerSubject {
  id: LedgerId;
  direction: LedgerDirection;
  parentId: LedgerId;
  subjectCode?: string;
  subjectName: string;
  level: number;
  sortOrder: number;
  dataSource: LedgerDataSource;
  status: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
  /** 后端回填：是否末级（列表用） */
  leaf?: boolean;
  childrenCount?: number;
}

export interface LedgerEntry {
  id: LedgerId;
  subjectId: LedgerId;
  deptId: LedgerId;
  direction: LedgerDirection;
  amount: number;
  /** yyyy-MM-dd（含当天） */
  startDate: string;
  endDate: string;
  remark?: string;
  createBy?: number;
  createTime?: string;
  updateTime?: string;
  /** 后端回填 */
  subjectName?: string;
  subjectPath?: string;
  deptName?: string;
}

export interface LedgerEntryQuery {
  period?: string;
  direction?: LedgerDirection;
  deptId?: LedgerId;
  subjectId?: LedgerId;
}

export interface LedgerReportColumn {
  deptId: LedgerId;
  deptName: string;
}

export interface LedgerReportRow {
  subjectId?: LedgerId;
  subjectName?: string;
  level: number;
  direction?: LedgerDirection;
  dataSource?: LedgerDataSource;
  totalRow: boolean;
  totalLabel?: string;
  /** 四级科目列合并跨度，0=该列被上级合并、不渲染 */
  spans: number[];
  /** 与 columns 等长；父级科目为 null */
  values: (number | null)[] | null;
  total?: number;
}

export interface LedgerReport {
  period: string;
  rootDeptName: string;
  columns: LedgerReportColumn[];
  rows: LedgerReportRow[];
  incomeTotal: number;
  expenseTotal: number;
  profitTotal: number;
}

/** 录入导入结果：整批校验通过才落库 */
export interface LedgerImportResult {
  total: number;
  successCount: number;
  failCount: number;
  errors: string[];
}

/** 统一剥离后端 R 包装（{ code, msg, data }），避免页面拿到 R 对象导致渲染报错 */
const unwrap = <T>(promise: Promise<any>): Promise<T> =>
  promise.then((res: any) => (res && 'code' in res ? res.data : res) as T);

export const ledgerApi = {
  listSubjects(direction?: LedgerDirection) {
    return unwrap<LedgerSubject[]>(panjiaRequest.get('/ledger/subject/list', { direction }));
  },
  createSubject(data: Partial<LedgerSubject>) {
    return unwrap<LedgerId>(panjiaRequest.post('/ledger/subject', data));
  },
  updateSubject(data: Partial<LedgerSubject>) {
    return unwrap<void>(panjiaRequest.put('/ledger/subject', data));
  },
  deleteSubject(id: LedgerId) {
    return unwrap<void>(panjiaRequest.delete(`/ledger/subject/${id}`));
  },

  listEntries(params: LedgerEntryQuery) {
    return unwrap<LedgerEntry[]>(panjiaRequest.get('/ledger/entry/list', params as Record<string, unknown>));
  },
  createEntry(data: Partial<LedgerEntry>) {
    return unwrap<LedgerId>(panjiaRequest.post('/ledger/entry', data));
  },
  updateEntry(data: Partial<LedgerEntry>) {
    return unwrap<void>(panjiaRequest.put('/ledger/entry', data));
  },
  deleteEntry(id: LedgerId) {
    return unwrap<void>(panjiaRequest.delete(`/ledger/entry/${id}`));
  },

  /** 导入录入 Excel（整批校验通过才写入） */
  importEntries(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return unwrap<LedgerImportResult>(panjiaRequest.post('/ledger/entry/import', formData));
  },
  /** 导出当前查询条件下的录入明细 */
  exportEntries(params: LedgerEntryQuery) {
    return download('/api/panjia/ledger/entry/export', params, '部门收支录入.xlsx');
  },
  /** 下载导入模板 */
  downloadTemplate() {
    return download('/api/panjia/ledger/entry/importTemplate', {}, '部门收支导入模板.xlsx');
  },

  getReport(period: string) {
    return unwrap<LedgerReport>(panjiaRequest.get('/ledger/report', { period }));
  }
};
