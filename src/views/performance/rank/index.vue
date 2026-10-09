<template>
  <div class="performance-rank-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="统计维度" prop="periodType">
            <el-radio-group v-model="queryParams.periodType" @change="handleQuery">
              <el-radio label="MONTH">按月</el-radio>
              <el-radio label="QUARTER">按季</el-radio>
              <el-radio label="YEAR">按年</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年份" prop="year">
            <el-date-picker
              v-model="queryParams.year"
              type="year"
              value-format="YYYY"
              placeholder="选择年份"
              style="width: 120px"
            />
          </el-form-item>
          <el-form-item v-if="queryParams.periodType === 'QUARTER'" label="季度" prop="quarter">
            <el-select
              v-model="queryParams.quarter"
              clearable
              placeholder="全部季度"
              style="width: 120px"
            >
              <el-option label="Q1" :value="1" />
              <el-option label="Q2" :value="2" />
              <el-option label="Q3" :value="3" />
              <el-option label="Q4" :value="4" />
            </el-select>
          </el-form-item>
          <el-form-item label="门店/组别" prop="deptId">
            <PanjiaDeptSelect
              v-model="queryParams.deptId"
              :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
              :clearable="!deptLocked"
              width="200px"
            />
          </el-form-item>
          <el-form-item label="业务类型" prop="bizType">
            <el-input
              v-model.trim="queryParams.bizType"
              clearable
              placeholder="业务类型"
              style="width: 160px"
              @keyup.enter="handleQuery"
              @clear="handleQuery"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :icon="Search" @click="handleQuery">查询</el-button>
            <el-button :icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          :data="tableData"
          border
          stripe
          :max-height="tableMaxHeight"
        >
          <el-table-column label="排名" align="center" width="70">
            <template #default="{ row }">
              <el-tag v-if="row.rank <= 3" type="warning">{{ row.rank }}</el-tag>
              <span v-else>{{ row.rank }}</span>
            </template>
          </el-table-column>
          <el-table-column label="员工姓名" align="center" min-width="120">
            <template #default="{ row }">{{ row.employeeName || '—' }}</template>
          </el-table-column>
          <el-table-column label="工号" align="center" width="120">
            <template #default="{ row }">{{ row.employeeCode || '—' }}</template>
          </el-table-column>
          <el-table-column label="部门" align="center" min-width="160">
            <template #default="{ row }">{{ row.deptName || '—' }}</template>
          </el-table-column>
          <el-table-column label="合同数" align="center" prop="contractCount" width="90" />
          <el-table-column label="新签业绩金额" align="right" min-width="140">
            <template #default="{ row }">
              <span class="amount-red">{{ formatMoney(row.totalAmount) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && tableData.length === 0" class="empty-wrap">
          <el-empty description="暂无排行数据" />
        </div>

        <!-- 分页 -->
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="queryParams.pageNum"
            v-model:page-size="queryParams.pageSize"
            :page-sizes="[10, 20, 50]"
            :total="total"
            layout="total, sizes, prev, pager, next, jumper"
            background
            @size-change="handleQuery"
            @current-change="getList"
          />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Search, Refresh } from '@element-plus/icons-vue';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceRankRow } from '@/api/panjia/performance';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import { useDeptScope } from '@/hooks/useDeptScope';

defineOptions({ name: 'PerformanceRank' });

const tableMaxHeight = ref(580);

const calcTableHeight = () => {
  nextTick(() => {
    tableMaxHeight.value = window.innerHeight - 280;
  });
};

// ==================== 部门口径（全系统统一：所有用户查本部门及以下） ====================
const { deptLocked, defaultDeptId } = useDeptScope();

// ==================== 筛选 & 分页 ====================
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  periodType: 'YEAR',
  year: String(new Date().getFullYear()),
  quarter: undefined as number | undefined,
  deptId: undefined as string | undefined,
  bizType: undefined as string | undefined,
});

const loading = ref(false);
const tableData = ref<PerformanceRankRow[]>([]);
const total = ref(0);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.listRank({
      periodType: queryParams.periodType,
      year: queryParams.year,
      quarter: queryParams.quarter,
      // 排行榜全员全量，部门仅作筛选
      deptId: queryParams.deptId,
      bizType: queryParams.bizType,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    tableData.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e) {
    console.error('[rank] 查询失败', e);
    tableData.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  // 统计维度/年份保持
  queryParams.quarter = undefined;
  // 受限角色重置回本部门默认值，不能清空为"全部"
  queryParams.deptId = defaultDeptId();
  queryParams.bizType = undefined;
  handleQuery();
};

// ==================== 格式化 ====================
const formatMoney = (val?: number | null): string => {
  if (val == null) return '—';
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ==================== 初始化 ====================
onMounted(() => {
  calcTableHeight();
  window.addEventListener('resize', calcTableHeight);
  // 受限角色（店长/总监）默认选中本部门，首屏即按本部门查询
  queryParams.deptId = defaultDeptId();
  getList();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', calcTableHeight);
});
</script>

<style scoped>
.performance-rank-page {
  padding: 0;
}

.page-card {
  border: none;
}

.page-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
}

.empty-wrap {
  display: flex;
  justify-content: center;
  padding: 40px 0;
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.amount-red {
  color: #f56c6c;
  font-weight: 500;
}

.amount-gray {
  color: #909399;
}
</style>
