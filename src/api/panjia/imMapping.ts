import panjiaRequest from './index';
import type { ImUserMapping, ImUserMappingQuery, PageResult } from './types';

/**
 * IM 账号映射接口（实际前缀 /api/panjia）。
 * 映射由同步任务自动生成，管理页用于查看、人工绑定/解绑。
 */
export const imMappingApi = {
  /** 分页查询 IM 账号映射 */
  list(params: ImUserMappingQuery) {
    return panjiaRequest.get<PageResult<ImUserMapping>>('/people/im-mapping/list', params);
  },
  /** 人工绑定映射到本地员工 */
  bind(mappingId: string | number, data: { employeeId: string | number }) {
    return panjiaRequest.put<void>(`/people/im-mapping/${mappingId}/bind`, data);
  },
  /** 解绑映射（清除员工/登录账号关联，保留渠道信息） */
  unbind(mappingId: string | number) {
    return panjiaRequest.put<void>(`/people/im-mapping/${mappingId}/unbind`);
  }
};
