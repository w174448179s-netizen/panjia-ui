import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

// ========== 类型定义 ==========
export interface PerformanceFact {
  id: string;
  factType: string;           // PERF_REAL / PERF_EXPECT
  factTypeName?: string;      // 显示用
  period: string;             // YYYY-MM
  businessDate: string;       // 业务发生日
  batchId?: string;
  sourceKey: string;
  contractNo?: string;        // 合同号（发起调整时用于在途互斥预检）
  orderNo?: string;           // 订单号
  bizType?: string;
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  deptId: string;
  deptName?: string;
  roleType?: string;
  shareRatio: number;
  performanceAmount: number;
  amount?: number;            // 兼容字段：同 performanceAmount
  factStatus: string;         // ACTIVE / REVERSED
  factStatusName?: string;
  source: string;             // IMPORT / MANUAL
  sourceName?: string;
  reversedReason?: string;
  createTime: string;
}

export interface FactQuery extends PageQuery {
  period?: string;
  factType?: string;
  employeeId?: string;
  deptId?: string;
  bizType?: string;
  factStatus?: string;
  source?: string;
}

export interface PerformanceAdjust {
  id: string;
  adjustNo: string;
  factId?: string;
  period: string;
  employeeId: string;
  employeeName?: string;
  deptId: string;
  deptName?: string;
  adjustType: string;         // AMOUNT / ADD_MEMBER
  adjustTypeName?: string;
  adjustScope?: string;      // CONTRACT / DETAIL
  contractNo?: string;
  originalAmount?: number;    // 调整前原始金额（创建时快照）
  targetAmount?: number;      // 调整后目标金额（用户录入的最终金额）
  convertedOriginalAmount?: number; // 折算后原始金额（originalAmount × factor）
  convertedTargetAmount?: number;    // 折算后目标金额（targetAmount × factor）
  /** ADD_MEMBER 调整后合同业绩合计（与 originalAmount 不等=同时调整了合同总额；旧单为空视为不变） */
  afterTotalAmount?: number;
  reason: string;
  status: string;             // SUBMITTED/APPROVED/REJECTED/CANCELLED/EXECUTED
  statusName?: string;
  applicantId?: string;
  applicantName?: string;
  approverId?: string;
  approverName?: string;
  approveTime?: string;
  executeTime?: string;
  createTime: string;
}

/** 调整单完整详情（审批办理页用） */
export interface AdjustDetailVO extends PerformanceAdjust {
  orderNo?: string;
  propertyAddress?: string;
  businessDate?: string;
  detailCount?: number;
  expectedTotal?: number;
  receivedTotal?: number;
  targetAmount?: number;
  details?: AdjustFactDetailVO[];
}

/** 调整单·受影响的明细行 */
export interface AdjustFactDetailVO {
  factId: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  shareRatio?: number;
  expectedAmount?: number;     // 对侧口径金额（应收调整时=实收，实收调整时=应收）
  amount?: number;             // 当前口径金额（调整前的 performance_amount）
  afterAmount?: number;
  convertedAmount?: number;    // 折算后当前金额（amount × factor）
  convertedAfterAmount?: number; // 折算后调整后金额（afterAmount × factor）
  deltaAmount?: number;
  target?: boolean;
  factStatus?: string;
}

export interface AdjustQuery extends PageQuery {
  period?: string;
  adjustType?: string;
  status?: string;
  employeeId?: string;
  deptId?: string;
  bizType?: string;
  keyword?: string;
}

export interface AdjustCreateForm {
  factId?: string;
  period: string;
  employeeId?: string;       // 明细级调整时必填（被调整事实所属员工）；合同级/ADD_MEMBER 不传
  deptId?: string;           // 同上，明细级必填
  adjustType: string;        // AMOUNT / ADD_MEMBER / MANUAL_OFFSET / RECEIVED_AMOUNT
  adjustScope?: string;      // CONTRACT / DETAIL
  contractNo?: string;       // 合同级调整时填
  factType?: string;         // PERF_REAL / PERF_EXPECT（RECEIVED_AMOUNT 固定 PERF_REAL）
  targetAmount?: number;     // 调整后目标金额
  reason: string;
  payloadJson?: string;
  // ---- 实收调整（RECEIVED_AMOUNT，合同级，2026-10-10）----
  // 只需 adjustType/adjustScope/contractNo/factType/period/targetAmount/reason：
  // period=实收期间（YYYY-MM），targetAmount=调整后实收合计（正多收负少收），
  // 后端按实收明细等比分摊并快照 payload，无需传明细行
  // ---- 增加角色人（ADD_MEMBER，合同级）专用 ----
  newEmployeeId?: string;    // 新角色人员工 ID
  newRoleType?: string;      // 新角色人角色类型
  newAmount?: number;        // 新角色人业绩金额
  newShareRatio?: number;    // 新角色人业绩比例（小数，如 0.5；空=不设置）
  newDeptId?: string;        // 新角色人业绩归属部门（默认员工档案部门，可改）
  deductions?: { factId: string; amount: number }[]; // 指定扣除行（剩余由未指定行等比分摊）
  // ---- 明细指定值（可编辑表格，2026-09-28）----
  // 按行提交「调整后金额/角色占比」，审批通过后按指定值精确落库（不再等比分摊）；
  // 合同级 AMOUNT 与 ADD_MEMBER 均支持，为空时保持旧交互
  detailTargets?: { factId: string; targetAmount: number; shareRatio?: number }[];
  // ---- 业绩冲正（MANUAL_OFFSET，合同级）专用 ----
  // 每条含员工ID、角色类型、角色名、冲正金额（正增负减），审批通过后循环创建 MANUAL 事实。
  // employeeId/factId 用 string：雪花 ID 超过 JS 安全整数范围，传 number 会被取整丢精度
  // （后端以工号+角色归一化，ID 仅作优先匹配）
  offsetItems?: {
    employeeId: string | number; roleType: string; roleName?: string; amount: number;
    factId?: string | number; employeeCode?: string; deptName?: string;
    shareRatio?: number; originalAmount?: number;
  }[];
}

export interface ManualFactForm {
  factType: string;
  period: string;
  businessDate: string;
  employeeId: string;
  employeeCode?: string;
  deptId: string;
  roleType?: string;
  bizType?: string;
  sourceKey: string;
  shareRatio?: number;
  performanceAmount: number;
  reason?: string;
}

/** 业绩管理明细行（人→合同→明细 树表的明细层，后端 /perf/fact/manage 返回） */
export interface PerformanceManageRow {
  id?: string | null;
  factStatus?: string;       // ACTIVE 有效 / VOIDED 已作废
  factType: string;          // PERF_REAL / PERF_EXPECT
  period: string;
  businessDate: string;      // 签约/认购日期
  orderNo?: string;          // 订单号
  contractNo?: string;       // 合同号
  bizType?: string;          // 类型
  propertyAddress?: string;  // 房源地址
  employeeId: string;
  employeeName?: string;     // 签约人
  employeeCode?: string;
  deptPath?: string;         // 门店/组别全路径：大区-门店-组（组与门店同名时只到两级）
  roleType?: string;         // 所属角色
  roleName?: string;         // 角色名
  shareRatio?: number;       // 角色占比
  amount: number | null;     // 业绩金额（调整后，PERF_EXPECT=应收 / PERF_REAL=实收）；ADD_MEMBER 在途新人虚拟行为 null
  originalAmount: number | null; // 原始金额（调整前，未调整时 = amount）；在途新人虚拟行为 null
  convertedAmount?: number;  // 折算后金额（amount × conversionFactor）
  originalConvertedAmount?: number; // 折算后原始金额（originalAmount × conversionFactor）
  adjustPending?: boolean;   // 存在审批中的调整单（SUBMITTED/APPROVED，执行前金额未变）
  adjustPendingType?: string;      // 审批中调整单类型 AMOUNT/ADD_MEMBER
  adjustPendingAmount?: number;    // 审批中调整单目标金额（仅 AMOUNT 类型）
  adjustPendingDelta?: number;     // 分摊到本明细的调整金额（= adjustPendingAmount − amount）
  adjustDelta?: number;            // 已执行调整累计的调整金额（= amount − originalAmount）
  conversionFactor?: number;       // 本行折算系数（调整弹窗录入业绩后自动算折算金额用）
  settled: boolean;                // 是否已结算
  settleDate?: string;       // 结算日期
  sourceKey: string;
  manualAdjust?: boolean;    // 「新增角色人」调整产生的新人事实行，展示「新签调整」标记
}

/** 业绩管理查询参数（以签约人为维度后端分页） */
export interface ManageQuery {
  period: string;
  factType: string;          // PERF_REAL / PERF_EXPECT
  deptId?: string;
  employeeId?: string;        // 员工 ID（合同维度页按员工过滤）
  bizType?: string;
  settled?: boolean;
  keyword?: string;          // 员工号/姓名/合同号/订单号/房源地址/角色/门店/店组
  factStatus?: string;       // ACTIVE / VOIDED / ALL（不传默认 ACTIVE）
  pageNum?: number;
  pageSize?: number;
}

/** 业绩管理人层聚合行（/perf/fact/manage 返回，每人一行） */
export interface PerformanceManageEmployee {
  employeeId: string;
  employeeCode?: string;     // 工号
  employeeName?: string;     // 签约人
  deptPath?: string;         // 门店/组别全路径：大区-门店-组（组与门店同名时只到两级）
  amount: number;            // 金额合计（调整后，PERF_EXPECT=应收 / PERF_REAL=实收）
  originalAmount: number | null;    // 原始金额合计（调整前，未调整时为 null）
  contractCount: number;     // 合同数
  detailCount: number;       // 明细条数
  unsettledCount: number;    // 未结算条数
}

/** 业绩明细懒加载查询参数（展开人时按员工查） */
export type ManageDetailQuery = Omit<ManageQuery, 'pageNum' | 'pageSize'> & {
  employeeIds: string;       // 员工 ID，逗号分隔（单人展开传 1 个）
};

/** 业绩管理全局汇总（跨所有页） */
export interface PerformanceManageSummary {
  employeeCount: number;
  contractCount: number;
  detailCount: number;
  unsettledCount: number;
  totalAmount: number;
}

/** 业绩管理人维度分页结果（rows=当前页签约人聚合行，明细懒加载） */
export interface PerformanceManagePage {
  total: number;             // 签约人总数
  rows: PerformanceManageEmployee[];
  bizTypes: string[];        // 当前期间/口径下的业务类型选项
  summary: PerformanceManageSummary;
}

/** 业绩管理合同层聚合行（/perf/fact/manage/contract 返回，每合同一行） */
export interface PerformanceManageContract {
  contractNo: string;        // 合同号
  orderNo?: string;          // 订单号
  bizType?: string;          // 业务类型
  propertyAddress?: string;  // 房源地址
  businessDate?: string;     // 签约/认购日期
  amount: number;            // 合同金额合计（调整后，PERF_EXPECT=应收 / PERF_REAL=实收）
  originalAmount: number | null;    // 原始金额合计（调整前，未调整时为 null）
  convertedAmount?: number;  // 折算后金额合计（amount × conversionFactor）
  originalConvertedAmount?: number; // 折算后原始金额合计（originalAmount × conversionFactor）
  adjustPending?: boolean;   // 存在审批中的调整单（SUBMITTED/APPROVED，执行前金额未变）
  adjustPendingType?: string;      // 审批中调整单类型 AMOUNT/ADD_MEMBER
  adjustPendingAmount?: number;    // 审批中调整单目标金额（仅 AMOUNT 类型，调整后合同业绩合计）
  conversionFactor?: number;       // 本行折算系数（调整弹窗录入业绩后自动算折算金额用）
  employeeCount: number;     // 涉及签约人数
  detailCount: number;       // 明细条数
  unsettledCount: number;    // 未结算条数
  factStatus?: string;       // 聚合状态（ACTIVE 有任一有效 / VOIDED 全部作废）
  hasAddMember?: boolean;    // 是否存在已生效的「新增角色人」调整
}

/** 合同明细懒加载查询参数（展开合同时按合同号查） */
export interface ManageContractDetailQuery {
  period: string;
  factType: string;
  contractNos: string;       // 合同号，逗号分隔（单合同展开传 1 个）
}

/** 业绩管理合同维度分页结果（rows=当前页合同聚合行，明细懒加载） */
export interface PerformanceManageContractPage {
  total: number;             // 合同总数
  rows: PerformanceManageContract[];
  bizTypes: string[];
  summary: PerformanceManageSummary;
}

/** 完整业绩查询行（合同维度，/perf/fact/search 返回） */
export interface PerformanceFactSearch {
  contractNo: string;
  orderNo?: string;
  bizType?: string;
  propertyAddress?: string;
  signDate?: string;
  period: string;
  expectAmount: number;       // 新签业绩合计（调整后当前值）
  expectOriginalAmount: number; // 新签业绩合计（调整前；未调整时 = expectAmount）
  realAmount: number;         // 实收业绩合计
  hasAdjust: boolean;         // 是否有调整
  /** 新签业绩折算后金额（expectAmount × 当前生效折算因子） */
  expectConvertedAmount: number;
  /** 调整前新签业绩折算后金额（expectOriginalAmount × 当前生效折算因子） */
  originalExpectConvertedAmount: number;
  /** 实收业绩折算后金额（realAmount × 当前生效折算因子） */
  realConvertedAmount: number;
  /** 结佣业绩折算后金额（commissionAmount × 当前生效折算因子） */
  commissionConvertedAmount?: number;
  adjustStatus?: string;     // 调整单状态
  adjustNo?: string;         // 调整单号
  adjustType?: string;       // 调整类型（最近一条）
  hasAddMember?: boolean;    // 是否存在「增加角色人」调整（任意一条，含在途/已执行）
  receivedStatus?: string;   // 实收审批状态
  receivedApplyNo?: string;  // 实收审批单号
  receivedExpectedAmount?: number; // 实收审批单应收
  receivedRealAmount?: number;     // 实收审批单实收
  commissionStatus?: string; // 结佣状态
  commissionApplyNo?: string; // 结佣申请单号
  commissionAmount?: number;   // 结佣业绩
  employeeCount: number;      // 涉及人数
  detailCount: number;        // 明细条数
}

/** 业绩汇总行（/perf/fact/summary 返回，按期间维度 + 员工聚合新签业绩） */
export interface PerformanceSummaryRow {
  period: string;             // 期间标签（YYYY-MM / YYYY-Qn / YYYY）
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  deptName?: string;
  deptId?: string;
  contractCount: number;      // 合同数（去重）
  totalAmount: number;        // 新签业绩金额合计
}

/** 业绩排行行（/perf/fact/rank 返回，按员工聚合新签业绩金额降序） */
export interface PerformanceRankRow {
  rank: number;               // 排名（跨页连续）
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  deptName?: string;
  deptId?: string;
  contractCount: number;
  totalAmount: number;
}

/** 业绩查询·员工下拉选项（/perf/fact/search/employee-options 返回，已按部门数据权限过滤） */
export interface PerformanceEmployeeOption {
  employeeId: string;
  employeeCode?: string;      // 工号
  employeeName: string;       // 姓名
  deptId?: string;
  deptName?: string;          // 部门全路径名
  status?: string;            // ACTIVE 在职 / LEFT 离职
}

/** 业绩查询·合同下明细行（/perf/fact/search/details 返回，含全部期间） */
export interface PerformanceSearchDetailRow {
  factId: string;
  period: string;             // 归属期间（明细覆盖业务键全部期间）
  employeeId: string;
  employeeCode?: string;      // 工号
  employeeName?: string;      // 姓名
  deptPath?: string;          // 门店/组别全路径
  roleType?: string;          // 所属角色
  roleName?: string;          // 角色名
  shareRatio?: number;        // 角色占比
  businessDate?: string;      // 签约/认购日期
  expectAmount: number;       // 新签业绩（新签业绩，调整后）
  originalExpectAmount: number; // 应收原始金额（调整前）
  /** 新签业绩折算后金额（expectAmount × 当前生效折算因子） */
  expectConvertedAmount: number;
  /** 调整前新签业绩折算后金额（originalExpectAmount × 当前生效折算因子） */
  originalExpectConvertedAmount: number;
  realAmount: number;         // 实收业绩（按 source_key 配对，无实收为 0）
  /** 实收业绩折算后金额（realAmount × 当前生效折算因子） */
  realConvertedAmount?: number;
  settled?: boolean;           // 是否已结算
  settleDate?: string;        // 结算日期
  manualAdjust?: boolean;     // 增加角色人（ADD_MEMBER）调整产生的新签行，展示「新签调整」标记
}

// ========== API ==========
export const performanceApi = {
  // 业绩事实
  listFacts: (params: FactQuery) =>
    panjiaRequest.get<PageResult<PerformanceFact>>('/perf/fact/list', params),

  // 有业绩数据的期间（倒序）
  listManagePeriods: () =>
    panjiaRequest.get<string[]>('/perf/fact/manage/periods'),

  // 业绩明细-合同维度（合同→人→明细 懒加载树表，后端按合同分页）
  listManageByContract: (params: ManageQuery) =>
    panjiaRequest.get<PerformanceManageContractPage>('/perf/fact/manage/contract', params),
  // 按合同号懒加载明细（展开单合同传 1 个合同号）
  listManageContractDetails: (params: ManageContractDetailQuery) =>
    panjiaRequest.get<PerformanceManageRow[]>('/perf/fact/manage/contract/details', params),

  // 调整单
  listAdjusts: (params: AdjustQuery) =>
    panjiaRequest.get<PageResult<PerformanceAdjust>>('/perf/adjust/list', params),
  getAdjustDetail: (id: string | number) =>
    panjiaRequest.get<AdjustDetailVO>(`/perf/adjust/${id}/detail`),
  createAdjust: (data: AdjustCreateForm) =>
    panjiaRequest.post<string>('/perf/adjust', data),
  // 申请人撤回审批中的调整单（仅发起人；工作流实例一并删除，单据置 CANCELLED）
  withdrawAdjust: (id: string | number) =>
    panjiaRequest.post<void>(`/perf/adjust/${id}/withdraw`),
  // 预检：指定合同是否存在审批中的业绩调整单（前端选完事实后即时禁用提交）
  checkAdjustInFlight: (contractNo: string, period: string, factType = 'PERF_EXPECT') =>
    panjiaRequest.get<boolean>('/perf/adjust/in-flight-check', { contractNo, period, factType }),

  // 期间解封（反结账；封账由工资批次锁定自动完成，无手工封账入口）
  reopenPeriod: (period: string, reason: string) =>
    panjiaRequest.post<void>(`/perf/period/reopen/${period}?reason=${encodeURIComponent(reason)}`),

  // 手工批量提交实收：选合同 → 后端查 PERF_EXPECT → 镜像造 PERF_REAL → 按订单号分组建审批单
  manualBatchSubmitReceived: (data: { period: string; bizKeys: string[] }) =>
    panjiaRequest.post<{ createdRealCount: number; createdApplyCount: number; skipped: Record<number, string> }>(
      '/performance/received/manual-batch-submit', data),

  // 完整业绩查询（合同维度；传 employeeId 时金额仅汇总该员工个人份额）
  searchByContract: (params: { period?: string; deptId?: string; bizType?: string; keyword?: string; employeeId?: string; settled?: boolean; pageNum?: number; pageSize?: number }) =>
    panjiaRequest.get<PageResult<PerformanceFactSearch>>('/perf/fact/search', params),

  // 完整业绩查询·业务类型下拉选项（数据范围与 searchByContract 一致）
  listSearchBizTypes: (params: { period?: string; deptId?: string; employeeId?: string }) =>
    panjiaRequest.get<string[]>('/perf/fact/search/biz-types', params),

  // 完整业绩查询·员工下拉选项（按姓名/工号远程搜索，后端按登录用户部门数据权限过滤）
  searchEmployeeOptions: (params: { keyword: string; deptId?: string }) =>
    panjiaRequest.get<PerformanceEmployeeOption[]>('/perf/fact/search/employee-options', params),

  // 业绩查询·合同下明细（查看详情弹窗；bizNo=列表行展示的合同号/订单号，
  // 一手房/房产金融/家装荐客传订单号，其余传合同号，空则订单号）
  getSearchDetails: (params: { bizNo: string }) =>
    panjiaRequest.get<PerformanceSearchDetailRow[]>('/perf/fact/search/details', params),

  // 业绩汇总报表（按月/季/年 + 员工聚合新签业绩；经纪人本人、店长本店、总监全员）
  listSummary: (params: { periodType: string; year: string; quarter?: number; deptId?: string; employeeId?: string; bizType?: string; pageNum?: number; pageSize?: number }) =>
    panjiaRequest.get<PageResult<PerformanceSummaryRow>>('/perf/fact/summary', params),

  // 业绩排行（按员工聚合新签业绩金额降序，分页；rank 跨页连续）
  listRank: (params: { periodType: string; year: string; quarter?: number; deptId?: string; bizType?: string; pageNum?: number; pageSize?: number }) =>
    panjiaRequest.get<PageResult<PerformanceRankRow>>('/perf/fact/rank', params),

  // 合同级作废：该合同该期间全部有效业绩一次性作废（不区分人员/角色）
  voidByContract: (period: string, factType: string, contractNo: string, reason: string) =>
    panjiaRequest.post<number>(`/perf/fact/void-contract?period=${period}&factType=${factType}&contractNo=${encodeURIComponent(contractNo)}&reason=${encodeURIComponent(reason)}`),

  // 合同级恢复：该合同该期间全部已作废业绩一次性恢复（period 改为当前月）
  restoreByContract: (period: string, factType: string, contractNo: string, reason: string) =>
    panjiaRequest.post<number>(`/perf/fact/restore-contract?period=${period}&factType=${factType}&contractNo=${encodeURIComponent(contractNo)}&reason=${encodeURIComponent(reason)}`),
};

// ========== 独立导出函数 ==========
/** 业绩冲正/补录（批量，一个合同录入多人） */
export function createManualOffset(data: {
  contractNo: string;
  period: string;
  items: {
    employeeId: number;
    roleType: string;
    roleName?: string;
    amount: number;
  }[];
  reason?: string;
}) {
  return panjiaRequest.post<number>('/perf/fact/manual-offset', data);
}
