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

/**
 * 导入批次原始行（V2.0 §3.2 RawData）。
 *
 * 后端在 {@code RawData} 接口上反序列化具体分表实体
 * （RawSigned/RawNewSign/RawAttendance/RawPoints/RawManual），
 * 前端只关心通用字段：id / batchId / rowNo / rawJson + createTime。
 * 其它类型字段（如 orderNo / roleSysNo 等）通过展开 rawJson 查看。
 */
export interface ImportRawRow {
  id: string;
  batchId: string;
  rowNo: number;
  rawJson: string;
  createTime: string;
}

// ==================== 员工域 V5.2 ====================

/** 员工档案（含当前态算薪事实，后端 enrich 后返回） */
export interface Employee {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  deptId: string;
  deptName: string;
  postNames: string[];
  levelCode: string;
  phone: string;
  idCard: string;
  reportDate: string;
  hireDate: string;
  leaveDate?: string;
  status: string;
  socialInsured: boolean;
  /** 社保金额（自定义；null=用全局默认算法） */
  socialFee?: number;
  housingInsured: boolean;
  commercialInsured: boolean;
  /** 商业保险金额（自定义；null=用全局默认 21 元） */
  commercialFee?: number;
  dormitory: boolean;
  /** 公积金金额（自定义；null=用全局默认算法） */
  housingFund?: number;
  /** 宿舍费金额（自定义；null=用全局默认算法） */
  dormitoryFee?: number;
  isPartTime: boolean;
  mentorCode?: string;
  mentorName?: string;
  remark?: string;
}

/** 员工分页查询参数 */
export interface EmployeeQuery extends PageQuery {
  employeeCode?: string;
  employeeName?: string;
  deptId?: string;
  postName?: string;
  status?: string;
}

/** 新增员工表单 */
export interface EmployeeCreateForm {
  employeeCode: string;
  employeeName: string;
  deptId: string;
  postNames: string[];
  levelCode: string;
  phone: string;
  idCard: string;
  reportDate: string;
  hireDate: string;
  status: string;
  socialInsured: boolean;
  housingInsured: boolean;
  commercialInsured: boolean;
  dormitory: boolean;
  parttime: boolean;
  mentorCode?: string;
  remark?: string;
  /** 社保金额（自定义；null=用全局默认算法） */
  socialFee?: number;
  /** 商业保险金额（自定义；null=用全局默认 21 元） */
  commercialFee?: number;
  /** 公积金金额（自定义；null=用全局默认算法） */
  housingFund?: number;
  /** 宿舍费金额（自定义；null=用全局默认算法） */
  dormitoryFee?: number;
}

/** 修改员工表单（在新增基础上支持生效日与离职日） */
export interface EmployeeUpdateForm extends EmployeeCreateForm {
  effectiveDate?: string;
  leaveDate?: string;
}

/** 部门树节点（门店 → 组别，不含客户根节点） */
export interface DeptNode {
  deptId: string;
  deptName: string;
  parentId: string;
  children: DeptNode[];
}

/** 岗位选项 */
export interface PostOption {
  postId: string;
  postName: string;
}

/** 员工变更记录 */
export interface EmployeeChangeLog {
  effectiveDate: string;
  changeFieldName: string;
  beforeValue?: string;
  afterValue?: string;
  operatorName?: string;
}

/** 对账差异项 */
export interface ReconcileItem {
  employeeCode: string;
  employeeName: string;
  field: string;
  beforeValue: string;
  afterValue: string;
}

/** 对账结果 */
export interface ReconcileResult {
  totalEmployees: number;
  fixedCount: number;
  items: ReconcileItem[];
}

// ==================== 导入域 V2.0（单据导入：业绩/考勤/积分/费用） ====================

/** 单据导入批次 */
export interface ImportBatch {
  id: string;
  batchNo: string;
  sourceType: string;
  templateVersion: string;
  fileName: string;
  originalFileName?: string;
  storagePath: string;
  period?: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: string;
  operatorId?: string;
  deptId?: string;
  createTime: string;
  updateTime: string;
}

/** 单据导入问题 */
export interface ImportIssue {
  id: string;
  batchId: string;
  rowNo?: number;
  issueType: string;
  fieldName?: string;
  rawValue?: string;
  message: string;
  status: string;
  createTime: string;
}

/** 导入模板配置（import 域） */
export interface ImportTemplate {
  id: string;
  templateCode: string;
  templateVersion: string;
  optLockVersion?: number;
  templateName: string;
  sourceType: string;
  fileType: string;
  sheetName?: string;
  headerRow: number;
  dataStartRow: number;
  columnMapping: string;
  validationRules?: string;
  isActive: boolean;
  description?: string;
  sourceFileVersion?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  remark?: string;
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

/** 导入列映射（import 域） */
export interface ColumnMapping {
  source_column?: string;
  source_header?: string;
  target_field?: string;
  transform?: string;
  default_value?: string;
  data_type?: string;
  required?: boolean;
}

/** 员工导入模板（people 域） */
export interface PeopleImportTemplate {
  id: string;
  templateCode: string;
  templateVersion: string;
  columnJson: string;
  enabled: number; // 1启用 0停用
  createTime: string;
}

/** 列定义（people 域 ColumnDef / 通用列结构） */
export interface ColumnDef {
  colName: string;
  field: string;
  type: string;
  required?: boolean;
  maxLength?: number;
  enumValues?: string[];
  dateFormat?: string;
  deptLevel?: number;
}

/** 版本对比差异条目 */
export interface TemplateColumnDiff {
  field: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'UNCHANGED';
  sourceHeader?: string;
  targetHeader?: string;
  sourceType?: string;
  targetType?: string;
  sourceRequired?: boolean;
  targetRequired?: boolean;
  diffDetail: string;
}

// ==================== 员工域 V6.0 员工导入 ====================

/** 员工导入批次（people 域独立状态机） */
export interface PeopleImportBatch {
  id: string;
  batchNo: string;
  templateCode: string;
  templateVersion: string;
  fileName: string;
  storagePath: string;
  fileHash: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  status: string;
  operatorId?: string;
  remark?: string;
  supersededByBatchId?: string;
  createTime: string;
  updateTime: string;
}

/** 员工导入问题 */
export interface PeopleImportIssue {
  id: string;
  batchId: string;
  rowNo?: number;
  issueType: string;
  fieldName?: string;
  rawValue?: string;
  message: string;
  status: string;
  createTime: string;
}

// ==================== 其它业务域（保留原有定义） ====================

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

/** 月考勤汇总（员工域 pj_people_attendance，一员工一月一行） */
export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendMonth: string;
  leaveDays?: number;
  absentDays?: number;
  lateCount?: number;
  lateMinutes?: number;
  missingCardCount?: number;
  attendDays?: number;
  restDays?: number;
  dataSource?: string;
  remark?: string;
  version?: number;
  createTime?: string;
  updateTime?: string;
  // 展示冗余
  employeeCode?: string;
  employeeName?: string;
  deptId?: string;
  deptName?: string;
  /** 该期间考勤已提交审批（SUBMITTED/APPROVED）时锁定，禁止增删改 */
  locked?: boolean;
}

/** 考勤汇总查询（管理端；本人查询仅用 monthStart/monthEnd） */
export interface AttendanceQuery extends PageQuery {
  employeeId?: string;
  employeeName?: string;
  employeeCode?: string;
  deptId?: string;
  monthStart?: string;
  monthEnd?: string;
}

/** 考勤汇总新增/编辑表单（人月维度） */
export interface AttendanceSaveForm {
  employeeId?: string;
  attendMonth?: string;
  leaveDays?: number;
  absentDays?: number;
  lateCount?: number;
  lateMinutes?: number;
  missingCardCount?: number;
  attendDays?: number;
  restDays?: number;
  remark?: string;
  version?: number;
}

/** 考勤审批单（一期间一行；无审批单时 status 为空表示未提交） */
export type AttendanceApprovalStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';

/** 异常考勤行（迟到/迟到分/缺卡/旷工/请假 任一 >0，仅这些行需要总监审阅） */
export interface AttendanceAbnormalRow {
  employeeId?: number | string;
  employeeCode?: string | null;
  employeeName?: string | null;
  attendMonth?: string | null;
  lateCount?: number;
  lateMinutes?: number;
  missingCardCount?: number;
  absentDays?: number;
  leaveDays?: number;
  remark?: string | null;
}

export interface AttendanceApproval {
  id?: string;
  period: string;
  status?: AttendanceApprovalStatus;
  submitBy?: string;
  submitTime?: string;
  approveBy?: string;
  approveTime?: string;
  rejectReason?: string;
  processInstanceId?: string | null;
  /** 当期考勤总行数 */
  totalCount?: number;
  /** 异常行数（需总监审阅的行） */
  abnormalCount?: number;
  /** 异常行请假天数合计 */
  abnormalLeaveDays?: number;
  /** 异常考勤快照明细 */
  abnormalRows?: AttendanceAbnormalRow[];
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
