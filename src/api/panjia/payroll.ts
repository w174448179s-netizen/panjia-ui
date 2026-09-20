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
  /** 员工姓名（后端按 employeeId 翻译） */
  employeeName?: string;
  /** 工号（后端按 employeeId 翻译） */
  employeeCode?: string;
  /** 门店名称（后端按 deptId 翻译） */
  deptName?: string;
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
  commercialInsurance: number;
  dormitoryFee: number;
  negativeCarryover: number;
  otherDeduct: number;
  /** 积分扣款（晚提交处罚：次数×5元/次） */
  pointsFee?: number;
  gross: number;
  deduct: number;
  tax: number;
  net: number;
  employerSocial: number;
  /** 当月新签业绩（折算后金额） */
  newSignPerformance?: number;
  /** 当月结佣业绩（不折算） */
  commissionPerformance?: number;
  /** 当月新签业绩提成比例（职级personalRate） */
  newSignRate?: number;
  finalRate: number;
  perfGrade: string;
  /** 绩效提成扣点（积分等级 A/B/C 对应扣点，A=0/B=-2%/C=-4%，负=扣点） */
  perfDeduct?: number | string | null;
  /** 提成点调整叠加值（负值=扣点，算薪时叠加到综合提点；0=无调整） */
  manualAdjust?: number | string | null;
  /** 提成点调整溯源 JSON（RateAdjustItem 数组：type/rate/reason/source/adjustId） */
  rateAdjustJson?: string | null;
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

/** 结佣追溯明细项（后端 CommissionItemDTO） */
export interface CommissionTraceItem {
  itemId?: number | string;
  performanceFactId?: number | string;
  period: string;
  approvedMonth?: string;
  employeeId: number | string;
  employeeCode?: string;
  deptId?: number | string;
  contractNo?: string;
  orderNo?: string;
  businessDate?: string;
  signDate?: string;
  propertyAddress?: string;
  shareRatio?: number | string;
  bizType: string;
  roleType?: string;
  feeItem?: string;
  amount: number;
  /** 结佣业绩折算后金额（amount × conversionFactor） */
  convertedAmount?: number;
  status?: string;
  source?: string;
}

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
  /** 我的结佣追溯（本人期间已审批结佣明细） */
  myCommissionTrace(period: string) {
    return panjiaRequest.get<CommissionTraceItem[]>('/payroll/batch/my/commission-trace', { period });
  },
  /** 我的门店新签明细（店长查看所在门店团队成员新签业绩） */
  myTeamNewSign(period: string) {
    return panjiaRequest.get<CommissionTraceItem[]>('/payroll/batch/my/team-newsign', { period });
  },
};

/** 组织视角结佣追溯（总监/财务查指定员工） */
export const orgCommissionTraceApi = {
  list(period: string, employeeId: number | string) {
    return panjiaRequest.get<CommissionTraceItem[]>('/payroll/batch/commission-trace', { period, employeeId });
  },
  teamNewSign(period: string, deptId: number | string) {
    return panjiaRequest.get<CommissionTraceItem[]>('/payroll/batch/team-newsign', { period, deptId });
  },
};
