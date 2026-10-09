export interface SysBackupVO {
  /** 备份文件名（含扩展名） */
  fileName: string;
  /** 文件大小（字节） */
  sizeBytes: number;
  /** 文件大小（可读格式） */
  sizeLabel: string;
  /** 备份时间 */
  backupTime: string;
}
