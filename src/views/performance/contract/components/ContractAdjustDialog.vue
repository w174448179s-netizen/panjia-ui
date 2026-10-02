<template>
  <el-dialog
    v-model="visible"
    title="合同业绩调整"
    width="92%"
    top="4vh"
    append-to-body
    destroy-on-close
    class="contract-adjust-dialog"
  >
    <div v-loading="loading">
      <!-- 合同信息（类详情界面） -->
      <el-descriptions :column="3" border size="small" class="info-desc">
        <el-descriptions-item label="合同号/订单号">{{ info?.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ info?.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ info?.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ info?.propertyAddress || '—' }}</el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(info?.businessDate) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 存在审批中调整单（含增加角色人）时禁止重复发起，避免链式在途单互相覆盖 -->
      <template v-if="pendingBlocked">
        <el-alert
          type="warning"
          show-icon
          :closable="false"
          title="该合同已有审批中的调整单，请等待审批结束后再发起新的调整"
          style="margin: 10px 0"
        />
        <div class="pending-title">审批中调整明细（逐人）</div>
        <el-table :data="pendingRows" border size="small" style="margin-bottom: 12px">
          <el-table-column label="门店/组别" prop="deptPath" min-width="140" show-overflow-tooltip />
          <el-table-column label="姓名" prop="employeeName" min-width="120" />
          <el-table-column label="所属角色" prop="roleType" min-width="100" />
          <el-table-column label="调整前业绩" width="110" align="right">
            <template #default="{ row }">{{ row.amount == null ? '0.00' : formatAmount(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="调整后业绩" width="190" align="right">
            <template #default="{ row }">
              <span class="amount-arrow">→</span>
              <b :class="(row.pendingDelta ?? 0) >= 0 ? 'amount-positive' : 'amount-negative'">
                {{ formatAmount(row.pendingAmount) }}
              </b>
              <span
                v-if="row.pendingDelta != null && row.pendingDelta !== 0"
                :class="row.pendingDelta > 0 ? 'amount-positive' : 'amount-negative'"
                style="font-size: 12px; margin-left: 4px"
              >{{ row.pendingDelta > 0 ? '+' : '' }}{{ row.pendingDelta.toFixed(2) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="标记" width="100" align="center">
            <template #default="{ row }">
              <el-tag v-if="row.isNewMember" type="success" size="small" effect="dark">新增角色人</el-tag>
              <el-tag v-else type="warning" size="small" effect="plain">调整审批中</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 汇总行：调整类型 + 调整后合计录入（明细跟着变）+ 折算自动 -->
      <div class="adjust-summary-bar">
        <div class="summary-cell">
          <span class="summary-label">调整类型</span>
          <el-select v-model="adjustType" style="width: 140px" :disabled="pendingBlocked" @change="handleTypeChange">
            <el-option label="金额调整" value="AMOUNT" />
            <el-option label="增加角色人" value="ADD_MEMBER" />
          </el-select>
        </div>
        <div class="summary-cell amount-cell">
          <span class="summary-label">新签业绩合计</span>
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
        <div class="summary-cell amount-cell">
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
        <div class="summary-cell">
          <span class="summary-label">折算后</span>
          <b class="summary-struck">{{ formatAmount(originalConvertedTotal) }}</b>
          <span class="summary-arrow">→</span>
          <b>{{ formatAmount(targetConvertedTotal) }}</b>
        </div>
        <div class="summary-cell tip-cell" v-if="adjustType === 'ADD_MEMBER'">
          增加角色人后请手动调整各角色人金额，提交时若合同总额发生变化需二次确认
        </div>
        <div class="summary-cell tip-cell" v-else>
          录入调整后合计 → 明细按业绩占比等比分摊；可再逐行微调（差额实时校验）；如需增加角色人，请将调整类型切换为「增加角色人」
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
            <span v-else>{{ row.roleType || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="角色占比" width="160" align="center">
          <template #default="{ row }">
            <el-input-number
              v-model="row.ratioPct"
              :precision="4"
              :min="0.0001"
              :max="100"
              :controls="false"
              :disabled="pendingBlocked"
              placeholder="不改"
              style="width: 120px"
            />
            <div class="cell-sub">{{ ratioText(row as EditRow) }}</div>
          </template>
        </el-table-column>
        <el-table-column label="新签业绩（调整后）" width="210" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.targetAmount"
              :precision="2"
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
        <el-table-column label="折算后（自动）" width="120" align="right">
          <template #default="{ row }">
            {{ row.targetAmount != null && row.factor ? formatAmount(round2(row.targetAmount * row.factor)) : '—' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="86" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.adjustPending" type="warning" size="small" effect="plain">审批中</el-tag>
            <el-tag v-else type="info" size="small" effect="plain">待审批</el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="adjustType === 'ADD_MEMBER'" label="操作" width="70" align="center">
          <template #default="{ row }">
            <el-button v-if="row.isNew" type="danger" link size="small" @click="removeRow(row as EditRow)">删除</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该合同暂无有效业绩明细" />
        </template>
      </el-table>

      <!-- 加人入口仅在「增加角色人」类型下展示：AMOUNT 语义为既有行总额调整，新人行不参与提交 -->
      <div class="add-member-bar" v-if="adjustType === 'ADD_MEMBER'">
        <el-button type="primary" plain size="small" icon="Plus" :disabled="pendingBlocked" @click="addMemberRow()">增加角色人</el-button>
        <span class="add-tip">新增行选择员工并录入业绩，自动回填让出金额；全部修改随下方一次提交审批</span>
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
      >提交审批</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import type {
  AdjustCreateForm,
  PerformanceEmployeeOption,
  PerformanceManageRow,
} from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
/** 合同存在审批中的调整单（后端在途预览会给行打 adjustPending，ADD_MEMBER 还会带 id=null 的新人虚拟行） */
const pendingBlocked = ref(false);
/** 在途调整单逐人变化（含 ADD_MEMBER 新人虚拟行），仅展示「原值 → 调整后」不可编辑 */
interface PendingRow {
  employeeName: string;
  roleType?: string;
  deptPath?: string;
  amount: number | null;        // 原值；新人虚拟行为 null（展示 0）
  pendingAmount: number | null; // 调整后
  pendingDelta: number | null;
  isNewMember: boolean;
}
const pendingRows = ref<PendingRow[]>([]);

interface AdjustInfo {
  contractNo: string;
  bizType?: string;
  propertyAddress?: string;
  businessDate?: string;
  period: string;
}
const info = ref<AdjustInfo | null>(null);

interface EditRow {
  key: string;
  factId?: string;      // 既有行才有（事实 ID）
  isNew: boolean;
  employeeId?: string;
  employeeCode: string;
  employeeName: string;
  deptPath?: string;
  roleType?: string;
  amount: number;                 // 当前业绩（原值）
  convertedOriginal: number;      // 当前折算后金额（原值）
  factor?: number;                // 折算系数（折算列自动计算用）
  targetAmount: number | null;    // 调整后业绩（可编辑）
  deltaInput?: number | null;     // 调整金额（可编辑，与 targetAmount 双向联动）
  ratioPct: number | null;        // 角色占比编辑值（百分数；null=不修改）
  originalRatioPct: number | null;
  adjustPending: boolean;         // 该行已有审批中的调整单
}
const editRows = ref<EditRow[]>([]);
const adjustType = ref<'AMOUNT' | 'ADD_MEMBER'>('AMOUNT');
const totalInput = ref<number | null>(null);
const deltaInput = ref<number | null>(null);
const reason = ref('');
let keySeq = 0;

// ==================== 计算属性 ====================
const existingRows = computed(() => editRows.value.filter(r => !r.isNew));
const newRows = computed(() => editRows.value.filter(r => r.isNew));
const originalTotal = computed(() => round2(existingRows.value.reduce((s, r) => s + num(r.amount), 0)));
const originalConvertedTotal = computed(() =>
  round2(existingRows.value.reduce((s, r) => s + num(r.convertedOriginal), 0)));
const targetTotal = computed(() => round2(editRows.value.reduce((s, r) => s + num(r.targetAmount), 0)));
const totalDelta = computed(() => round2(targetTotal.value - originalTotal.value));
const targetConvertedTotal = computed(() => round2(
  editRows.value.reduce((s, r) => s + (r.targetAmount != null ? num(r.targetAmount) * num(r.factor) : 0), 0),
));

// ==================== 打开弹窗：拉取明细初始化可编辑表格 ====================
async function open(payload: AdjustInfo) {
  info.value = payload;
  adjustType.value = 'AMOUNT';
  reason.value = '';
  totalInput.value = null;
  // 必须重置「调整金额」差额框：否则上一单录入的差额会残留到后续打开的每个合同
  deltaInput.value = null;
  editRows.value = [];
  pendingBlocked.value = false;
  pendingRows.value = [];
  visible.value = true;
  loading.value = true;
  try {
    const res = await performanceApi.listManageContractDetails({
      period: payload.period,
      factType: 'PERF_EXPECT',
      contractNos: payload.contractNo,
    });
    const allRows: PerformanceManageRow[] = (res.data ?? [])
      .filter((r: PerformanceManageRow) => r.factStatus !== 'VOIDED');
    // 在途单逐人变化（保留 ADD_MEMBER 新人虚拟行 id=null，用于只读展示 0 → X）
    pendingRows.value = allRows
      .filter(r => r.adjustPending)
      .map(r => ({
        employeeName: r.employeeName || '',
        roleType: r.roleType || r.roleName,
        deptPath: r.deptPath,
        amount: r.id == null ? null : num(r.amount),
        pendingAmount: r.adjustPendingAmount != null ? num(r.adjustPendingAmount) : null,
        pendingDelta: r.adjustPendingDelta != null ? num(r.adjustPendingDelta) : null,
        isNewMember: r.id == null,
      }));
    // 编辑底表：已作废行与新人虚拟行（id=null，非真实事实）不参与
    const rows: PerformanceManageRow[] = allRows.filter(r => r.id != null);
    pendingBlocked.value = rows.some(r => r.adjustPending);
    if (pendingBlocked.value) {
      ElMessage.warning('该合同已有审批中的调整单，请等待审批结束后再发起调整');
    }
    editRows.value = rows.map(r => ({
      key: `f-${r.id}`,
      factId: r.id!,
      isNew: false,
      employeeId: r.employeeId,
      employeeCode: r.employeeCode || '',
      employeeName: r.employeeName || '',
      deptPath: r.deptPath,
      roleType: r.roleType || r.roleName,
      amount: num(r.amount),
      convertedOriginal: num(r.convertedAmount),
      factor: num(r.conversionFactor) || undefined,
      targetAmount: num(r.amount),
      deltaInput: 0,
      ratioPct: r.shareRatio != null ? round4(num(r.shareRatio) * 100) : null,
      originalRatioPct: r.shareRatio != null ? round4(num(r.shareRatio) * 100) : null,
      adjustPending: !!r.adjustPending,
    }));
    totalInput.value = originalTotal.value;
  } finally {
    loading.value = false;
  }
}

// ==================== 联动逻辑 ====================
/**
 * 汇总行录入调整后合计。
 * AMOUNT：既有行按业绩占比等比分摊；
 * ADD_MEMBER：不自动分摊，仅更新合计数字（各角色人金额全手工调整）。
 */
function handleTotalInput(v: number | null) {
  const target = v == null ? originalTotal.value : round2(v);
  const rows = existingRows.value;
  if (!rows.length) {
    totalInput.value = target;
    return;
  }
  if (adjustType.value === 'ADD_MEMBER') {
    // 加人模式不自动分摊：合计回显为行合计（输入框仅作展示，手动逐行调整为准）
    totalInput.value = round2(targetTotal.value);
    deltaInput.value = totalDelta.value;
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
  const target = round2(originalTotal.value + delta);
  handleTotalInput(target);
  deltaInput.value = totalDelta.value;
}

/** 行编辑：合计跟随 = Σ行；全手工调整，不做自动扣减 */
function handleRowAmount(row: EditRow, v: number | null) {
  row.targetAmount = v == null ? null : round2(v);
  row.deltaInput = rowDelta(row);
  totalInput.value = round2(targetTotal.value);
  deltaInput.value = totalDelta.value;
}

/** 行调整金额录入：差额 → 自动算调整后业绩，走 handleRowAmount 联动 */
function handleRowDelta(row: EditRow, v: number | null) {
  const delta = v == null ? 0 : round2(v);
  handleRowAmount(row, round2(row.amount + delta));
}

/** 类型切换：统一重置既有行为原值（避免金额调整残留叠加），再按类型补新人行或重算合计 */
function handleTypeChange() {
  existingRows.value.forEach(r => { r.targetAmount = round2(r.amount); r.deltaInput = 0; });
  if (adjustType.value === 'ADD_MEMBER') {
    if (!newRows.value.length) {
      addMemberRow();
    }
    totalInput.value = originalTotal.value;
  } else {
    editRows.value = editRows.value.filter(r => !r.isNew);
    totalInput.value = round2(targetTotal.value);
  }
  deltaInput.value = totalDelta.value;
}

/** 增加角色人：表格末尾加一行，金额留空由用户手工录入（不自动扣减既有行） */
function addMemberRow() {
  // 折算因子沿用同合同既有行（同业务类型折算口径一致），保证新人行也能实时展示折算后金额
  const factor = existingRows.value.find(r => r.factor != null)?.factor;
  editRows.value.push({
    key: `new-${++keySeq}`,
    isNew: true,
    employeeCode: '',
    employeeName: '',
    roleType: '合作人',
    amount: 0,
    convertedOriginal: 0,
    factor,
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

// ==================== 新人选择（EmployeeSelect 公共组件，选中后自动回填姓名/工号/门店） ====================
function onEmployeePick(row: EditRow, emp: PerformanceEmployeeOption | null) {
  if (emp) {
    row.employeeId = String(emp.employeeId);
    row.employeeName = emp.employeeName;
    row.employeeCode = emp.employeeCode || '';
    // 选中员工后带出所属门店/组别（部门全路径名）
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

// ==================== 提交审批（一张单统一提交全部修改） ====================
async function submit() {
  if (!info.value) return;
  if (pendingBlocked.value) {
    ElMessage.warning('该合同已有审批中的调整单，不能重复发起');
    return;
  }
  const why = reason.value.trim();
  if (!why) {
    ElMessage.warning('请填写调整原因');
    return;
  }
  const existing = existingRows.value;
  if (existing.some(r => r.targetAmount == null)) {
    ElMessage.warning('每行需填写调整后业绩金额');
    return;
  }
  // 角色占比：填了就必须大于 0（清空=不修改/不设置）
  const invalidRatioRow = editRows.value.find(r => r.ratioPct != null && num(r.ratioPct) <= 0);
  if (invalidRatioRow) {
    ElMessage.warning(`「${invalidRatioRow.employeeName || '新角色人'}」的角色占比须大于 0，不需要调整请清空输入框`);
    return;
  }

  const detailTargets = existing.map(r => ({
    factId: r.factId!,
    targetAmount: round2(num(r.targetAmount)),
    shareRatio: ratioUnchanged(r) ? undefined : round6(num(r.ratioPct) / 100),
  }));

  const form: AdjustCreateForm = {
    adjustType: 'AMOUNT',
    period: info.value.period,
    factType: 'PERF_EXPECT',
    adjustScope: 'CONTRACT',
    contractNo: info.value.contractNo,
    reason: why,
    detailTargets,
  };

  if (adjustType.value === 'ADD_MEMBER') {
    const nr = newRows.value[0];
    if (!nr || !nr.employeeId) {
      ElMessage.warning('增加角色人需选择员工');
      return;
    }
    if (nr.targetAmount == null || num(nr.targetAmount) <= 0) {
      ElMessage.warning('新角色人业绩金额必须大于 0');
      return;
    }
    // 允许「增加角色人 + 合同金额调整」混合发起：总额发生变化时二次确认，不再拦截提交
    const diff = totalDelta.value;
    if (Math.abs(diff) > 0.004) {
      try {
        await ElMessageBox.confirm(
          `本次调整除增加角色人「${nr.employeeName || ''}」外，合同业绩总额将由 ${formatAmount(originalTotal.value)} `
          + `调整为 ${formatAmount(targetTotal.value)}（${diff > 0 ? '+' : ''}${diff.toFixed(2)}）。是否确认提交审批？`,
          '合同金额有调整',
          { confirmButtonText: '确认提交', cancelButtonText: '再检查一下', type: 'warning' },
        );
      } catch {
        return; // 用户取消
      }
    }
    Object.assign(form, {
      adjustType: 'ADD_MEMBER',
      newEmployeeId: nr.employeeId,
      newRoleType: nr.roleType?.trim() || '合作人',
      newAmount: round2(num(nr.targetAmount)),
      newShareRatio: nr.ratioPct != null && num(nr.ratioPct) > 0
        ? round6(num(nr.ratioPct) / 100) : undefined,
    });
  } else {
    if (totalInput.value == null) {
      ElMessage.warning('请录入调整后业绩合计');
      return;
    }
    Object.assign(form, {
      adjustType: 'AMOUNT',
      targetAmount: round2(num(totalInput.value)),
    });
  }

  submitting.value = true;
  try {
    await performanceApi.createAdjust(form);
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

function formatDateTime(v?: string | null): string {
  return v ? v.replace('T', ' ').slice(0, 16) : '—';
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

.pending-title {
  margin: 10px 0 6px;
  font-weight: 600;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
</style>
