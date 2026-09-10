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
                accept=".xlsx,.xls,.csv"
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
              <el-button icon="Download" @click="handleDownloadTemplate">下载模板</el-button>
            </el-form-item>
          </el-form>
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
          <el-table-column label="操作" width="230" align="center" fixed="right">
            <template #default="scope">
              <el-button link type="primary" icon="Warning" @click="openIssues(scope.row.id, scope.row.batchNo)">
                问题
              </el-button>
              <el-button
                link
                type="warning"
                icon="Refresh"
                :loading="actingId === scope.row.id"
                :disabled="!canRenormalize(scope.row.status)"
                @click="handleRenormalize(scope.row as ImportBatch)"
              >
                重归一化
              </el-button>
              <el-button
                link
                type="success"
                icon="Box"
                :loading="actingId === scope.row.id"
                :disabled="!canArchive(scope.row.status)"
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

const handleDownloadTemplate = () => {
  importApi.downloadTemplate('ATTENDANCE', '考勤导入模板.xlsx');
};

const beforeUpload = (file: File): boolean => {
  const ok = /\.(xlsx|xls|csv)$/i.test(file.name);
  if (!ok) {
    modal.msgWarning('仅支持 .xlsx / .xls / .csv 格式文件');
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
    const res = await importApi.listBatches(SOURCE_TYPE, period.value || undefined);
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

const canRenormalize = (status: string): boolean => {
  return status !== 'ARCHIVED';
};

const canArchive = (status: string): boolean => {
  return status !== 'ARCHIVED';
};

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
</style>
