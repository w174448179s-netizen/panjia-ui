<template>
  <div class="performance-period-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>期间封账</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 工具栏 -->
        <div class="toolbar">
          <el-button icon="Refresh" @click="getList">刷新</el-button>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="periodList"
          :default-sort="{ prop: 'period', order: 'descending' }"
        >
          <el-table-column label="期间" align="center" prop="period" width="140">
            <template #default="scope">
              <span class="period-text">{{ scope.row.period }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" width="120">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small" effect="dark">
                {{ statusMap[scope.row.status] ?? scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="封账原因" align="center" prop="closeReason" min-width="200" show-overflow-tooltip>
            <template #default="scope">{{ scope.row.closeReason || '—' }}</template>
          </el-table-column>
          <el-table-column label="操作人" align="center" prop="operatorId" width="120">
            <template #default="scope">{{ scope.row.operatorId || '—' }}</template>
          </el-table-column>
          <el-table-column label="封账时间" align="center" prop="closeTime" width="170">
            <template #default="scope">{{ scope.row.closeTime || '—' }}</template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="120" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button v-if="scope.row.status === 'OPEN'" link type="danger" @click="handleClose(scope.row)">封账</el-button>
              <el-button v-else-if="scope.row.status === 'CLOSED'" link type="primary" @click="handleReopen(scope.row)">反结账</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && periodList.length === 0" class="empty-wrap">
          <el-empty description="暂无数据" />
        </div>
      </div>
    </el-card>

    <!-- 封账弹窗 -->
    <el-dialog
      v-model="closeDialog.visible"
      title="期间封账"
      width="480px"
      append-to-body
    >
      <el-alert
        :title="`确认对期间「${closeDialog.period}」执行封账操作？封账后该期间的业绩数据将不可再修改。`"
        type="warning"
        :closable="false"
        show-icon
        class="close-alert"
      />
      <el-form :model="closeForm" label-width="80px" style="margin-top: 16px">
        <el-form-item label="封账原因">
          <el-input
            v-model="closeForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入封账原因"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeDialog.visible = false">取 消</el-button>
        <el-button type="danger" :loading="submitLoading" @click="submitClose">确认封账</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PeriodClose } from '@/api/panjia/performance';
import modal from '@/plugins/modal';

// 状态映射
const statusMap: Record<string, string> = {
  OPEN: '开启',
  CLOSED: '已封账'
};

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const statusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    OPEN: 'success',
    CLOSED: 'danger'
  };
  return map[status] ?? 'info';
};

// ==================== 列表 ====================
const loading = ref(false);
const periodList = ref<PeriodClose[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.listPeriods();
    const list: PeriodClose[] = res.data ?? [];
    // 按期间倒序
    list.sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0));
    periodList.value = list;
  } finally {
    loading.value = false;
  }
};

// ==================== 操作：封账 ====================
const closeDialog = reactive({
  visible: false,
  period: ''
});
const closeForm = reactive({
  reason: ''
});
const submitLoading = ref(false);

const handleClose = (row: PeriodClose) => {
  closeDialog.period = row.period;
  closeForm.reason = '';
  closeDialog.visible = true;
};

const submitClose = async () => {
  submitLoading.value = true;
  try {
    await performanceApi.closePeriod(closeDialog.period, closeForm.reason || undefined);
    modal.msgSuccess('封账成功');
    closeDialog.visible = false;
    getList();
  } finally {
    submitLoading.value = false;
  }
};

// ==================== 操作：反结账 ====================
const handleReopen = async (row: PeriodClose) => {
  try {
    await modal.confirm(`确认对期间「${row.period}」执行反结账？反结账后该期间的业绩数据将允许修改。`);
  } catch {
    return;
  }
  try {
    await performanceApi.reopenPeriod(row.period);
    modal.msgSuccess('反结账成功');
    getList();
  } catch {
    // 错误已在拦截器处理
  }
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.performance-period-page {
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

  .toolbar {
    display: flex;
    gap: 8px;
  }

  .data-table {
    width: 100%;
  }

  .period-text {
    font-weight: 600;
    font-size: 14px;
    letter-spacing: 0.5px;
  }

  .empty-wrap {
    padding: 40px 0;
  }

  .close-alert {
    margin-bottom: 0;
  }
}
</style>
