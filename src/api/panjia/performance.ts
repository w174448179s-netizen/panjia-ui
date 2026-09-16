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
  adjustType: string;         // AMOUNT / VOID / TRANSFER
  adjustTypeName?: string;
  adjustScope?: string;      // CONTRACT / DETAIL
  contractNo?: string;
  originalAmount?: number;    // 调整前原始金额（创建时快照）
  targetAmount?: number;      // 调整后目标金额（用户录入的最终金额）
  targetDeptId?: string;
  targetDeptName?: string;
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
}

export interface AdjustCreateForm {
  factId?: string;
  period: string;
  employeeId: string;
  deptId: string;
  adjustType: string;        // AMOUNT / VOID / TRANSFER
  adjustScope?: string;      // CONTRACT / DETAIL
  contractNo?: string;       // 合同级调整时填
  factType?: string;         // PERF_REAL / PERF_EXPECT
  targetAmount?: number;     // 调整后目标金额
  targetDeptId?: string;
  reason: string;
  payloadJson?: string;
}

export interface PeriodClose {
  id: string;
  period: string;
  status: string;             // OPEN / CLOSED
  statusName?: string;
  closeReason?: string;
  refBatchId?: string;
  operatorId?: string;
  closeTime?: string;
  createTime: string;
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
  id: string;
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
  amount: number;            // 业绩金额（调整后，PERF_EXPECT=应收 / PERF_REAL=实收）
  originalAmount: number;    // 原始金额（调整前，未调整时 = amount）
  settled: boolean;          // 是否已结算
  settleDate?: string;       // 结算日期
  sourceKey: string;
}

/** 业绩管理查询参数（以签约人为维度后端分页） */
export interface ManageQuery {
  period: string;
  factType: string;          // PERF_REAL / PERF_EXPECT
  deptId?: string;
  bizType?: string;
  settled?: boolean;
  keyword?: string;          // 员工号/姓名/合同号/订单号/房源地址/角色/门店/店组
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
  originalAmount: number;    // 原始金额合计（调整前，未调整时 = amount）
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
  originalAmount: number;    // 原始金额合计（调整前，未调整时 = amount）
  employeeCount: number;     // 涉及签约人数
  detailCount: number;       // 明细条数
  unsettledCount: number;    // 未结算条数
}

/** 合同明细懒加载查询参数（展开合同时按合同号查） */
export type ManageContractDetailQuery = Omit<ManageQuery, 'pageNum' | 'pageSize'> & {
  contractNos: string;       // 合同号，逗号分隔（单合同展开传 1 个）
};

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
  expectAmount: number;       // 新签业绩合计
  realAmount: number;         // 实收业绩合计
  hasAdjust: boolean;         // 是否有调整
  adjustedAmount: number;     // 调整后新签金额
  adjustStatus?: string;     // 调整单状态
  adjustNo?: string;         // 调整单号
  adjustType?: string;       // 调整类型
  receivedStatus?: string;   // 实收审批状态
  receivedApplyNo?: string;  // 实收审批单号
  receivedExpectedAmount?: number; // 实收审批单应收
  receivedRealAmount?: number;     // 实收审批单实收
  commissionStatus?: string; // 结佣状态
  commissionApplyNo?: string; // 结佣申请单号
  commissionAmount?: number;   // 结佣金额
  employeeCount: number;      // 涉及人数
  detailCount: number;        // 明细条数
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
  expectAmount: number;       // 应收金额（新签业绩，调整后）
  originalExpectAmount: number; // 应收原始金额（调整前）
  realAmount: number;         // 实收金额（按 source_key 配对，无实收为 0）
  settled?: boolean;           // 是否已结算
  settleDate?: string;        // 结算日期
}

// ========== API ==========
export const performanceApi = {
  // 业绩事实
  listFacts: (params: FactQuery) =>
    panjiaRequest.get<PageResult<PerformanceFact>>('/perf/fact/list', params),
  getFact: (id: string | number) =>
    panjiaRequest.get<PerformanceFact>(`/perf/fact/${id}`),
  buildBatch: (batchId: string | number) =>
    panjiaRequest.post<void>(`/perf/fact/build/${batchId}`),
  getSummary: (params: { period?: string; factType?: string; employeeId?: string; deptId?: string }) =>
    panjiaRequest.get<number>('/perf/fact/summary', params),

  // 业绩明细（人→合同→明细 懒加载树表，后端按人分页）
  listManage: (params: ManageQuery) =>
    panjiaRequest.get<PerformanceManagePage>('/perf/fact/manage', params),
  // 按员工懒加载明细（展开单人传 1 个 ID，全部展开传当前页全部 ID）
  listManageDetails: (params: ManageDetailQuery) =>
    panjiaRequest.get<PerformanceManageRow[]>('/perf/fact/manage/details', params),
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
  getAdjust: (id: string | number) =>
    panjiaRequest.get<PerformanceAdjust>(`/perf/adjust/${id}`),
  getAdjustDetail: (id: string | number) =>
    panjiaRequest.get<AdjustDetailVO>(`/perf/adjust/${id}/detail`),
  createAdjust: (data: AdjustCreateForm) =>
    panjiaRequest.post<string>('/perf/adjust', data),

  // 期间封账
  listPeriods: () =>
    panjiaRequest.get<PeriodClose[]>('/perf/period/list'),
  getPeriod: (period: string) =>
    panjiaRequest.get<PeriodClose>(`/perf/period/${period}`),
  closePeriod: (period: string, reason?: string) => {
    const url = reason
      ? `/perf/period/close/${period}?reason=${encodeURIComponent(reason)}`
      : `/perf/period/close/${period}`;
    return panjiaRequest.post<void>(url);
  },
  reopenPeriod: (period: string) =>
    panjiaRequest.post<void>(`/perf/period/reopen/${period}`),

  // 完整业绩查询（合同维度）
  searchByContract: (params: { period?: string; deptId?: string; keyword?: string; pageNum?: number; pageSize?: number }) =>
    panjiaRequest.get<PageResult<PerformanceFactSearch>>('/perf/fact/search', params),

  // 业绩查询·合同下明细（查看详情弹窗；bizNo=列表行展示的合同号/订单号，
  // 一手房/房产金融/家装荐客传订单号，其余传合同号，空则订单号）
  getSearchDetails: (params: { bizNo: string }) =>
    panjiaRequest.get<PerformanceSearchDetailRow[]>('/perf/fact/search/details', params),
};
