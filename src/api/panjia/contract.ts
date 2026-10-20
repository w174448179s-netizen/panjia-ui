import panjiaRequest from './index';
import type { Contract, ContractCreateForm, ContractExpiring, ContractQuery, ContractUpdateForm, PageResult } from './types';

/**
 * 员工合同接口（实际前缀 /api/panjia）。
 * 劳动合同/兼职合同/其他；续签 = 新增记录，历史保留。
 * 到期提前 30 天提醒（expiring），供合同页与员工管理页提醒条共用。
 */
export const contractApi = {
  /** 分页查询合同列表 */
  list(params: ContractQuery) {
    return panjiaRequest.get<PageResult<Contract>>('/people/contract/list', params);
  },
  /** 新增合同（同一员工同一类型同一开始日唯一） */
  create(data: ContractCreateForm) {
    return panjiaRequest.post<string>('/people/contract', data);
  },
  /** 修改合同（错录修正；员工不允许改，换人走删除重录） */
  update(contractId: string | number, data: ContractUpdateForm) {
    return panjiaRequest.put<void>(`/people/contract/${contractId}`, data);
  },
  /** 删除合同（错录修正，支持批量逗号分隔） */
  remove(contractIds: string) {
    return panjiaRequest.delete<void>(`/people/contract/${contractIds}`);
  },
  /** 合同到期提醒名单（已到期未重签在前，其余按到期日升序） */
  expiring() {
    return panjiaRequest.get<ContractExpiring[]>('/people/contract/expiring');
  },
  /** 查询全部合同模板配置 */
  listTemplates() {
    return panjiaRequest.get<ContractTemplateVO[]>('/people/contract/templates');
  },
  /** 保存/更新某类型自定义模板（ossId 来自 FileUpload） */
  saveTemplate(contractType: string, ossId: string | number) {
    return panjiaRequest.put<void>(`/people/contract/template/${contractType}/${ossId}`);
  },
  /** 删除某类型自定义模板（恢复默认） */
  deleteTemplate(contractType: string) {
    return panjiaRequest.delete<void>(`/people/contract/template/${contractType}`);
  },

  // ==================== 本人合同查询（综合查询 → 合同查询） ====================
  /** 我的全部合同列表 */
  myList() {
    return panjiaRequest.get<Contract[]>('/people/contract/my/list');
  },
  /** 当前登录员工的基本信息（身份证/工资卡等，供打印用） */
  myEmployee() {
    return panjiaRequest.get<any>('/people/contract/my/employee');
  },
  /** 查询当前登录员工是否已设置合同查询密码（与工资查询共用） */
  myPasswordStatus() {
    return panjiaRequest.get<{ hasPassword: boolean }>('/people/contract/my/password-status');
  },
  /** 验证合同查询密码（与工资查询共用） */
  verifyMyPassword(password: string) {
    return panjiaRequest.post<void>('/people/contract/my/verify-password', { password });
  },
  /** 设置/修改合同查询密码 */
  setMyPassword(password: string, oldPassword?: string) {
    const body: Record<string, string> = { password };
    if (oldPassword) body.oldPassword = oldPassword;
    return panjiaRequest.put<void>('/people/contract/my/password', body);
  }
};

/** 合同模板配置 */
export interface ContractTemplateVO {
  contractType: string;
  contractTypeLabel: string;
  useDefault: boolean;
  ossId: number | null;
  url: string | null;
  originalName: string | null;
}
