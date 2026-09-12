<template>
  <div class="performance-contract-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件（经纪人无任何查询项，后端强制限定本人业绩） -->
      <el-form v-if="!isBroker" class="filter-form" :inline="true" :model="queryParams">
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

      <!-- 双 Tab：新签业绩 / 结佣业绩 -->
      <el-tabs v-model="activeTab" class="fact-tabs" @tab-change="onTabChange">
        <el-tab-pane label="新签业绩（当月应收）" name="PERF_EXPECT" />
        <el-tab-pane label="结佣业绩（当月实收）" name="PERF_REAL" />
      </el-tabs>

      <!-- 汇总条（经纪人隐藏搜索框，只看统计） -->
      <div class="summary-bar">
        <div class="summary-left">
          <el-input
            v-if="!isBroker"
            v-model="keyword"
            placeholder="搜索合同号 / 订单号 / 房源地址 / 员工号 / 姓名 / 角色"
            clearable
            :prefix-icon="Search"
            class="keyword-input"
          />
          <span class="summary-text">
            共 <b>{{ summary.contractCount }}</b> 个合同 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.detailCount }}</b> 条明细 ·
            未结算 <b class="unsettled">{{ summary.unsettledCount }}</b> 条
          </span>
        </div>
        <div class="summary-right">
          <span class="hint-text">单击行展开/收起</span>
          <span class="summary-amount">{{ amountLabel }}合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
        </div>
      </div>

      <!-- 树表：合同 → 人 → 明细（后端按合同分页，单击行懒加载展开） -->
      <el-table
        ref="tableRef"
        border
        lazy
        class="data-table"
        :data="contractData"
        row-key="id"
        :tree-props="{ children: 'children', hasChildren: 'hasChildren' }"
        :load="handleLoad"
        :row-class-name="rowClassName"
        @row-click="onRowClick"
      >
        <el-table-column label="合同号/订单号" align="center" min-width="170" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <span v-if="scope.row.level === 'contract'" class="contract-no">
              {{ contractOrOrderNo(scope.row) }}
            </span>
            <span v-else-if="scope.row.level === 'person' || scope.row.level === 'detail'">
              {{ contractOrOrderNo(scope.row) || '—' }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="amountLabel" align="right" width="150" fixed="left">
          <template #default="scope">
            <span class="amount" :class="[`amount-${scope.row.level}`, { 'amount-redink': scope.row.level === 'detail' && scope.row.amount < 0 }]">{{ formatAmount(scope.row.amount) }}</span>
            <el-tag v-if="scope.row.level === 'detail' && scope.row.amount < 0" type="danger" size="small" effect="plain" class="redink-tag">红冲</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="100">
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.bizType || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="房源地址" align="left" min-width="180" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.propertyAddress || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="签约/认购日期" align="center" width="120">
          <template #default="scope">
            <span v-if="scope.row.level !== 'person'">{{ scope.row.businessDate || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="姓名" align="center" width="120">
          <template #default="scope">
            <span v-if="scope.row.level === 'person'" class="person-name">
              {{ scope.row.employeeName }}
              <em class="person-meta">{{ scope.row.detailCount }}条</em>
            </span>
          </template>
        </el-table-column>
        <el-table-column label="门店/组别" align="center" min-width="160" show-overflow-tooltip>
          <template #default="scope">
            <span v-if="scope.row.level === 'person' || scope.row.level === 'detail'">{{ scope.row.deptPath || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" width="110">
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ scope.row.roleType || scope.row.roleName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="scope">
            <span v-if="scope.row.level === 'detail'">{{ formatRatio(scope.row.shareRatio) }}</span>
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
        <!-- 操作列：合同级/明细级业绩调整（经纪人无权限，不显示） -->
        <el-table-column v-if="!isBroker" label="操作" align="center" width="100" fixed="right">
          <template #default="scope">
            <el-button
              v-if="scope.row.level === 'contract' || scope.row.level === 'detail'"
              type="primary"
              link
              size="small"
              @click.stop="openAdjustDialog(scope.row)"
            >调整</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无业绩数据' : '请选择期间查询业绩'" />
        </template>
      </el-table>

      <!-- 按合同维度分页 -->
      <div class="pager-bar">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="totalContracts"
          :page-sizes="[10, 20, 50]"
          v-model:current-page="pageNum"
          v-model:page-size="pageSize"
          @current-change="onPageChange"
          @size-change="onSizeChange"
        />
      </div>
    </el-card>

    <!-- 业绩调整弹窗 -->
    <el-dialog
      v-model="adjustDialog.visible"
      :title="adjustDialog.scope === 'CONTRACT' ? '合同业绩调整' : '明细业绩调整'"
      width="480px"
      destroy-on-close
    >
      <el-form
        ref="adjustFormRef"
        :model="adjustForm"
        :rules="adjustRules"
        label-width="90px"
      >
        <el-form-item label="调整范围">
          <el-tag :type="adjustDialog.scope === 'CONTRACT' ? 'warning' : 'info'">
            {{ adjustDialog.scope === 'CONTRACT' ? '合同级（按比例分摊到各明细）' : '明细级（单条调整）' }}
          </el-tag>
        </el-form-item>
        <el-form-item v-if="adjustDialog.scope === 'CONTRACT'" label="合同号">
          <span>{{ adjustDialog.contractNo }}</span>
        </el-form-item>
        <el-form-item label="调整类型">
          <el-select v-model="adjustForm.adjustType" style="width: 100%">
            <el-option label="金额调整" value="AMOUNT" />
            <el-option label="业绩冲销" value="VOID" />
            <el-option label="部门划转" value="TRANSFER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'AMOUNT'" label="调整金额" prop="deltaAmount">
          <el-input-number
            v-model="adjustForm.deltaAmount"
            :precision="2"
            :step="100"
            style="width: 100%"
            placeholder="正数调增，负数调减"
          />
          <div class="form-tip">正数调增业绩，负数调减业绩</div>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'TRANSFER'" label="目标部门">
          <el-tree-select
            v-model="adjustForm.targetDeptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="选择目标部门"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input
            v-model="adjustForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入调整原因（审批必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitting" @click="submitAdjust">提交审批</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { Search } from '@element-plus/icons-vue';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageContract, PerformanceManageRow } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useUserStore } from '@/store/modules/user';

// 经纪人角色无查询项，后端强制限定本人业绩
const userStore = useUserStore();
const isBroker = computed(() => userStore.roles.includes('agent'));

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

// ==================== 数据（后端按合同分页，明细懒加载） ====================
const loading = ref(false);
const contractData = ref<TreeNode[]>([]);      // 当前页合同聚合行
const totalContracts = ref(0);                  // 符合条件的合同总数
const keyword = ref('');
const tableRef = ref<ElTableInstance>();

// 已懒加载过的合同明细缓存：contractNo → 明细行
const detailCache = ref(new Map<string, PerformanceManageRow[]>());

const pageNum = ref(1);
const pageSize = ref(20);

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

// 合同号/订单号合并展示：业务类型为「一手房」时展示订单号，其它展示合同号
const contractOrOrderNo = (row: any): string => {
  if (row.bizType === '一手房') {
    return row.orderNo || row.contractNo || '—';
  }
  return row.contractNo || row.orderNo || '—';
};

// ==================== 关键字搜索（防抖） ====================
const bizTypeOptions = ref<string[]>([]);
let keywordTimer: ReturnType<typeof setTimeout> | undefined;
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
  level: 'contract' | 'person' | 'detail';
  contractNo?: string;
  orderNo?: string;
  bizType?: string;
  propertyAddress?: string;
  businessDate?: string;
  employeeId?: string;
  employeeName?: string;
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  shareRatio?: number | string;
  amount: number;
  settled?: boolean;
  settleDate?: string;
  employeeCount?: number;       // 合同层：涉及人数
  detailCount: number;
  hasChildren?: boolean;
  children?: TreeNode[];
  detailNodes?: TreeNode[];     // 人层懒加载的明细缓存
  [key: string]: unknown;
}

/**
 * 把单个合同的扁平明细组装成「人 → 明细」两级节点（合同节点懒加载时调用）。
 * - person：同一合同下同一员工汇总（姓名/门店组别取首行），明细节点挂在 detailNodes
 * - detail：角色明细行
 */
const buildPersonNodes = (contractKey: string, rows: PerformanceManageRow[]): TreeNode[] => {
  const personMap = new Map<string, TreeNode>();

  for (const row of rows) {
    const personKey = String(row.employeeId || row.employeeName || '(未知)');
    let person = personMap.get(personKey);
    if (!person) {
      person = {
        id: `p_${contractKey}_${personKey}`,
        level: 'person',
        contractNo: row.contractNo,
        orderNo: row.orderNo,
        bizType: row.bizType,
        propertyAddress: row.propertyAddress,
        businessDate: row.businessDate,
        employeeId: String(row.employeeId),
        employeeName: row.employeeName || '未知',
        deptPath: row.deptPath,
        amount: 0,
        detailCount: 0,
        hasChildren: true,
        detailNodes: []
      };
      personMap.set(personKey, person);
    }
    person.amount += num(row.amount);
    person.detailCount += 1;

    person.detailNodes!.push({ ...row, id: `d_${row.id}`, level: 'detail', amount: num(row.amount), detailCount: 1 });
  }

  return Array.from(personMap.values());
};

// ==================== 明细懒加载 ====================
const baseDetailParams = () => ({
  period: queryParams.period,
  factType: activeTab.value,
  deptId: queryParams.deptId ? String(queryParams.deptId) : undefined,
  bizType: queryParams.bizType || undefined,
  settled: queryParams.settled,
  keyword: keyword.value.trim() || undefined
});

const batchLoadDetails = async (nos: string[]) => {
  if (!nos.length) return;
  const res = await performanceApi.listManageContractDetails({ ...baseDetailParams(), contractNos: nos.join(',') });
  const all: PerformanceManageRow[] = res.data ?? [];
  for (const no of nos) {
    detailCache.value.set(no, all.filter((r) => String(r.contractNo) === no));
  }
};

const ensureDetailCached = async (nos: string[]) => {
  const missing = Array.from(new Set(nos)).filter((no) => !detailCache.value.has(no));
  if (missing.length) await batchLoadDetails(missing);
};

const attachPersons = (contract: TreeNode): TreeNode[] => {
  if (contract.children?.length) return contract.children;
  const persons = buildPersonNodes(contract.contractNo!, detailCache.value.get(contract.contractNo!) ?? []);
  contract.children = persons;
  return persons;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleLoad = async (row: TreeNode, _treeNode: any, resolve: (data: TreeNode[]) => void) => {
  try {
    if (row.level === 'contract' && row.contractNo) {
      await ensureDetailCached([row.contractNo]);
      resolve(attachPersons(row));
    } else if (row.level === 'person') {
      resolve(row.detailNodes ?? []);
    } else {
      resolve([]);
    }
  } catch (e) {
    console.error('[performance-contract] 明细懒加载失败', e);
    resolve([]);
  }
};

// ==================== 展开控制 ====================
const onRowClick = (row: TreeNode) => {
  if (row.level === 'contract' || row.level === 'person') {
    tableRef.value?.toggleRowExpansion(row);
  }
};

// ==================== 加载 ====================
const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[performance-contract] 部门树加载失败', e);
  }
};

const getList = async () => {
  if (!queryParams.period) {
    contractData.value = [];
    totalContracts.value = 0;
    summary.value = emptySummary();
    bizTypeOptions.value = [];
    detailCache.value = new Map();
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManageByContract({
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
    contractData.value = (page?.rows ?? []).map((c: PerformanceManageContract) => ({
      id: `c_${c.contractNo}`,
      level: 'contract' as const,
      contractNo: c.contractNo,
      orderNo: c.orderNo,
      bizType: c.bizType,
      propertyAddress: c.propertyAddress,
      businessDate: c.businessDate,
      amount: num(c.amount),
      employeeCount: c.employeeCount ?? 0,
      detailCount: c.detailCount ?? 0,
      hasChildren: (c.detailCount ?? 0) > 0
    }));
    totalContracts.value = page?.total ?? 0;
    summary.value = page?.summary ?? emptySummary();
    bizTypeOptions.value = page?.bizTypes ?? [];
    detailCache.value = new Map();
  } finally {
    loading.value = false;
  }
};

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

// ==================== 业绩调整弹窗 ====================
const adjustFormRef = ref();
const adjustSubmitting = ref(false);
const adjustDialog = reactive({
  visible: false,
  scope: 'DETAIL' as 'CONTRACT' | 'DETAIL',
  contractNo: '',
  factId: '',
  employeeId: '',
  deptId: '',
});
const adjustForm = reactive({
  adjustType: 'AMOUNT',
  deltaAmount: undefined as number | undefined,
  targetDeptId: undefined as string | undefined,
  reason: '',
});
const adjustRules = {
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  deltaAmount: [
    {
      validator: (_rule: unknown, value: number | undefined, callback: (err?: Error) => void) => {
        if (adjustForm.adjustType === 'AMOUNT' && (value === undefined || value === null)) {
          callback(new Error('请输入调整金额'));
        } else {
          callback();
        }
      },
      trigger: 'blur',
    },
  ],
  targetDeptId: [
    {
      validator: (_rule: unknown, value: string | undefined, callback: (err?: Error) => void) => {
        if (adjustForm.adjustType === 'TRANSFER' && !value) {
          callback(new Error('请选择目标部门'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
};

const openAdjustDialog = (row: TreeNode) => {
  adjustDialog.scope = row.level === 'contract' ? 'CONTRACT' : 'DETAIL';
  adjustDialog.contractNo = row.contractNo || '';
  // 明细行 id 格式为 d_${factId}
  adjustDialog.factId = row.level === 'detail' ? String(row.id).replace(/^d_/, '') : '';
  adjustDialog.employeeId = row.employeeId || '';
  adjustDialog.deptId = '';
  adjustForm.adjustType = 'AMOUNT';
  adjustForm.deltaAmount = undefined;
  adjustForm.targetDeptId = undefined;
  adjustForm.reason = '';
  adjustDialog.visible = true;
};

const submitAdjust = async () => {
  await adjustFormRef.value?.validate();
  adjustSubmitting.value = true;
  try {
    await performanceApi.createAdjust({
      factId: adjustDialog.scope === 'DETAIL' ? adjustDialog.factId : undefined,
      period: queryParams.period,
      employeeId: adjustDialog.employeeId,
      deptId: adjustDialog.deptId || '0',
      adjustType: adjustForm.adjustType,
      adjustScope: adjustDialog.scope,
      contractNo: adjustDialog.scope === 'CONTRACT' ? adjustDialog.contractNo : undefined,
      factType: activeTab.value,
      deltaAmount: adjustForm.deltaAmount,
      targetDeptId: adjustForm.targetDeptId,
      reason: adjustForm.reason.trim(),
    });
    ElMessage.success('调整单已提交审批');
    adjustDialog.visible = false;
    getList();
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    adjustSubmitting.value = false;
  }
};

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
.performance-contract-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
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
  padding: 8px 4px 12px;
  flex-wrap: wrap;

  .summary-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    flex-wrap: wrap;
  }

  .summary-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .keyword-input {
    width: 320px;
  }

  .summary-text {
    font-size: 13px;
    color: #606266;

    b {
      color: #303133;
      margin: 0 2px;
    }

    .unsettled {
      color: #e6a23c;
    }
  }

  .hint-text {
    font-size: 12px;
    color: #909399;
  }

  .summary-amount {
    font-size: 13px;
    color: #606266;

    b {
      color: #f56c6c;
      font-size: 15px;
      margin-left: 4px;
    }
  }
}

.data-table {
  width: 100%;

  :deep(.el-table__expand-icon) {
    display: none;
  }

  .contract-no {
    font-weight: 600;
    color: #409eff;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-contract {
    color: #f56c6c;
  }
  .amount-person {
    color: #67c23a;
  }
  .amount-detail {
    color: #909399;
    font-weight: 400;
  }
  .amount-redink {
    color: #f56c6c;
    font-weight: 600;
  }
  .redink-tag {
    margin-left: 4px;
    transform: scale(0.85);
    transform-origin: left center;
  }

  .person-name {
    font-weight: 600;

    .person-meta {
      font-style: normal;
      font-weight: 400;
      font-size: 12px;
      color: #909399;
      margin-left: 4px;
    }
  }

  :deep(.row-contract) {
    background-color: #f5f7fa !important;
    cursor: pointer;
  }
  :deep(.row-person) {
    background-color: #fafafa !important;
    cursor: pointer;
  }
  :deep(.row-detail) {
    background-color: #ffffff !important;
  }
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
