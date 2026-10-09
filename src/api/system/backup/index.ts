import type { AxiosPromise } from '@/utils/api-types';
import panjiaRequest from '@/api/panjia';
import type { SysBackupVO } from './types';

// 备份恢复实现在 panjia-backup 业务模块（com.panjia 包），后端统一带 /api/panjia 前缀，
// 故必须走 panjiaRequest（普通 request 无前缀会 404）。

// 备份文件列表
export function listBackups(): AxiosPromise<SysBackupVO[]> {
  return panjiaRequest.get('/system/backup/list');
}

// 立即备份
export function createBackup(): AxiosPromise<string> {
  return panjiaRequest.post('/system/backup/create', undefined, { timeout: 600000 });
}

// 还原数据库（整库覆盖，危险操作）
export function restoreBackup(fileName: string): AxiosPromise<void> {
  return panjiaRequest.post('/system/backup/restore/' + encodeURIComponent(fileName), undefined, {
    timeout: 600000
  });
}

// 上传 dump 文件直接还原（整库覆盖，危险操作；大文件 10 分钟超时）
export function restoreUpload(file: File): AxiosPromise<string> {
  const formData = new FormData();
  formData.append('file', file);
  return panjiaRequest.post('/system/backup/restore-upload', formData, { timeout: 600000 });
}

// 删除备份文件
export function deleteBackup(fileName: string): AxiosPromise<void> {
  return panjiaRequest.delete('/system/backup/' + encodeURIComponent(fileName));
}
