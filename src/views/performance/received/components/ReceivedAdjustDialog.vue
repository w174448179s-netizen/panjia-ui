<template>
  <el-dialog
    v-model="visible"
    title="实收调整"
    width="820px"
    top="6vh"
    append-to-body
    destroy-on-close
    class="received-adjust-dialog"
  >
    <div v-loading="loading">
      <!-- 合同信息 -->
      <el-descriptions :column="3" border size="small" class="info-desc">
        <el-descriptions-item label="合同号/订单号">{{ info?.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ info?.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="房源地址">{{ info?.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 实收期间（必选，period=实收明细归属期间） -->
      <el-form :model="formData" label-width="90px" class="adjust-form">
        <el-form-item label="实收期间" required>
          <el-date-picker
            v-model="formData.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择实收期间"
            :clearable="false"
            style="width: 200px"
            @change="loadRows"
          />
        </el-form-item>
      </el-form>

      <!-- 汇总条 -->
      <div class="adjust-summary-bar">
        <div class="summary-cell amount-cell">
          <span class="summary-label">当前实收合计</span>
          <b class="amount-bold">{{ formatAmount(originalTotal) }}</b>
        </div>
        <div class="summary-cell amount-cell">
          <span class="summary-label">调整后合计</span>
          <el-input-number
            v-model="targetInput"
            :precision="2"
            :step="100"
            :controls="false"
            placeholder="正多收负少收"
            class="total-input"
          />
        </div>
        <div class="summary-cell amount-cell highlight-cell">
          <span class="summary-label">变动合计</span>
          <b :class="deltaTotal > 0 ? 'amount-positive' : deltaTotal < 0 ? 'amount-negative' : ''">
            {{ deltaTotal > 0 ? '+' : '' }}{{ formatAmount(deltaTotal) }}
          </b>
          <span v-if="deltaTotal" class="tip-inline">{{ deltaTotal > 0 ? '多收' : '少收' }}</span>
        </div>
        <div class="summary-cell tip-cell">
          录入调整后合计，自动按当前实收占比分摊到各行；正数多收、负数少收，提交后走审批流程
        </div>
      </div>

      <!-- 明细表（只读展示 + 分摊额预演） -->
      <el-table :data="rows" border size="small" max-height="380">
        <el-table-column label="门店/组别" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptPath || '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" width="110" align="center">
          <template #default="{ row }">{{ row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" min-width="100">
          <template #default="{ row }">{{ row.employeeName || '—' }}</template>
        </el-table-column>
        <el-table-column label="所属角色" min-width="100">
          <template #default="{ row }">{{ row.roleType || row.roleName || '—' }}</template>
        </el-table-column>
        <el-table-column label="当前实收" width="120" align="right">
          <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="调整分摊额" width="120" align="right">
          <template #default="{ row }">
            <span :class="num(row.delta) > 0 ? 'amount-positive' : num(row.delta) < 0 ? 'amount-negative' : 'muted'">
              {{ num(row.delta) > 0 ? '+' : '' }}{{ formatAmount(row.delta) }}
            </span>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同该期间暂无有效实收明细" />
        </template>
      </el-table>

      <el-input
        v-model="reason"
        type="textarea"
        :rows="2"
        maxlength="200"
        show-word-limit
        placeholder="调整原因（审批留痕，建议填写）"
        style="margin-top: 12px"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="rows.length === 0" @click="submit">提交审批</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageRow } from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);

interface ReceivedInfo {
  contractNo: string;
  orderNo?: string;   // 订单号（同合同号多订单时订单号优先精确匹配明细，防串单）
  bizType?: string;
  propertyAddress?: string;
  period?: string; // 来源实收单的期间，从实收明细页进入时优先使用
}
const info = ref<ReceivedInfo | null>(null);
const formData = reactive({ period: '' });
const reason = ref('');

interface ReceivedRow {
  key: string;
  factId?: string | null;
  employeeCode: string;
  employeeName: string;
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  amount: number;  // 当前实收
  delta: number;   // 调整分摊额（合计录入后自动分摊，只读）
}
const rows = ref<ReceivedRow[]>([]);
const targetInput = ref<number | null>(null);

const originalTotal = computed(() => round2(rows.value.reduce((s, r) => s + num(r.amount), 0)));
// 未录入时默认等于当前合计（变动 0，后端会拦截）
const targetAmount = computed(() => (targetInput.value == null ? originalTotal.value : round2(targetInput.value)));
const deltaTotal = computed(() => round2(targetAmount.value - originalTotal.value));

// ==================== 打开弹窗：默认当前月并拉取实收明细 ====================
function open(payload: ReceivedInfo) {
  info.value = payload;
  reason.value = '';
  targetInput.value = null;
  rows.value = [];
  visible.value = true;
  // 优先用来源实收单的期间；无则默认当前月
  if (payload.period) {
    formData.period = payload.period;
  } else {
    const now = new Date();
    formData.period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }
  loadRows();
}

/** 按期间 + 合同号拉取实收明细（复用合同明细查询 API，factType=PERF_REAL） */
async function loadRows() {
  if (!info.value || !formData.period) {
    rows.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await performanceApi.listManageContractDetails({
      period: formData.period,
      factType: 'PERF_REAL',
      contractNos: info.value.contractNo,
      // 同合同号多订单时按订单号精确限定明细（防跨订单串单）
      ...(info.value.orderNo ? { orderNos: info.value.orderNo } : {}),
    });
    const list: PerformanceManageRow[] = (res.data ?? [])
      .filter((r: PerformanceManageRow) => r.factStatus !== 'VOIDED');
    rows.value = list.map(r => ({
      key: `rd-${r.id ?? Math.random()}`,
      factId: r.id ?? undefined,
      employeeCode: r.employeeCode || '',
      employeeName: r.employeeName || '',
      deptPath: r.deptPath,
      roleType: r.roleType,
      roleName: r.roleName,
      amount: num(r.amount),
      delta: 0,
    }));
    // 切换期间后重置调整后合计 = 新的当前合计
    targetInput.value = round2(rows.value.reduce((s, r) => s + num(r.amount), 0));
  } finally {
    loading.value = false;
  }
}

// ==================== 合计录入自动按占比分摊到各行（只读预演） ====================
watch(deltaTotal, () => {
  if (!rows.value.length) return;
  const parts = allocateByAmount(rows.value.map(r => num(r.amount)), deltaTotal.value);
  rows.value.forEach((r, i) => {
    r.delta = parts[i];
  });
});

// ==================== 提交 ====================
async function submit() {
  if (!info.value) return;
  if (!formData.period) {
    ElMessage.warning('请选择实收期间');
    return;
  }
  if (!rows.value.length) {
    ElMessage.warning('该合同该期间无有效实收明细，无法调整');
    return;
  }
  if (deltaTotal.value === 0) {
    ElMessage.warning('调整后合计与当前实收合计一致（变动为 0），无需调整');
    return;
  }
  submitting.value = true;
  try {
    await performanceApi.createAdjust({
      adjustType: 'RECEIVED_AMOUNT',
      adjustScope: 'CONTRACT',
      contractNo: info.value.contractNo,
      orderNo: info.value.orderNo,
      factType: 'PERF_REAL',
      period: formData.period,
      targetAmount: targetAmount.value,
      reason: reason.value.trim() || '实收调整',
    });
    ElMessage.success('实收调整已提交审批');
    visible.value = false;
    emit('submitted');
  } finally {
    submitting.value = false;
  }
}

// ==================== 工具 ====================
function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
function formatAmount(v?: number | null): string {
  return (v ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * 等比分摊（镜像后端 MoneyUtil.allocateByAmount）：
 * 8 位中间精度逐行 round2，尾差补到调整额绝对值最大的一行；总额为 0 时平摊、尾差补首行。
 */
function allocateByAmount(amounts: number[], deltaTotal: number): number[] {
  const n = amounts.length;
  if (n === 0) return [];
  const d = round2(deltaTotal);
  if (Math.abs(d) < 0.005) return amounts.map(() => 0);
  const total = round2(amounts.reduce((s, v) => s + v, 0));
  if (Math.abs(total) < 0.005) {
    const base = Math.round((d / n) * 100) / 100;
    const parts = amounts.map(() => base);
    parts[0] = round2(parts[0] + round2(d - round2(base * n)));
    return parts;
  }
  const parts = amounts.map(v => round2((Math.round((v / total) * 1e8) / 1e8) * d));
  const diff = round2(d - parts.reduce((s, v) => s + v, 0));
  if (Math.abs(diff) > 0.004) {
    let maxIdx = 0;
    let maxAbs = -1;
    parts.forEach((v, i) => {
      const a = Math.abs(v);
      if (a > maxAbs) {
        maxAbs = a;
        maxIdx = i;
      }
    });
    parts[maxIdx] = round2(parts[maxIdx] + diff);
  }
  return parts;
}

defineExpose({ open });
</script>

<style scoped>
.info-desc {
  margin-bottom: 12px;
}
.adjust-form {
  margin-bottom: 4px;
}
.adjust-summary-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 24px;
  padding: 10px 14px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}
.summary-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}
.summary-label {
  color: var(--el-text-color-secondary);
}
.tip-cell {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.tip-inline {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.total-input {
  width: 150px;
}
.amount-positive {
  color: var(--el-color-success);
}
.amount-negative {
  color: var(--el-color-danger);
}
.amount-bold {
  font-size: 16px;
  font-weight: 700;
}
.highlight-cell {
  padding: 4px 12px;
  background: var(--el-color-primary-light-9);
  border-radius: 4px;
}
.muted {
  color: var(--el-text-color-secondary);
}
</style>
