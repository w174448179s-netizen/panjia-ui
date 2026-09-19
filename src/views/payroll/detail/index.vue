<template>
  <div class="payroll-detail">
    <!-- ══════════ 顶部：批次选择 + 核心指标卡片 ══════════ -->
    <el-card shadow="never" class="header-card">
      <div class="header-bar">
        <div class="header-left">
          <span class="page-title">工资明细</span>
          <el-select
            v-model="selectedBatchId"
            placeholder="选择工资批次"
            filterable
            style="width: 260px"
            @change="loadDetails"
          >
            <el-option
              v-for="b in batches"
              :key="b.id"
              :label="`${b.period}（${statusLabel(b.status)}）`"
              :value="b.id"
            />
          </el-select>
          <el-tag v-if="currentBatch" :type="statusTag(currentBatch.status)" effect="light" size="large">
            {{ statusLabel(currentBatch.status) }}
          </el-tag>
          <span v-if="currentBatch?.status === 'LOCKED' || currentBatch?.status === 'PAID'" class="lock-hint">
            <el-icon><Lock /></el-icon> 已锁定封账，如需修正请走补发单
          </span>
        </div>
        <div class="header-right">
          <el-button :disabled="!viewDetails.length" @click="exportExcel">
            <el-icon><Download /></el-icon>&nbsp;导出当前视图
          </el-button>
        </div>
      </div>

      <div v-if="currentBatch" class="stat-row">
        <div class="stat-card net">
          <div class="stat-label">实发合计</div>
          <div class="stat-value">¥{{ fmt(currentBatch.netTotal) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">应发合计</div>
          <div class="stat-value">¥{{ fmt(currentBatch.grossTotal) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">扣款 + 个税</div>
          <div class="stat-value deduct-text">¥{{ fmt(Number(currentBatch.deductTotal) + Number(currentBatch.taxTotal)) }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">参与人数</div>
          <div class="stat-value">{{ currentBatch.employeeCount }}<span class="stat-unit">人</span></div>
        </div>
        <div class="stat-card view-tabs-card">
          <div class="stat-label">按角色查看</div>
          <el-radio-group v-model="viewRole" size="small">
            <el-radio-button value="ALL">全部</el-radio-button>
            <el-radio-button value="AGENT">经纪人</el-radio-button>
            <el-radio-button value="MANAGER">店长工资</el-radio-button>
            <el-radio-button value="DIRECTOR">总监工资</el-radio-button>
          </el-radio-group>
        </div>
      </div>
    </el-card>

    <!-- ══════════ 明细表格：分组表头 + 零值淡化 + 智能列 ══════════ -->
    <el-card shadow="never" class="table-card">
      <div class="table-toolbar">
        <div class="toolbar-left">
          <el-icon class="toolbar-icon"><InfoFilled /></el-icon>
          <span class="toolbar-tip">
            点击行首 <b>▸</b> 展开每个人的<b>工资构成与追溯</b>；金额为零的项目已淡化显示
          </span>
        </div>
        <div class="toolbar-right">
          <el-select
            v-model="filterDeptId"
            placeholder="门店"
            clearable
            filterable
            size="small"
            style="width: 170px"
          >
            <el-option v-for="d in deptOptions" :key="d.deptId" :label="d.deptName" :value="d.deptId" />
          </el-select>
          <el-input v-model="filterName" placeholder="员工姓名" clearable size="small" style="width: 130px" />
          <el-input v-model="filterCode" placeholder="员工号" clearable size="small" style="width: 130px" />
          <el-button size="small" :icon="RefreshLeft" @click="resetFilters">重置</el-button>
          <el-checkbox v-model="showAllColumns" size="small">显示全部金额列（含全零列）</el-checkbox>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="viewDetails"
        stripe
        class="detail-table"
        max-height="620"
        :summary-method="summaryMethod"
        show-summary
        row-key="id"
        :empty-text="selectedBatchId ? (viewRole === 'ALL' ? '该批次暂无明细数据' : '该批次暂无此角色数据') : '请先选择工资批次'"
      >
        <el-table-column type="expand" width="36">
          <template #default="{ row }">
            <PayrollTracePanel
              :row="(row as any)"
              :employee-name="empOf(row).employeeName"
              :period="currentBatch?.period || ''"
            />
          </template>
        </el-table-column>

        <!-- 基本信息 -->
        <el-table-column label="姓名" fixed="left" width="90">
          <template #default="{ row }">
            <span class="emp-name">{{ empOf(row).employeeName || `员工${row.employeeId}` }}</span>
          </template>
        </el-table-column>
        <el-table-column label="门店" fixed="left" min-width="110" show-overflow-tooltip>
          <template #default="{ row }">{{ empOf(row).deptName || '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" fixed="left" width="100">
          <template #default="{ row }">
            <span class="emp-code">{{ empOf(row).employeeCode || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="职级" width="70" align="center">
          <template #default="{ row }">{{ row.levelCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="row.employeeRole === 'MANAGER' ? 'warning' : row.employeeRole === 'DIRECTOR' ? 'danger' : 'info'" effect="plain">
              {{ roleLabel(row.employeeRole) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="兼职" width="56" align="center">
          <template #default="{ row }">
            <span v-if="row.isPartTime" class="part-time">兼职</span>
            <span v-else class="zero-val">—</span>
          </template>
        </el-table-column>
        <el-table-column label="提成点调整" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.manualAdjust != null && Number(row.manualAdjust) !== 0" class="deduct-text">
              {{ ratePercent(row.manualAdjust) }}
            </span>
            <span v-else class="zero-val">—</span>
          </template>
        </el-table-column>

        <!-- 收入构成 -->
        <el-table-column label="收入构成（应发 = 各项之和）" align="center" class-name="group-income" label-class-name="group-income">
          <el-table-column
            v-for="c in visibleIncomeCols"
            :key="c.prop"
            :label="c.label"
            :width="c.width"
            align="right"
          >
            <template #default="{ row }">
              <span v-if="isZero(row[c.prop])" class="zero-val">—</span>
              <span v-else class="money">{{ fmt(row[c.prop]) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="应发合计" width="120" align="right">
            <template #default="{ row }"><b class="money">{{ fmt(row.gross) }}</b></template>
          </el-table-column>
        </el-table-column>

        <!-- 扣款构成 -->
        <el-table-column label="扣款构成（从工资中减除）" align="center" class-name="group-deduct" label-class-name="group-deduct">
          <el-table-column
            v-for="c in visibleDeductCols"
            :key="c.prop"
            :label="c.label"
            :width="c.width"
            align="right"
          >
            <template #default="{ row }">
              <span v-if="isZero(row[c.prop])" class="zero-val">—</span>
              <span v-else class="money deduct-text">{{ fmt(row[c.prop]) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="扣款合计" width="110" align="right">
            <template #default="{ row }">
              <span v-if="isZero(row.deduct)" class="zero-val">—</span>
              <b v-else class="money deduct-text">{{ fmt(row.deduct) }}</b>
            </template>
          </el-table-column>
          <el-table-column label="个税" width="90" align="right">
            <template #default="{ row }">
              <span v-if="isZero(row.tax)" class="zero-val">—</span>
              <span v-else class="money deduct-text">{{ fmt(row.tax) }}</span>
            </template>
          </el-table-column>
        </el-table-column>

        <!-- 结果 -->
        <el-table-column label="实发工资" fixed="right" width="130" align="right" class-name="col-net">
          <template #default="{ row }">
            <span class="net-value" :class="{ 'net-negative': Number(row.net) < 0 }">¥{{ fmt(row.net) }}</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Lock, Download, InfoFilled, RefreshLeft } from '@element-plus/icons-vue';
import { payrollApi, type PayrollBatch, type PayrollDetail } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';
import PayrollTracePanel from '../components/PayrollTracePanel.vue';

/* ───────────── 基础状态 ───────────── */
const batches = ref<PayrollBatch[]>([]);
const details = ref<PayrollDetail[]>([]);
const selectedBatchId = ref<number | null>(null);
const loading = ref(false);
const viewRole = ref<'ALL' | 'AGENT' | 'MANAGER' | 'DIRECTOR'>('ALL');
const showAllColumns = ref(false);

const empMap = reactive<Record<number, { employeeName: string; employeeCode: string; deptId: number | string; deptName: string }>>({});

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CALCULATING: '计算中', CALCULATED: '已计算', FAILED: '失败',
  REVIEWING: '待审核', APPROVED: '已确认', LOCKED: '已锁定', PAID: '已发放',
};
const STATUS_TAG: Record<string, string> = {
  DRAFT: 'info', CALCULATING: 'warning', CALCULATED: '', FAILED: 'danger',
  REVIEWING: 'warning', APPROVED: 'success', LOCKED: 'success', PAID: 'success',
};

const statusLabel = (s: string) => STATUS_LABEL[s] || s;
const statusTag = (s: string) => (STATUS_TAG[s] || 'info') as any;
const roleLabel = (r: string) => ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r || '—');
const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 提成点调整叠加值 → 百分比文案（-0.02 → -2%） */
const ratePercent = (v: number | string | null | undefined) => `${Number((Number(v) * 100).toFixed(2))}%`;
const isZero = (v: number | null | undefined) => !v || Number(v) === 0;
const empOf = (row: any) =>
  empMap[row.employeeId] || { employeeName: '', employeeCode: '', deptId: '', deptName: '' };

const currentBatch = computed(() => batches.value.find((b) => b.id === selectedBatchId.value) || null);

/* ───────────── 筛选条件（门店/姓名/工号，总监·财务组织视角） ───────────── */
const filterDeptId = ref<number | string>('');
const filterName = ref('');
const filterCode = ref('');

/** 门店选项：从员工档案派生去重（避免依赖 system:dept:query 权限） */
const deptOptions = computed(() => {
  const map = new Map<string, string>();
  Object.values(empMap).forEach((e) => {
    if (e.deptId && e.deptName) map.set(String(e.deptId), e.deptName);
  });
  return Array.from(map, ([deptId, deptName]) => ({ deptId, deptName }));
});

const resetFilters = () => {
  filterDeptId.value = '';
  filterName.value = '';
  filterCode.value = '';
};

/** 当前视图明细：角色 tab → 门店 → 姓名模糊 → 工号模糊（对应 Excel 分 sheet + 手工查找） */
const viewDetails = computed(() => {
  let list = viewRole.value === 'ALL' ? details.value : details.value.filter((d) => d.employeeRole === viewRole.value);
  if (filterDeptId.value !== '') {
    list = list.filter((d) => String(empOf(d).deptId) === String(filterDeptId.value));
  }
  const name = filterName.value.trim();
  if (name) list = list.filter((d) => empOf(d).employeeName.includes(name));
  const code = filterCode.value.trim();
  if (code) list = list.filter((d) => (empOf(d).employeeCode || '').includes(code));
  return list;
});

/* ───────────── 列定义（含适用角色与溯源口径） ───────────── */
interface ColDef { prop: string; label: string; width: number; roles?: string[]; source: string }

const INCOME_COLS: ColDef[] = [
  { prop: 'commissionIncome', label: '业绩提成', width: 110, source: '结佣业绩 × 快照提点' },
  { prop: 'teamIncome', label: '团队提成', width: 105, roles: ['MANAGER'], source: '团队新签业绩 × 10%' },
  { prop: 'personalNewsignIncome', label: '个人新签', width: 105, roles: ['MANAGER'], source: '本人新签业绩 × 70%' },
  { prop: 'storeIncome', label: '门店提成', width: 105, roles: ['DIRECTOR'], source: '各门店新签业绩 × 跳点比例' },
  { prop: 'baseSalary', label: '底薪/保底', width: 100, source: '职级规则配置（历史快照）' },
  { prop: 'guaranteeFill', label: '保底补足', width: 100, roles: ['MANAGER'], source: 'MAX(保底, 团队+个人新签) 补足部分' },
  { prop: 'mentorBonus', label: '招聘奖励', width: 95, source: '师徒关系档案：徒弟结佣业绩 × 2%' },
  { prop: 'bonus', label: '奖金', width: 90, source: '奖金审批单' },
  { prop: 'otherIncome', label: '其他收入', width: 95, source: '收入录入记录（补贴/补发等）' },
];

const DEDUCT_COLS: ColDef[] = [
  { prop: 'socialFee', label: '社保', width: 90, source: '1637.15 × 职级比例' },
  { prop: 'housingFund', label: '公积金', width: 90, source: '员工档案自缴金额' },
  { prop: 'attendanceFee', label: '考勤扣款', width: 95, source: '考勤Excel导入：迟到×20 + 旷工/请假标准' },
  { prop: 'commercialInsurance', label: '商业保险', width: 95, source: '人事数据（21元/月）' },
  { prop: 'dormitoryFee', label: '宿舍费', width: 85, source: '人事数据（住宿名单）' },
  { prop: 'negativeCarryover', label: '负工资结转', width: 105, source: '上月负工资余额（系统自动结转）' },
  { prop: 'otherDeduct', label: '其他支出', width: 95, source: '支出录入记录（培训费/罚款等）' },
];

/** 智能列：按当前视图隐藏「角色不适用」和「全零」列；可一键切回全列 */
const visibleIncomeCols = computed(() => filterCols(INCOME_COLS));
const visibleDeductCols = computed(() => filterCols(DEDUCT_COLS));

function filterCols(cols: ColDef[]): ColDef[] {
  return cols.filter((c) => {
    if (c.roles && viewRole.value !== 'ALL' && !c.roles.includes(viewRole.value)) return false;
    if (showAllColumns.value) return true;
    return viewDetails.value.some((r: any) => !isZero(r[c.prop]));
  });
}

/* ───────────── 数据加载 ───────────── */
const loadBatches = async () => {
  try {
    const res = await payrollApi.listBatches();
    batches.value = (res as any).data ?? [];
    if (batches.value.length && !selectedBatchId.value) {
      selectedBatchId.value = batches.value[0].id;
      loadDetails();
    }
  } catch { /* 拦截器处理 */ }
};

const loadDetails = async () => {
  if (!selectedBatchId.value) { details.value = []; return; }
  loading.value = true;
  try {
    const res = await payrollApi.getDetails(selectedBatchId.value);
    details.value = (res as any).data ?? [];
  } catch {
    details.value = [];
  } finally {
    loading.value = false;
  }
};

/** 员工姓名/工号/门店映射（替代裸的员工ID） */
const loadEmployees = async () => {
  try {
    const res = await employeeApi.list({ pageNum: 1, pageSize: 1000 });
    const rows: Employee[] = ((res as any).data?.rows ?? (res as any).rows ?? []) as Employee[];
    rows.forEach((e) => {
      empMap[Number(e.employeeId)] = {
        employeeName: e.employeeName,
        employeeCode: e.employeeCode || '',
        deptId: e.deptId,
        deptName: e.deptName,
      };
    });
  } catch { /* 映射失败时回退显示员工ID */ }
};

/* ───────────── 合计行 ───────────── */
const MONEY_PROPS = [
  'commissionIncome', 'teamIncome', 'personalNewsignIncome', 'storeIncome',
  'baseSalary', 'guaranteeFill', 'mentorBonus', 'bonus', 'otherIncome', 'gross',
  'socialFee', 'housingFund', 'attendanceFee', 'commercialInsurance',
  'dormitoryFee', 'negativeCarryover', 'otherDeduct', 'deduct', 'tax', 'net',
];

const summaryMethod = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) { sums[idx] = ''; return; }
    if (idx === 1) { sums[idx] = '合计'; return; }
    const prop = col.property;
    if (prop && MONEY_PROPS.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

/* ───────────── 导出（按当前视图，含姓名/门店） ───────────── */
const exportExcel = () => {
  if (!viewDetails.value.length) return;
  const basicHeads = ['姓名', '门店', '工号', '职级', '角色', '兼职'];
  const incomeHeads = visibleIncomeCols.value.map((c) => c.label).concat(['应发合计']);
  const deductHeads = visibleDeductCols.value.map((c) => c.label).concat(['扣款合计', '个税']);
  const heads = [...basicHeads, ...incomeHeads, ...deductHeads, '实发'];

  const rows = viewDetails.value.map((r: any) => {
    const basic = [
      empOf(r).employeeName || `员工${r.employeeId}`, empOf(r).deptName || '',
      empOf(r).employeeCode || '', r.levelCode || '', roleLabel(r.employeeRole), r.isPartTime ? '是' : '否',
    ];
    const income = visibleIncomeCols.value.map((c) => num(r[c.prop])).concat([num(r.gross)]);
    const deduct = visibleDeductCols.value.map((c) => num(r[c.prop])).concat([num(r.deduct), num(r.tax)]);
    return [...basic, ...income, ...deduct, num(r.net)];
  });

  const csv = [heads, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const roleSuffix = viewRole.value === 'ALL' ? '' : `_${roleLabel(viewRole.value)}工资`;
  link.download = `工资明细_${currentBatch.value?.period || ''}${roleSuffix}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
};
const num = (v: any) => (v == null || v === '' ? '' : Number(v).toFixed(2));

onMounted(() => {
  loadBatches();
  loadEmployees();
});
</script>

<style scoped>
.payroll-detail {
  padding: 12px;
  background: #f5f7fa;
  min-height: 100%;
}
.header-card :deep(.el-card__body) { padding: 14px 16px; }
.table-card :deep(.el-card__body) { padding: 10px 12px; }

.header-bar { display: flex; align-items: center; justify-content: space-between; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 17px; font-weight: 600; color: #1f2d3d; }
.lock-hint { display: inline-flex; align-items: center; gap: 4px; color: #b8860b; font-size: 12px; }

/* 指标卡片 */
.stat-row { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 150px; background: #fafbfc; border: 1px solid #ebeef5;
  border-radius: 8px; padding: 12px 16px;
}
.stat-card.net { background: #f0f9eb; border-color: #d1edc4; }
.stat-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.stat-value { font-size: 22px; font-weight: 600; color: #1f2d3d; font-variant-numeric: tabular-nums; }
.stat-unit { font-size: 12px; font-weight: 400; color: #909399; margin-left: 4px; }
.view-tabs-card { display: flex; flex-direction: column; justify-content: center; }

/* 角色视图切换 */
.toolbar { margin-bottom: 8px; }

/* 表格 */
.detail-table { width: 100%; --el-table-header-bg-color: #fafbfc; }
.detail-table :deep(th.group-income) { color: #0a7d43 !important; }
.detail-table :deep(th.group-deduct) { color: #c0392b !important; }
.detail-table :deep(.group-income .el-table__cell) { background: #f4fbf7; }
.detail-table :deep(.group-deduct .el-table__cell) { background: #fdf5f4; }
.emp-name { font-weight: 600; color: #1f2d3d; }
.money { font-variant-numeric: tabular-nums; }
.deduct-text { color: #c0392b; }
.zero-val { color: #cdd0d6; }
.part-time { color: #e6a23c; font-size: 12px; }
.net-value { font-size: 14px; font-weight: 700; color: #0a7d43; font-variant-numeric: tabular-nums; }
.net-negative { color: #c0392b; }
.col-net { background: #f0f9eb !important; }

/* 工具条 */
.table-toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; gap: 12px; flex-wrap: wrap; }
.toolbar-left { display: flex; align-items: center; gap: 6px; color: #909399; font-size: 12px; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.toolbar-icon { color: #409eff; }
.toolbar-tip b { color: #606266; }
.emp-code { color: #606266; font-variant-numeric: tabular-nums; }
</style>
