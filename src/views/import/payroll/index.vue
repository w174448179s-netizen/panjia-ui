<template>
  <div class="app-container">
    <!-- 上传区 -->
    <el-card shadow="never" class="mb12">
      <template #header>
        <div class="card-header">
          <span>历史工资导入</span>
          <el-tooltip content="上传天街工资表 xlsx（工资表/店长/总监/新签业绩/结佣业绩/人事数据/绩效和扣款），回写工资批次、考勤、积分、算薪事实、业绩与结佣数据，分段幂等可重跑">
            <el-icon><QuestionFilled /></el-icon>
          </el-tooltip>
        </div>
      </template>
      <el-form :inline="true">
        <el-form-item label="工资归属月">
          <el-date-picker v-model="period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width: 160px" />
        </el-form-item>
        <el-form-item label="Excel 文件">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".xlsx"
            :on-change="(f: any) => (file = f.raw)"
            :on-remove="() => (file = null)"
          >
            <el-button type="primary" plain>选择文件</el-button>
          </el-upload>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="uploading" :disabled="!period || !file" @click="doUpload">
            开始导入
          </el-button>
        </el-form-item>
      </el-form>
      <el-alert
        type="warning"
        :closable="false"
        title="导入为分段幂等：已存在的分段自动跳过；重复导入同一期间前建议先撤销旧批次。员工未匹配等告警行会记入批次问题清单。"
      />
    </el-card>

    <!-- 批次列表 -->
    <el-card shadow="never">
      <template #header><span>导入批次</span></template>
      <el-table v-loading="loading" :data="batches" border>
        <el-table-column label="批次号" prop="batchNo" min-width="180" show-overflow-tooltip />
        <el-table-column label="归属月" prop="period" width="100" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结果摘要" prop="remark" min-width="260" show-overflow-tooltip />
        <el-table-column label="告警" width="80" align="center">
          <template #default="{ row }">
            <el-badge v-if="row.failedRows > 0" :value="row.failedRows" type="warning">
              <el-button link type="warning" @click="showIssues(row)">问题</el-button>
            </el-badge>
            <span v-else>-</span>
          </template>
        </el-table-column>
        <el-table-column label="原文件" prop="originalFileName" min-width="160" show-overflow-tooltip />
        <el-table-column label="导入人" prop="operatorName" width="100" />
        <el-table-column label="导入时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="showIssues(row)">问题清单</el-button>
            <el-button link type="primary" @click="downloadFile(row)">原文件</el-button>
            <el-button
              v-if="row.status === 'ARCHIVED' || row.status === 'PENDING_CONFIRM'"
              link
              type="danger"
              @click="revoke(row)"
            >撤销导入</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 问题清单弹窗 -->
    <el-dialog v-model="issuesVisible" title="批次问题清单" width="720px" destroy-on-close>
      <el-table :data="issues" border max-height="480">
        <el-table-column label="类型" width="130">
          <template #default="{ row }">{{ issueTypeLabel(row.issueType) }}</template>
        </el-table-column>
        <el-table-column label="行号" prop="rowNo" width="70" />
        <el-table-column label="说明" prop="message" min-width="380" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { QuestionFilled } from '@element-plus/icons-vue';
import { importApi } from '@/api/panjia/import';
import type { ImportBatch, ImportIssue } from '@/api/panjia/types';

defineOptions({ name: 'ImportPayroll' });

const period = ref('');
const file = ref<File | null>(null);
const uploading = ref(false);
const loading = ref(false);
const batches = ref<ImportBatch[]>([]);
const issuesVisible = ref(false);
const issues = ref<ImportIssue[]>([]);
const uploadRef = ref();

const listBatches = async () => {
  loading.value = true;
  try {
    // 拦截器返回完整 R 包装体，取 data 解包
    batches.value = (await importApi.listBatches(['HISTORY_PAYROLL'])).data ?? [];
  } finally {
    loading.value = false;
  }
};

const doUpload = async () => {
  if (!period.value || !file.value) return;
  uploading.value = true;
  try {
    await importApi.upload(file.value, 'HISTORY_PAYROLL', period.value);
    ElMessage.success('导入完成');
    file.value = null;
    uploadRef.value?.clearFiles();
    await listBatches();
  } finally {
    uploading.value = false;
  }
};

const showIssues = async (row: any) => {
  issues.value = (await importApi.listIssues(row.id)).data ?? [];
  issuesVisible.value = true;
};

const downloadFile = (row: any) => {
  importApi.downloadOriginalFile(row.id, row.originalFileName);
};

const revoke = (row: any) => {
  ElMessageBox.confirm(
    `撤销将硬删除 ${row.period} 导入的工资批次/明细、考勤、积分、算薪事实、业绩事实、实收审批单与结佣申请单，且不可恢复。确定撤销？`,
    '撤销导入',
    { type: 'warning', confirmButtonText: '确定撤销', cancelButtonText: '取消' }
  ).then(async () => {
    await importApi.cancelImport(row.id);
    ElMessage.success('已撤销');
    await listBatches();
  }).catch(() => {});
};

const statusLabel = (s: string) =>
  ({ PARSING: '解析中', NORMALIZING: '归一化中', PENDING_CONFIRM: '待确认', ARCHIVED: '已归档', FAILED: '失败', SUPERSEDED: '已替代' })[s] ?? s;
const statusType = (s: string): 'success' | 'danger' | 'warning' | 'info' =>
  (({ ARCHIVED: 'success', FAILED: 'danger', PENDING_CONFIRM: 'warning' } as Record<string, 'success' | 'danger' | 'warning'>)[s] ?? 'info');
const issueTypeLabel = (t: string) =>
  ({ REQUIRED_MISSING: '必填缺失', EMPLOYEE_NOT_MATCH: '员工未匹配', DUPLICATE_KEY: '重复键', COLUMN_TYPE_ERR: '格式错误' })[t] ?? t;

onMounted(listBatches);
</script>

<style scoped>
.mb12 {
  margin-bottom: 12px;
}
.card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}
</style>
