import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

/** 实收业绩审批单（§2） */
export interface ReceivedApply {
  id: string;
  applyNo: string;            // RCV 前缀
  period: string;
  /** 未选期间时同一合同多期单据合并为一行：合并的期间串（如「2026-08、2026-09、2026-10」） */
  periods?: string;
  /**
   * 「待匹配新签」展示行（无审批单）。
   * <p>去草稿后无新签的到账只落库不建单：`id/applyNo/status` 为空、`expectedAmount` 为 0，
   * `receivedAmount` 为未绑定明细合计；前端展示「待匹配新签」并提供「补录」入口。</p>
   */
  pendingMatch?: boolean;
  contractNo: string;
  orderNo?: string;
  propertyAddress?: string;
  businessDate?: string;
  deptId?: string;
  batchId?: string;
  receivedAmount: number;     // 实收合计
  expectedAmount?: number;    // 应收合计（展示实时值：ACTIVE PERF_EXPECT 含已生效调整）
  /** 应收已被调整（当前应收 ≠ 提交时快照，展示「已调整」标记） */
  expectedAdjusted?: boolean;
  /** 提交时快照应收（即「调整前」值，仅在 expectedAdjusted=true 时有意义） */
  originalExpectedAmount?: number;
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 调整前新签业绩的折算后金额（originalExpectedAmount × 同一折算因子） */
  originalExpectedConvertedAmount?: number;
  /** 实收已被实收调整：当前 ACTIVE PERF_REAL 合计 ≠ 事实链最早值 */
  receivedAdjusted?: boolean;
  /** 调整前实收合计（事实链最早 PERF_REAL 金额合计；仅 receivedAdjusted=true 时有值） */
  originalReceivedAmount?: number;
  /** 是否存在审批中的实收调整单（SUBMITTED/APPROVED） */
  adjustPending?: boolean;
  /** 审批中实收调整单的目标金额（调整后实收合计） */
  adjustPendingAmount?: number;
  /** 转人工审批的原因（仅审批中单据有值；如「新签与实收人数不一致（新签 3 人/实收 2 人）」） */
  manualReviewReason?: string;
  itemCount: number;
  /** 业务类型（建单时快照落库，列表直接读列；「类型」筛选已下推 SQL） */
  bizType?: string;
  /** 涉及人数（列表接口回填：该合同本期间实收事实去重员工数） */
  employeeCount?: number;
  /** SUBMITTED / APPROVED / REJECTED / CANCELLED（查询条件另支持 PENDING=待匹配新签） */
  status: string;
  currentNode?: string;       // FINANCE / DIRECTOR
  processInstanceId?: string;
  applicantId?: string;
  /** 发起人昵称（后端 @Translation 按 applicantId 翻译；为空表示系统自动发起） */
  applicantName?: string;
  approverId?: string;
  /** 终审人昵称（后端按 approverId 翻译） */
  approverName?: string;
  approveTime?: string;
  /** 自动发起结佣生成的结佣申请单号（仅系统自动通过且非二手买卖时有值，留痕提示） */
  autoCommissionApplyNo?: string;
  createTime: string;
}

/** 审批单内每人实收明细（ReceivedFactDetailDTO，列口径对齐合同业绩明细） */
export interface ReceivedFact {
  factId: string;
  /** 归属期间（跨期详情逐笔展示：8、9、10 月各一行） */
  period?: string;
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  /** 门店/组别（「集团-门店-组别」） */
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  /** 角色占比 */
  shareRatio?: number;
  /** 新签业绩（同 sourceKey 的 PERF_EXPECT 事实金额，已含调整） */
  expectedAmount?: number;
  /** 新签业绩原值（调整前；未调整时 = expectedAmount） */
  originalExpectedAmount?: number;
  /** 该行应收已被调整（同 sourceKey 存在 REVERSED 的 PERF_EXPECT 事实） */
  expectedAdjusted?: boolean;
  /** 实收业绩（PERF_REAL 事实金额，已含实收调整） */
  amount: number;
  /** 实收原值（调整前；未调整时 = amount） */
  originalAmount?: number;
  /** 该行实收已被调整（同 sourceKey 存在 REVERSED 的 PERF_REAL 事实） */
  receivedAdjusted?: boolean;
  /** 新签业绩折算后金额（expectedAmount × 当前生效折算因子） */
  expectedConvertedAmount?: number;
  /** 新签业绩原值折算后金额（originalExpectedAmount × 同一折算因子） */
  originalConvertedAmount?: number;
}

export interface ReceivedQuery extends PageQuery {
  period?: string;
  status?: string;
  currentNode?: string;
  batchId?: string;
  keyword?: string;
  /** 门店/组别（含下级组别，后端按部门子树过滤） */
  deptId?: string;
  /** 员工 ID */
  employeeId?: string;
  /** 业务类型 */
  bizType?: string;
  /** 退单三态筛选：REFUND=仅退单 / NORMAL=仅正常 / 空=全部 */
  refundFilter?: string;
}

export type ReceivedPage = PageResult<ReceivedApply>;
export type ReceivedDetail = { apply: ReceivedApply; facts: ReceivedFact[] };

/** 批量审批结果 */
export interface BatchApproveResult {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  successContracts: string[];
  skippedContracts: string[];
  failedContracts: string[];
}

export const receivedApi = {
  list: (params: ReceivedQuery) =>
    panjiaRequest.get<ReceivedPage>('/performance/received/list', params),
  /** 有实收审批单的期间（倒序），用于默认选中最新有数据期间 */
  listPeriods: () =>
    panjiaRequest.get<string[]>('/performance/received/periods'),
  getDetail: (id: string | number) =>
    panjiaRequest.get<ReceivedDetail>(`/performance/received/${id}`),
  /** 按合同/订单跨期间查实收明细（列表未选期间时合并行的详情，每行带期间） */
  getContractDetail: (contractNo?: string, orderNo?: string) =>
    panjiaRequest.get<ReceivedDetail>('/performance/received/contract-detail', { contractNo, orderNo }),
  /** 「待匹配新签」到账组的每人明细（无审批单），供补录弹窗装载角色人清单；bizKey=订单号(优先)/合同号 */
  pendingDetail: (bizKey: string, period?: string) =>
    panjiaRequest.get<ReceivedFact[]>('/performance/received/pending-detail', { bizKey, period }),
  /** 按审批单 ID 查流程实例 ID（绕过 workflow:instance:query 权限） */
  getInstanceId: (id: string | number) =>
    panjiaRequest.get<{ instanceId: string | number }>(`/performance/received/${id}/instance`),
  /** 认领当前节点待办（拥有节点所需角色但不在授权快照时，如事后补赋财务角色） */
  claim: (id: string | number) =>
    panjiaRequest.post<boolean>(`/performance/received/${id}/claim`),
  /** 驳回后重新提交 */
  resubmit: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/resubmit`),
  cancel: (id: string | number) =>
    panjiaRequest.post<void>(`/performance/received/${id}/cancel`),
  /** 按合同号批量审批（CompletableFuture 挂起等待，返回每张单处理结果） */
  batchApproveByContractAsync: (period: string, contractNos: string[]) =>
    panjiaRequest.post<BatchApproveResult>('/performance/received/batch-approve-by-contract-async', {
      period,
      contractNos,
    }, { timeout: 300000 }),
};
