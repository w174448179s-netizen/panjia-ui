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
              <el-button type="primary" icon="Upload" :loading="uploadLoading">
                上传文件
              </el-button>
            </el-upload>
            <el-button icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
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
          <el-table-column label="操作" align="center" width="200" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" icon="Warning" @click="openIssues(scope.row.id)">问题</el-button>
              <el-button
                link
                type="warning"
                icon="Refresh"
                :loading="rowLoadingId === scope.row.id && rowAction === 'renormalize'"
                @click="handleRenormalize(scope.row as ImportBatch)"
              >
                重归一化
              </el-button>
              <el-button
                link
                type="success"
                icon="Box"
                :loading="rowLoadingId === scope.row.id && rowAction === 'archive'"
                @click="handleArchive(scope.row as ImportBatch)"
              >
                归档
              </el-button>
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

const SOURCE_TYPE = 'KE_SIGNED';

// ==================== 工具栏 / 上传 ====================
const period = ref<string>('');
const uploadLoading = ref(false);
const uploadResult = ref<{ success: boolean; batchId: string; message?: string } | null>(null);

const handlePeriodChange = () => {
  loadBatches();
};

const handleDownloadTemplate = () => {
  importApi.downloadTemplate('KE_SIGNED', '贝壳业绩导入模板.xlsx');
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
</style>
