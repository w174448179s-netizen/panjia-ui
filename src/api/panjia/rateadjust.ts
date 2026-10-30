import panjiaRequest from './index';

/**
 * 提成点调整单（pj_payroll_rate_adjust）。
 * 财务登记员工业绩扣点调整（原因必填）→ 总监「我的待办」审批 →
 * 通过后按生效区间在算薪时自动叠加到综合提点。
 * NO_SOCIAL（未买社保扣点）由档案参保事实自动判断，不经本表登记，仅用于工资明细溯源标签。
 */
export interface RateAdjust {
  /** 雪花 ID（后端以字符串下发，Number() 会丢精度） */
  id?: string | number;
  employeeId: string | number;
  /** 员工姓名（后端按 employeeId 翻译返回） */
  employeeName?: string | null;
  /** 调整类型（字典 rate_adjust_type）：NO_SOCIAL/PHONE_CHECK/PERSONAL */
  adjustType: string;
  /** 调整点数（负值=扣点，如 -0.02 扣 2 个点） */
  adjustRate: number | string;
  /** 生效起始月 YYYY-MM（含） */
  startMonth: string;
  /** 生效结束月 YYYY-MM（含，null=长期有效至撤销） */
  endMonth?: string | null;
  /** 调整原因（必填） */
  reason: string;
  /** 状态：DRAFT=待提交/SUBMITTED=审批中/APPROVED=已通过/REJECTED=已驳回/CANCELLED=已撤销 */
  status?: string;
  /** Warm-Flow 流程实例 ID（rate_adjust_approval 流程，可空） */
  processInstanceId?: string | null;
  applyBy?: string | number | null;
  applyTime?: string | null;
  approveBy?: string | number | null;
  approveTime?: string | null;
  rejectReason?: string | null;
  createTime?: string | null;
}

/** 列表查询参数（period 传则仅查该月生效中的调整） */
export interface RateAdjustQuery {
  employeeId?: string | number;
  adjustType?: string;
  status?: string;
  period?: string;
}

/**
 * 提成点调整接口（实际前缀 /api/panjia）。
 * 审批动作（通过/驳回）统一在「我的待办」由引擎判权办理，本域无业务直批端点。
 */
export const rateAdjustApi = {
  /** 列表查询（非分页，res.data 直接是数组） */
  list(params: RateAdjustQuery) {
    return panjiaRequest.get<RateAdjust[]>('/payroll/rateadjust/list', params);
  },
  /** 按调整单 ID 查询（工作流办理弹窗详情组件用） */
  getById(id: string | number) {
    return panjiaRequest.get<RateAdjust>(`/payroll/rateadjust/detail/${id}`);
  },
  /** 登记调整单（DRAFT） */
  create(data: Partial<RateAdjust>) {
    return panjiaRequest.post<string | number>('/payroll/rateadjust', data);
  },
  /** 修改（仅待提交/已驳回） */
  update(data: Partial<RateAdjust>) {
    return panjiaRequest.put<void>('/payroll/rateadjust', data);
  },
  /** 删除（仅待提交/已驳回） */
  remove(id: string | number) {
    return panjiaRequest.delete<void>(`/payroll/rateadjust/${id}`);
  },
  /** 提交审批（发起/重提 warm-flow 流程，REJECTED 重提同走此接口） */
  submit(id: string | number) {
    return panjiaRequest.post<void>('/payroll/rateadjust/submit', { id });
  },
  /** 撤销：SUBMITTED 撤回流程回待提交；APPROVED 作废为 CANCELLED 终态 */
  cancel(id: string | number) {
    return panjiaRequest.post<void>('/payroll/rateadjust/cancel', { id });
  }
};
