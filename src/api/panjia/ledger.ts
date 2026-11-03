import panjiaRequest from './index';

/** 收入 / 支出方向 */
export type LedgerDirection = 'INCOME' | 'EXPENSE';

/** 数据来源：手工录入 / 实收明细自动 / 工资应发自动 */
export type LedgerDataSource = 'MANUAL' | 'RECEIVED_DETAIL' | 'PAYROLL_GROSS';

export interface LedgerSubject {
  id: number;
  direction: LedgerDirection;
  parentId: number;
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
  id: number;
  subjectId: number;
  deptId: number;
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
  deptId?: number;
  subjectId?: number;
}

export interface LedgerReportColumn {
  deptId: number;
  deptName: string;
}

export interface LedgerReportRow {
  subjectId?: number;
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

/** 统一剥离后端 R 包装（{ code, msg, data }），避免页面拿到 R 对象导致渲染报错 */
const unwrap = <T>(promise: Promise<any>): Promise<T> =>
  promise.then((res: any) => (res && 'code' in res ? res.data : res) as T);

export const ledgerApi = {
  listSubjects(direction?: LedgerDirection) {
    return unwrap<LedgerSubject[]>(panjiaRequest.get('/ledger/subject/list', { direction }));
  },
  createSubject(data: Partial<LedgerSubject>) {
    return unwrap<number>(panjiaRequest.post('/ledger/subject', data));
  },
  updateSubject(data: Partial<LedgerSubject>) {
    return unwrap<void>(panjiaRequest.put('/ledger/subject', data));
  },
  deleteSubject(id: number) {
    return unwrap<void>(panjiaRequest.delete(`/ledger/subject/${id}`));
  },

  listEntries(params: LedgerEntryQuery) {
    return unwrap<LedgerEntry[]>(panjiaRequest.get('/ledger/entry/list', params as Record<string, unknown>));
  },
  createEntry(data: Partial<LedgerEntry>) {
    return unwrap<number>(panjiaRequest.post('/ledger/entry', data));
  },
  updateEntry(data: Partial<LedgerEntry>) {
    return unwrap<void>(panjiaRequest.put('/ledger/entry', data));
  },
  deleteEntry(id: number) {
    return unwrap<void>(panjiaRequest.delete(`/ledger/entry/${id}`));
  },

  getReport(period: string) {
    return unwrap<LedgerReport>(panjiaRequest.get('/ledger/report', { period }));
  }
};
