import panjiaRequest from './index';
import type { ImportBatch, ImportIssue, ImportTemplate, PeopleImportTemplate, ColumnMapping, ColumnDef, TemplateColumnDiff } from './types';
import { getToken } from '@/utils/auth';

/**
 * 导入域 V2.0 接口（实际前缀 /api/panjia）。
 * 单据导入：业绩（KE_SIGNED/KE_NEW_SIGN）/ 考勤 / 积分 / 费用。
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
  /** 批次列表（可按 sourceType / period 筛选） */
  listBatches(sourceType?: string, period?: string) {
    return panjiaRequest.get<ImportBatch[]>('/import/batches', { sourceType, period });
  },
  /** 批次详情 */
  getBatch(id: string | number) {
    return panjiaRequest.get<ImportBatch>(`/import/batches/${id}`);
  },
  /** 批次问题清单 */
  listIssues(id: string | number) {
    return panjiaRequest.get<ImportIssue[]>(`/import/batches/${id}/issues`);
  },
  /** 重归一化 */
  renormalize(id: string | number) {
    return panjiaRequest.post<void>(`/import/batches/${id}/renormalize`);
  },
  /** 归档 */
  archive(id: string | number) {
    return panjiaRequest.post<void>(`/import/batches/${id}/archive`);
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
