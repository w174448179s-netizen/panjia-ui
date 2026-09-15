import panjiaRequest from './index';
import type { ImportBatch, ImportIssue, ImportRawRow, ImportTemplate, PageResult, PeopleImportTemplate, ColumnMapping, ColumnDef, TemplateColumnDiff } from './types';
import { getToken } from '@/utils/auth';

/**
 * 导入域 V2.0 接口（实际前缀 /api/panjia）。
 * 单据导入：业绩（KE_SIGNED，唯一来源：贝壳业绩明细表）/ 考勤 / 积分 / 费用。
 */
export const importApi = {
  /** 文件上传导入（sourceType 指定单据类型） */
  upload(file: File, sourceType: string, period?: string) {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    params.append('sourceType', sourceType);
    if (period) {
      params.append('period', period);
    }
    return panjiaRequest.post<string>(`/import/upload?${params.toString()}`, formData);
  },
  /** 批次列表（按 sourceTypes 数组 / period 筛选）
   * <p>
   * - {@code sourceTypes} 传 {@code string[]} → 后端按 {@code IN (...)} 过滤；
   * - 传 {@code ''} / {@code undefined} → 不过滤；
   * - 单值场景下可传 {@code ['ATTENDANCE']}，等价于旧版单 {@code sourceType} 参数。
   */
  listBatches(sourceTypes?: string[] | string, period?: string) {
    const types: string[] | undefined = Array.isArray(sourceTypes)
      ? sourceTypes
      : sourceTypes
        ? [sourceTypes]
        : undefined;
    return panjiaRequest.get<ImportBatch[]>('/import/batches', { sourceTypes: types, period });
  },
  /** 批次详情 */
  getBatch(id: string | number) {
    return panjiaRequest.get<ImportBatch>(`/import/batches/${id}`);
  },
  /** 批次问题清单 */
  listIssues(id: string | number) {
    return panjiaRequest.get<ImportIssue[]>(`/import/batches/${id}/issues`);
  },
  /**
   * 批次原始数据列表（审计/追溯入口，按 batchId 查询对应 raw 分表，分页）。
   * - KE_SIGNED  → pj_import_raw_signed（贝壳业绩明细表，唯一业绩来源）
   * - ATTENDANCE → pj_import_raw_attendance
   * - POINTS     → pj_import_raw_points
   * - OTHERS     → pj_import_raw_manual
   */
  listRaw(id: string | number, pageNum = 1, pageSize = 50) {
    return panjiaRequest.get<PageResult<ImportRawRow>>(`/import/batches/${id}/raw`, { pageNum, pageSize });
  },
  /** 重归一化 */
  renormalize(id: string | number) {
    return panjiaRequest.post<void>(`/import/batches/${id}/renormalize`);
  },
  /** 归档 */
  archive(id: string | number) {
    return panjiaRequest.post<void>(`/import/batches/${id}/archive`);
  },
  /** 撤销导入（硬删批次及下游数据，原始导入文件保留） */
  cancelImport(id: string | number) {
    return panjiaRequest.post<void>(`/import/batches/${id}/revoke`);
  },
  /** 忽略问题 */
  ignoreIssue(id: string | number) {
    return panjiaRequest.post<void>(`/import/issues/${id}/ignore`);
  },
  /** 下载导入模板（Excel，含表头+示例行） */
  async downloadTemplate(sourceType: string, fileName: string) {
    const baseApi = import.meta.env.VITE_APP_BASE_API;
    const res = await fetch(`${baseApi}/api/panjia/import/template/${sourceType}?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${getToken()}`, clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e' }
    });
    if (!res.ok) throw new Error('模板下载失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  },
  /**
   * 下载批次上传时的原文件（审计/追溯入口）。
   * 用户下载后可用 Excel / WPS / Numbers 直接打开看上传内容，
   * 适合核实解析前后是否一致、沟通问题排查等场景。
   */
  async downloadOriginalFile(id: string | number, fileName?: string) {
    const baseApi = import.meta.env.VITE_APP_BASE_API;
    const res = await fetch(`${baseApi}/api/panjia/import/batches/${id}/file?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${getToken()}`, clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e' }
    });
    if (!res.ok) throw new Error('原文件下载失败');
    // 优先用响应头里的 filename* 解析服务端返回的中文文件名
    const dispo = res.headers.get('Content-Disposition') ?? '';
    const starMatch = /filename\*=UTF-8''([^;]+)/.exec(dispo);
    const quotedMatch = /filename="?([^";]+)"?/.exec(dispo);
    const serverName = starMatch ? decodeURIComponent(starMatch[1]) : quotedMatch ? quotedMatch[1] : null;
    const downloadName = fileName || serverName || `import_batch_${id}.xlsx`;
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadName;
    link.click();
    window.URL.revokeObjectURL(url);
  }
};

/** 导入模板管理接口 */
export const templateApi = {
  /** 模板列表 */
  list(sourceType?: string) {
    return panjiaRequest.get<ImportTemplate[]>('/template/list', { sourceType });
  },
  /** 模板详情 */
  get(id: string | number) {
    return panjiaRequest.get<ImportTemplate>(`/template/${id}`);
  },
  /** 新增模板 */
  add(data: Partial<ImportTemplate>) {
    return panjiaRequest.post<string>('/template', data);
  },
  /** 复制模板为新版本 */
  copy(sourceId: string | number, newVersion: string, newName?: string) {
    const params = new URLSearchParams();
    params.append('newVersion', newVersion);
    if (newName) params.append('newName', newName);
    return panjiaRequest.post<string>(`/template/copy/${sourceId}?${params.toString()}`);
  },
  /** 更新模板 */
  update(data: Partial<ImportTemplate>) {
    return panjiaRequest.put<void>('/template', data);
  },
  /** 激活模板 */
  activate(id: string | number) {
    return panjiaRequest.post<void>(`/template/${id}/activate`);
  },
  /** 下载模板 Excel */
  async download(id: string | number, fileName: string) {
    const baseApi = import.meta.env.VITE_APP_BASE_API;
    const res = await fetch(`${baseApi}/api/panjia/template/${id}/download?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${getToken()}`, clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e' }
    });
    if (!res.ok) throw new Error('模板下载失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  },
  /** 获取列映射列表 */
  getColumns(id: string | number) {
    return panjiaRequest.get<ColumnMapping[]>(`/template/${id}/columns`);
  },
  /** 保存列映射 */
  saveColumns(id: string | number, columns: ColumnMapping[]) {
    return panjiaRequest.put<void>(`/template/${id}/columns`, columns);
  },
  /** 版本对比 */
  compare(sourceId: string | number, targetId: string | number) {
    return panjiaRequest.get<TemplateColumnDiff[]>('/template/compare', { sourceId, targetId });
  }
};

/** 员工导入模板管理接口（people 域） */
export const peopleTemplateApi = {
  /** 模板列表 */
  list() {
    return panjiaRequest.get<PeopleImportTemplate[]>('/people/template/list');
  },
  /** 模板详情 */
  get(id: string | number) {
    return panjiaRequest.get<PeopleImportTemplate>(`/people/template/${id}`);
  },
  /** 获取列定义列表 */
  getColumns(id: string | number) {
    return panjiaRequest.get<ColumnDef[]>(`/people/template/${id}/columns`);
  },
  /** 保存列定义 */
  saveColumns(id: string | number, columns: ColumnDef[]) {
    return panjiaRequest.put<void>(`/people/template/${id}/columns`, columns);
  },
  /** 新增模板 */
  add(data: Partial<PeopleImportTemplate>) {
    return panjiaRequest.post<string>('/people/template', data);
  },
  /** 复制模板为新版本 */
  copy(sourceId: string | number, newVersion: string, newName?: string) {
    const params = new URLSearchParams();
    params.append('newVersion', newVersion);
    if (newName) params.append('newName', newName);
    return panjiaRequest.post<string>(`/people/template/copy/${sourceId}?${params.toString()}`);
  },
  /** 启用模板 */
  activate(id: string | number) {
    return panjiaRequest.post<void>(`/people/template/${id}/activate`);
  },
  /** 下载模板 Excel */
  async download(id: string | number, fileName: string) {
    const baseApi = import.meta.env.VITE_APP_BASE_API;
    const res = await fetch(`${baseApi}/api/panjia/people/template/${id}/download?_t=${Date.now()}`, {
      headers: { Authorization: `Bearer ${getToken()}`, clientid: 'e5cd7e4891bf95d1d19206ce24a7b32e' }
    });
    if (!res.ok) throw new Error('模板下载失败');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
  },
  /** 版本对比 */
  compare(sourceId: string | number, targetId: string | number) {
    return panjiaRequest.get<TemplateColumnDiff[]>('/people/template/compare', { sourceId, targetId });
  }
};
