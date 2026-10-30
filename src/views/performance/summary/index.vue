<template>
  <div class="performance-summary-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="统计维度" prop="periodType">
            <el-radio-group v-model="queryParams.periodType" @change="handleQuery">
              <el-radio-button label="MONTH">按月</el-radio-button>
              <el-radio-button label="QUARTER">按季</el-radio-button>
              <el-radio-button label="YEAR">按年</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="年份" prop="year">
            <el-date-picker
              v-model="queryParams.year"
              type="year"
              value-format="YYYY"
              placeholder="选择年份"
              style="width: 120px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item v-if="queryParams.periodType === 'QUARTER'" label="季度" prop="quarter">
            <el-select
              v-model="queryParams.quarter"
              placeholder="全部季度"
              clearable
              style="width: 120px"
              @change="handleQuery"
            >
              <el-option :value="1" label="Q1" />
              <el-option :value="2" label="Q2" />
              <el-option :value="3" label="Q3" />
              <el-option :value="4" label="Q4" />
            </el-select>
          </el-form-item>
          <el-form-item v-if="!isAgent" label="门店/组别" prop="deptId">
            <PanjiaDeptSelect
              v-model="queryParams.deptId"
              :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
              :clearable="!deptLocked"
              width="200px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item v-if="!isAgent" label="员工" prop="employeeId">
            <EmployeeSelect
              v-model="queryParams.employeeId"
              :dept-id="queryParams.deptId"
              width="230px"
              placeholder="姓名/工号搜索"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item label="业务类型" prop="bizType">
            <el-input
              v-model.trim="queryParams.bizType"
              placeholder="业务类型"
              clearable
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
          <el-table-column label="期间" align="center" prop="period" width="120" />
          <el-table-column label="员工姓名" align="center" prop="employeeName" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.employeeName || '—' }}</template>
          </el-table-column>
          <el-table-column label="工号" align="center" prop="employeeCode" width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.employeeCode || '—' }}</template>
          </el-table-column>
          <el-table-column label="部门" align="center" prop="deptName" min-width="150" show-overflow-tooltip>
            <template #default="{ row }">{{ row.deptName || '—' }}</template>
          </el-table-column>
          <el-table-column label="合同数" align="center" prop="contractCount" width="90" />
          <el-table-column label="新签业绩金额" align="right" prop="totalAmount" min-width="140">
            <template #default="{ row }">
              <span class="amount-red">{{ formatMoney(row.totalAmount) }}</span>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && tableData.length === 0" class="empty-wrap">
          <el-empty description="暂无业绩数据" />
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
import type { PerformanceSummaryRow } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import { useUserStore } from '@/store/modules/user';
import { useDeptScope } from '@/hooks/useDeptScope';

defineOptions({ name: 'PerformanceSummary' });

const userStore = useUserStore();
/** 经纪人：本人口径（后端强制按本人 employeeId 过滤），不展示门店/组别筛选 */
const isAgent = computed(() => userStore.roles.includes('agent'));

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
  periodType: 'MONTH',
  year: new Date().getFullYear() + '',
  quarter: undefined as number | undefined,
  deptId: undefined as string | undefined,
  employeeId: undefined as string | undefined,
  bizType: undefined as string | undefined,
});

const loading = ref(false);
const tableData = ref<PerformanceSummaryRow[]>([]);
const total = ref(0);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.listSummary({
      periodType: queryParams.periodType,
      year: queryParams.year,
      quarter: queryParams.quarter,
      // 经纪人走后端本人 employeeId 口径，不传部门/员工筛选
      deptId: isAgent.value ? undefined : queryParams.deptId,
      employeeId: isAgent.value ? undefined : queryParams.employeeId,
      bizType: queryParams.bizType,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    tableData.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e) {
    console.error('[summary] 查询失败', e);
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
  // periodType 保持，year 保持当前年
  queryParams.quarter = undefined;
  // 受限角色重置回本部门默认值，不能清空为"全部"
  queryParams.deptId = defaultDeptId();
  queryParams.employeeId = undefined;
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
.performance-summary-page {
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

.amount-ink {
  color: #303133;
  font-weight: 500;
}
</style>
