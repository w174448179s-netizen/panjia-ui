<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>考勤数据导入</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 顶部工具栏 -->
        <div class="toolbar">
          <el-form :inline="true" @submit.prevent>
            <el-form-item label="归属月">
              <el-date-picker
                v-model="period"
                type="month"
                value-format="YYYY-MM"
                placeholder="请选择归属月"
                clearable
                style="width: 180px"
              />
            </el-form-item>
            <el-form-item>
              <el-upload
                ref="uploadRef"
                :show-file-list="false"
                :auto-upload="true"
                accept=".xlsx,.xls"
                :before-upload="beforeUpload"
                :http-request="handleUpload"
              >
                <el-button
                  v-hasPermi="['import:batch:upload']"
                  type="primary"
                  icon="Upload"
                  :loading="uploading"
                  :disabled="uploading"
                >
                  上传文件
                </el-button>
              </el-upload>
            </el-form-item>
          </el-form>
          <el-alert
            type="info"
            :closable="false"
            show-icon
            title="请直接上传钉钉考勤后台导出的《月度汇总》Excel 原文件（无需下载模板改写），归属月选择文件统计日期所在月份；员工工号需与员工档案一致。"
          />
        </div>

        <!-- 上传结果 -->
        <el-alert
          v-if="uploadResult"
          :title="uploadResult.title"
          :type="uploadResult.type"
          :closable="true"
          show-icon
          class="upload-result"
          @close="uploadResult = null"
        >
          <template #default>
            <span>{{ uploadResult.text }}</span>
            <el-button
              v-if="uploadResult.batchId"
              link
              type="primary"
              @click="openIssues(uploadResult.batchId)"
            >
              查看问题清单
            </el-button>
          </template>
        </el-alert>

        <!-- 批次列表 -->
        <el-table
          v-loading="loading"
          v-hasPermi="['import:batch:list']"
          :data="batchList"
          border
        >
          <el-table-column label="批次号" prop="batchNo" min-width="160" show-overflow-tooltip />
          <el-table-column label="归属月" prop="period" width="100" align="center">
            <template #default="scope">{{ scope.row.period || '—' }}</template>
          </el-table-column>
          <el-table-column label="文件名" prop="fileName" min-width="180" show-overflow-tooltip />
          <el-table-column label="总行数" prop="totalRows" width="90" align="center" />
          <el-table-column label="成功" prop="successRows" width="80" align="center" />
          <el-table-column label="失败" prop="failedRows" width="80" align="center" />
          <el-table-column label="状态" prop="status" width="130" align="center">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small">
                {{ scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" prop="createTime" width="160" align="center" />
          <el-table-column label="操作" min-width="140" align="center" fixed="right">
            <template #default="scope">
              <div class="action-row">
                <!-- 终态（ARCHIVED）：仅保留"下载"做合规留档 -->
                <template v-if="scope.row.status === 'ARCHIVED'">
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
                <!-- 终态（FAILED）：保留"问题"排查失败原因 + "下载"留档 -->
                <template v-else-if="scope.row.status === 'FAILED'">
                  <el-tooltip v-if="hasIssues(scope.row as ImportBatch)" content="查看失败问题清单" placement="top">
                    <a class="action-btn" @click="openIssues(scope.row.id, scope.row.batchNo)">
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
                <!-- 中间态：按状态机判定 -->
                <template v-else>
                  <el-tooltip v-if="hasIssues(scope.row as ImportBatch)" content="查看问题清单" placement="top">
                    <a class="action-btn" @click="openIssues(scope.row.id, scope.row.batchNo)">
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
                  <el-tooltip v-if="canRenormalize(scope.row.status)" content="重新解析与归一化" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': actingId === scope.row.id }"
                      @click="handleRenormalize(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="actingId !== scope.row.id"><Refresh /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
                  <el-tooltip v-if="canArchive(scope.row.status)" content="归档批次" placement="top">
                    <a
                      class="action-btn"
                      :class="{ 'is-loading': actingId === scope.row.id }"
                      @click="handleArchive(scope.row as ImportBatch)"
                    >
                      <el-icon v-if="actingId !== scope.row.id"><Box /></el-icon>
                      <el-icon v-else class="is-loading"><Loading /></el-icon>
                    </a>
                  </el-tooltip>
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
      :title="`问题清单 - ${issueDialog.batchNo}`"
      width="900px"
      append-to-body
    >
      <el-table v-loading="issueLoading" :data="issueList" border max-height="480">
        <el-table-column label="行号" prop="rowNo" width="90" align="center">
          <template #default="scope">{{ scope.row.rowNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题类型" prop="issueType" width="130" align="center" />
        <el-table-column label="字段" prop="fieldName" width="130" align="center">
          <template #default="scope">{{ scope.row.fieldName ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="原始值" prop="rawValue" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.rawValue ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题描述" prop="message" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" prop="status" width="110" align="center">
          <template #default="scope">
            <el-tag :type="issueStatusType(scope.row.status)" size="small">
              {{ scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button type="primary" @click="issueDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="ImportAttendance" lang="ts">
import { importApi } from '@/api/panjia/import';
import type { ImportBatch, ImportIssue } from '@/api/panjia/types';
import type { UploadRequestOptions } from 'element-plus';
import { Warning, Download, Refresh, Loading, Box } from '@element-plus/icons-vue';
import modal from '@/plugins/modal';

/** 单据类型：考勤 */
const SOURCE_TYPE = 'ATTENDANCE';

// ==================== 归属月 + 上传 ====================
const uploadRef = ref<ElUploadInstance>();
const period = ref<string>('');
const uploading = ref(false);

interface UploadResult {
  title: string;
  type: 'success' | 'error';
  text: string;
  batchId: string;
}
const uploadResult = ref<UploadResult | null>(null);

const beforeUpload = (file: File): boolean => {
  const ok = /\.(xlsx|xls)$/i.test(file.name);
  if (!ok) {
    modal.msgWarning('仅支持钉钉导出的 .xlsx / .xls 格式文件');
    return false;
  }
  return true;
};

const handleUpload = async (options: UploadRequestOptions): Promise<void> => {
  const file = options.file as File;
  uploading.value = true;
  try {
    const res = await importApi.upload(file, SOURCE_TYPE, period.value || undefined);
    const batchId = res.data ?? '';
    uploadResult.value = {
      title: '上传成功',
      type: 'success',
      text: `批次号：${batchId}`,
      batchId
    };
    modal.msgSuccess('上传成功');
    await getList();
  } catch (e: any) {
    uploadResult.value = {
      title: '上传失败',
      type: 'error',
      text: e?.message || '文件上传失败，请重试',
      batchId: ''
    };
  } finally {
    uploading.value = false;
    uploadRef.value?.clearFiles();
  }
};

// ==================== 批次列表 ====================
const loading = ref(false);
const batchList = ref<ImportBatch[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const res = await importApi.listBatches([SOURCE_TYPE], period.value || undefined);
    const list: ImportBatch[] = res.data ?? [];
    list.sort((a, b) => (a.createTime < b.createTime ? 1 : a.createTime > b.createTime ? -1 : 0));
    batchList.value = list;
  } finally {
    loading.value = false;
  }
};

const statusTagType = (status: string): ElTagType => {
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

// 状态机硬约束：仅 PENDING_CONFIRM 允许重归一化/归档（与 batch 列表一致）
const canRenormalize = (status: string): boolean => status === 'PENDING_CONFIRM';
const canArchive = (status: string): boolean => status === 'PENDING_CONFIRM';

/**
 * 批次是否存在需要展示的问题（failedRows > 0）。
 * - 中间态/终态都用此判定是否显示"问题"按钮。
 */
const hasIssues = (row: ImportBatch): boolean => Number(row.failedRows ?? 0) > 0;

// ==================== 问题清单 ====================
const issueLoading = ref(false);
const issueList = ref<ImportIssue[]>([]);
const issueDialog = ref<{ visible: boolean; batchId: string; batchNo: string }>({
  visible: false,
  batchId: '',
  batchNo: ''
});

const openIssues = async (batchId: string, batchNo?: string) => {
  issueDialog.value = {
    visible: true,
    batchId,
    batchNo: batchNo ?? batchId
  };
  issueList.value = [];
  issueLoading.value = true;
  try {
    const res = await importApi.listIssues(batchId);
    issueList.value = res.data ?? [];
  } finally {
    issueLoading.value = false;
  }
};

const issueStatusType = (status: string): ElTagType => {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'IGNORED':
      return 'info';
    case 'RESOLVED':
    case 'FIXED':
      return 'success';
    default:
      return 'info';
  }
};

// ==================== 重归一化 / 归档 ====================
const actingId = ref<string>('');

const handleRenormalize = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认对批次「${row.batchNo}」执行重归一化？`);
  } catch {
    return;
  }
  actingId.value = row.id;
  try {
    await importApi.renormalize(row.id);
    modal.msgSuccess('重归一化已提交');
    await getList();
  } finally {
    actingId.value = '';
  }
};

const handleArchive = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认归档批次「${row.batchNo}」？归档后将不可再操作。`);
  } catch {
    return;
  }
  actingId.value = row.id;
  try {
    await importApi.archive(row.id);
    modal.msgSuccess('归档成功');
    await getList();
  } finally {
    actingId.value = '';
  }
};

// ==================== 下载原文件 ====================
const rowDownloadingId = ref<string>('');

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
  getList();
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
  font-weight: 600;
  font-size: 16px;
}

.page-content {
  min-height: auto;
  display: block;
}

.toolbar {
  margin-bottom: 12px;
}

.upload-result {
  margin-bottom: 12px;
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
