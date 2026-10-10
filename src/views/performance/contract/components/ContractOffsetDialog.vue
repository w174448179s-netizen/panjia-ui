<template>
  <el-dialog
    v-model="visible"
    title="业绩冲正"
    width="820px"
    top="6vh"
    append-to-body
    destroy-on-close
    class="contract-offset-dialog"
  >
    <div v-loading="loading">
      <!-- 合同信息 -->
      <el-descriptions :column="3" border size="small" class="info-desc">
        <el-descriptions-item label="合同号/订单号">{{ info?.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ info?.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ info?.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 冲正期间（必选） -->
      <el-form :model="formData" label-width="90px" class="offset-form">
        <el-form-item label="冲正期间" required>
          <el-date-picker
            v-model="formData.period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="选择冲正期间"
            style="width: 200px"
          />
        </el-form-item>
      </el-form>

      <!-- 汇总行 -->
      <div class="offset-summary-bar">
        <div class="summary-cell amount-cell">
          <span class="summary-label">合同业绩合计</span>
          <b class="amount-bold">{{ formatAmount(originalTotal) }}</b>
        </div>
        <div class="summary-cell amount-cell">
          <span class="summary-label">冲正金额合计</span>
          <el-input-number
            v-model="totalOffsetInput"
            :precision="2"
            :step="100"
            :controls="false"
            placeholder="正增负减"
            class="total-input"
            @update:model-value="handleTotalOffset"
          />
        </div>
        <div class="summary-cell amount-cell">
          <span class="summary-label">分摊合计</span>
          <b :class="offsetTotal > 0 ? 'amount-positive' : offsetTotal < 0 ? 'amount-negative' : ''">
            {{ offsetTotal > 0 ? '+' : '' }}{{ formatAmount(offsetTotal) }}
          </b>
          <span
            v-if="totalDiff !== 0"
            :class="totalDiff > 0 ? 'amount-positive' : 'amount-negative'"
            style="font-size: 12px; margin-left: 4px"
          >差 {{ totalDiff > 0 ? '+' : '' }}{{ totalDiff.toFixed(2) }}</span>
        </div>
        <div class="summary-cell amount-cell highlight-cell">
          <span class="summary-label">冲正后金额</span>
          <b :class="afterTotal > originalTotal ? 'amount-positive' : afterTotal < originalTotal ? 'amount-negative' : 'amount-bold'">
            {{ formatAmount(afterTotal) }}
          </b>
        </div>
        <div class="summary-cell tip-cell">
          录入合计后自动按业绩占比平分到各行，可逐行微调；正数补录/负数冲正，提交后走审批流程
        </div>
      </div>

      <!-- 可编辑明细表格 -->
      <el-table :data="editRows" border size="small" max-height="380" row-key="key">
        <el-table-column label="门店/组别" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptPath || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" min-width="110">
          <template #default="{ row }">
            <EmployeeSelect
              v-if="row.isNew"
              v-model="row.employeeId"
              @change="(_v, opt) => onEmployeePick(row as EditRow, opt)"
            />
            <span v-else>{{ row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" min-width="100">
          <template #default="{ row }">
            <el-input v-if="row.isNew" v-model="row.roleType" placeholder="角色类型" maxlength="50" />
            <span v-else>{{ row.roleType || row.roleName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="当前业绩" width="120" align="right">
          <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
        </el-table-column>
        <el-table-column label="冲正金额" width="170" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.offsetAmount"
              :precision="2"
              :step="100"
              :controls="false"
              placeholder="正增负减"
              style="width: 140px"
              @update:model-value="handleRowAmount"
            />
          </template>
        </el-table-column>
        <el-table-column label="冲正后" width="120" align="right">
          <template #default="{ row }">
            <span
              v-if="row.offsetAmount != null && num(row.offsetAmount) !== 0"
              :class="num(row.offsetAmount) >= 0 ? 'amount-positive' : 'amount-negative'"
            >{{ formatAmount(round2(num(row.amount) + num(row.offsetAmount))) }}</span>
            <span v-else class="muted">{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="60" align="center">
          <template #default="{ row, $index }">
            <el-button v-if="row.isNew" type="danger" link size="small" @click="removeRow($index)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无有效业绩明细" />
        </template>
      </el-table>

      <div class="add-row-bar">
        <el-button type="primary" plain size="small" @click="addRow">+ 添加角色人</el-button>
      </div>

      <el-input
        v-model="reason"
        type="textarea"
        :rows="2"
        maxlength="200"
        show-word-limit
        placeholder="冲正原因（选填）"
        style="margin-top: 12px"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="editRows.length === 0" @click="submit">提交审批</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import type { PerformanceManageRow, PerformanceEmployeeOption } from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);

interface OffsetInfo {
  contractNo: string;
  bizType?: string;
  propertyAddress?: string;
}
const info = ref<OffsetInfo | null>(null);
const formData = reactive({
  period: '',
});
const reason = ref('');
let keySeq = 0;

interface EditRow {
  key: string;
  isNew: boolean;
  factId?: string | null;   // 源事实 ID（既有行带出，执行时按此行精确复制）
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  shareRatio?: number | null; // 角色占比
  amount: number;           // 当前业绩（已有行有值，新行为 0）
  offsetAmount: number | null; // 冲正金额（正数补录/负数冲正）
}
const editRows = ref<EditRow[]>([]);
const totalOffsetInput = ref<number | null>(null);

const existingRows = computed(() => editRows.value.filter(r => !r.isNew));
const originalTotal = computed(() => round2(existingRows.value.reduce((s, r) => s + num(r.amount), 0)));
const offsetTotal = computed(() =>
  round2(editRows.value.reduce((s, r) => s + (r.offsetAmount != null ? num(r.offsetAmount) : 0), 0)),
);
const afterTotal = computed(() => round2(originalTotal.value + offsetTotal.value));
const totalDiff = computed(() => round2(offsetTotal.value - num(totalOffsetInput)));

// ==================== 打开弹窗：拉取已有明细 ====================
async function open(payload: OffsetInfo) {
  info.value = payload;
  reason.value = '';
  formData.period = '';
  totalOffsetInput.value = null;
  editRows.value = [];
  visible.value = true;
  loading.value = true;
  const now = new Date();
  formData.period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  try {
    const res = await performanceApi.listManageContractDetails({
      period: '',
      factType: 'PERF_EXPECT',
      contractNos: payload.contractNo,
    });
    const rows: PerformanceManageRow[] = (res.data ?? [])
      .filter((r: PerformanceManageRow) => r.factStatus !== 'VOIDED');
    editRows.value = rows.map(r => ({
      key: `f-${r.id ?? Math.random()}`,
      isNew: false,
      factId: r.id ?? undefined,
      employeeId: r.employeeId,
      employeeCode: r.employeeCode || '',
      employeeName: r.employeeName || '',
      deptPath: r.deptPath,
      roleType: r.roleType,
      roleName: r.roleName,
      shareRatio: r.shareRatio ?? null,
      amount: num(r.amount),
      offsetAmount: null,
    }));
    if (!editRows.value.length) {
      addRow();
    }
  } finally {
    loading.value = false;
  }
}

// ==================== 新增角色人行 ====================
function addRow() {
  editRows.value.push({
    key: `new-${++keySeq}`,
    isNew: true,
    employeeCode: '',
    employeeName: '',
    roleType: '',
    amount: 0,
    offsetAmount: null,
  });
}

function removeRow(index: number) {
  editRows.value.splice(index, 1);
}

function onEmployeePick(row: EditRow, emp: PerformanceEmployeeOption | null) {
  if (emp) {
    row.employeeId = String(emp.employeeId);
    row.employeeName = emp.employeeName;
    row.employeeCode = emp.employeeCode || '';
    row.deptPath = emp.deptName || '';
  }
}

// ==================== 合计录入自动平分 + 行编辑联动 ====================
/** 录入冲正合计：按现有行当前业绩占比自动分摊到各行（新增行不参与） */
function handleTotalOffset(v: number | null) {
  const total = v == null ? 0 : round2(v);
  const rows = existingRows.value;
  if (!rows.length) return;
  const amounts = rows.map(r => num(r.amount));
  const parts = allocateByAmount(amounts, total);
  rows.forEach((r, i) => {
    r.offsetAmount = parts[i];
  });
}

/** 行手动编辑：同步更新合计输入框 */
function handleRowAmount() {
  totalOffsetInput.value = offsetTotal.value;
}

// ==================== 提交 ====================
async function submit() {
  if (!info.value) return;
  if (!formData.period) {
    ElMessage.warning('请选择冲正期间');
    return;
  }
  // 收集有冲正金额的行（已有行金额为 0/空跳过，新行必须有金额）；
  // 保存表格行全部字段快照（factId/工号/门店/占比/当前业绩），详情与执行按快照还原
  const items = editRows.value
    .filter(r => {
      if (r.isNew) return r.employeeId && r.offsetAmount != null;
      return r.offsetAmount != null && num(r.offsetAmount) !== 0;
    })
    .map(r => ({
      employeeId: Number(r.employeeId),
      roleType: (r.roleType || '').trim() || '合作人',
      roleName: (r.roleName || '').trim() || undefined,
      amount: round2(num(r.offsetAmount)),
      factId: !r.isNew && r.factId ? Number(r.factId) : undefined,
      employeeCode: r.employeeCode || undefined,
      deptName: r.deptPath || undefined,
      shareRatio: r.shareRatio ?? undefined,
      originalAmount: round2(num(r.amount)),
    }));
  if (!items.length) {
    ElMessage.warning('请至少录入一行冲正金额');
    return;
  }
  submitting.value = true;
  try {
    await performanceApi.createAdjust({
      adjustType: 'MANUAL_OFFSET',
      adjustScope: 'CONTRACT',
      contractNo: info.value.contractNo,
      factType: 'PERF_EXPECT',
      period: formData.period,
      reason: reason.value.trim() || '业绩冲正',
      offsetItems: items,
    });
    ElMessage.success('业绩冲正已提交审批');
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
.offset-form {
  margin-bottom: 4px;
}
.offset-summary-bar {
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
.add-row-bar {
  margin-top: 10px;
}
</style>
