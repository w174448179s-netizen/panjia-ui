import panjiaRequest from './index';

/**
 * 经纪人自购单提成（pj_payroll_self_purchase）——公司内部员工福利。
 * 登记「合同号 + 经纪人」→ 总监「我的待办」审批 → 通过后在算薪时对该经纪人在
 * **该合同号**下的结佣提点额外加成（默认 +10 个百分点）；其他合同、该合同其他
 * 参与经纪人的提点不受影响；仅经纪人角色生效。
 */
export interface SelfPurchase {
  /** 雪花 ID（后端以字符串下发，Number() 会丢精度） */
  id?: string | number;
  /** 合同号 */
  contractNo: string;
  /** 享受加成的经纪人员工 ID */
  employeeId: string | number;
  /** 员工姓名（后端按 employeeId 翻译返回） */
  employeeName?: string | null;
  /** 提点加成（百分点绝对值：0.10 = 额外 +10 个百分点） */
  bonusRate: number | string;
  /** 备注/原因 */
  remark?: string | null;
  /** 状态：DRAFT=待提交/SUBMITTED=审批中/APPROVED=已通过/REJECTED=已驳回/CANCELLED=已撤销 */
  status?: string;
  /** Warm-Flow 流程实例 ID（self_purchase_approval 流程，可空） */
  processInstanceId?: string | null;
  applyBy?: string | number | null;
  applyTime?: string | null;
  approveBy?: string | number | null;
  approveTime?: string | null;
  rejectReason?: string | null;
  createTime?: string | null;
}

/** 列表查询参数 */
export interface SelfPurchaseQuery {
  contractNo?: string;
  employeeId?: string | number;
  status?: string;
}

/**
 * 自购单提成接口（实际前缀 /api/panjia）。
 * 审批动作（通过/驳回）统一在「我的待办」由引擎判权办理，本域无业务直批端点。
 */
export const selfPurchaseApi = {
  /** 列表查询（非分页，res.data 直接是数组） */
  list(params: SelfPurchaseQuery) {
    return panjiaRequest.get<SelfPurchase[]>('/payroll/selfpurchase/list', params);
  },
  /** 按自购单 ID 查询（工作流办理弹窗详情组件用） */
  getById(id: string | number) {
    return panjiaRequest.get<SelfPurchase>(`/payroll/selfpurchase/detail/${id}`);
  },
  /** 登记自购单（DRAFT） */
  create(data: Partial<SelfPurchase>) {
    return panjiaRequest.post<string | number>('/payroll/selfpurchase', data);
  },
  /** 修改（仅待提交/已驳回） */
  update(data: Partial<SelfPurchase>) {
    return panjiaRequest.put<void>('/payroll/selfpurchase', data);
  },
  /** 删除（仅待提交/已驳回） */
  remove(id: string | number) {
    return panjiaRequest.delete<void>(`/payroll/selfpurchase/${id}`);
  },
  /** 提交审批（发起/重提 warm-flow 流程，REJECTED 重提同走此接口） */
  submit(id: string | number) {
    return panjiaRequest.post<void>('/payroll/selfpurchase/submit', { id });
  },
  /** 撤销：SUBMITTED 撤回流程回待提交；APPROVED 作废为 CANCELLED 终态 */
  cancel(id: string | number) {
    return panjiaRequest.post<void>('/payroll/selfpurchase/cancel', { id });
  }
};
