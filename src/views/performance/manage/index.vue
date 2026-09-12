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
        <el-form-item label="门店/组别">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="全部门店/组别"
            clearable
            check-strictly
            style="width: 210px"
            @change="handleQuery"
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
            placeholder="搜索员工号 / 姓名 / 合同号 / 订单号 / 房源地址 / 角色"
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
          <span class="hint-text">单击行展开/收起</span>
          <span class="summary-amount">{{ amountLabel }}合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
        </div>
      </div>

      <!-- 树表：人 → 合同 → 明细（后端按签约人分页，单击行懒加载展开） -->
      <el-table
        ref="tableRef"
        border
        lazy
        class="data-table"
        :data="personData"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :load="handleLoad"
        :row-class-name="rowClassName"
        @row-click="onRowClick"
      >
        <!-- 以人为维度：员工号 → 姓名 → 金额 → 合同号 → 订单号 → 其余信息 -->
        <el-table-column label="员工号" align="center" width="110">
          <template #default="scope">
            <span v-if="scope.row.level === 'person'" class="person-code">{{ scope.row.employeeCode || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="姓名" align="center" width="150">
          <template #default="scope">
            <span v-if="scope.row.level === 'person'" class="person-name">
              {{ scope.row.employeeName }}
              <em class="person-meta">{{ scope.row.contractCount }}合同/{{ scope.row.detailCount }}条</em>
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="amountLabel" align="right" width="130">
          <template #default="scope">
            <span class="amount" :class="`amount-${scope.row.level}`">{{ formatAmount(scope.row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="合同号" align="center" width="160" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level === 'contract'" class="contract-no">{{ scope.row.contractNo }}</span>
            <span v-else-if="scope.row.level === 'detail'">{{ scope.row.contractNo || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="订单号" align="center" width="160" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.orderNo || '—' }}</span>
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
        <el-table-column label="门店/组别" align="center" width="200" show-overflow-tooltip>
          <template #default="scope">
            <span>{{ scope.row.deptPath || '—' }}</span>
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
        <el-table-column label="签约/认购日期" align="center" width="120">
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.businessDate || '—' }}</span>
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

      <!-- 按签约人维度分页 -->
      <div class="pager-bar">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalEmployees"
          :page-sizes="[10, 20, 50]"
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageEmployee, PerformanceManageRow } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';

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

const deptTreeData = ref<DeptNode[]>([]);

// ==================== 数据（后端按签约人分页，明细懒加载） ====================
const loading = ref(false);
const personData = ref<TreeNode[]>([]);         // 当前页签约人聚合行（树表只渲染人层）
const totalEmployees = ref(0);                    // 符合条件的签约人总数
const keyword = ref('');
const tableRef = ref<ElTableInstance>();

// 已懒加载过的员工业绩明细缓存：employeeId → 明细行（翻页/切条件时清空）
const detailCache = ref(new Map<string, PerformanceManageRow[]>());

// 人维度分页参数
const pageNum = ref(1);
const pageSize = ref(20);

// 跨页全局汇总（后端返回，不随分页变化）
const emptySummary = () => ({ employeeCount: 0, contractCount: 0, detailCount: 0, unsettledCount: 0, totalAmount: 0 });
const summary = ref(emptySummary());

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

// 角色占比：角色人信息中的业绩比例，库内 0.0500 → 5%
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

// ==================== 关键字搜索（防抖，下推后端） ====================
// 类型下拉项（后端按当前期间/口径返回的业务类型集合）
const bizTypeOptions = ref<string[]>([]);

let keywordTimer: ReturnType<typeof setTimeout> | undefined;
// 重置按钮主动清空关键字时抑制防抖回调，避免重复请求
let suppressKeywordWatch = false;
watch(keyword, () => {
  if (suppressKeywordWatch) return;
  clearTimeout(keywordTimer);
  keywordTimer = setTimeout(() => {
    pageNum.value = 1;
    getList();
  }, 350);
});

interface TreeNode {
  id: string;
  level: 'person' | 'contract' | 'detail';
  employeeId?: string;
  employeeCode?: string;
  employeeName?: string;
  contractNo?: string;
  orderNo?: string;
  businessDate?: string;
  bizType?: string;
  propertyAddress?: string;
  deptPath?: string;
  roleType?: string;
  shareRatio?: number | string;
  amount: number;
  settled?: boolean;
  settleDate?: string;
  contractCount?: number;          // 人层：后端聚合的合同数
  detailCount: number;
  hasChildren?: boolean;           // el-table lazy：是否可展开
  children?: TreeNode[];           // 懒加载挂载点（人→合同 / 合同→明细）
  detailNodes?: TreeNode[];        // 合同层懒加载的明细缓存
  [key: string]: unknown;
}

/**
 * 把单个员工的扁平明细组装成「合同 → 明细」两级节点（人节点懒加载时调用）。
 * - contract：同一人同一合同汇总（合同号/订单号/类型/地址/门店组别取该组首行），
 *   明细节点挂在 detailNodes，展开合同行时由 el-table lazy resolve
 * - detail：角色明细行
 */
const buildContractNodes = (empKey: string, rows: PerformanceManageRow[]): TreeNode[] => {
  const contractMap = new Map<string, TreeNode>();

  for (const row of rows) {
    const contractKey = row.contractNo || '(无合同号)';
    let contract = contractMap.get(contractKey);
    if (!contract) {
      contract = {
        id: `c_${empKey}_${contractKey}`,
        level: 'contract',
        employeeName: row.employeeName,
        contractNo: contractKey,
        orderNo: row.orderNo,
        businessDate: row.businessDate,
        bizType: row.bizType,
        propertyAddress: row.propertyAddress,
        deptPath: row.deptPath,
        amount: 0,
        detailCount: 0,
        hasChildren: true,
        detailNodes: []
      };
      contractMap.set(contractKey, contract);
    }
    contract.amount += num(row.amount);
    contract.detailCount += 1;
    // 合同层日期取最早签约日；同一合同多个订单号时合并展示
    if (row.businessDate && (!contract.businessDate || row.businessDate < contract.businessDate)) {
      contract.businessDate = row.businessDate;
    }
    if (row.orderNo) {
      const orderNos = (contract.orderNo ?? '').split(' / ').filter(Boolean);
      if (!orderNos.includes(row.orderNo)) {
        orderNos.push(row.orderNo);
        contract.orderNo = orderNos.join(' / ');
      }
    }

    contract.detailNodes!.push({ ...row, id: `d_${row.id}`, level: 'detail', amount: num(row.amount), detailCount: 1 });
  }

  return Array.from(contractMap.values());
};

// ==================== 明细懒加载 ====================
// 明细查询的公共筛选条件（与人分页接口保持一致）
const baseDetailParams = () => ({
  period: queryParams.period,
  factType: activeTab.value,
  deptId: queryParams.deptId ? String(queryParams.deptId) : undefined,
  bizType: queryParams.bizType || undefined,
  settled: queryParams.settled,
  keyword: keyword.value.trim() || undefined
});

// 批量拉取员工明细并写入缓存
const batchLoadDetails = async (ids: string[]) => {
  if (!ids.length) return;
  const res = await performanceApi.listManageDetails({ ...baseDetailParams(), employeeIds: ids.join(',') });
  const all: PerformanceManageRow[] = res.data ?? [];
  for (const id of ids) {
    detailCache.value.set(id, all.filter((r) => String(r.employeeId) === id));
  }
};

const ensureDetailCached = async (ids: string[]) => {
  const missing = Array.from(new Set(ids)).filter((id) => !detailCache.value.has(id));
  if (missing.length) await batchLoadDetails(missing);
};

// 用缓存明细构建合同节点并挂到人节点下（幂等：已构建直接复用）
const attachContracts = (person: TreeNode): TreeNode[] => {
  if (person.children?.length) return person.children;
  const contracts = buildContractNodes(
    person.employeeId!,
    detailCache.value.get(person.employeeId!) ?? []
  );
  person.children = contracts;
  return contracts;
};

// el-table lazy 回调：展开人 → 查明细挂合同层；展开合同 → 取已缓存明细
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleLoad = async (row: TreeNode, _treeNode: any, resolve: (data: TreeNode[]) => void) => {
  try {
    if (row.level === 'person' && row.employeeId) {
      await ensureDetailCached([row.employeeId]);
      resolve(attachContracts(row));
    } else if (row.level === 'contract') {
      resolve(row.detailNodes ?? []);
    } else {
      resolve([]);
    }
  } catch (e) {
    console.error('[performance-manage] 明细懒加载失败', e);
    resolve([]);
  }
};

// ==================== 展开控制 ====================
// 单击人/合同行切换展开（明细行是叶子，忽略）
const onRowClick = (row: TreeNode) => {
  if (row.level === 'person' || row.level === 'contract') {
    tableRef.value?.toggleRowExpansion(row);
  }
};

// ==================== 加载 ====================
// 部门树与人员页同源（/people/employee/deptTree：大区→门店→小组，不含占位根），
// check-strictly 允许选任意一级；后端按 dept_id = 选中节点 OR 祖级链包含该节点过滤（含下级）
const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[performance-manage] 部门树加载失败', e);
  }
};

const getList = async () => {
  if (!queryParams.period) {
    personData.value = [];
    totalEmployees.value = 0;
    summary.value = emptySummary();
    bizTypeOptions.value = [];
    detailCache.value = new Map();
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManage({
      period: queryParams.period,
      factType: activeTab.value,
      deptId: queryParams.deptId ? String(queryParams.deptId) : undefined,
      bizType: queryParams.bizType || undefined,
      settled: queryParams.settled,
      keyword: keyword.value.trim() || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    });
    const page = res.data;
    // 只映射人层聚合行；树表 lazy，合同/明细单击展开时才请求
    personData.value = (page?.rows ?? []).map((e: PerformanceManageEmployee) => ({
      id: `p_${e.employeeId}`,
      level: 'person' as const,
      employeeId: String(e.employeeId),
      employeeCode: e.employeeCode,
      employeeName: e.employeeName || '未知',
      deptPath: e.deptPath,
      amount: num(e.amount),
      contractCount: e.contractCount ?? 0,
      detailCount: e.detailCount ?? 0,
      hasChildren: (e.detailCount ?? 0) > 0
    }));
    totalEmployees.value = page?.total ?? 0;
    summary.value = page?.summary ?? emptySummary();
    bizTypeOptions.value = page?.bizTypes ?? [];
    // 筛选条件已变化，明细缓存作废；新人行默认全部收起
    detailCache.value = new Map();
  } finally {
    loading.value = false;
  }
};

// 分页事件（v-model 已更新页码，这里只触发查询）
const onPageChange = () => getList();
const onSizeChange = () => {
  pageNum.value = 1;
  getList();
};

const onTabChange = () => {
  pageNum.value = 1;
  getList();
};

const handleQuery = () => {
  pageNum.value = 1;
  getList();
};

const resetQuery = () => {
  queryParams.deptId = undefined;
  queryParams.bizType = '';
  queryParams.settled = undefined;
  suppressKeywordWatch = true;
  keyword.value = '';
  pageNum.value = 1;
  nextTick(() => {
    suppressKeywordWatch = false;
    getList();
  });
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

  .hint-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .keyword-input {
    width: 300px;
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

  // 隐藏树表自带的展开箭头图标，单击行展开；懒加载中的转圈图标保留
  :deep(.el-table__expand-icon:not(.is-loading)) {
    display: none;
  }

  // 人层：浅蓝底加粗，突出第一维度；人/合同行可单击
  :deep(.row-person) {
    background: var(--el-color-primary-light-9);
    cursor: pointer;

    td {
      background: var(--el-color-primary-light-9) !important;
      font-weight: 600;
    }
  }

  // 合同层：斑马灰，第二维度
  :deep(.row-contract) {
    cursor: pointer;

    td {
      background: var(--el-fill-color-lighter) !important;
    }
  }

  .person-code {
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-regular);
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

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
