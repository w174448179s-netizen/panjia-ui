<template>
  <div class="performance-fact-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>业绩明细</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams">
          <el-form-item label="期间" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="事实口径" prop="factType">
            <el-select
              v-model="queryParams.factType"
              placeholder="全部口径"
              clearable
              style="width: 160px"
            >
              <el-option
                v-for="opt in factTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="员工" prop="employeeName">
            <el-input
              v-model="queryParams.employeeName"
              placeholder="员工姓名"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="部门" prop="deptName">
            <el-input
              v-model="queryParams.deptName"
              placeholder="部门名称"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="业务类型" prop="bizType">
            <el-input
              v-model="queryParams.bizType"
              placeholder="业务类型"
              clearable
              style="width: 140px"
            />
          </el-form-item>
          <el-form-item label="状态" prop="factStatus">
            <el-select
              v-model="queryParams.factStatus"
              placeholder="全部状态"
              clearable
              style="width: 140px"
            >
              <el-option
                v-for="opt in factStatusOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 工具栏 -->
        <div class="toolbar">
          <el-button icon="Refresh" @click="getList">刷新</el-button>
          <el-button type="warning" icon="Lightning" @click="handleBuildBatch" :disabled="!selectedBatchId">
            手工触发消费
          </el-button>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="factList"
          :default-sort="{ prop: 'createTime', order: 'descending' }"
        >
          <el-table-column label="期间" align="center" prop="period" width="100" />
          <el-table-column label="业务日期" align="center" prop="businessDate" width="110" />
          <el-table-column label="事实口径" align="center" width="110">
            <template #default="scope">
              {{ factTypeMap[scope.row.factType] ?? scope.row.factType }}
            </template>
          </el-table-column>
          <el-table-column label="员工姓名" align="center" prop="employeeName" width="100" show-overflow-tooltip />
          <el-table-column label="工号" align="center" prop="employeeCode" width="110" show-overflow-tooltip />
          <el-table-column label="部门" align="center" prop="deptName" min-width="140" show-overflow-tooltip />
          <el-table-column label="业务类型" align="center" prop="bizType" width="110" show-overflow-tooltip />
          <el-table-column label="来源单号" align="center" prop="sourceKey" min-width="160" show-overflow-tooltip />
          <el-table-column label="原始金额" align="center" prop="originAmount" width="110">
            <template #default="scope">
              <span class="amount-text">{{ formatAmount(scope.row.originAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="分摊比例" align="center" prop="shareRatio" width="100">
            <template #default="scope">
              {{ formatPercent(scope.row.shareRatio) }}
            </template>
          </el-table-column>
          <el-table-column label="折算系数" align="center" prop="conversionRate" width="100">
            <template #default="scope">
              {{ scope.row.conversionRate ?? '—' }}
            </template>
          </el-table-column>
          <el-table-column label="业绩金额" align="center" prop="performanceAmount" width="120">
            <template #default="scope">
              <span class="amount-highlight">{{ formatAmount(scope.row.performanceAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" width="100">
            <template #default="scope">
              <el-tag :type="factStatusTagType(scope.row.factStatus)" size="small">
                {{ factStatusMap[scope.row.factStatus] ?? scope.row.factStatus }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="来源" align="center" width="90">
            <template #default="scope">
              {{ sourceMap[scope.row.source] ?? scope.row.source }}
            </template>
          </el-table-column>
          <el-table-column label="创建时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="100" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && factList.length === 0" class="empty-wrap">
          <el-empty description="暂无数据" />
        </div>

        <!-- 分页 -->
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="queryParams.pageNum"
            v-model:page-size="queryParams.pageSize"
            :page-sizes="[10, 20, 50, 100]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="getList"
            @current-change="getList"
          />
        </div>
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog
      v-model="detailDialog.visible"
      title="业绩明细详情"
      width="680px"
      append-to-body
    >
      <el-descriptions v-if="detailData" :column="2" border>
        <el-descriptions-item label="期间">{{ detailData.period }}</el-descriptions-item>
        <el-descriptions-item label="业务日期">{{ detailData.businessDate }}</el-descriptions-item>
        <el-descriptions-item label="事实口径">
          {{ factTypeMap[detailData.factType] ?? detailData.factType }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">
          {{ sourceMap[detailData.source] ?? detailData.source }}
        </el-descriptions-item>
        <el-descriptions-item label="员工姓名">{{ detailData.employeeName }}</el-descriptions-item>
        <el-descriptions-item label="工号">{{ detailData.employeeCode }}</el-descriptions-item>
        <el-descriptions-item label="部门" :span="2">{{ detailData.deptName }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detailData.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="来源单号">{{ detailData.sourceKey }}</el-descriptions-item>
        <el-descriptions-item label="原始金额">{{ formatAmount(detailData.originAmount) }}</el-descriptions-item>
        <el-descriptions-item label="分摊比例">{{ formatPercent(detailData.shareRatio) }}</el-descriptions-item>
        <el-descriptions-item label="折算系数">{{ detailData.conversionRate ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="业绩金额">
          <span class="amount-highlight">{{ formatAmount(detailData.performanceAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="factStatusTagType(detailData.factStatus)" size="small">
            {{ factStatusMap[detailData.factStatus] ?? detailData.factStatus }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ detailData.createTime }}</el-descriptions-item>
        <el-descriptions-item v-if="detailData.factStatus === 'REVERSED'" label="冲销原因" :span="2">
          {{ detailData.reversedReason || '—' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="detailDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceFact, FactQuery } from '@/api/panjia/performance';
import modal from '@/plugins/modal';

// 事实口径映射
const factTypeMap: Record<string, string> = {
  PERF_REAL: '结佣业绩',
  PERF_EXPECT: '新签业绩'
};
const factTypeOptions = Object.entries(factTypeMap).map(([value, label]) => ({ value, label }));

// 状态映射
const factStatusMap: Record<string, string> = {
  ACTIVE: '有效',
  REVERSED: '已冲销'
};
const factStatusOptions = Object.entries(factStatusMap).map(([value, label]) => ({ value, label }));

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const factStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    ACTIVE: 'success',
    REVERSED: 'info'
  };
  return map[status] ?? 'info';
};

// 来源映射
const sourceMap: Record<string, string> = {
  IMPORT: '导入',
  MANUAL: '手工'
};

// ==================== 筛选 & 分页 ====================
const queryParams = reactive<FactQuery & { employeeName?: string; deptName?: string }>({
  pageNum: 1,
  pageSize: 20,
  period: '',
  factType: '',
  employeeId: '',
  employeeName: '',
  deptId: '',
  deptName: '',
  bizType: '',
  factStatus: '',
  source: ''
});

// 选中的批次ID（用于手工触发消费）
const selectedBatchId = ref('');

// ==================== 列表 ====================
const loading = ref(false);
const total = ref(0);
const factList = ref<PerformanceFact[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const params: FactQuery = {
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      period: queryParams.period || undefined,
      factType: queryParams.factType || undefined,
      employeeId: queryParams.employeeId || undefined,
      deptId: queryParams.deptId || undefined,
      bizType: queryParams.bizType || undefined,
      factStatus: queryParams.factStatus || undefined,
      source: queryParams.source || undefined
    };
    const res = await performanceApi.listFacts(params);
    factList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryParams.period = '';
  queryParams.factType = '';
  queryParams.employeeId = '';
  queryParams.employeeName = '';
  queryParams.deptId = '';
  queryParams.deptName = '';
  queryParams.bizType = '';
  queryParams.factStatus = '';
  queryParams.source = '';
  queryParams.pageNum = 1;
  getList();
};

// ==================== 工具方法 ====================
const formatAmount = (val: number | undefined): string => {
  if (val === undefined || val === null) return '—';
  return val.toFixed(2);
};

const formatPercent = (val: number | undefined): string => {
  if (val === undefined || val === null) return '—';
  return (val * 100).toFixed(2) + '%';
};

// ==================== 操作：手工触发消费 ====================
const handleBuildBatch = async () => {
  if (!selectedBatchId.value) {
    modal.msgWarning('请先输入批次ID');
    return;
  }
  try {
    await modal.confirm(`确认触发批次「${selectedBatchId.value}」的业绩消费？`);
  } catch {
    return;
  }
  try {
    await performanceApi.buildBatch(selectedBatchId.value);
    modal.msgSuccess('已触发消费');
    getList();
  } catch {
    // 错误已在拦截器处理
  }
};

// ==================== 详情弹窗 ====================
const detailDialog = reactive({ visible: false });
const detailData = ref<PerformanceFact | null>(null);

const handleDetail = async (row: PerformanceFact) => {
  detailData.value = null;
  detailDialog.visible = true;
  try {
    const res = await performanceApi.getFact(row.id);
    detailData.value = res.data ?? row;
  } catch {
    detailData.value = row;
  }
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.performance-fact-page {
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

  .toolbar {
    display: flex;
    gap: 8px;
  }

  .data-table {
    width: 100%;
  }

  .amount-text {
    font-variant-numeric: tabular-nums;
  }

  .amount-highlight {
    color: var(--el-color-primary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .empty-wrap {
    padding: 40px 0;
  }

  .pagination-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }
}
</style>
