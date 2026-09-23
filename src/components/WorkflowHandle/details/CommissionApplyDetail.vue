<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="detail && !adjustOnly">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="审批单号">{{ detail.applyNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">{{ detail.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detail.currentNode ? nodeLabel(detail.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ applicantName(detail.applicantName, detail.applicantId) }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ detail.approverName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ formatDateTime(detail.approveTime) }}</el-descriptions-item>
        <!-- 结佣合计：结佣调整 AMOUNT 生效时展示「原值 → 调整后值」，折算后同形式（口径同每人明细） -->
        <el-descriptions-item label="结佣合计">
          <template v-if="detailReceivedAdjusted">
            <span class="amount-strike">¥{{ formatAmount(totalOriginalReceivedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
          </template>
          <span v-else class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
          <span class="converted-inline">
            折算后
            <template v-if="detailReceivedAdjusted">
              <span class="amount-strike">¥{{ formatAmount(totalOriginalReceivedConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
            </template>
            <span class="amount amount-ink">¥{{ formatAmount(totalConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <!-- 新签合计（应收业绩）：有调整时展示「原值 → 调整后值」，折算后同形式 -->
        <el-descriptions-item label="新签合计">
          <template v-if="detailAdjusted">
            <span class="amount-strike">¥{{ formatAmount(detail.originalExpectedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-red">¥{{ formatAmount(detail.expectedAmount) }}</span>
          </template>
          <template v-else>
            <span class="amount amount-red">¥{{ formatAmount(detail.expectedAmount) }}</span>
          </template>
          <span class="converted-inline">
            折算后
            <span v-if="detailAdjusted" class="amount-strike">¥{{ formatAmount(totalOriginalExpectedConvertedAmount) }}</span>
            <span v-if="detailAdjusted" class="amount-arrow">→</span>
            <span class="amount amount-ink">¥{{ formatAmount(totalExpectedConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <!-- 结佣特有：发起时实收与应收是否一致（差额单据为「未对齐」） -->
        <el-descriptions-item label="是否对齐">
          <el-tag v-if="detail.aligned != null" :type="detail.aligned ? 'success' : 'warning'" size="small" effect="plain">
            {{ detail.aligned ? '已对齐' : '未对齐' }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(detail.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">
          <span>每人结佣明细（{{ items.length }} 条）</span>
          <el-button v-if="detail && detail.status === 'LOCKED' && !props.periodClosed" type="danger" size="small" @click="onCancel">作废</el-button>
        </div>
        <el-table :data="items" border max-height="420" class="detail-facts-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
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
              <span class="person-name">{{ scope.row.employeeName || employeeName(scope.row.employeeId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <!-- 结佣业绩：结佣调整生效时展示「原值 → 调整后值」，未调整只展示一个值 -->
          <el-table-column label="结佣业绩" align="right" width="200">
            <template #default="scope">
              <template v-if="isReceivedAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
              </template>
              <span v-else class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="190">
            <template #default="scope">
              <template v-if="isReceivedAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalReceivedConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值 -->
          <el-table-column label="新签业绩" align="right" width="190">
            <template #default="scope">
              <template v-if="isAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalExpectedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
              </template>
              <span v-else class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="180">
            <template #default="scope">
              <template v-if="isAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column v-if="detail && detail.status === 'LOCKED' && !props.periodClosed && checkPermi(['commission:adjust:add'])" label="操作" align="center" width="90" fixed="right">
            <template #default="scope">
              <el-button v-if="detail && detail.status === 'LOCKED' && !props.periodClosed && checkPermi(['commission:adjust:add'])" link type="warning" @click="openAdjust('DETAIL', scope.row)">调整</el-button>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该申请单暂无结佣明细" />
          </template>
        </el-table>
      </div>
    </template>
    <!-- 未发起模式：无审批单，界面骨架与审批详情一致，明细为该合同新签业绩构成 -->
    <template v-else-if="summary && !adjustOnly">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="期间">{{ summary.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag type="info" size="small">未发起</el-tag></el-descriptions-item>
        <el-descriptions-item label="是否对齐">—</el-descriptions-item>
        <el-descriptions-item label="合同号">{{ summary.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ summary.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">—</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(summary.amount) }}</span>
          <span class="converted-inline">折算后 <span class="amount amount-ink">¥{{ formatAmount(summary.convertedAmount) }}</span></span>
        </el-descriptions-item>
        <el-descriptions-item label="新签合计" :span="2">
          <span class="amount amount-red">¥{{ formatAmount(summary.expectedAmount) }}</span>
          <span class="converted-inline">折算后 <span class="amount amount-ink">¥{{ formatAmount(summary.expectedConvertedAmount) }}</span></span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(summary.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ summary.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-table-wrap">
        <div class="detail-table-title">每人业绩明细（{{ perfRows.length }} 条）</div>
        <el-table :data="perfRows" border max-height="420" class="detail-facts-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
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
            <template #default="scope"><span class="person-name">{{ scope.row.employeeName || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedAmount != null" class="amount amount-red">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收折算后" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedConvertedAmount != null" class="amount amount-ink">¥{{ formatAmount(scope.row.receivedConvertedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="新签业绩" align="right" width="190">
            <template #default="scope">
              <template v-if="isPerfAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount">¥{{ formatAmount(scope.row.amount) }}</span>
              </template>
              <span v-else class="amount">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="180">
            <template #default="scope">
              <template v-if="isPerfAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedAmount != null" class="amount amount-red">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收折算后" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedConvertedAmount != null" class="amount amount-ink">¥{{ formatAmount(scope.row.receivedConvertedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该合同暂无新签业绩明细" />
          </template>
        </el-table>
      </div>
    </template>

    <!-- 结佣调整弹窗（合同级 / 明细级共用） -->
    <el-dialog v-model="adjustDialog.visible" :title="adjustDialog.scope === 'CONTRACT' ? '结佣调整（合同级）' : '结佣调整（明细级）'" width="520px" append-to-body destroy-on-close @close="onAdjustDialogClose">
      <el-form ref="adjustFormRef" :model="adjustForm" :rules="adjustRules" label-width="110px">
        <el-form-item label="调整类型" prop="adjustType">
          <el-radio-group v-model="adjustForm.adjustType">
            <el-radio-button value="AMOUNT">金额调整</el-radio-button>
            <el-radio-button value="VOID">业绩冲销</el-radio-button>
            <el-radio-button value="TRANSFER">部门划转</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="当前金额">
          <span class="amount amount-red">¥{{ formatAmount(adjustDialog.currentAmount) }}</span>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'AMOUNT'" label="调整金额" prop="adjustAmount">
          <el-input-number
            v-model="adjustForm.adjustAmount"
            :precision="2"
            :step="100"
            :min="-num(adjustDialog.currentAmount)"
            controls-position="right"
            style="width: 100%"
            placeholder="正数增加，负数减少"
          />
          <div class="form-tip">
            <span :class="adjustDeltaClass(adjustForm.adjustAmount)">
              {{ (adjustForm.adjustAmount ?? 0) >= 0 ? '+' : '' }}{{ formatAmount(adjustForm.adjustAmount ?? 0) }}
            </span>
            → 调整后：¥{{ formatAmount(adjustTargetAmount) }}
          </div>
        </el-form-item>
        <el-form-item v-if="adjustForm.adjustType === 'TRANSFER'" label="目标门店" prop="targetDeptId">
          <el-tree-select
            v-model="adjustForm.targetDeptId"
            :data="deptTreeRaw"
            :props="{ label: 'deptName', children: 'children' }"
            value-key="deptId"
            node-key="deptId"
            check-strictly
            placeholder="请选择目标门店/组别"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="adjustForm.reason" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="请输入调整原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="adjustSubmitting" @click="submitAdjust">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { commissionApi, type CommissionApplication, type CommissionItemDetail, type CommissionContractVO } from '@/api/panjia/commission';
import { performanceApi, type PerformanceManageRow } from '@/api/panjia/performance';
import { useEmployeeMap } from '../useEmployeeMap';
import { useDeptScope } from '@/hooks/useDeptScope';
import { checkPermi } from '@/utils/permission';

const props = defineProps<{
  /** 已发起模式：结佣申请单 businessId（工作流查看/办理、结佣明细页已发起行） */
  businessId?: string | number;
  /** 未发起模式：合同行摘要。无审批单，按同款界面骨架展示新签业绩构成 */
  summary?: CommissionContractVO | null;
  /** 未发起模式的查询号（合同号，一手房等无合同号时传订单号） */
  bizNo?: string;
  /** 从列表「调整」入口进入：详情加载后自动弹出合同级调整弹窗（仅 LOCKED 生效） */
  autoAdjust?: boolean;
  /** 仅调整模式：不渲染详情内容，只展示调整弹窗（配合 autoAdjust 使用） */
  adjustOnly?: boolean;
  /** 该期间是否已封账（封账后隐藏作废/调整按钮） */
  periodClosed?: boolean;
}>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionApplication | null>(null);
const items = ref<CommissionItemDetail[]>([]);
/** 未发起模式：合同新签业绩构成明细（listManageContractDetails，factType=PERF_EXPECT） */
const perfRows = ref<PerformanceManageRow[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

/** 头部「折算后合计」：按明细逐行折算后金额求和，与表格同源，避免合计与明细对不上 */
const totalConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.convertedAmount), 0));
const totalExpectedConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.expectedConvertedAmount), 0));
/** 调整前应收的折算后合计：与明细列同源，供「应收合计」展示「原折算 → 调整后折算」 */
const totalOriginalExpectedConvertedAmount = computed(() =>
  items.value.reduce((s, it) => s + num(it.originalConvertedAmount), 0));

/**
 * 结佣合计「原值 → 调整后值」：头部原值不在申请单快照中（结佣调整直接 supersede 事实），
 * 与现有 totalConvertedAmount 一样按每人明细同源求和；任一行被结佣金额调整即展示。
 * 未调整行回退取当前金额，保证合计与表格逐行一致。
 */
const detailReceivedAdjusted = computed(() =>
  items.value.some((it) => !!it.receivedAdjusted && it.originalAmount != null));
const totalOriginalReceivedAmount = computed(() =>
  items.value.reduce((s, it) => s + num(it.receivedAdjusted ? it.originalAmount : it.amount), 0));
const totalOriginalReceivedConvertedAmount = computed(() =>
  items.value.reduce((s, it) => s + num(it.receivedAdjusted ? it.originalReceivedConvertedAmount : it.convertedAmount), 0));

/**
 * 是否按「原值 → 调整后值」展示：需后端 expectedAdjusted 标记与调整前值同时成立。
 * 两者缺一（如差额行无关联业绩事实）就退回单值展示，避免出现「0.00 → 12000.00」这类误导。
 * 详情头部（CommissionApplication）与每人明细行（CommissionItemDetail）共用同一判定。
 */
const isAdjusted = (
  row: { expectedAdjusted?: boolean | null; originalExpectedAmount?: number | string | null } | null | undefined,
): boolean => !!row?.expectedAdjusted && row.originalExpectedAmount != null;
const detailAdjusted = computed(() => isAdjusted(detail.value));

/**
 * 结佣业绩（PERF_REAL）是否按「原值 → 调整后值」展示：需后端 receivedAdjusted 标记与
 * 调整前值同时成立（结佣调整 AMOUNT 生效；部门划转金额不变不置标记）。
 */
const isReceivedAdjusted = (
  row: { receivedAdjusted?: boolean | null; originalAmount?: number | string | null } | null | undefined,
): boolean => !!row?.receivedAdjusted && row.originalAmount != null;

const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toFixed(2);
const formatDateTime = (val?: string | null): string => (val ? val.replace('T', ' ').substring(0, 19) : '—');
const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
/** SUBMITTED 全程「审批中」，与结佣明细列表、工作流系统页（字典 waiting）保持一致 */
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    NONE: 'info', DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};
const nodeLabel = (node?: string) => (node === 'FINANCE' ? '财务审批' : node === 'DIRECTOR' ? '总监审批' : (node || '—'));

// 门店/组别拆分：deptPath 形如「集团-门店-组别」，门店取倒数第二段，组别取最后一段（与实收详情同口径）
const deptParts = (path: string): string[] => path.split('-').map((s) => s.trim()).filter(Boolean);
const deptStore = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '—');
};
const deptGroup = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
};

/** 发起人姓名由后端翻译，直接展示；空值 = 系统自动发起（如导入归档自动建单） */
const applicantName = (name?: string | null, userId?: number | string | null) => {
  if (name) return name;
  if (userId === null || userId === undefined || String(userId).trim() === '' || Number(userId) === 0) return '系统自动';
  return '—';
};

/** 未发起模式业绩行：金额与调整前不一致即视为已调整（与合同业绩明细页同口径） */
const isPerfAdjusted = (row: { amount?: number | string | null; originalAmount?: number | string | null }): boolean =>
  num(row.amount) !== num(row.originalAmount);

/** 业绩行合并 key：员工 + 所属角色（实收口径与应收口径的行按此对应） */
const perfKey = (row: { employeeId?: string | null; roleType?: string | null; roleName?: string | null }): string =>
  `${row.employeeId}|${row.roleType || row.roleName || ''}`;

// ==================== 结佣调整弹窗 ====================
const { deptTreeRaw, loadDeptTree } = useDeptScope();

const adjustDialog = reactive({
  visible: false,
  scope: 'CONTRACT' as 'CONTRACT' | 'DETAIL',
  currentAmount: 0,
  itemId: undefined as number | string | undefined,
});

const adjustForm = reactive({
  adjustType: 'AMOUNT',
  adjustAmount: undefined as number | undefined,
  targetDeptId: undefined as number | string | undefined,
  reason: '',
});
const adjustTargetAmount = computed(() =>
  Math.round((num(adjustDialog.currentAmount) + num(adjustForm.adjustAmount)) * 100) / 100);
const adjustSubmitting = ref(false);
const adjustFormRef = ref<FormInstance>();

const adjustRules = {
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  adjustAmount: [
    {
      validator: (_r: unknown, v: number | undefined, cb: (e?: Error) => void) => {
        if (adjustForm.adjustType === 'AMOUNT' && (v === undefined || v === null)) cb(new Error('请输入调整金额'));
        else cb();
      },
      trigger: 'blur',
    },
  ],
  targetDeptId: [
    {
      validator: (_r: unknown, v: number | string | undefined, cb: (e?: Error) => void) => {
        if (adjustForm.adjustType === 'TRANSFER' && (v === undefined || v === null || v === '')) cb(new Error('请选择目标门店'));
        else cb();
      },
      trigger: 'change',
    },
  ],
};

const adjustDeltaClass = (v: number | undefined) => {
  const d = num(v);
  return d > 0 ? 'amount-positive' : d < 0 ? 'amount-negative' : '';
};

const emit = defineEmits(['adjusted', 'cancelled', 'adjust-closed']);

const openAdjust = (scope: 'CONTRACT' | 'DETAIL', row?: any) => {
  if (!detail.value) return;
  loadDeptTree();
  adjustDialog.scope = scope;
  adjustDialog.itemId = row?.itemId;
  adjustDialog.currentAmount = scope === 'CONTRACT' ? num(detail.value.totalAmount) : num(row?.amount);
  adjustForm.adjustType = 'AMOUNT';
  adjustForm.adjustAmount = undefined;
  adjustForm.targetDeptId = undefined;
  adjustForm.reason = '';
  adjustDialog.visible = true;
};

const submitAdjust = async () => {
  if (!adjustFormRef.value || !detail.value) return;
  try {
    await adjustFormRef.value.validate();
  } catch {
    return;
  }
  adjustSubmitting.value = true;
  try {
    const payload: any = {
      applicationId: detail.value.id,
      adjustScope: adjustDialog.scope,
      adjustType: adjustForm.adjustType,
      reason: adjustForm.reason,
    };
    if (adjustDialog.scope === 'DETAIL') payload.itemId = adjustDialog.itemId;
    if (adjustForm.adjustType === 'AMOUNT') payload.targetAmount = adjustTargetAmount.value;
    if (adjustForm.adjustType === 'TRANSFER') payload.targetDeptId = adjustForm.targetDeptId;
    await commissionApi.createAdjust(payload);
    ElMessage.success('调整单已提交，等待审批');
    adjustDialog.visible = false;
    emit('adjusted');
  } finally {
    adjustSubmitting.value = false;
  }
};

/** 调整弹窗关闭（含取消/点 X）：通知父组件清理状态 */
const onAdjustDialogClose = () => {
  emit('adjust-closed');
};

/** 作废已锁定申请单：冲销全部明细，不再计入工资，可重新发起 */
const onCancel = async () => {
  if (!detail.value) return;
  try {
    await ElMessageBox.confirm(
      `确认作废已锁定申请单「${detail.value.applyNo}」？\n作废后该单全部结佣明细将冲销，不再计入工资；业绩事实释放，可重新发起并按发起日生成当月结佣记录。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(detail.value.id);
    ElMessage.success('已作废');
    emit('cancelled');
  } catch { /* 拦截器处理 */ }
};

/** 列表「调整」入口：详情加载完成且已锁定时，自动弹出合同级调整弹窗 */
watch(() => detail.value, (d) => {
  if (props.autoAdjust && d && d.status === 'LOCKED') {
    openAdjust('CONTRACT');
  }
});

onMounted(async () => {
  // 未发起模式：无审批单，按合同/订单号拉新签业绩构成（PERF_EXPECT），
  // 并发拉实收口径（PERF_REAL）按员工+角色合并，补充每人实收金额
  if (props.businessId == null || props.businessId === '') {
    if (props.summary && props.bizNo) {
      loading.value = true;
      try {
        const period = String(props.summary.period || '');
        const nos = String(props.bizNo);
        const [expectRes, realRes] = await Promise.all([
          performanceApi.listManageContractDetails({ period, factType: 'PERF_EXPECT', contractNos: nos }),
          performanceApi.listManageContractDetails({ period, factType: 'PERF_REAL', contractNos: nos }),
        ]);
        // 实收按「员工+角色」聚合（同 key 多条时累加）
        const realMap = new Map<string, { amount: number; converted: number }>();
        for (const r of (realRes.data ?? []) as PerformanceManageRow[]) {
          const key = perfKey(r);
          const prev = realMap.get(key);
          realMap.set(key, {
            amount: num(prev?.amount) + num(r.amount),
            converted: num(prev?.converted) + num(r.convertedAmount),
          });
        }
        perfRows.value = ((expectRes.data ?? []) as PerformanceManageRow[]).map((row) => {
          const real = realMap.get(perfKey(row));
          return { ...row, receivedAmount: real ? real.amount : null, receivedConvertedAmount: real ? real.converted : null };
        });
      } catch {
        loadError.value = '加载业绩明细失败';
      } finally {
        loading.value = false;
      }
    }
    return;
  }
  loading.value = true;
  try {
    const [res] = await Promise.all([commissionApi.getApplication(props.businessId), loadEmployees()]);
    const data = (res as any).data ?? {};
    detail.value = data.application ?? null;
    items.value = data.items ?? [];
    if (!detail.value) loadError.value = '未找到该结佣审批单';
  } catch {
    loadError.value = '加载结佣审批单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.amount-red {
  color: #f56c6c;
}
.amount-ink {
  color: #303133;
}
.amount-gray {
  color: #909399;
  font-weight: 400;
}
.amount-positive { color: #67c23a; font-weight: 600; }
.amount-negative { color: #f56c6c; font-weight: 600; }
.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.person-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.dept-wrap {
  line-height: 1.5;
  word-break: break-word;
}
.dept-store {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.dept-group {
  color: var(--el-text-color-secondary);
}
/* ============ 「原值 → 调整后值」展示（头部应收合计 / 每人明细两列共用） ============
   有调整时：被调整掉的原值置灰加删除线，箭头连接调整后值；未调整时只渲染一个值。
   口径与「合同业绩明细」页 / 实收明细页保持一致。 */
.amount-strike {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #c0c4cc;
  text-decoration: line-through;
}
.amount-arrow {
  margin: 0 4px;
  color: #c0c4cc;
}
/* 应收合计右侧的折算后内联段：灰字标签 + 值，与左侧应收合计同一格并排 */
.converted-inline {
  margin-left: 10px;
  font-size: 13px;
  color: #909399;
}
</style>
