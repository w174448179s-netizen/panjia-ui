import panjiaRequest from './index';
import type { PageResult, ScoreApproval, ScoreQuery, ScoreRecord } from './types';

/**
 * 绩效积分接口（员工域，实际前缀 /api/panjia）。
 * 人月维度：一员工一月一行（总积分/出勤天数/平均积分/绩效等级/提成扣点），
 * 数据来自「二手积分日报」导入归档后聚合，不提供手工增删改。
 * 方法需 people:score:list 权限（人事/总监）。
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
