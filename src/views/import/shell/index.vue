<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span class="page-title">贝壳业绩导入</span>
          <div class="toolbar">
            <el-form-item label="归属月" class="period-item">
              <el-date-picker
                v-model="period"
                type="month"
                value-format="YYYY-MM"
                placeholder="选择归属月"
                :clearable="true"
                style="width: 160px"
                @change="handlePeriodChange"
              />
            </el-form-item>
            <el-upload
              ref="uploadRef"
              v-hasPermi="['import:batch:upload']"
              class="upload-btn"
              accept=".xlsx,.xls,.csv"
              :show-file-list="false"
              :before-upload="beforeUpload"
              :http-request="handleHttpRequest"
            >
              <el-button type="primary" icon="Upload" :loading="uploadLoading" :disabled="!period">
                上传文件
              </el-button>
            </el-upload>
            <el-tooltip content="请直接上传贝壳·经纪人业绩明细表原始文件（.xlsx），无需下载模板" placement="bottom">
              <el-icon class="upload-hint-icon"><InfoFilled /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </template>

      <div class="page-content">
        <!-- 上传结果提示 -->
        <el-alert
          v-if="uploadResult"
          :title="uploadResult.success ? '上传成功' : '上传失败'"
          :type="uploadResult.success ? 'success' : 'error'"
          :description="uploadResult.success ? `批次 ID：${uploadResult.batchId}` : (uploadResult.message || '请稍后重试')"
          show-icon
          :closable="true"
          class="upload-alert"
          @close="uploadResult = null"
        >
          <template v-if="uploadResult.success" #default>
            <div class="alert-body">
              <span>批次 ID：{{ uploadResult.batchId }}</span>
              <el-button link type="primary" @click="openIssues(uploadResult.batchId)">查看问题清单</el-button>
            </div>
          </template>
        </el-alert>

        <!-- 批次列表 -->
        <el-table
          v-hasPermi="['import:batch:list']"
          v-loading="listLoading"
          border
          :data="batches"
          class="data-table"
          empty-text="暂无导入批次"
        >
          <el-table-column label="批次号" prop="batchNo" align="center" min-width="160" show-overflow-tooltip />
          <el-table-column label="归属月" prop="period" align="center" width="100">
            <template #default="scope">{{ scope.row.period || '—' }}</template>
          </el-table-column>
          <el-table-column label="文件名" prop="fileName" align="center" min-width="180" show-overflow-tooltip />
          <el-table-column label="总行数" prop="totalRows" align="center" width="80" />
          <el-table-column label="成功" prop="successRows" align="center" width="70">
            <template #default="scope">
              <span class="num-success">{{ scope.row.successRows }}</span>
            </template>
          </el-table-column>
          <el-table-column label="失败" prop="failedRows" align="center" width="70">
            <template #default="scope">
              <span :class="scope.row.failedRows > 0 ? 'num-fail' : ''">{{ scope.row.failedRows }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" prop="status" align="center" width="110">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small">
                {{ statusLabel(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" prop="createTime" align="center" width="170" />
          <el-table-column label="操作" width="190" align="center" fixed="right">
            <template #default="scope">
              <div class="action-row">
                <!-- 终态（ARCHIVED）：仅保留"下载"做合规留档 -->
                <template v-if="scope.row.status === 'ARCHIVED'">
                  <el-tooltip content="撤销导入（冲销该批次业绩数据，不可逆）" placement="top">
                    <a
                      class="action-btn action-btn-danger"
                      :class="{ 'is-loading': rowCancellingId === scope.row.id }"
                      @click="handleCancelImport(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="rowCancellingId !== scope.row.id"><CircleClose /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-tooltip content="下载上传时的原文件（Excel/WPS 可直接打开）" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': rowDownloadingId === scope.row.id }"
                      @click="handleDownloadFile(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="rowDownloadingId !== scope.row.id"><Download /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                </template>
                <!-- 终态（FAILED）：保留"问题" + "下载" -->
                <template v-else-if="scope.row.status === 'FAILED'">
                  <el-tooltip v-if="hasIssues(scope.row as ImportBatch)" content="查看失败问题清单" placement="top">
                    <a class="action-btn" @click="openIssues(scope.row.id)">
                      <el-icon><Warning /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-tooltip content="下载上传时的原文件（Excel/WPS 可直接打开）" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': rowDownloadingId === scope.row.id }"
                      @click="handleDownloadFile(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="rowDownloadingId !== scope.row.id"><Download /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                </template>
                <!-- 中间态：内联最多 3 个高频操作（问题/重归一化/归档），低频"下载"收进"更多"下拉 -->
                <template v-else>
                  <el-tooltip v-if="hasIssues(scope.row as ImportBatch)" content="查看问题清单" placement="top">
                    <a class="action-btn" @click="openIssues(scope.row.id)">
                      <el-icon><Warning /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-tooltip v-if="canRenormalize(scope.row.status)" content="重新解析与归一化" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': rowLoadingId === scope.row.id && rowAction === 'renormalize' }"
                      @click="handleRenormalize(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="!(rowLoadingId === scope.row.id && rowAction === 'renormalize')"><Refresh /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-tooltip v-if="canArchive(scope.row.status)" content="归档批次" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': rowLoadingId === scope.row.id && rowAction === 'archive' }"
                      @click="handleArchive(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="!(rowLoadingId === scope.row.id && rowAction === 'archive')"><Box /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-dropdown
                    trigger="click"
                    @command="(cmd: string) => handleMoreCommand(cmd, scope.row as ImportBatch)"
                  >
                    <a class="action-btn" @click.prevent>
                      <el-icon><MoreFilled /></el-icon>
                    </a>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item command="download" :disabled="rowDownloadingId === scope.row.id">
                          下载原文件（Excel/WPS 可直接打开）
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 问题清单 -->
    <el-dialog
      v-model="issueDialog.visible"
      :title="issueDialog.title"
      width="960px"
      append-to-body
      destroy-on-close
    >
      <el-table v-loading="issueLoading" border :data="issues" size="small" max-height="520" empty-text="暂无问题记录">
        <el-table-column label="行号" prop="rowNo" align="center" width="80">
          <template #default="scope">{{ scope.row.rowNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题类型" prop="issueType" align="center" width="130" show-overflow-tooltip />
        <el-table-column label="字段" prop="fieldName" align="center" width="130">
          <template #default="scope">{{ scope.row.fieldName || '—' }}</template>
        </el-table-column>
        <el-table-column label="原始值" prop="rawValue" align="center" min-width="150" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.rawValue ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题描述" prop="message" align="center" min-width="220" show-overflow-tooltip />
        <el-table-column label="状态" prop="status" align="center" width="100">
          <template #default="scope">
            <el-tag :type="issueStatusTagType(scope.row.status)" size="small">{{ scope.row.status }}</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="issueDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { importApi } from '@/api/panjia/import';
import type { ImportBatch, ImportIssue } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { InfoFilled, Warning, Download, Refresh, Loading, Box, CircleClose, MoreFilled } from '@element-plus/icons-vue';

/** 业绩单据唯一来源：贝壳·经纪人业绩明细表（一张表同时携当月应收+当月实收） */
const SOURCE_TYPE = 'KE_SIGNED';

// ==================== 工具栏 / 上传 ====================
const period = ref<string>('');
const uploadLoading = ref(false);
const uploadResult = ref<{ success: boolean; batchId: string; message?: string } | null>(null);

const handlePeriodChange = () => {
  loadBatches();
};

const beforeUpload = (file: File) => {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
    modal.msgError('仅支持 .xlsx、.xls、.csv 文件');
    return false;
  }
  return true;
};

const handleHttpRequest = (options: any) => {
  const file = options.file as File;
  if (!period.value) {
    modal.msgWarning('请先选择归属月');
    return Promise.reject(new Error('请先选择归属月'));
  }
  uploadLoading.value = true;
  uploadResult.value = null;
  return importApi
    .upload(file, SOURCE_TYPE, period.value)
    .then((res) => {
      const batchId = res.data;
      uploadResult.value = { success: true, batchId };
      modal.msgSuccess('上传成功，批次已创建');
      loadBatches();
    })
    .catch((err) => {
      uploadResult.value = {
        success: false,
        batchId: '',
        message: err?.message || '上传失败'
      };
      throw err;
    })
    .finally(() => {
      uploadLoading.value = false;
    });
};

// ==================== 批次列表 ====================
const listLoading = ref(false);
const batches = ref<ImportBatch[]>([]);

const loadBatches = async () => {
  listLoading.value = true;
  try {
    const res = await importApi.listBatches(SOURCE_TYPE, period.value || undefined);
    const list = res.data ?? [];
    list.sort((a, b) => new Date(b.createTime).getTime() - new Date(a.createTime).getTime());
    batches.value = list;
  } finally {
    listLoading.value = false;
  }
};

// ==================== 状态映射 ====================
const statusTagType = (status: string): 'info' | 'warning' | 'success' | 'danger' | 'primary' => {
  switch (status) {
    case 'PARSING':
    case 'NORMALIZING':
      return 'info';
    case 'PENDING_CONFIRM':
      return 'warning';
    case 'ARCHIVED':
      return 'success';
    case 'FAILED':
      return 'danger';
    case 'CANCELLED':
      return 'info';
    default:
      return 'info';
  }
};

const statusLabel = (status: string): string => {
  switch (status) {
    case 'PARSING':
      return '解析中';
    case 'NORMALIZING':
      return '归一化中';
    case 'PENDING_CONFIRM':
      return '待确认';
    case 'ARCHIVED':
      return '已归档';
    case 'FAILED':
      return '失败';
    case 'CANCELLED':
      return '已撤销';
    default:
      return status;
  }
};

const issueStatusTagType = (status: string): 'info' | 'warning' | 'success' | 'danger' | 'primary' => {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'RESOLVED':
      return 'success';
    case 'IGNORED':
      return 'info';
    default:
      return 'info';
  }
};

// ==================== 问题清单 ====================
const issueLoading = ref(false);
const issues = ref<ImportIssue[]>([]);
const issueDialog = reactive({ visible: false, title: '问题清单' });

const openIssues = async (batchId: string) => {
  issueDialog.title = '问题清单';
  issueDialog.visible = true;
  issueLoading.value = true;
  issues.value = [];
  try {
    const res = await importApi.listIssues(batchId);
    issues.value = res.data ?? [];
    if (issues.value.length === 0) {
      issueDialog.title = '问题清单（无问题记录）';
    }
  } finally {
    issueLoading.value = false;
  }
};

// ==================== 操作：重归一化 / 归档 ====================
const rowLoadingId = ref<string>('');
const rowAction = ref<'renormalize' | 'archive'>('renormalize');

// 状态机硬约束：仅 PENDING_CONFIRM 允许重归一化/归档
const canRenormalize = (status: string): boolean => status === 'PENDING_CONFIRM';
const canArchive = (status: string): boolean => status === 'PENDING_CONFIRM';

/**
 * 批次是否存在需要展示的问题（failedRows > 0）。
 * - 中间态/终态都用此判定是否显示"问题"按钮。
 */
const hasIssues = (row: ImportBatch): boolean => Number(row.failedRows ?? 0) > 0;

const handleRenormalize = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认对批次「${row.batchNo}」重新执行归一化处理？`);
  } catch {
    return;
  }
  rowLoadingId.value = row.id;
  rowAction.value = 'renormalize';
  try {
    await importApi.renormalize(row.id);
    modal.msgSuccess('已触发重归一化');
    await loadBatches();
  } finally {
    rowLoadingId.value = '';
  }
};

const handleArchive = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认归档批次「${row.batchNo}」？归档后该批次将不再参与重算。`);
  } catch {
    return;
  }
  rowLoadingId.value = row.id;
  rowAction.value = 'archive';
  try {
    await importApi.archive(row.id);
    modal.msgSuccess('归档成功');
    await loadBatches();
  } finally {
    rowLoadingId.value = '';
  }
};

// ==================== 操作：撤销导入 ====================
const rowCancellingId = ref<string>('');

const handleCancelImport = async (row: ImportBatch) => {
  try {
    await modal.confirm(
      `确认撤销批次「${row.batchNo}」？\n` +
      `将冲销该批次所有业绩事实（已调整/已审批事实不受影响），操作不可逆。\n` +
      `撤销后可重新导入到正确的归属月。`
    );
  } catch {
    return;
  }
  rowCancellingId.value = row.id;
  try {
    const res = await importApi.cancelImport(row.id);
    modal.msgSuccess('撤销成功');
    await loadBatches();
  } catch (e: any) {
    modal.msgError(e?.message || '撤销失败');
  } finally {
    rowCancellingId.value = '';
  }
};

// ==================== 下载原文件 ====================
const rowDownloadingId = ref<string>('');

/** "更多"下拉命令分发（中间态批次：下载原文件） */
const handleMoreCommand = (command: string, row: ImportBatch) => {
  if (command === 'download') {
    handleDownloadFile(row);
  }
};

const handleDownloadFile = async (row: ImportBatch) => {
  rowDownloadingId.value = row.id;
  try {
    const fileName = `${row.batchNo}_${row.fileName ?? '原始文件'}`;
    await importApi.downloadOriginalFile(row.id, fileName);
    modal.msgSuccess('已开始下载原文件');
  } catch (e: any) {
    modal.msgError(e?.message || '原文件下载失败');
  } finally {
    rowDownloadingId.value = '';
  }
};

onMounted(() => {
  loadBatches();
});
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
  flex-wrap: wrap;
  gap: 12px;

  .page-title {
    font-weight: 600;
    font-size: 16px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .period-item {
    margin-bottom: 0;
  }

  .upload-btn {
    display: inline-flex;
  }

  .upload-hint-icon {
    color: var(--el-text-color-secondary);
    font-size: 16px;
    cursor: help;
  }
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upload-alert {
  .alert-body {
    display: flex;
    align-items: center;
    gap: 12px;
  }
}

.data-table {
  .num-success {
    color: var(--el-color-success);
    font-weight: 600;
  }

  .num-fail {
    color: var(--el-color-danger);
    font-weight: 600;
  }
}

.action-row {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: nowrap;
  white-space: nowrap;

  .action-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    color: var(--el-color-primary);
    background-color: #f5f7fa;
    border-radius: 6px;
    cursor: pointer;
    text-decoration: none;
    user-select: none;
    line-height: 1;
    transition: background-color 0.15s ease, color 0.15s ease;

    &:hover {
      background-color: var(--el-color-primary-light-9);
    }

    &:active {
      background-color: var(--el-color-primary-light-8);
    }

    &.is-loading {
      cursor: wait;
      opacity: 0.7;
    }

    &.action-btn-danger {
      color: var(--el-color-danger);

      &:hover {
        background-color: var(--el-color-danger-light-9);
      }

      &:active {
        background-color: var(--el-color-danger-light-8);
      }
    }

    .el-icon {
      font-size: 16px;

      &.is-loading {
        animation: rotating 1.4s linear infinite;
      }
    }
  }
}

@keyframes rotating {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
