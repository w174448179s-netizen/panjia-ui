/**
 * 盘家业务公共类型定义
 */

// 分页查询参数
export interface PageQuery {
  pageNum?: number;
  pageSize?: number;
}

// 分页返回结果（复用上游定义，这里补充业务层别名）
export interface PageResult<T = any> {
  total: number;
  rows: T[];
}

// 员工档案
export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  phone: string;
  idCard: string;
  deptId: string;
  deptName: string;
  storeId: string;
  storeName: string;
  rankId: string;
  rankName: string;
  position: string;
  entryDate: string;
  status: string;
  remark: string;
  createTime: string;
}

// 员工查询参数
export interface EmployeeQuery extends PageQuery {
  name?: string;
  phone?: string;
  deptId?: string;
  storeId?: string;
  rankId?: string;
  status?: string;
}

// 员工表单
export interface EmployeeForm {
  id?: string;
  employeeNo: string;
  name: string;
  phone: string;
  idCard: string;
  deptId: string;
  storeId: string;
  rankId: string;
  position: string;
  entryDate: string;
  status: string;
  remark?: string;
}

// 职级规则
export interface RankRule {
  id: string;
  rankCode: string;
  rankName: string;
  rankLevel: number;
  baseSalary: number;
  commissionRate: number;
  status: string;
  remark: string;
}

export interface RankRuleQuery extends PageQuery {
  rankCode?: string;
  rankName?: string;
  status?: string;
}

// 师徒关系
export interface MentorRelation {
  id: string;
  mentorId: string;
  mentorName: string;
  apprenticeId: string;
  apprenticeName: string;
  startDate: string;
  endDate?: string;
  status: string;
  commissionRate: number;
}

export interface MentorQuery extends PageQuery {
  mentorId?: string;
  apprenticeId?: string;
  status?: string;
}

// 贝壳导入
export interface CommissionImport {
  id: string;
  batchNo: string;
  fileName: string;
  totalCount: number;
  successCount: number;
  failCount: number;
  importTime: string;
  status: string;
}

export interface CommissionRecord {
  id: string;
  batchId: string;
  projectName: string;
  houseNo: string;
  customerName: string;
  brokerName: string;
  commissionAmount: number;
  dealDate: string;
  status: string;
}

export interface CommissionQuery extends PageQuery {
  batchNo?: string;
  brokerName?: string;
  projectName?: string;
  status?: string;
}

// 业绩调整
export interface Adjustment {
  id: string;
  employeeId: string;
  employeeName: string;
  adjustType: string;
  adjustAmount: number;
  adjustReason: string;
  adjustMonth: string;
  status: string;
  approver?: string;
  approveTime?: string;
}

export interface AdjustmentQuery extends PageQuery {
  employeeName?: string;
  adjustType?: string;
  adjustMonth?: string;
  status?: string;
}

// 考勤
export interface AttendanceImport {
  id: string;
  batchNo: string;
  fileName: string;
  totalCount: number;
  importTime: string;
  month: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  workDays: number;
  leaveDays: number;
  absentDays: number;
  lateTimes: number;
  earlyLeaveTimes: number;
  overtimeHours: number;
  month: string;
}

export interface AttendanceQuery extends PageQuery {
  employeeName?: string;
  month?: string;
}

// 积分
export interface ScoreImport {
  id: string;
  batchNo: string;
  fileName: string;
  totalCount: number;
  importTime: string;
  month: string;
}

export interface ScoreRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  scoreType: string;
  score: number;
  month: string;
  remark: string;
}

export interface ScoreQuery extends PageQuery {
  employeeName?: string;
  scoreType?: string;
  month?: string;
}

// 工资计算
export interface SalaryBatch {
  id: string;
  batchNo: string;
  month: string;
  totalCount: number;
  totalAmount: number;
  status: string;
  createTime: string;
  calcTime?: string;
}

export interface SalaryRecord {
  id: string;
  batchId: string;
  employeeId: string;
  employeeName: string;
  baseSalary: number;
  performanceSalary: number;
  commission: number;
  bonus: number;
  allowance: number;
  deduction: number;
  socialSecurity: number;
  housingFund: number;
  tax: number;
  actualSalary: number;
  month: string;
}

export interface SalaryQuery extends PageQuery {
  employeeName?: string;
  batchId?: string;
  month?: string;
}

// 奖金审批
export interface BonusApproval {
  id: string;
  employeeId: string;
  employeeName: string;
  bonusType: string;
  bonusAmount: number;
  bonusReason: string;
  month: string;
  status: string;
  approver?: string;
  approveTime?: string;
}

export interface BonusQuery extends PageQuery {
  employeeName?: string;
  bonusType?: string;
  month?: string;
  status?: string;
}

// 其他收入
export interface OtherIncome {
  id: string;
  employeeId: string;
  employeeName: string;
  incomeType: string;
  incomeAmount: number;
  incomeDate: string;
  remark: string;
}

export interface OtherIncomeQuery extends PageQuery {
  employeeName?: string;
  incomeType?: string;
  incomeDate?: string;
}

// 其他支出
export interface OtherExpense {
  id: string;
  employeeId: string;
  employeeName: string;
  expenseType: string;
  expenseAmount: number;
  expenseDate: string;
  remark: string;
}

export interface OtherExpenseQuery extends PageQuery {
  employeeName?: string;
  expenseType?: string;
  expenseDate?: string;
}

// 部门收支分析
export interface DeptLedger {
  deptId: string;
  deptName: string;
  totalIncome: number;
  totalExpense: number;
  netProfit: number;
  employeeCount: number;
  month: string;
}

export interface DeptLedgerQuery extends PageQuery {
  deptId?: string;
  month?: string;
}
