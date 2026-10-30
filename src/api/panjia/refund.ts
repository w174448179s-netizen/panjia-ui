import panjiaRequest from './index';
import type { PageQuery, PageResult } from './types';

/** 退单申请单（pj_perf_refund）：合同级全额冲退，区别于业绩冲正 */
export interface PerfRefund {
  id: string;
  refundNo: string;              // TD 前缀
  contractNo: string;
  orderNo?: string;
  /** 退单落账月 YYYY-MM（负新签/负实收归属月） */
  refundPeriod: string;
  bizType?: string;
  employeeId?: string;
  deptId?: string;
  deptName?: string;
  /** 冲减新签合计（负数） */
  expectAmount: number;
  /** 冲减实收合计（负数；无实收为 0） */
  realAmount: number;
  /** 冲减结佣合计（负数；仅已结佣部分，未结佣部分待发起结佣自然抵扣） */
  commissionAmount?: number;
  reason?: string;
  payloadJson?: string;
  status: string;                // SUBMITTED / APPROVED / REJECTED / CANCELLED / EXECUTED
  processInstanceId?: string;
  applicantId?: string;
  approverId?: string;
  approveTime?: string;
  operatorId?: string;
  executeTime?: string;
  createTime?: string;
}

/** 退单列表查询条件 */
export interface PerfRefundQuery extends PageQuery {
  refundPeriod?: string;
  status?: string;
  employeeId?: string;
  bizType?: string;
  deptId?: string;
  keyword?: string;
}

/** 退单明细行（预览/快照） */
export interface PerfRefundDetailLine {
  factId?: string;
  detailId?: string;
  factType?: string;
  /** 原归属月（原事实所在月） */
  period?: string;
  /** 负数落账月（= 退单月份） */
  refundPeriod?: string;
  employeeId?: string;
  employeeCode?: string;
  roleType?: string;
  roleName?: string;
  shareRatio?: number;
  amount: number;
}

/** 退单预览结果 */
export interface PerfRefundPreview {
  contractNo: string;
  orderNo?: string;
  refundPeriod: string;
  expectAmount: number;
  realAmount: number;
  /** 冲减结佣（负数；仅已结佣部分） */
  commissionAmount?: number;
  factCount: number;
  realCount: number;
  bizType?: string;
  /** 非空即不可退单（如已封账/已退单） */
  blocked?: string;
  details: PerfRefundDetailLine[];
  /** 实收明细行（退单月生成同额负实收） */
  realDetails?: PerfRefundDetailLine[];
}

/** 退单汇总 */
export interface PerfRefundSummary {
  expectAmount: number;
  realAmount: number;
  commissionAmount?: number;
  refundCount: number;
}

export const perfRefundApi = {
  list(query: PerfRefundQuery) {
    return panjiaRequest.get<PageResult<PerfRefund>>('/perf/refund/list', query);
  },
  detail(id: string) {
    return panjiaRequest.get<PerfRefund>(`/perf/refund/${id}`);
  },
  summary(refundPeriod?: string) {
    return panjiaRequest.get<PerfRefundSummary>('/perf/refund/summary', { refundPeriod });
  },
  preview(contractNo: string, refundPeriod: string, orderNo?: string) {
    return panjiaRequest.get<PerfRefundPreview>('/perf/refund/preview', {
      contractNo,
      refundPeriod,
      orderNo,
    });
  },
  refundedPeriods(contractNos: string[]) {
    return panjiaRequest.get<Record<string, string>>('/perf/refund/refunded-periods', {
      contractNos: contractNos.join(','),
    });
  },
  claim(id: string) {
    return panjiaRequest.post<boolean>(`/perf/refund/${id}/claim`);
  },
};

/** 发起退单并启动审批 */
export function createPerfRefund(data: {
  contractNo: string;
  orderNo?: string;
  refundPeriod: string;
  reason: string;
}) {
  return panjiaRequest.post<number>('/perf/refund', data);
}

/** 撤回审批中的退单（仅发起人、仅 SUBMITTED） */
export function withdrawPerfRefund(id: string) {
  return panjiaRequest.post<void>(`/perf/refund/${id}/withdraw`);
}
