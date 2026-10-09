<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>备份恢复</span>
          <div class="header-actions">
            <el-upload
              v-if="checkPermi(['system:backup:restore'])"
              ref="uploadRef"
              class="upload-restore"
              :auto-upload="false"
              :show-file-list="false"
              :limit="1"
              accept=".dump"
              :on-change="handleUploadChange"
            >
              <el-button type="danger" plain icon="Upload" :loading="uploading">
                {{ uploading ? '还原中…' : '上传还原' }}
              </el-button>
            </el-upload>
            <el-button
              v-if="checkPermi(['system:backup:create'])"
              type="primary"
              icon="Plus"
              :loading="creating"
              @click="handleCreate"
            >立即备份</el-button>
          </div>
        </div>
      </template>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        title="备份为 PostgreSQL 逻辑备份（pg_dump 自定义格式），保存于服务器本地 backup 目录，超出保留份数自动清理最旧的备份。点击「上传还原」可直接选择本地 .dump 文件整库还原（还原前自动校验文件完整性）。"
      />
      <el-table v-loading="loading" :data="backupList" class="backup-table">
        <el-table-column label="备份文件" prop="fileName" min-width="280" show-overflow-tooltip />
        <el-table-column label="大小" prop="sizeLabel" width="110" align="center" />
        <el-table-column label="备份时间" prop="backupTime" width="180" align="center" />
        <el-table-column label="操作" width="220" align="center">
          <template #default="{ row }">
            <el-button
              v-if="checkPermi(['system:backup:restore'])"
              link
              type="warning"
              icon="RefreshRight"
              @click="handleRestore(row)"
            >还原</el-button>
            <el-button
              v-if="checkPermi(['system:backup:download'])"
              link
              type="primary"
              icon="Download"
              @click="handleDownload(row)"
            >下载</el-button>
            <el-button
              v-if="checkPermi(['system:backup:delete'])"
              link
              type="danger"
              icon="Delete"
              @click="handleDelete(row)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && backupList.length === 0" description="暂无备份，点击右上角「立即备份」创建" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { listBackups, createBackup, restoreBackup, restoreUpload, deleteBackup } from '@/api/system/backup';
import type { SysBackupVO } from '@/api/system/backup/types';
import download from '@/plugins/download';
import { checkPermi } from '@/utils/permission';

const loading = ref(false);
const creating = ref(false);
const uploading = ref(false);
const uploadRef = ref();
const backupList = ref<SysBackupVO[]>([]);

const humanFileSize = (bytes: number) => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
};

const getList = async () => {
  loading.value = true;
  try {
    const res: any = await listBackups();
    backupList.value = res.data || [];
  } finally {
    loading.value = false;
  }
};

/** 立即备份（同步执行，pg_dump 期间按钮 loading） */
const handleCreate = async () => {
  creating.value = true;
  try {
    const res: any = await createBackup();
    ElMessage.success('备份完成：' + (res.data || ''));
    await getList();
  } catch {
    /* 拦截器处理 */
  } finally {
    creating.value = false;
  }
};

/** 选择本地 dump 文件后二次确认，确认即上传并整库还原 */
const handleUploadChange = async (uploadFile: any) => {
  const file = uploadFile?.raw as File | undefined;
  if (!file) return;
  if (!file.name.toLowerCase().endsWith('.dump')) {
    ElMessage.warning('仅支持 .dump 格式的备份文件');
    uploadRef.value?.clearFiles();
    return;
  }
  try {
    const { value } = await ElMessageBox.prompt(
      `即将用本地文件 ${file.name}（${humanFileSize(file.size)}）整库覆盖当前数据，该操作不可撤销！` +
        `系统会先校验备份文件完整性，还原期间在线请求可能短暂报错。请输入「还原」二字确认执行。`,
      '危险操作：上传文件还原',
      {
        confirmButtonText: '确认还原',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
        inputPattern: /^还原$/,
        inputErrorMessage: '请输入「还原」以确认'
      }
    );
    if (value !== '还原') return;
    uploading.value = true;
    const res: any = await restoreUpload(file);
    ElMessage.success(res.msg || '还原完成，建议刷新页面确认系统状态');
  } catch {
    /* 用户取消或拦截器处理 */
  } finally {
    uploading.value = false;
    uploadRef.value?.clearFiles();
  }
};

/** 还原（整库覆盖，危险操作：需输入"还原"确认） */
const handleRestore = async (row: any) => {
  try {
    const { value } = await ElMessageBox.prompt(
      `即将用备份 ${row.fileName}（${row.backupTime}）整库覆盖当前数据，该操作不可撤销！` +
        `还原期间在线请求可能短暂报错。请输入「还原」二字确认执行。`,
      '危险操作：数据库还原',
      {
        confirmButtonText: '确认还原',
        cancelButtonText: '取消',
        confirmButtonClass: 'el-button--danger',
        inputPattern: /^还原$/,
        inputErrorMessage: '请输入「还原」以确认'
      }
    );
    if (value !== '还原') return;
    const res: any = await restoreBackup(row.fileName);
    ElMessage.success(res.msg || '还原完成');
  } catch {
    /* 用户取消或拦截器处理 */
  }
};

/** 下载备份文件（panjia 业务模块后端带 /api/panjia 前缀，download 插件只拼 /dev-api） */
const handleDownload = (row: any) => {
  download.zip('/api/panjia/system/backup/download/' + encodeURIComponent(row.fileName), row.fileName);
};

/** 删除备份 */
const handleDelete = async (row: any) => {
  try {
    await ElMessageBox.confirm(`确认删除备份文件 ${row.fileName}？`, '提示', { type: 'warning' });
    await deleteBackup(row.fileName);
    ElMessage.success('删除成功');
    await getList();
  } catch {
    /* 用户取消或拦截器处理 */
  }
};

onMounted(getList);
</script>

<style lang="scss" scoped>
.panjia-page {
  padding: 16px;
}

.page-card {
  border-radius: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
  font-size: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload-restore {
  display: inline-block;
}

.backup-table {
  margin-top: 16px;
}
</style>
