<template>
  <div class="performance-contract-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件（经纪人无任何查询项，后端强制限定本人业绩） -->
      <el-form v-if="!isBroker" class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
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
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <div class="summary-left">
          <el-input
            v-if="!isBroker"
            v-model="keyword"
            placeholder="搜索合同号 / 订单号 / 房源地址 / 员工号 / 姓名 / 角色"
            clearable
            :prefix-icon="Search"
            class="keyword-input"
            @keydown.enter.prevent="handleQuery"
          />
          <span class="summary-text">
            共 <b>{{ summary.contractCount }}</b> 个合同 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.detailCount }}</b> 条明细
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">{{ amountLabel }}合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
        </div>
      </div>

      <!-- 合同列表（扁平表格，点击合同号跳转明细页） -->
      <el-table border class="data-table" :data="contractData">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="scope">
            <el-button type="primary" link class="contract-link" @click="goDetail(scope.row)">
              {{ contractOrOrderNo(scope.row) }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column :label="amountLabel" align="right" width="100" fixed="left">
          <template #default="scope">
            <span class="amount amount-contract">{{ formatAmount(scope.row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="100">
          <template #default="scope">{{ scope.row.bizType || '—' }}</template>
        </el-table-column>
        <el-table-column label="房源地址" align="left" min-width="200" show-overflow-tooltip>
          <template #default="scope">{{ scope.row.propertyAddress || '—' }}</template>
        </el-table-column>
        <el-table-column label="签约/认购时间" align="center" width="170">
          <template #default="scope">{{ formatDateTime(scope.row.businessDate) }}</template>
        </el-table-column>
        <el-table-column label="涉及人数" align="center" width="80">
          <template #default="scope">{{ scope.row.employeeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="明细条数" align="center" width="80">
          <template #default="scope">{{ scope.row.detailCount ?? 0 }}</template>
        </el-table-column>
        <!-- 操作列：详情 + 合同级业绩调整（经纪人无调整权限） -->
        <el-table-column label="操作" align="center" width="100" fixed="right">
          <template #default="scope">
            <el-button link type="primary" @click="goDetail(scope.row)">详情</el-button>
            <el-button v-if="!isBroker" link type="warning" @click="openAdjustDialog(scope.row)">调整</el-button>
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
      title="合同业绩调整"
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
          <el-tag type="warning">合同级（按比例分摊到各明细）</el-tag>
        </el-form-item>
        <el-form-item label="合同号">
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

    <!-- 合同业绩明细弹窗 -->
    <el-dialog
      v-model="detailDialog.visible"
      title="合同业绩明细"
      width="92%"
      top="3vh"
      class="contract-detail-dialog"
      destroy-on-close
    >
      <!-- 合同信息 -->
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="合同号">{{ detailDialog.contractNo }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detailDialog.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ detailDialog.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detailDialog.propertyAddress || '—' }}</el-descriptions-item>
        <el-descriptions-item label="签约时间">{{ formatDateTime(detailDialog.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailDialog.period }}</el-descriptions-item>
        <el-descriptions-item label="口径">
          新签业绩（应收）
        </el-descriptions-item>
      </el-descriptions>

      <!-- 汇总条 -->
      <div class="detail-summary-bar">
        <span class="summary-text">
          涉及 <b>{{ detailSummary.employeeCount }}</b> 人 ·
          <b>{{ detailList.length }}</b> 条明细
        </span>
        <span class="summary-amount">
          应收合计：
          <b :class="{ 'amount-negative': detailSummary.totalAmount < 0 }">{{ formatAmount(detailSummary.totalAmount) }}</b>
        </span>
      </div>

      <!-- 明细列表 -->
      <el-table border :data="detailList" v-loading="detailLoading">
        <el-table-column label="门店/组别" align="left" min-width="150">
          <template #default="scope">
            <span v-if="scope.row.deptPath" class="dept-wrap" :title="scope.row.deptPath">
              <span class="dept-store">{{ deptStore(scope.row.deptPath) }}</span>
              <span v-if="deptGroup(scope.row.deptPath)" class="dept-group"> · {{ deptGroup(scope.row.deptPath) }}</span>
            </span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="工号" align="center" width="100">
          <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" align="center" min-width="110">
          <template #default="scope">
            <span class="person-name">{{ scope.row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" align="center" min-width="100">
          <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色占比" align="center" width="90">
          <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
        </el-table-column>
        <el-table-column :label="'应收金额'" align="right" width="120">
          <template #default="scope">
            <span class="amount" :class="{ 'amount-redink': scope.row.amount < 0 }">{{ formatAmount(scope.row.amount) }}</span>
            <el-tag v-if="scope.row.amount < 0" type="danger" size="small" effect="plain" class="redink-tag">红冲</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="!isBroker" label="操作" align="center" width="100" fixed="right">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="openDetailAdjustDialog(scope.row)">调整</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无明细数据" />
        </template>
      </el-table>
    </el-dialog>

    <!-- 明细级业绩调整弹窗 -->
    <el-dialog
      v-model="detailAdjustDialog.visible"
      title="明细业绩调整"
      width="480px"
      destroy-on-close
    >
      <el-form
        ref="detailAdjustFormRef"
        :model="detailAdjustForm"
        :rules="detailAdjustRules"
        label-width="90px"
      >
        <el-form-item label="调整范围">
          <el-tag type="info">明细级（单条调整）</el-tag>
        </el-form-item>
        <el-form-item label="员工">
          <span>{{ detailAdjustDialog.employeeName }}</span>
        </el-form-item>
        <el-form-item label="调整类型">
          <el-select v-model="detailAdjustForm.adjustType" style="width: 100%">
            <el-option label="金额调整" value="AMOUNT" />
            <el-option label="业绩冲销" value="VOID" />
            <el-option label="部门划转" value="TRANSFER" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="detailAdjustForm.adjustType === 'AMOUNT'" label="调整金额" prop="deltaAmount">
          <el-input-number
            v-model="detailAdjustForm.deltaAmount"
            :precision="2"
            :step="100"
            style="width: 100%"
            placeholder="正数调增，负数调减"
          />
          <div class="form-tip">正数调增业绩，负数调减业绩</div>
        </el-form-item>
        <el-form-item v-if="detailAdjustForm.adjustType === 'TRANSFER'" label="目标部门">
          <el-tree-select
            v-model="detailAdjustForm.targetDeptId"
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
            v-model="detailAdjustForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入调整原因（审批必填）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="detailAdjustDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="detailAdjustSubmitting" @click="submitDetailAdjust">提交审批</el-button>
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

const userStore = useUserStore();
const isBroker = computed(() => userStore.roles.includes('agent'));

// ==================== 筛选 ====================
const amountLabel = '新签业绩';

const queryParams = reactive<{
  period: string;
  deptId: string | number | undefined;
  bizType: string;
}>({
  period: '',
  deptId: undefined,
  bizType: '',
});

const deptTreeData = ref<DeptNode[]>([]);

// ==================== 数据 ====================
const loading = ref(false);
const contractData = ref<PerformanceManageContract[]>([]);
const totalContracts = ref(0);
const keyword = ref('');

const pageNum = ref(1);
const pageSize = ref(20);

const emptySummary = () => ({ employeeCount: 0, contractCount: 0, detailCount: 0, totalAmount: 0 });
const summary = ref(emptySummary());

// ==================== 工具 ====================
const formatDateTime = (val: string | undefined | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  return Number.isNaN(n) ? String(val) : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 合同号/订单号合并展示：业务类型为「一手房」时展示订单号，其它展示合同号
const contractOrOrderNo = (row: PerformanceManageContract): string => {
  if (row.bizType === '一手房') {
    return row.orderNo || row.contractNo || '—';
  }
  return row.contractNo || row.orderNo || '—';
};

// ==================== 合同明细弹窗 ====================
const detailLoading = ref(false);
const detailList = ref<PerformanceManageRow[]>([]);
const detailDialog = reactive({
  visible: false,
  contractNo: '',
  orderNo: '',
  bizType: '',
  propertyAddress: '',
  businessDate: '',
  period: '',
  factType: 'PERF_EXPECT' as 'PERF_EXPECT' | 'PERF_REAL',
});

const detailSummary = computed(() => {
  const list = detailList.value;
  return {
    employeeCount: new Set(list.map(r => r.employeeId)).size,
    totalAmount: list.reduce((sum, r) => sum + num(r.amount), 0),
  };
});

const goDetail = async (row: PerformanceManageContract) => {
  detailDialog.contractNo = row.contractNo || row.orderNo || '';
  detailDialog.orderNo = row.orderNo || '';
  detailDialog.bizType = row.bizType || '';
  detailDialog.propertyAddress = row.propertyAddress || '';
  detailDialog.businessDate = row.businessDate ? String(row.businessDate) : '';
  detailDialog.period = queryParams.period;
  detailDialog.factType = 'PERF_EXPECT';
  detailList.value = [];
  detailDialog.visible = true;
  await loadDetailList();
};

const loadDetailList = async () => {
  if (!detailDialog.contractNo || !detailDialog.period) return;
  detailLoading.value = true;
  try {
    const res = await performanceApi.listManageContractDetails({
      period: detailDialog.period,
      factType: detailDialog.factType,
      contractNos: detailDialog.contractNo,
    });
    detailList.value = res.data ?? [];
  } catch (e) {
    console.error('[performance-contract] 明细加载失败', e);
  } finally {
    detailLoading.value = false;
  }
};

// ==================== 明细级业绩调整弹窗 ====================
const detailAdjustFormRef = ref();
const detailAdjustSubmitting = ref(false);
const detailAdjustDialog = reactive({
  visible: false,
  factId: '',
  employeeId: '',
  employeeName: '',
});
const detailAdjustForm = reactive({
  adjustType: 'AMOUNT',
  deltaAmount: undefined as number | undefined,
  targetDeptId: undefined as string | undefined,
  reason: '',
});
const detailAdjustRules = {
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  deltaAmount: [
    {
      validator: (_rule: unknown, value: number | undefined, callback: (err?: Error) => void) => {
        if (detailAdjustForm.adjustType === 'AMOUNT' && (value === undefined || value === null)) {
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
        if (detailAdjustForm.adjustType === 'TRANSFER' && !value) {
          callback(new Error('请选择目标部门'));
        } else {
          callback();
        }
      },
      trigger: 'change',
    },
  ],
};

const openDetailAdjustDialog = (row: PerformanceManageRow) => {
  detailAdjustDialog.factId = String(row.id);
  detailAdjustDialog.employeeId = String(row.employeeId);
  detailAdjustDialog.employeeName = row.employeeName || '—';
  detailAdjustForm.adjustType = 'AMOUNT';
  detailAdjustForm.deltaAmount = undefined;
  detailAdjustForm.targetDeptId = undefined;
  detailAdjustForm.reason = '';
  detailAdjustDialog.visible = true;
};

const submitDetailAdjust = async () => {
  await detailAdjustFormRef.value?.validate();
  detailAdjustSubmitting.value = true;
  try {
    await performanceApi.createAdjust({
      factId: detailAdjustDialog.factId,
      period: detailDialog.period,
      employeeId: detailAdjustDialog.employeeId,
      adjustType: detailAdjustForm.adjustType,
      adjustScope: 'DETAIL',
      factType: detailDialog.factType,
      deltaAmount: detailAdjustForm.deltaAmount,
      targetDeptId: detailAdjustForm.targetDeptId,
      reason: detailAdjustForm.reason.trim(),
    } as any);
    ElMessage.success('调整单已提交审批');
    detailAdjustDialog.visible = false;
    loadDetailList();
  } catch (e) {
    // 错误已由拦截器提示
  } finally {
    detailAdjustSubmitting.value = false;
  }
};

// ==================== 工具函数 ====================
const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

// ==================== 门店/组别 拆分展示 ====================
// deptPath 形如「集团-门店-组别」（2~3 段）：门店取倒数第二段（无上级时取首段），组别取最后一段
const deptParts = (path: string): string[] => path.split('-').map((s) => s.trim()).filter(Boolean);
const deptStore = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '—');
};
const deptGroup = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
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
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManageByContract({
      period: queryParams.period,
      factType: 'PERF_EXPECT',
      deptId: queryParams.deptId ? String(queryParams.deptId) : undefined,
      bizType: queryParams.bizType || undefined,
      keyword: keyword.value.trim() || undefined,
      pageNum: pageNum.value,
      pageSize: pageSize.value
    });
    const page = res.data;
    contractData.value = page?.rows ?? [];
    totalContracts.value = page?.total ?? 0;
    summary.value = page?.summary ?? emptySummary();
    bizTypeOptions.value = page?.bizTypes ?? [];
  } finally {
    loading.value = false;
  }
};

const onPageChange = () => getList();
const onSizeChange = () => {
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
  suppressKeywordWatch = true;
  keyword.value = '';
  pageNum.value = 1;
  nextTick(() => {
    suppressKeywordWatch = false;
    getList();
  });
};

// ==================== 业绩调整弹窗 ====================
const adjustFormRef = ref();
const adjustSubmitting = ref(false);
const adjustDialog = reactive({
  visible: false,
  contractNo: '',
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

const openAdjustDialog = (row: PerformanceManageContract) => {
  adjustDialog.contractNo = row.contractNo || row.orderNo || '';
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
      period: queryParams.period,
      adjustType: adjustForm.adjustType,
      adjustScope: 'CONTRACT',
      contractNo: adjustDialog.contractNo,
      factType: 'PERF_EXPECT',
      deltaAmount: adjustForm.deltaAmount,
      targetDeptId: adjustForm.targetDeptId,
      reason: adjustForm.reason.trim(),
    } as any);
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

  .contract-link {
    font-weight: 600;
    padding: 0;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-contract {
    color: #f56c6c;
  }
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.detail-desc {
  margin-bottom: 12px;
}

.detail-summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  flex-wrap: wrap;

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

  .summary-amount {
    font-size: 14px;
    color: #606266;

    b {
      color: #f56c6c;
      font-size: 16px;
      margin-left: 4px;
    }

    .amount-negative {
      color: #67c23a;
    }
  }
}

.person-name {
  font-weight: 600;
  color: #303133;
}

.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: #909399;
}
.amount-redink {
  color: #f56c6c;
}
.redink-tag {
  margin-left: 4px;
  transform: scale(0.85);
  transform-origin: left center;
}
</style>

<style lang="scss">
/* 合同业绩明细弹窗：近全屏展示，body 不出现内部滚动条（teleport 到 body，需全局样式） */
.contract-detail-dialog {
  margin-bottom: 0 !important;

  .el-dialog__body {
    max-height: none;
    overflow: visible;
    padding-top: 10px;
    padding-bottom: 12px;
  }
}

/* 门店/组别列：门店加粗为主、组别弱化为辅，超宽自动换行不截断 */
.dept-wrap {
  line-height: 1.5;
  word-break: break-word;
}
.dept-store {
  font-weight: 600;
  color: #303133;
}
.dept-group {
  color: #909399;
}
</style>
