<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="92%"
    top="4vh"
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

      <!-- 驳回调整重提：期间取自驳回单，不允许改动 -->
      <el-form v-if="mode === 'revise'" label-width="90px" class="adjust-form">
        <el-form-item label="实收期间">
          <span>{{ formData.period || '—' }}</span>
        </el-form-item>
      </el-form>

      <!-- 实收期间（必选，period=实收明细归属期间；切换期间重新装载明细） -->
      <el-form v-else label-width="90px" class="adjust-form">
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

      <!-- 存在审批中实收调整单时禁止重复发起 -->
      <el-alert
        v-if="pendingBlocked"
        type="warning"
        show-icon
        :closable="false"
        title="该合同该实收期间已有审批中的实收调整单，请等待审批结束或撤回后再发起"
        style="margin: 0 0 10px"
      />

      <!-- 汇总行：调整类型 + 调整后合计录入（明细跟着变） -->
      <div class="adjust-summary-bar">
        <div class="summary-cell" v-if="mode === 'adjust'">
          <span class="summary-label">调整类型</span>
          <el-select v-model="adjustType" style="width: 140px" :disabled="pendingBlocked">
            <el-option label="业绩调整" value="AMOUNT" />
            <el-option label="业绩扣减" value="DEDUCT" />
            <el-option label="业绩增加" value="INCREASE" />
          </el-select>
        </div>
        <div class="summary-cell amount-cell">
          <span class="summary-label">实收业绩合计</span>
          <b class="summary-struck">{{ formatAmount(originalTotal) }}</b>
          <span class="summary-arrow">→</span>
          <el-input-number
            v-model="totalInput"
            :precision="2"
            :step="100"
            :controls="false"
            :disabled="pendingBlocked"
            class="total-input"
            @update:model-value="handleTotalInput"
          />
          <span
            class="summary-delta"
            :class="totalDelta > 0 ? 'amount-positive' : totalDelta < 0 ? 'amount-negative' : ''"
          >{{ totalDelta > 0 ? '+' : '' }}{{ totalDelta.toFixed(2) }}</span>
        </div>
        <div class="summary-cell amount-cell" v-if="mode === 'adjust'">
          <span class="summary-label">调整金额</span>
          <el-input-number
            v-model="deltaInput"
            :precision="2"
            :step="100"
            :controls="false"
            :disabled="pendingBlocked"
            placeholder="正增负减"
            class="total-input"
            @update:model-value="handleDeltaInput"
          />
          <span class="form-hint">录入差额自动算出调整后合计</span>
        </div>
        <div class="summary-cell tip-cell">
          <template v-if="mode === 'revise'">
            驳回调整：直接修改实收金额/角色占比，提交后立即重新进入审批
          </template>
          <template v-else-if="adjustType === 'AMOUNT'">
            业绩调整：修改后实收总额必须保持不变（可增加角色人重新分配）
          </template>
          <template v-else-if="adjustType === 'DEDUCT'">
            业绩扣减：修改后实收总额必须小于原金额；各行调整后实收不能为负
          </template>
          <template v-else>
            业绩增加：修改后实收总额必须大于原金额
          </template>
        </div>
      </div>

      <!-- 可编辑明细表格 -->
      <el-table :data="editRows" border size="small" max-height="420" row-key="key">
        <el-table-column label="门店/组别" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptPath || '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" width="90" align="center">
          <template #default="{ row }">{{ row.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="姓名" min-width="90">
          <template #default="{ row }">
            <EmployeeSelect
              v-if="row.isNew"
              v-model="row.employeeId"
              @change="(_v, opt) => onEmployeePick(row as EditRow, opt)"
            />
            <span v-else>{{ row.employeeName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="所属角色" min-width="110">
          <template #default="{ row }">
            <el-input v-if="row.isNew" v-model="row.roleType" placeholder="合作人" maxlength="20" />
            <span v-else>{{ row.roleType || row.roleName || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="角色占比" width="160" align="center">
          <template #default="{ row }">
            <el-input-number
              v-model="row.ratioPct"
              :precision="4"
              :min="0"
              :max="100"
              :controls="false"
              :disabled="pendingBlocked"
              placeholder="不改"
              style="width: 120px"
            />
            <div class="cell-sub">{{ ratioText(row as EditRow) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="实收金额（调整后）" width="210" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.targetAmount"
              :precision="2"
              :min="0"
              :controls="false"
              :disabled="pendingBlocked"
              style="width: 160px"
              @update:model-value="(v: number | null) => handleRowAmount(row as EditRow, v)"
            />
            <div class="cell-sub" v-if="rowDelta(row as EditRow) !== 0">
              <span class="amount-strike">{{ formatAmount(row.amount) }}</span>
              <span class="amount-arrow">→</span>
              <span :class="rowDelta(row as EditRow) > 0 ? 'amount-positive' : 'amount-negative'">
                {{ formatAmount(row.targetAmount) }}（{{ rowDelta(row as EditRow) > 0 ? '+' : '' }}{{ rowDelta(row as EditRow).toFixed(2) }}）
              </span>
            </div>
            <div class="cell-sub muted" v-else>{{ formatAmount(row.amount) }}（不变）</div>
          </template>
        </el-table-column>
        <el-table-column label="调整金额" width="150" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.deltaInput"
              :precision="2"
              :step="100"
              :controls="false"
              :disabled="pendingBlocked"
              placeholder="正增负减"
              style="width: 130px"
              @update:model-value="(v: number | null) => handleRowDelta(row as EditRow, v)"
            />
          </template>
        </el-table-column>
        <el-table-column v-if="mode === 'adjust'" label="状态" width="86" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.adjustPending" type="warning" size="small" effect="plain">审批中</el-tag>
            <el-tag v-else-if="row.isNew" type="success" size="small" effect="plain">新增角色人</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">待审批</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="mode === 'adjust'" label="操作" width="70" align="center">
          <template #default="{ row }">
            <el-button v-if="row.isNew" type="danger" link size="small" @click="removeRow(row as EditRow)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="formData.period ? '该合同该期间暂无有效实收明细' : '请先选择实收期间'" />
        </template>
      </el-table>

      <!-- 三类型（业绩调整/扣减/增加）均可增加角色人；驳回调整仅允许修改既有明细 -->
      <div v-if="mode === 'adjust'" class="add-member-bar">
        <el-button type="primary" plain size="small" icon="Plus" :disabled="pendingBlocked" @click="addMemberRow()">增加角色人</el-button>
        <span class="add-tip">新增行选择员工并录入实收金额；全部修改随下方一次提交审批</span>
      </div>

      <el-input
        v-model="reason"
        type="textarea"
        :rows="2"
        maxlength="200"
        show-word-limit
        :disabled="pendingBlocked"
        placeholder="请输入调整原因（必填，将随审批单展示）"
        style="margin-top: 12px"
      />
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="editRows.length === 0 || pendingBlocked"
        @click="submit"
      >{{ mode === 'revise' ? '提交并重提' : '提交审批' }}</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { performanceApi, receivedAdjustApi } from '@/api/panjia/performance';
import { receivedApi, type ReceivedFact } from '@/api/panjia/received';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import type { PerformanceEmployeeOption, PerformanceManageRow } from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
/** 弹窗模式：adjust=已通过单的实收调整（走调整单审批）；revise=驳回单调整后重提 */
const mode = ref<'adjust' | 'revise'>('adjust');
/** 驳回重提对应的审批单 ID */
const applyId = ref<string | null>(null);
const dialogTitle = computed(() => (mode.value === 'revise' ? '驳回调整后重提' : '实收业绩调整'));
/** 该合同该期间存在审批中的实收调整单（checkInFlight + 行级 adjustPending 双保险） */
const pendingBlocked = ref(false);

interface ReceivedInfo {
  contractNo: string;
  orderNo?: string;   // 订单号（同合同号多订单时订单号优先精确匹配明细，防串单）
  bizType?: string;
  propertyAddress?: string;
  period?: string;    // 来源实收单的期间，从实收明细页进入时优先使用
}
const info = ref<ReceivedInfo | null>(null);
const formData = ref<{ period: string }>({ period: '' });

interface EditRow {
  key: string;
  factId?: string;      // 既有行才有（实收明细 ID）
  isNew: boolean;
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  deptPath?: string;
  roleType?: string;
  roleName?: string;
  amount: number;                 // 当前实收（原值）
  targetAmount: number | null;    // 调整后实收（可编辑）
  deltaInput?: number | null;     // 调整金额（可编辑，与 targetAmount 双向联动）
  ratioPct: number | null;        // 角色占比编辑值（百分数；null=不修改）
  originalRatioPct: number | null;
  adjustPending: boolean;         // 该行已有审批中的调整单
}
const editRows = ref<EditRow[]>([]);
/** 调整类型：业绩调整=总额不变 / 业绩扣减=总额须减少 / 业绩增加=总额须增加；三类型均可增加角色人 */
const adjustType = ref<'AMOUNT' | 'DEDUCT' | 'INCREASE'>('AMOUNT');
const totalInput = ref<number | null>(null);
const deltaInput = ref<number | null>(null);
const reason = ref('');
let keySeq = 0;

// ==================== 计算属性 ====================
const existingRows = computed(() => editRows.value.filter(r => !r.isNew));
const newRows = computed(() => editRows.value.filter(r => r.isNew));
const originalTotal = computed(() => round2(existingRows.value.reduce((s, r) => s + num(r.amount), 0)));
const targetTotal = computed(() => round2(editRows.value.reduce((s, r) => s + num(r.targetAmount), 0)));
const totalDelta = computed(() => round2(targetTotal.value - originalTotal.value));

// ==================== 打开弹窗 ====================
function open(payload: ReceivedInfo) {
  mode.value = 'adjust';
  applyId.value = null;
  info.value = payload;
  adjustType.value = 'AMOUNT';
  reason.value = '';
  totalInput.value = null;
  deltaInput.value = null;
  editRows.value = [];
  pendingBlocked.value = false;
  visible.value = true;
  const now = new Date();
  formData.value.period = payload.period
    || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  loadRows();
}

/** 驳回单调整后重提：期间取驳回单期间，明细取该单 ACTIVE 实收明细 */
function openForRevise(payload: ReceivedInfo & { applyId: string | number }) {
  mode.value = 'revise';
  applyId.value = String(payload.applyId);
  info.value = payload;
  adjustType.value = 'AMOUNT';
  reason.value = '';
  totalInput.value = null;
  deltaInput.value = null;
  editRows.value = [];
  pendingBlocked.value = false;
  visible.value = true;
  formData.value.period = payload.period || '';
  loadRows();
}

/** 按期间 + 合同号拉取实收明细（复用合同明细查询 API，factType=PERF_REAL） */
async function loadRows() {
  if (!info.value || !formData.value.period) {
    editRows.value = [];
    return;
  }
  loading.value = true;
  try {
    if (mode.value === 'revise') {
      const res = await receivedApi.getDetail(applyId.value!);
      const facts = (res.data?.facts ?? []) as ReceivedFact[];
      editRows.value = facts
        .filter(f => f.factId)
        .map(f => ({
          key: `rd-${f.factId}`,
          factId: f.factId,
          isNew: false,
          employeeId: f.employeeId ? String(f.employeeId) : undefined,
          employeeCode: f.employeeCode || '',
          employeeName: f.employeeName || '',
          deptPath: f.deptPath,
          roleType: f.roleType,
          roleName: f.roleName,
          amount: num(f.amount),
          targetAmount: num(f.amount),
          deltaInput: 0,
          ratioPct: f.shareRatio != null ? round4(num(f.shareRatio) * 100) : null,
          originalRatioPct: f.shareRatio != null ? round4(num(f.shareRatio) * 100) : null,
          adjustPending: false,
        }));
      pendingBlocked.value = false;
      totalInput.value = originalTotal.value;
      deltaInput.value = 0;
      return;
    }
    const [res, inFlight] = await Promise.all([
      performanceApi.listManageContractDetails({
        period: formData.value.period,
        factType: 'PERF_REAL',
        contractNos: info.value.contractNo,
        ...(info.value.orderNo ? { orderNos: info.value.orderNo } : {}),
      }),
      receivedAdjustApi.checkInFlight(info.value.contractNo, formData.value.period).catch(() => false),
    ]);
    const list: PerformanceManageRow[] = (res.data ?? [])
      .filter((r: PerformanceManageRow) => r.factStatus !== 'VOIDED' && r.id != null);
    editRows.value = list.map(r => ({
      key: `rd-${r.id}`,
      factId: r.id!,
      isNew: false,
      employeeId: r.employeeId ? String(r.employeeId) : undefined,
      employeeCode: r.employeeCode || '',
      employeeName: r.employeeName || '',
      deptPath: r.deptPath,
      roleType: r.roleType,
      roleName: r.roleName,
      amount: num(r.amount),
      targetAmount: num(r.amount),
      deltaInput: 0,
      ratioPct: r.shareRatio != null ? round4(num(r.shareRatio) * 100) : null,
      originalRatioPct: r.shareRatio != null ? round4(num(r.shareRatio) * 100) : null,
      adjustPending: !!r.adjustPending,
    }));
    // checkInFlight 经响应拦截器返回 R 包装体 { code, data }，取 data 判断
    pendingBlocked.value = (inFlight as any)?.data === true || editRows.value.some(r => r.adjustPending);
    if (pendingBlocked.value) {
      ElMessage.warning('该合同该实收期间已有审批中的实收调整单，请等待审批结束或撤回后再发起');
    }
    totalInput.value = originalTotal.value;
    deltaInput.value = 0;
  } finally {
    loading.value = false;
  }
}

// ==================== 联动逻辑 ====================
/** 汇总行录入调整后合计：既有行按实收占比等比分摊（三类型统一；新人行金额全手工录入不参与分摊） */
function handleTotalInput(v: number | null) {
  const target = v == null ? originalTotal.value : round2(v);
  const rows = existingRows.value;
  if (!rows.length) {
    totalInput.value = target;
    return;
  }
  const amounts = rows.map(r => num(r.amount));
  const delta = round2(target - originalTotal.value);
  const parts = allocateByAmount(amounts, delta);
  rows.forEach((r, i) => {
    r.targetAmount = round2(amounts[i] + parts[i]);
    r.deltaInput = rowDelta(r);
  });
  totalInput.value = round2(targetTotal.value);
  deltaInput.value = totalDelta.value;
}

/** 调整金额录入：自动算出调整后合计，并触发等比分摊 */
function handleDeltaInput(v: number | null) {
  const delta = v == null ? 0 : round2(v);
  handleTotalInput(round2(originalTotal.value + delta));
  deltaInput.value = totalDelta.value;
}

/** 行编辑：合计跟随 = Σ行；全手工调整，不做自动扣减 */
function handleRowAmount(row: EditRow, v: number | null) {
  row.targetAmount = v == null ? null : round2(v);
  row.deltaInput = rowDelta(row);
  totalInput.value = round2(targetTotal.value);
  deltaInput.value = totalDelta.value;
}

/** 行调整金额录入：差额 → 自动算调整后实收，走 handleRowAmount 联动 */
function handleRowDelta(row: EditRow, v: number | null) {
  const delta = v == null ? 0 : round2(v);
  handleRowAmount(row, round2(row.amount + delta));
}

/** 增加角色人：表格末尾加一行，金额留空由用户手工录入 */
function addMemberRow() {
  if (!existingRows.value.length) {
    ElMessage.warning('该合同该期间暂无有效实收明细，无法增加角色人');
    return;
  }
  editRows.value.push({
    key: `new-${++keySeq}`,
    isNew: true,
    employeeCode: '',
    employeeName: '',
    roleType: '合作人',
    amount: 0,
    targetAmount: null,
    ratioPct: null,
    originalRatioPct: null,
    adjustPending: false,
  });
  totalInput.value = round2(targetTotal.value);
}

function removeRow(row: EditRow) {
  editRows.value = editRows.value.filter(r => r.key !== row.key);
  totalInput.value = round2(targetTotal.value);
  deltaInput.value = totalDelta.value;
}

// ==================== 新人选择 ====================
function onEmployeePick(row: EditRow, emp: PerformanceEmployeeOption | null) {
  if (emp) {
    row.employeeId = String(emp.employeeId);
    row.employeeName = emp.employeeName;
    row.employeeCode = emp.employeeCode || '';
    row.deptPath = emp.deptName || '';
  }
}

// ==================== 展示辅助 ====================
function rowDelta(row: EditRow): number {
  return row.targetAmount == null ? 0 : round2(num(row.targetAmount) - row.amount);
}

function ratioUnchanged(row: EditRow): boolean {
  return row.ratioPct == null
    || (row.originalRatioPct != null && Math.abs(num(row.ratioPct) - row.originalRatioPct) < 1e-9);
}

function ratioText(row: EditRow): string {
  if (ratioUnchanged(row)) {
    return row.originalRatioPct == null ? '占比不改' : `原 ${trimZero(row.originalRatioPct)}%（不变）`;
  }
  const from = row.originalRatioPct == null ? '—' : trimZero(row.originalRatioPct);
  return `${from}% → ${trimZero(row.ratioPct)}%`;
}

// ==================== 提交审批 ====================
async function submit() {
  if (!info.value) return;
  if (!formData.value.period) {
    ElMessage.warning('请选择实收期间');
    return;
  }
  if (pendingBlocked.value) {
    ElMessage.warning('该合同该实收期间已有审批中的实收调整单，不能重复发起');
    return;
  }
  const why = reason.value.trim();
  if (!why) {
    ElMessage.warning('请填写调整原因');
    return;
  }
  const existing = existingRows.value;
  if (!existing.length) {
    ElMessage.warning('该合同该期间无有效实收明细，无法调整');
    return;
  }
  if (existing.some(r => r.targetAmount == null)) {
    ElMessage.warning('每行需填写调整后实收金额');
    return;
  }
  // 实收行调整后金额不能为负
  const negativeRow = existing.find(r => num(r.targetAmount) < 0);
  if (negativeRow) {
    ElMessage.warning(`「${negativeRow.employeeName || ''}」调整后实收金额不能为负`);
    return;
  }
  const invalidRatioRow = editRows.value.find(r => r.ratioPct != null && num(r.ratioPct) < 0);
  if (invalidRatioRow) {
    ElMessage.warning(`「${invalidRatioRow.employeeName || '新角色人'}」的角色占比不能为负`);
    return;
  }

  // 驳回调整重提：明细直接落库，随后立即重新提交审批
  if (mode.value === 'revise') {
    if (!applyId.value) {
      ElMessage.warning('审批单信息缺失，请刷新后重试');
      return;
    }
    const overRatioRow = editRows.value.find(r => r.ratioPct != null && num(r.ratioPct) > 100);
    if (overRatioRow) {
      ElMessage.warning(`「${overRatioRow.employeeName || ''}」的角色占比不能大于 100%`);
      return;
    }
    const changedRows = existing.filter(r => Math.abs(rowDelta(r)) >= 0.005 || !ratioUnchanged(r));
    if (!changedRows.length) {
      ElMessage.warning('无任何实收变动，无需调整');
      return;
    }
    submitting.value = true;
    try {
      await receivedApi.reviseAndResubmit(applyId.value, {
        reason: why,
        detailTargets: existing.map(r => ({
          factId: r.factId!,
          amount: round2(num(r.targetAmount)),
          shareRatio: ratioUnchanged(r) ? undefined : round6(num(r.ratioPct) / 100),
        })),
      });
      ElMessage.success('已调整并重新提交审批');
      visible.value = false;
      emit('submitted');
    } finally {
      submitting.value = false;
    }
    return;
  }

  // 新角色人校验：必选员工、金额大于 0、同一员工不重复添加、不与既有实收人员重复
  const nrs = newRows.value;
  for (const nr of nrs) {
    if (!nr.employeeId) {
      ElMessage.warning('每个新角色人都需选择员工');
      return;
    }
    if (nr.targetAmount == null || num(nr.targetAmount) <= 0) {
      ElMessage.warning(`新角色人「${nr.employeeName || ''}」的实收金额必须大于 0`);
      return;
    }
  }
  const pickedIds = new Set<string>();
  for (const nr of nrs) {
    if (pickedIds.has(nr.employeeId!)) {
      ElMessage.warning(`员工「${nr.employeeName || ''}」不能重复添加为新角色人`);
      return;
    }
    pickedIds.add(nr.employeeId!);
    if (existing.some(r => r.employeeId && r.employeeId === nr.employeeId)) {
      ElMessage.warning(`员工「${nr.employeeName || ''}」已在此合同本期实收中，请直接调整其实收金额`);
      return;
    }
  }
  // 无任何变动（无新人、各行金额/占比均未改）时无需发起
  const anyRowChange = existing.some(r => Math.abs(rowDelta(r)) >= 0.005 || !ratioUnchanged(r));
  if (!nrs.length && !anyRowChange) {
    ElMessage.warning('无任何实收变动，无需调整');
    return;
  }

  // 三类型总额规则
  const delta = totalDelta.value;
  if (adjustType.value === 'AMOUNT' && Math.abs(delta) >= 0.005) {
    ElMessage.warning(`业绩调整必须保证修改后实收总额不变（当前变动 ${delta > 0 ? '+' : ''}${delta.toFixed(2)}），请调整明细金额`);
    return;
  }
  if (adjustType.value === 'DEDUCT' && delta >= 0) {
    ElMessage.warning('业绩扣减要求修改后实收总额必须小于原金额');
    return;
  }
  if (adjustType.value === 'INCREASE' && delta <= 0) {
    ElMessage.warning('业绩增加要求修改后实收总额必须大于原金额');
    return;
  }

  const detailTargets = existing.map(r => ({
    factId: r.factId!,
    targetAmount: round2(num(r.targetAmount)),
    shareRatio: ratioUnchanged(r) ? undefined : round6(num(r.ratioPct) / 100),
  }));

  submitting.value = true;
  try {
    await receivedAdjustApi.create({
      adjustType: adjustType.value,
      period: formData.value.period,
      contractNo: info.value.contractNo,
      orderNo: info.value.orderNo,
      reason: why,
      detailTargets,
      targetAmount: round2(targetTotal.value),
      ...(nrs.length
        ? {
            newMembers: nrs.map(nr => ({
              employeeId: nr.employeeId!,
              roleType: nr.roleType?.trim() || '合作人',
              amount: round2(num(nr.targetAmount)),
              shareRatio: nr.ratioPct != null ? round6(num(nr.ratioPct) / 100) : undefined,
            })),
          }
        : {}),
    });
    ElMessage.success('已提交审批，审批通过后自动生效');
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

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function trimZero(v: number | null | undefined): string {
  return v == null ? '—' : String(Number(v.toFixed(4)));
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

defineExpose({ open, openForRevise });
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

.summary-struck {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
  font-weight: 600;
}

.summary-arrow {
  color: var(--el-text-color-secondary);
}

.total-input {
  width: 150px;
}

.summary-delta {
  font-size: 13px;
  font-weight: 600;
  min-width: 72px;
}

.tip-cell {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.cell-sub {
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
  margin-top: 2px;
}

.cell-sub.muted {
  color: var(--el-text-color-placeholder);
}

.amount-strike {
  text-decoration: line-through;
  color: var(--el-text-color-secondary);
}

.amount-arrow {
  color: var(--el-text-color-secondary);
  margin: 0 2px;
}

.amount-positive {
  color: var(--el-color-success);
}

.amount-negative {
  color: var(--el-color-danger);
}

.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.add-member-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.add-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
