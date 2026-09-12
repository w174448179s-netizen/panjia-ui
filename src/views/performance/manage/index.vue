<template>
  <div class="performance-manage-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>业绩管理</span>
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
          <el-form-item label="门店/店组" prop="deptId">
            <el-tree-select
              v-model="queryParams.deptId"
              :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' }"
              value-key="deptId"
              node-key="deptId"
              placeholder="全部部门"
              clearable
              check-strictly
              style="width: 220px"
            />
          </el-form-item>
          <el-form-item label="类型" prop="bizType">
            <el-input
              v-model="queryParams.bizType"
              placeholder="业务类型"
              clearable
              style="width: 140px"
            />
          </el-form-item>
          <el-form-item label="结算状态" prop="settled">
            <el-select
              v-model="queryParams.settled"
              placeholder="全部"
              clearable
              style="width: 140px"
            >
              <el-option label="已结算" :value="true" />
              <el-option label="未结算" :value="false" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 双 Tab：新签业绩 / 结佣业绩 -->
        <el-tabs v-model="activeTab" class="fact-tabs" @tab-change="onTabChange">
          <el-tab-pane label="新签业绩（当月应收）" name="PERF_EXPECT" />
          <el-tab-pane label="结佣业绩（当月实收）" name="PERF_REAL" />
        </el-tabs>

        <!-- 汇总条 -->
        <div class="summary-bar">
          <span>共 <b>{{ summary.employeeCount }}</b> 人 / <b>{{ summary.contractCount }}</b> 合同 / <b>{{ summary.detailCount }}</b> 条明细</span>
          <span class="summary-amount">
            {{ amountLabel }}合计：<b>{{ formatAmount(summary.totalAmount) }}</b>
          </span>
        </div>

        <!-- 树表：人 → 合同 → 明细 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="treeData"
          row-key="id"
          :tree-props="{ children: 'children' }"
          :default-expand-all="false"
          :expand-row-keys="expandedKeys"
          @expand-change="onExpandChange"
        >
          <el-table-column label="签约/认购日期" align="center" prop="businessDate" width="120" />
          <el-table-column label="订单号" align="center" prop="orderNo" width="140" show-overflow-tooltip />
          <el-table-column label="合同号" align="center" prop="contractNo" width="140" show-overflow-tooltip />
          <el-table-column label="类型" align="center" prop="bizType" width="100" show-overflow-tooltip />
          <el-table-column label="房源地址" align="center" prop="propertyAddress" min-width="180" show-overflow-tooltip />
          <el-table-column label="签约人" align="center" prop="employeeName" width="100" show-overflow-tooltip />
          <el-table-column label="店组" align="center" prop="groupName" width="110" show-overflow-tooltip />
          <el-table-column label="门店" align="center" prop="storeName" width="120" show-overflow-tooltip />
          <el-table-column label="所属角色" align="center" width="130" show-overflow-tooltip>
            <template #default="scope">
              <span>{{ scope.row.roleName || scope.row.roleType || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" prop="shareRatio" width="100">
            <template #default="scope">
              {{ scope.row.level === 'detail' ? formatPercent(scope.row.shareRatio) : '—' }}
            </template>
          </el-table-column>
          <el-table-column :label="amountLabel" align="center" width="130">
            <template #default="scope">
              <span :class="{ 'amount-highlight': scope.row.level === 'detail' }">
                {{ formatAmount(scope.row.amount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="是否结算" align="center" width="100">
            <template #default="scope">
              <el-tag v-if="scope.row.level === 'detail'" :type="scope.row.settled ? 'success' : 'info'" size="small">
                {{ scope.row.settled ? '已结算' : '未结算' }}
              </el-tag>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="结算日期" align="center" prop="settleDate" width="160" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.settleDate || '—' }}
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && treeData.length === 0" class="empty-wrap">
          <el-empty description="暂无数据" />
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageRow } from '@/api/panjia/performance';
import { listDept } from '@/api/system/dept';
import type { DeptVO } from '@/api/system/dept/types';

// ==================== Tab & 筛选 ====================
const activeTab = ref<'PERF_EXPECT' | 'PERF_REAL'>('PERF_EXPECT');
const amountLabel = computed(() => activeTab.value === 'PERF_EXPECT' ? '新签业绩' : '结佣业绩');

const queryParams = reactive<{
  period: string;
  deptId: string | number | undefined;
  bizType: string;
  settled: boolean | undefined;
}>({
  period: '',
  deptId: undefined,
  bizType: '',
  settled: undefined
});

const deptTreeData = ref<DeptVO[]>([]);

// ==================== 数据 ====================
const loading = ref(false);
const flatRows = ref<PerformanceManageRow[]>([]);
const treeData = ref<any[]>([]);
const expandedKeys = ref<string[]>([]);

const summary = reactive({
  employeeCount: 0,
  contractCount: 0,
  detailCount: 0,
  totalAmount: 0
});

const loadDeptTree = async () => {
  try {
    const res = await listDept();
    deptTreeData.value = (res as any).data ?? [];
  } catch (e) {
    console.error('[performance-manage] 部门树加载失败', e);
  }
};

const getList = async () => {
  if (!queryParams.period) {
    treeData.value = [];
    resetSummary();
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManage({
      period: queryParams.period,
      factType: activeTab.value,
      deptId: queryParams.deptId ? String(queryParams.deptId) : undefined,
      bizType: queryParams.bizType || undefined,
      settled: queryParams.settled
    });
    flatRows.value = res.data ?? [];
    buildTree(flatRows.value);
  } finally {
    loading.value = false;
  }
};

const resetSummary = () => {
  summary.employeeCount = 0;
  summary.contractCount = 0;
  summary.detailCount = 0;
  summary.totalAmount = 0;
};

/**
 * 把扁平明细组装成「人 → 合同 → 明细」三级树。
 * - person 节点：汇总该员工全部明细金额
 * - contract 节点：汇总该员工某合同下全部明细金额
 * - detail 节点：原始明细行
 */
const buildTree = (rows: PerformanceManageRow[]) => {
  resetSummary();
  summary.detailCount = rows.length;

  const empMap = new Map<string, any>();
  for (const row of rows) {
    const empKey = String(row.employeeId);
    if (!empMap.has(empKey)) {
      empMap.set(empKey, {
        id: `p_${empKey}`,
        level: 'person',
        employeeId: row.employeeId,
        employeeName: row.employeeName || '未知',
        employeeCode: row.employeeCode,
        amount: 0,
        detailCount: 0,
        children: [] as any[]
      });
    }
    const person = empMap.get(empKey);
    person.amount = num(person.amount) + num(row.amount);
    person.detailCount += 1;

    // 合同分组：合同号可能为空，统一用 (无合同号) 兜底
    const contractKey = row.contractNo || '(无合同号)';
    let contract = person.children.find((c: any) => c.contractNo === contractKey);
    if (!contract) {
      contract = {
        id: `c_${empKey}_${contractKey}`,
        level: 'contract',
        employeeId: row.employeeId,
        employeeName: row.employeeName,
        contractNo: contractKey,
        storeName: row.storeName,
        amount: 0,
        detailCount: 0,
        children: [] as any[]
      };
      person.children.push(contract);
    }
    contract.amount = num(contract.amount) + num(row.amount);
    contract.detailCount += 1;

    contract.children.push({
      ...row,
      id: `d_${row.id}`,
      level: 'detail'
    });
  }

  treeData.value = Array.from(empMap.values());
  summary.employeeCount = empMap.size;
  summary.contractCount = treeData.value.reduce(
    (acc, p) => acc + (p.children?.length ?? 0), 0
  );
  summary.totalAmount = treeData.value.reduce(
    (acc, p) => acc + num(p.amount), 0
  );

  // 默认展开所有员工节点（第一层）
  expandedKeys.value = treeData.value.map((p) => p.id);
};

const onExpandChange = (_row: any, expandedRows: any[]) => {
  expandedKeys.value = expandedRows.map((r) => r.id);
};

const onTabChange = () => {
  getList();
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  queryParams.period = '';
  queryParams.deptId = undefined;
  queryParams.bizType = '';
  queryParams.settled = undefined;
  treeData.value = [];
  resetSummary();
};

// ==================== 工具 ====================
// 后端把 BigDecimal 序列化成字符串，统一 Number() 归一
const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toFixed(2);
};

const formatPercent = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : (n * 100).toFixed(2) + '%';
};

onMounted(() => {
  loadDeptTree();
});
</script>

<style lang="scss" scoped>
.performance-manage-page {
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

  .fact-tabs {
    :deep(.el-tabs__header) {
      margin-bottom: 12px;
    }
  }

  .summary-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 16px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    font-size: 13px;
    color: var(--el-text-color-regular);

    b {
      color: var(--el-text-color-primary);
      margin: 0 2px;
    }

    .summary-amount b {
      color: var(--el-color-primary);
      font-size: 15px;
    }
  }

  .data-table {
    width: 100%;
  }

  .amount-highlight {
    color: var(--el-color-primary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .empty-wrap {
    padding: 40px 0;
  }
}
</style>
