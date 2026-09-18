import panjiaRequest from './index';

export interface PayrollBatch {
  id: number;
  period: string;
  deptScope: string;
  status: string;
  employeeCount: number;
  grossTotal: number;
  deductTotal: number;
  taxTotal: number;
  netTotal: number;
  attempt: number;
  lockedAt: string;
  createTime: string;
}

export interface PayrollDetail {
  id: number;
  employeeId: number;
  deptId: number;
  levelCode: string;
  employeeRole: string;
  isPartTime: boolean;
  commissionIncome: number;
  teamIncome: number;
  personalNewsignIncome: number;
  storeIncome: number;
  baseSalary: number;
  guaranteeFill: number;
  mentorBonus: number;
  bonus: number;
  otherIncome: number;
  socialFee: number;
  housingFund: number;
  attendanceFee: number;
  pointsFee: number;
  commercialInsurance: number;
  dormitoryFee: number;
  negativeCarryover: number;
  otherDeduct: number;
  gross: number;
  deduct: number;
  tax: number;
  net: number;
  employerSocial: number;
  finalRate: number;
  perfGrade: string;
}

/** 本人工资查询用的员工主数据（后端 EmployeeMainDataDTO） */
export interface MyPayrollEmployee {
  employeeId: number | string;
  employeeCode: string;
  employeeName: string;
  deptId: number | string;
  deptName: string;
  status?: string;
  userId?: number | string;
}

/** GET /payroll/my/detail 返回体：批次 + 本人明细 + 员工主数据 */
export interface MyPayrollDetailVO {
  batch: PayrollBatch;
  detail: PayrollDetail;
  employee: MyPayrollEmployee;
}

export interface RankRule {
  id: number;
  levelCode: string;
  baseSalary: number;
  baseRate: number;
  minSalary: number;
  teamRate: number | null;
  personalRate: number | null;
  ruleContent: string;
  effectiveFrom: string;
}

export interface PolicyRule {
  id: number;
  scopeType: string;
  scopeKey: string | null;
  baseSocial: number;
  ruleContent: string;
  effectiveFrom: string;
}

export interface ConversionRule {
  id: number;
  bizType: string;
  factor: number;
  effectiveFrom: string;
}

export interface ManualItem {
  id: number;
  period: string;
  employeeId: number;
  itemType: string;
  subType: string | null;
  amount: number;
  reason: string;
  status: string;
  createTime: string;
}

export interface PayrollAdjust {
  id: number;
  sourceBatchId?: number;
  targetPeriod: string;
  employeeId: number;
  adjustType: string; // ADJUST / SUPPLEMENT / RECOVER
  amount: number;
  reason: string;
  status: string; // SUBMITTED / APPROVED / REJECTED / CANCELLED / EXECUTED
  operatorId?: number;
  createTime: string;
  updateTime?: string;
}

export const payrollApi = {
  // 批次
  createBatch(data: { period: string; deptScope?: string }) {
    return panjiaRequest.post<PayrollBatch>('/payroll/batch', data);
  },
  calculate(id: number) {
    return panjiaRequest.post<PayrollBatch>(`/payroll/batch/${id}/calculate`);
  },
  submit(id: number) {
    return panjiaRequest.post<PayrollBatch>(`/payroll/batch/${id}/submit`);
  },
  pay(id: number) {
    return panjiaRequest.post<PayrollBatch>(`/payroll/batch/${id}/pay`);
  },
  listBatches(period?: string) {
    return panjiaRequest.get<PayrollBatch[]>('/payroll/batch', { period });
  },
  /** id 接受字符串：雪花 ID 由后端以字符串下发，Number() 转换 19 位会丢精度 */
  getBatch(id: number | string) {
    return panjiaRequest.get<PayrollBatch>(`/payroll/batch/${id}`);
  },
  getDetails(id: number | string) {
    return panjiaRequest.get<PayrollDetail[]>(`/payroll/batch/${id}/details`);
  },
  getSnapshot(id: number) {
    return panjiaRequest.get<{ snapshotContent: string }>(`/payroll/batch/${id}/snapshot`);
  },

  // 规则
  rankList() {
    return panjiaRequest.get<RankRule[]>('/payroll/rule/rank');
  },
  saveRank(data: RankRule) {
    return panjiaRequest.post('/payroll/rule/rank', data);
  },
  policyList() {
    return panjiaRequest.get<PolicyRule[]>('/payroll/rule/policy');
  },
  savePolicy(data: PolicyRule) {
    return panjiaRequest.post('/payroll/rule/policy', data);
  },
  conversionList() {
    return panjiaRequest.get<ConversionRule[]>('/payroll/rule/conversion');
  },
  saveConversion(data: ConversionRule) {
    return panjiaRequest.post('/payroll/rule/conversion', data);
  },

  // 手工项
  createManual(data: Partial<ManualItem>) {
    return panjiaRequest.post<number>('/payroll/manual-item', data);
  },
  listManual(period: string) {
    return panjiaRequest.get<ManualItem[]>('/payroll/manual-item', { period });
  },
  getManual(id: number | string) {
    return panjiaRequest.get<ManualItem>(`/payroll/manual-item/${id}`);
  },
  deleteManual(id: number) {
    return panjiaRequest.delete(`/payroll/manual-item/${id}`);
  },

  // 调整/补发
  listAdjusts(params: { period?: string; adjustType?: string; status?: string; pageNum?: number; pageSize?: number }) {
    return panjiaRequest.get<{ total: number; rows: PayrollAdjust[] }>('/payroll/adjust/list', params);
  },
  createAdjust(data: Partial<PayrollAdjust>) {
    return panjiaRequest.post<number>('/payroll/adjust', data);
  },
  getAdjust(id: number | string) {
    return panjiaRequest.get<PayrollAdjust>(`/payroll/adjust/${id}`);
  },
};

/** 本人工资查询（综合查询 → 工资查询；员工身份后端按登录态解析） */
export const mySalaryApi = {
  /** 我有工资明细的批次（期间倒序） */
  listBatches() {
    return panjiaRequest.get<PayrollBatch[]>('/payroll/batch/my/batches');
  },
  /** 我在指定批次的工资明细 + 员工主数据 */
  getDetail(batchId: number | string) {
    return panjiaRequest.get<MyPayrollDetailVO>('/payroll/batch/my/detail', { batchId });
  },
};
