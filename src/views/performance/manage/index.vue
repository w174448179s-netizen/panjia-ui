<template>
  <div class="performance-manage-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件 -->
      <el-form class="filter-form" :inline="true" :model="queryParams">
        <el-form-item label="期间">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            :clearable="false"
            style="width: 150px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/店组">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' }"
            value-key="deptId"
            node-key="deptId"
            placeholder="全部门店/店组"
            clearable
            check-strictly
            style="width: 210px"
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select
            v-model="queryParams.bizType"
            placeholder="全部类型"
            clearable
            style="width: 130px"
            @change="handleQuery"
          >
            <el-option v-for="t in bizTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="结算状态">
          <el-select
            v-model="queryParams.settled"
            placeholder="全部"
            clearable
            style="width: 120px"
            @change="handleQuery"
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

      <!-- 双 Tab：新签业绩（当月应收） / 结佣业绩（当月实收） -->
      <el-tabs v-model="activeTab" class="fact-tabs" @tab-change="onTabChange">
        <el-tab-pane label="新签业绩（当月应收）" name="PERF_EXPECT" />
        <el-tab-pane label="结佣业绩（当月实收）" name="PERF_REAL" />
      </el-tabs>

      <!-- 汇总条 + 树操作 -->
      <div class="summary-bar">
        <div class="summary-left">
          <el-input
            v-model="keyword"
            placeholder="搜索签约人 / 合同号 / 房源地址 / 角色"
            clearable
            :prefix-icon="Search"
            class="keyword-input"
          />
          <span class="summary-text">
            共 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.contractCount }}</b> 个合同 ·
            <b>{{ summary.detailCount }}</b> 条明细 ·
            未结算 <b class="unsettled">{{ summary.unsettledCount }}</b> 条
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">{{ amountLabel }}合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
          <el-button link type="primary" @click="expandAll">全部展开</el-button>
          <el-button link type="primary" @click="collapseAll">全部收起</el-button>
        </div>
      </div>

      <!-- 树表：人 → 合同 → 明细 -->
      <el-table
        border
        class="data-table"
        :data="treeData"
        row-key="id"
        :tree-props="{ children: 'children' }"
        :expand-row-keys="expandedKeys"
        :row-class-name="rowClassName"
        @expand-change="onExpandChange"
      >
        <el-table-column label="签约/认购日期" align="center" width="120">
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ scope.row.businessDate || '—' }}</span>
            <span v-else-if="scope.row.level === 'contract'">{{ scope.row.businessDate || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同号" align="center" width="150" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level === 'contract'" class="contract-no">{{ scope.row.contractNo }}</span>
            <span v-else-if="scope.row.level === 'detail'">{{ scope.row.contractNo || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="100">
          <template #default="scope">
            <el-tag v-if="scope.row.level !== 'person' && scope.row.bizType" size="small" type="info" effect="plain">
              {{ scope.row.bizType }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="房源地址" prop="propertyAddress" min-width="200" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.propertyAddress || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="签约人" align="center" width="120">
          <template #default="scope">
            <span v-if="scope.row.level === 'person'" class="person-name">
              {{ scope.row.employeeName }}
              <em class="person-meta">{{ scope.row.children?.length }}合同/{{ scope.row.detailCount }}条</em>
            </span>
            <span v-else>{{ scope.row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="店组" align="center" width="170" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.groupName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="门店" align="center" width="150" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.storeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" width="130" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ scope.row.roleType || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ formatRatio(scope.row.shareRatio) }}</span>
          </template>
        </el-table-column>
        <el-table-column :label="amountLabel" align="right" width="130">
          <template #default="scope">
            <span class="amount" :class="`amount-${scope.row.level}`">{{ formatAmount(scope.row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="是否结算" align="center" width="90">
          <template #default="scope">
            <el-tag v-if="scope.row.level === 'detail'" :type="scope.row.settled ? 'success' : 'info'" size="small" effect="light">
              {{ scope.row.settled ? '已结算' : '未结算' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="结算日期" align="center" width="110">
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ formatDate(scope.row.settleDate) }}</span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无业绩数据' : '请选择期间查询业绩'" />
        </template>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue';
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
const expandedKeys = ref<string[]>([]);
const keyword = ref('');

// ==================== 工具 ====================
const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 角色占比：库内 0.0500 → 5%
const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

const formatDate = (val?: string | null): string => {
  if (!val) return '—';
  return val.length >= 10 ? val.substring(0, 10) : val;
};

// ==================== 关键字过滤（前端实时过滤） ====================
const filteredRows = computed<PerformanceManageRow[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  if (!kw) return flatRows.value;
  return flatRows.value.filter((r) =>
    [r.employeeName, r.contractNo, r.propertyAddress, r.roleType, r.groupName, r.storeName]
      .some((v) => v && v.toLowerCase().includes(kw))
  );
});

// 类型下拉项（取当前数据中的类型集合）
const bizTypeOptions = computed(() =>
  Array.from(new Set(flatRows.value.map((r) => r.bizType).filter(Boolean) as string[])).sort()
);

interface TreeNode {
  id: string;
  level: 'person' | 'contract' | 'detail';
  employeeId?: string;
  employeeName?: string;
  contractNo?: string;
  businessDate?: string;
  bizType?: string;
  propertyAddress?: string;
  groupName?: string;
  storeName?: string;
  roleType?: string;
  shareRatio?: number | string;
  amount: number;
  settled?: boolean;
  settleDate?: string;
  detailCount: number;
  children?: TreeNode[];
  [key: string]: unknown;
}

/**
 * 把扁平明细组装成「人 → 合同 → 明细」三级树。
 * - person：签约人维度汇总
 * - contract：同一人同一合同汇总（合同号/类型/地址/店组/门店取该组首行）
 * - detail：角色明细行，12 列完整展示
 */
const treeData = computed<TreeNode[]>(() => {
  const rows = filteredRows.value;
  const empMap = new Map<string, TreeNode>();

  for (const row of rows) {
    const empKey = String(row.employeeId);
    let person = empMap.get(empKey);
    if (!person) {
      person = {
        id: `p_${empKey}`,
        level: 'person',
        employeeId: empKey,
        employeeName: row.employeeName || '未知',
        amount: 0,
        detailCount: 0,
        children: []
      };
      empMap.set(empKey, person);
    }
    person.amount += num(row.amount);
    person.detailCount += 1;

    const contractKey = row.contractNo || '(无合同号)';
    let contract = person.children!.find((c) => c.contractNo === contractKey);
    if (!contract) {
      contract = {
        id: `c_${empKey}_${contractKey}`,
        level: 'contract',
        employeeName: row.employeeName,
        contractNo: contractKey,
        businessDate: row.businessDate,
        bizType: row.bizType,
        propertyAddress: row.propertyAddress,
        groupName: row.groupName,
        storeName: row.storeName,
        amount: 0,
        detailCount: 0,
        children: []
      };
      person.children!.push(contract);
    }
    contract.amount += num(row.amount);
    contract.detailCount += 1;
    // 合同层日期取最早签约日
    if (row.businessDate && (!contract.businessDate || row.businessDate < contract.businessDate)) {
      contract.businessDate = row.businessDate;
    }

    contract.children!.push({ ...row, id: `d_${row.id}`, level: 'detail', amount: num(row.amount), detailCount: 1 });
  }

  return Array.from(empMap.values());
});

// ==================== 汇总 ====================
const summary = computed(() => {
  let contractCount = 0;
  let unsettledCount = 0;
  let totalAmount = 0;
  for (const p of treeData.value) {
    contractCount += p.children?.length ?? 0;
    totalAmount += num(p.amount);
  }
  for (const r of filteredRows.value) {
    if (!r.settled) unsettledCount += 1;
  }
  return {
    employeeCount: treeData.value.length,
    contractCount,
    detailCount: filteredRows.value.length,
    unsettledCount,
    totalAmount
  };
});

// ==================== 展开控制 ====================
const allExpandKeys = (): string[] => {
  const keys: string[] = [];
  for (const p of treeData.value) {
    keys.push(p.id);
    for (const c of p.children ?? []) keys.push(c.id);
  }
  return keys;
};

const expandAll = () => {
  expandedKeys.value = allExpandKeys();
};

const collapseAll = () => {
  expandedKeys.value = [];
};

const onExpandChange = (_row: TreeNode, expandedRows: TreeNode[]) => {
  expandedKeys.value = expandedRows.map((r) => r.id);
};

// 搜索关键字时自动展开全部，清空后恢复只展开人层
watch(keyword, (v) => {
  expandedKeys.value = v.trim() ? allExpandKeys() : treeData.value.map((p) => p.id);
});

// ==================== 加载 ====================
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
    flatRows.value = [];
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
    // 默认展开第一层（人）
    expandedKeys.value = treeData.value.map((p) => p.id);
  } finally {
    loading.value = false;
  }
};

const onTabChange = () => {
  getList();
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  queryParams.deptId = undefined;
  queryParams.bizType = '';
  queryParams.settled = undefined;
  keyword.value = '';
  getList();
};

const rowClassName = ({ row }: { row: TreeNode }) => `row-${row.level}`;

// 初始化：默认选中最新有数据的期间并加载
onMounted(async () => {
  await loadDeptTree();
  try {
    const res = await performanceApi.listManagePeriods();
    const periods = res.data ?? [];
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    queryParams.period = periods.includes(current) ? current : (periods[0] ?? current);
  } catch {
    const now = new Date();
    queryParams.period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  await getList();
});
</script>

<style lang="scss" scoped>
.performance-manage-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.filter-form {
  margin-bottom: 4px;
}

.fact-tabs {
  :deep(.el-tabs__header) {
    margin-bottom: 10px;
  }
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  margin-bottom: 10px;
  background: var(--el-fill-color-light);
  border-radius: 8px;
  font-size: 13px;
  color: var(--el-text-color-regular);

  .summary-left {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .summary-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .keyword-input {
    width: 260px;
  }

  b {
    color: var(--el-text-color-primary);
    font-weight: 600;
    margin: 0 2px;
  }

  .unsettled {
    color: var(--el-color-warning);
  }

  .summary-amount b {
    color: var(--el-color-primary);
    font-size: 16px;
  }
}

.data-table {
  width: 100%;

  // 人层：浅蓝底加粗，突出第一维度
  :deep(.row-person) {
    background: var(--el-color-primary-light-9);

    td {
      background: var(--el-color-primary-light-9) !important;
      font-weight: 600;
    }
  }

  // 合同层：斑马灰，第二维度
  :deep(.row-contract) td {
    background: var(--el-fill-color-lighter) !important;
  }

  .person-name {
    display: inline-flex;
    align-items: baseline;
    gap: 6px;
    color: var(--el-color-primary);
    font-weight: 600;

    .person-meta {
      font-style: normal;
      font-size: 11px;
      font-weight: 400;
      color: var(--el-text-color-secondary);
    }
  }

  .contract-no {
    font-weight: 600;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .amount-person {
    font-size: 15px;
    font-weight: 700;
    color: var(--el-color-primary);
  }

  .amount-contract {
    font-weight: 600;
    color: var(--el-text-color-primary);
  }

  .amount-detail {
    color: var(--el-color-danger-light-3);
  }
}
</style>
