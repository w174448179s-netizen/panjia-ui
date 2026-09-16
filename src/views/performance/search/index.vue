<template>
  <div class="performance-search-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="期间" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="全部期间"
              clearable
              style="width: 160px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item label="门店/组别" prop="deptId">
            <el-tree-select
              v-model="queryParams.deptId"
              :data="deptTreeData"
              :props="{ value: 'id', label: 'label', children: 'children' }"
              node-key="id"
              placeholder="全部门店"
              clearable
              check-strictly
              style="width: 200px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item label="关键字" prop="keyword">
            <el-input
              v-model.trim="queryParams.keyword"
              placeholder="合同号/订单号/物业地址"
              clearable
              style="width: 260px"
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
          <el-table-column label="合同号" align="center" min-width="140" show-overflow-tooltip>
            <template #default="{ row }">
              <span class="contract-no">{{ row.contractNo || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="订单号" align="center" prop="orderNo" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row.orderNo || '—' }}</template>
          </el-table-column>
          <el-table-column label="类型" align="center" prop="bizType" width="100" show-overflow-tooltip>
            <template #default="{ row }">{{ row.bizType || '—' }}</template>
          </el-table-column>
          <el-table-column label="物业地址" align="center" min-width="200" show-overflow-tooltip>
            <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
          </el-table-column>
          <el-table-column label="期间" align="center" prop="period" width="90" />
          <el-table-column label="签约日期" align="center" width="170" show-overflow-tooltip>
            <template #default="{ row }">{{ formatDate(row.signDate) }}</template>
          </el-table-column>

          <el-table-column label="新签业绩" align="right" width="130">
            <template #default="{ row }">
              <span :class="{ 'amount-gray': row.expectAmount === 0 }">{{ formatMoney(row.expectAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="130">
            <template #default="{ row }">
              <span class="amount-red">{{ formatMoney(row.realAmount) }}</span>
            </template>
          </el-table-column>

          <el-table-column label="调整" align="center" width="80">
            <template #default="{ row }">
              <el-tag v-if="row.hasAdjust" type="warning" size="small">已调整</el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="调整后新签" align="right" width="130">
            <template #default="{ row }">
              <span v-if="row.hasAdjust" class="amount-red">{{ formatMoney(row.adjustedAmount) }}</span>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="调整单状态" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.adjustStatus" :type="adjustStatusTagType(row.adjustStatus)" size="small">
                {{ adjustStatusMap[row.adjustStatus] ?? row.adjustStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="实收审批" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.receivedStatus" :type="receivedStatusTagType(row.receivedStatus)" size="small">
                {{ receivedStatusMap[row.receivedStatus] ?? row.receivedStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收/应收" align="right" width="150">
            <template #default="{ row }">
              <div v-if="row.receivedRealAmount != null">
                <span class="amount-red">{{ formatMoney(row.receivedRealAmount) }}</span>
                <span class="amount-gray"> / {{ formatMoney(row.receivedExpectedAmount) }}</span>
              </div>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="结佣状态" align="center" width="110">
            <template #default="{ row }">
              <el-tag v-if="row.commissionStatus" :type="commissionStatusTagType(row.commissionStatus)" size="small">
                {{ commissionStatusMap[row.commissionStatus] ?? row.commissionStatus }}
              </el-tag>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>
          <el-table-column label="结佣金额" align="right" width="130">
            <template #default="{ row }">
              <span v-if="row.commissionAmount != null" class="amount-red">{{ formatMoney(row.commissionAmount) }}</span>
              <span v-else class="amount-gray">—</span>
            </template>
          </el-table-column>

          <el-table-column label="人数" align="center" prop="employeeCount" width="70" />
          <el-table-column label="明细" align="center" prop="detailCount" width="70" />
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
            :page-sizes="[10, 20, 50, 100]"
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
import type { PerformanceFactSearch } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';

defineOptions({ name: 'PerformanceSearch' });

const tableMaxHeight = ref(580);

const calcTableHeight = () => {
  nextTick(() => {
    tableMaxHeight.value = window.innerHeight - 280;
  });
};

// ==================== 部门树 ====================
const deptTreeData = ref<DeptNode[]>([]);
const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[search] 部门树加载失败', e);
  }
};

// ==================== 筛选 & 分页 ====================
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: undefined as string | undefined,
  deptId: undefined as string | undefined,
  keyword: undefined as string | undefined,
});

const loading = ref(false);
const tableData = ref<PerformanceFactSearch[]>([]);
const total = ref(0);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.searchByContract({
      period: queryParams.period,
      deptId: queryParams.deptId,
      keyword: queryParams.keyword,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    tableData.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e) {
    console.error('[search] 查询失败', e);
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
  queryParams.period = undefined;
  queryParams.deptId = undefined;
  queryParams.keyword = undefined;
  handleQuery();
};

// ==================== 格式化 ====================
const formatMoney = (val?: number | null): string => {
  if (val == null) return '—';
  return `¥${val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// ==================== 状态映射 ====================
type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';

const adjustStatusMap: Record<string, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  EXECUTED: '已执行',
};
const adjustStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'info',
    EXECUTED: 'success',
  };
  return map[status] ?? 'info';
};

const receivedStatusMap: Record<string, string> = {
  DRAFT: '待提交',
  SUBMITTED: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已作废',
};
const receivedStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    DRAFT: 'info',
    SUBMITTED: 'warning',
    APPROVED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'info',
  };
  return map[status] ?? 'info';
};

const commissionStatusMap: Record<string, string> = {
  DRAFT: '待提交',
  SUBMITTED: '审批中',
  APPROVED: '已通过',
  LOCKED: '已锁定',
  REJECTED: '已驳回',
  CANCELLED: '已作废',
};
const commissionStatusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    DRAFT: 'info',
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    LOCKED: 'success',
    REJECTED: 'danger',
    CANCELLED: 'info',
  };
  return map[status] ?? 'info';
};

// ==================== 初始化 ====================
onMounted(() => {
  calcTableHeight();
  window.addEventListener('resize', calcTableHeight);
  loadDeptTree();
  getList();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', calcTableHeight);
});
</script>

<style scoped>
.performance-search-page {
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

.contract-no {
  color: var(--el-color-primary);
  font-weight: 500;
}

.amount-red {
  color: #f56c6c;
  font-weight: 500;
}

.amount-gray {
  color: #909399;
}
</style>
