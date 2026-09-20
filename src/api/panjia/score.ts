import panjiaRequest from './index';
import type { PageResult, ScoreApproval, ScoreQuery, ScoreRecord } from './types';

/**
 * 绩效积分接口（员工域，实际前缀 /api/panjia）。
 * 人月维度：一员工一月一行（总积分/出勤天数/平均积分/绩效等级/提成扣点）。
 * 数据来自「二手积分日报」导入归档后聚合；另支持手工新增（MANUAL 补录/修正）、
 * 删除、修改原始事实。平均积分/等级/扣点/扣款为派生字段，查询时按政策规则实时计算。
 * list/getById 需 people:score:list；新增需 people:score:add；删除需 people:score:remove（人事/总监）。
 */
export const scoreApi = {
  /** 管理端分页查询 */
  list(params: ScoreQuery) {
    return panjiaRequest.get<PageResult<ScoreRecord>>('/people/score/list', params);
  },
  /** 管理端详情 */
  getById(id: string | number) {
    return panjiaRequest.get<ScoreRecord>(`/people/score/${id}`);
  },
  /** 手工新增积分记录（补录/修正；scoreMonth 格式 yyyy-MM；期间未锁定才允许） */
  create(data: {
    employeeId: string | number;
    scoreMonth: string;
    totalPoints: number;
    attendDays: number;
    lateSubmitCount: number;
  }) {
    return panjiaRequest.post<string>('/people/score', data);
  },
  /** 删除积分记录（仅期间未锁定时可删） */
  remove(id: string | number) {
    return panjiaRequest.delete<string>(`/people/score/${id}`);
  },
  /** 修改积分原始事实（总积分/出勤天数/晚提交次数；仅期间未锁定时可改） */
  update(id: string | number, data: { totalPoints: number; attendDays: number; lateSubmitCount: number }) {
    return panjiaRequest.put<string>(`/people/score/${id}`, data);
  },
  // ==================== 积分审批 ====================
  /** 查询期间审批状态（算薪前确认也用该接口，仅登录即可访问） */
  getApproval(period: string) {
    return panjiaRequest.get<ScoreApproval>(`/people/score/approval/${period}`);
  },
  /** 按审批单 ID 查询（工作流办理弹窗详情用，含 B/C 级扣点快照） */
  getApprovalDetail(id: string | number) {
    return panjiaRequest.get<ScoreApproval>(`/people/score/approval/detail/${id}`);
  },
  /** 提交当月积分审批（人事，发起 warm-flow 积分月度审批流程） */
  submitApproval(period: string) {
    return panjiaRequest.post<string>('/people/score/approval/submit', { period });
  }
};
