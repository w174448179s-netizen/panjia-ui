<template>
  <div class="panjia-page">
    <el-card v-hasPermi="['import:batch:list']" class="page-card">
      <template #header>
        <div class="card-header">
          <span>导入批次查询</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams">
          <el-form-item label="单据类型" prop="sourceType">
            <el-select
              v-model="queryParams.sourceType"
              placeholder="全部单据类型"
              clearable
              style="width: 180px"
            >
              <el-option
                v-for="opt in sourceTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="所属月份" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 批次列表 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="batchList"
          :default-sort="{ prop: 'createTime', order: 'descending' }"
        >
          <el-table-column label="批次号" align="center" prop="batchNo" min-width="180" show-overflow-tooltip />
          <el-table-column label="单据类型" align="center" width="130">
            <template #default="scope">
              {{ sourceTypeMap[scope.row.sourceType] ?? scope.row.sourceType }}
            </template>
          </el-table-column>
          <el-table-column label="所属月份" align="center" prop="period" width="110">
            <template #default="scope">{{ scope.row.period || '—' }}</template>
          </el-table-column>
          <el-table-column label="文件名" align="center" prop="fileName" min-width="200" show-overflow-tooltip />
          <el-table-column label="总行数" align="center" prop="totalRows" width="90" />
          <el-table-column label="成功行数" align="center" prop="successRows" width="100">
            <template #default="scope">
              <span class="row-success">{{ scope.row.successRows }}</span>
            </template>
          </el-table-column>
          <el-table-column label="失败行数" align="center" prop="failedRows" width="100">
            <template #default="scope">
              <span :class="{ 'row-failed': scope.row.failedRows > 0 }">{{ scope.row.failedRows }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" prop="status" width="130">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small">
                {{ statusMap[scope.row.status] ?? scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="230" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-tooltip content="查看问题清单" placement="top">
                <el-button link type="primary" icon="Warning" @click="handleIssues(scope.row as ImportBatch)">
                  问题
                </el-button>
              </el-tooltip>
              <el-tooltip content="重新解析与归一化" placement="top">
                <el-button
                  link
                  type="primary"
                  icon="Refresh"
                  :loading="renormalizingId === scope.row.id"
                  @click="handleRenormalize(scope.row as ImportBatch)"
                >
                  重归一化
                </el-button>
              </el-tooltip>
              <el-tooltip content="归档批次" placement="top">
                <el-button
                  link
                  type="primary"
                  icon="Box"
                  :loading="archivingId === scope.row.id"
                  @click="handleArchive(scope.row as ImportBatch)"
                >
                  归档
                </el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <!-- 问题清单弹窗 -->
    <el-dialog
      v-model="issueDialog.visible"
      :title="issueDialogTitle"
      width="860px"
      append-to-body
    >
      <el-table v-loading="issueLoading" border :data="issueList" size="small" max-height="460">
        <el-table-column label="行号" align="center" prop="rowNo" width="80">
          <template #default="scope">{{ scope.row.rowNo ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="问题类型" align="center" prop="issueType" width="140" show-overflow-tooltip />
        <el-table-column label="字段" align="center" prop="fieldName" width="130">
          <template #default="scope">{{ scope.row.fieldName || '—' }}</template>
        </el-table-column>
        <el-table-column label="原始值" align="center" prop="rawValue" min-width="140" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.rawValue || '—' }}</template>
        </el-table-column>
        <el-table-column label="问题描述" prop="message" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" align="center" prop="status" width="110">
          <template #default="scope">
            <el-tag :type="issueStatusTagType(scope.row.status)" size="small">
              {{ issueStatusMap[scope.row.status] ?? scope.row.status }}
            </el-tag>
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

// 单据类型映射（跨所有单据类型）
const sourceTypeMap: Record<string, string> = {
  KE_SIGNED: '贝壳结佣',
  KE_NEW_SIGN: '新签业绩',
  ATTENDANCE: '考勤',
  POINTS: '积分',
  OTHERS: '手工费用'
};
const sourceTypeOptions = Object.entries(sourceTypeMap).map(([value, label]) => ({ value, label }));

// 批次状态映射 + el-tag 着色
const statusMap: Record<string, string> = {
  PARSING: '解析中',
  NORMALIZING: '归一化中',
  PENDING_CONFIRM: '待确认',
  ARCHIVED: '已归档',
  FAILED: '失败'
};
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const statusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    PARSING: 'info',
    NORMALIZING: 'info',
    PENDING_CONFIRM: 'warning',
    ARCHIVED: 'success',
    FAILED: 'danger'
  };
  return map[status] ?? 'info';
};

// 问题状态映射
const issueStatusMap: Record<string, string> = {
  OPEN: '未处理',
  RESOLVED: '已解决',
  IGNORED: '已忽略'
};
const issueStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    OPEN: 'warning',
    RESOLVED: 'success',
    IGNORED: 'info'
  };
  return map[status] ?? 'info';
};

// ==================== 筛选 ====================
const queryParams = reactive({
  sourceType: '',
  period: ''
});

// ==================== 列表 ====================
const loading = ref(false);
const batchList = ref<ImportBatch[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const res = await importApi.listBatches(
      queryParams.sourceType || undefined,
      queryParams.period || undefined
    );
    const list: ImportBatch[] = res.data ?? [];
    // 按 createTime 倒序
    list.sort((a, b) => (a.createTime < b.createTime ? 1 : a.createTime > b.createTime ? -1 : 0));
    batchList.value = list;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  queryParams.sourceType = '';
  queryParams.period = '';
  getList();
};

// ==================== 操作：重归一化 / 归档 ====================
const renormalizingId = ref<string | number | undefined>();
const archivingId = ref<string | number | undefined>();

const handleRenormalize = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认对批次「${row.batchNo}」重新归一化？将基于原始文件重新解析与归一化数据。`);
  } catch {
    return;
  }
  renormalizingId.value = row.id;
  try {
    await importApi.renormalize(row.id);
    modal.msgSuccess('已触发重归一化');
    await getList();
  } finally {
    renormalizingId.value = undefined;
  }
};

const handleArchive = async (row: ImportBatch) => {
  try {
    await modal.confirm(`确认归档批次「${row.batchNo}」？归档后将不再参与后续处理。`);
  } catch {
    return;
  }
  archivingId.value = row.id;
  try {
    await importApi.archive(row.id);
    modal.msgSuccess('归档成功');
    await getList();
  } finally {
    archivingId.value = undefined;
  }
};

// ==================== 问题清单弹窗 ====================
const issueDialog = reactive({ visible: false });
const issueLoading = ref(false);
const issueList = ref<ImportIssue[]>([]);
const issueDialogBatchNo = ref('');
const issueDialogTitle = computed(() =>
  issueDialogBatchNo.value ? `问题清单 - ${issueDialogBatchNo.value}` : '问题清单'
);

const handleIssues = async (row: ImportBatch) => {
  issueDialogBatchNo.value = row.batchNo;
  issueDialog.visible = true;
  issueLoading.value = true;
  issueList.value = [];
  try {
    const res = await importApi.listIssues(row.id);
    issueList.value = res.data ?? [];
  } finally {
    issueLoading.value = false;
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
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .filter-form {
    margin-bottom: 0;
  }

  .data-table {
    width: 100%;
  }

  .row-success {
    color: var(--el-color-success);
    font-weight: 600;
  }

  .row-failed {
    color: var(--el-color-danger);
    font-weight: 600;
  }
}
</style>
