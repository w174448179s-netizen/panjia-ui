<template>
  <div v-loading="loading" class="adjust-detail-panel">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />

    <template v-if="detail">
      <!-- 调整单基础信息（仅元数据，金额统一放下方概览条，避免重复） -->
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调整类型">{{ adjustTypeLabel(detail.adjustType) }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 金额变动行内条：对齐合同详情 summary-bar 规范（无底色卡片，13px 标签 + 16px 粗值） -->
      <div v-if="isAddMember" class="amount-bar">
        <span class="ab-item">
          <span class="ab-label">合同业绩总额(调整前)</span>
          <b class="ab-value">{{ formatYuan(detail.originalAmount) }}</b>
        </span>
        <span class="ab-arrow">→</span>
        <span class="ab-item">
          <span class="ab-label">新增角色人业绩</span>
          <b class="ab-value amount-positive">+{{ formatYuan(detail.targetAmount) }}</b>
        </span>
        <span class="ab-arrow">→</span>
        <span class="ab-item">
          <span class="ab-label">调整后合同总额</span>
          <b class="ab-value">{{ formatYuan(addMemberAfterTotal) }}</b>
          <el-tag v-if="addMemberTotalChanged" type="warning" size="small" effect="plain" style="margin-left: 6px">
            总额调整 {{ totalChangedText }}
          </el-tag>
          <el-tag v-else type="success" size="small" effect="plain" style="margin-left: 6px">总额不变</el-tag>
        </span>
      </div>
      <div v-else class="amount-bar-wrap">
        <div class="amount-bar">
          <span class="ab-item">
            <span class="ab-label">{{ isReceivedAdjust ? '实收业绩(调整前)' : '新签业绩(调整前)' }}</span>
            <b class="ab-value">{{ formatYuan(detail.originalAmount) }}</b>
          </span>
          <span class="ab-arrow">→</span>
          <span class="ab-item">
            <span class="ab-label">调整金额</span>
            <b class="ab-value" :class="deltaAmountClass(detail.targetAmount, detail.originalAmount)">
              {{ deltaYuan(detail.targetAmount, detail.originalAmount) }}
            </b>
          </span>
          <span class="ab-arrow">→</span>
          <span class="ab-item">
            <span class="ab-label">{{ isReceivedAdjust ? '实收业绩(调整后)' : '新签业绩(调整后)' }}</span>
            <b class="ab-value">{{ formatYuan(detail.targetAmount) }}</b>
          </span>
        </div>
        <!-- 新签口径：折算后金额次行（实收无折算概念） -->
        <div v-if="!isReceivedAdjust" class="amount-bar amount-bar-sub">
          <span class="ab-item">
            <span class="ab-label">折算后(调整前)</span>
            <b class="ab-value ab-value-sub">{{ formatYuan(detail.convertedOriginalAmount) }}</b>
          </span>
          <span class="ab-arrow">→</span>
          <span class="ab-item">
            <span class="ab-label">调整金额(折算后)</span>
            <b class="ab-value ab-value-sub" :class="deltaAmountClass(detail.convertedTargetAmount, detail.convertedOriginalAmount)">
              {{ deltaYuan(detail.convertedTargetAmount, detail.convertedOriginalAmount) }}
            </b>
          </span>
          <span class="ab-arrow">→</span>
          <span class="ab-item">
            <span class="ab-label">折算后(调整后)</span>
            <b class="ab-value ab-value-sub">{{ formatYuan(detail.convertedTargetAmount) }}</b>
          </span>
        </div>
      </div>

      <!-- 合同信息（仅合同元数据，金额已在上方概览条展示，不再重复）；
           无合同号业务（一手房/家装荐客等）以订单号为锚点，contractNo 为空也要展示 -->
      <div v-if="detail.contractNo || detail.orderNo" class="detail-block">
        <div class="block-title">合同信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同号">
            <span class="contract-no">{{ detail.contractNo || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="签约/认购时间">{{ detail.businessDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="明细条数">{{ detail.detailCount ?? 0 }} 条</el-descriptions-item>
          <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 受影响明细 -->
      <div v-if="detail.details && detail.details.length" class="detail-block">
        <div class="block-title">
          {{ isOffset ? '冲正明细' : isSupplement ? '补录明细' : '受影响明细' }}
          <span class="block-subtitle">
            <template v-if="isOffset">
              （审批通过后在冲正期间 {{ detail.period }} 生成以下记录；正数补录、负数冲正）
            </template>
            <template v-else-if="isSupplement">
              （审批通过后在新签结算月 {{ detail.period }} 生成以下新签业绩记录；实收金额列为同工号同角色的实收到账，新签合计不得超过实收）
            </template>
            <template v-else-if="isAddMemberView">
              （增加角色人：既有角色人按快照扣减/调整后金额预演，新角色人调整前业绩为 0；{{
                addMemberTotalChanged
                  ? `合同总额同步调整 ${totalChangedText}`
                  : '合同总额不变，从既有角色人扣减分摊给新角色人'
              }}）
            </template>
            <template v-else>
              （合同级调整：调整金额按各明细占比分摊）
            </template>
          </span>
        </div>
        <div class="detail-table-wrap">
          <el-table :data="detail.details" size="small" border stripe :row-class-name="rowClassName">
            <el-table-column type="index" label="序号" width="55" align="center" />
            <el-table-column label="门店/组别" prop="deptPath" min-width="150" show-overflow-tooltip />
            <el-table-column label="工号" prop="employeeCode" width="100" show-overflow-tooltip />
            <el-table-column label="姓名" prop="employeeName" width="90" show-overflow-tooltip />
            <el-table-column label="所属角色" min-width="110" show-overflow-tooltip>
              <template #default="scope">
                <!-- role_type 才是角色（客源成交人/合作人）；role_name 列在本系统存的是人员姓名 -->
                <span>{{ scope.row.roleType || scope.row.roleName || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="角色占比" width="100" align="right">
              <template #default="scope">
                <span>{{ formatRatio(scope.row.shareRatio) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-if="isSupplement" label="实收金额" width="120" align="right">
              <template #default="scope">
                <span class="amount amount-received">{{ formatNumber(scope.row.receivedAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="isReceivedAdjust ? '实收业绩' : '新签业绩'" width="120" align="right">
              <template #default="scope">
                <!-- ADD_MEMBER 新角色人（在途虚拟行 amount=null / 已执行 amount=0）调整前业绩按 0.00 展示 -->
                <span class="amount amount-expected">{{ formatNumber(scope.row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column v-if="!isReceivedAdjust" label="折算后" width="110" align="right">
              <template #default="scope">
                <span class="amount amount-ink">{{ formatNumber(scope.row.convertedAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="变动" width="110" align="right">
              <template #default="scope">
                <span :class="getAmountClass(scope.row.deltaAmount)">{{ formatDelta(scope.row.deltaAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="isReceivedAdjust ? '调整后实收' : '调整后业绩'" width="120" align="right">
              <template #default="scope">
                <span class="amount" :class="getAmountClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.afterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column v-if="!isReceivedAdjust" label="折算后" width="110" align="right">
              <template #default="scope">
                <span class="amount amount-ink" :class="getAmountClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.convertedAfterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="scope">
                <el-tag v-if="isNewMemberRow(scope.row)" type="success" size="small" effect="dark">新增角色人</el-tag>
                <el-tag v-else-if="isSupplement && scope.row.target" type="success" size="small" effect="dark">补录记录</el-tag>
                <el-tag v-else-if="isOffset && scope.row.target" type="warning" size="small" effect="dark">冲正记录</el-tag>
                <el-tag v-else-if="scope.row.target" type="danger" size="small" effect="dark">调整行</el-tag>
                <el-tag v-else type="info" size="small" effect="plain">参考行</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { performanceApi, receivedAdjustApi, type AdjustDetailVO } from '@/api/panjia/performance';

/**
 * 业绩调整单详情面板（唯一模板）。
 *
 * 「业绩调整 → 详情」与「我的待办 → 业绩调整审批」曾经各写了一份几乎相同的模板，
 * 口径与列宽长期漂移。现统一由本组件承担，两处只传入 businessId。
 *
 * kind：
 * - perf（默认）：新签调整单（pj_perf_adjust，/perf/adjust）
 * - received：实收调整单（pj_perf_received_adjust，/perf/received-adjust，2026-10-12 物理拆表）
 */
const props = withDefaults(defineProps<{
  businessId: string | number;
  kind?: 'perf' | 'received';
}>(), {
  kind: 'perf'
});

const loading = ref(false);
const loadError = ref('');
const detail = ref<AdjustDetailVO | null>(null);

const ADJUST_TYPE_MAP: Record<string, string> = {
  AMOUNT: '业绩调整',
  DEDUCT: '业绩扣减',
  INCREASE: '业绩增加',
  ADD_MEMBER: '增加角色人',
  MANUAL_OFFSET: '业绩冲正',
  RECEIVED_AMOUNT: '实收调整',
  SUPPLEMENT: '新签补录'
};
const adjustTypeLabel = (t: string) => ADJUST_TYPE_MAP[t] ?? t ?? '—';

/** 历史增加角色人单（2026-10-14 起禁止新建，仅历史展示） */
const isAddMember = computed(() => detail.value?.adjustType === 'ADD_MEMBER');

/** 业绩冲正单：明细为待生成的冲正记录清单（正数补录/负数冲正） */
const isOffset = computed(() => detail.value?.adjustType === 'MANUAL_OFFSET');

/** 新签补录单：明细为待生成的新签业绩记录清单（审批通过后落 PERF_EXPECT 事实） */
const isSupplement = computed(() => detail.value?.adjustType === 'SUPPLEMENT');

/** 明细行中是否含新增角色人行（在途虚拟行 amount=null / 已执行新人 amount=0 且正变动）；
 *  补录单（SUPPLEMENT）明细行同为 amount=0 正变动，须排除以免误判为新增角色人 */
const hasMemberRows = computed(() =>
  !isSupplement.value &&
  (detail.value?.details ?? []).some(r =>
    r.target && (r.amount == null || (Number(r.amount) === 0 && (r.deltaAmount ?? 0) > 0))));

/** 增加角色人视图：历史 ADD_MEMBER 单，或业绩调整/扣减/增加新单中含新增角色人行（三类均可加人） */
const isAddMemberView = computed(() => isAddMember.value || hasMemberRows.value);

/**
 * 实收调整单：金额口径为实收（pj_received_detail），标签不得再用「新签业绩」。
 * 2026-10-14 三类型重构后实收单返回真实类型（AMOUNT/DEDUCT/INCREASE），
 * 口径改由 kind 属性识别（组件数据源即实收单），不再依赖 adjustType === 'RECEIVED_AMOUNT'。
 */
const isReceivedAdjust = computed(() => props.kind === 'received');

/** ADD_MEMBER 调整后合同总额：payload 回填 afterTotalAmount，旧单为空时回退原总额（总额不变） */
const addMemberAfterTotal = computed(() => {
  const d = detail.value;
  if (!d) return undefined;
  return d.afterTotalAmount ?? d.originalAmount;
});

/** 是否同时调整了合同总额（afterTotalAmount 显式存在且与原总额不等） */
const addMemberTotalChanged = computed(() => {
  const d = detail.value;
  if (!d || !isAddMemberView.value || d.afterTotalAmount == null) return false;
  const origin = Number(d.originalAmount ?? 0);
  return Math.abs(Number(d.afterTotalAmount) - origin) > 0.004;
});

/** 总额变化文案：+/-差额（带 ¥） */
const totalChangedText = computed(() => {
  const d = detail.value;
  if (!d || d.afterTotalAmount == null) return '';
  const diff = Number(d.afterTotalAmount) - Number(d.originalAmount ?? 0);
  return `（${diff > 0 ? '+' : ''}¥${diff.toFixed(2)}）`;
});

/** 明细表「新增角色人」行：调整目标行且原值为空（在途虚拟行）或为 0（已执行新人事实） */
const isNewMemberRow = (row: {
  target?: boolean;
  amount?: number | null;
  deltaAmount?: number | null;
}): boolean => {
  if (!isAddMemberView.value || !row.target) return false;
  if (row.amount === null || row.amount === undefined) return true;
  return Number(row.amount) === 0 && (row.deltaAmount ?? 0) > 0;
};

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  EXECUTED: '已执行'
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'info',
    EXECUTED: 'success'
  };
  return (map as any)[s] || 'info';
};

/** 金额：两位小数，带 ¥ 前缀 */
const formatYuan = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

/** 金额：两位小数，无前缀；缺失按 0.00 */
const formatNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
};

/** 变动金额：带 +/- 前缀 */
const formatDelta = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return (n > 0 ? '+' : '') + n.toFixed(2);
};

/** 两数相减保留两位小数（消除浮点误差）；任一值缺失/非数字返回 null */
const subtract2 = (
  target: number | string | undefined | null,
  original: number | string | undefined | null
): number | null => {
  if (target === undefined || target === null || target === ''
    || original === undefined || original === null || original === '') {
    return null;
  }
  const t = Number(target);
  const o = Number(original);
  if (Number.isNaN(t) || Number.isNaN(o)) return null;
  return Math.round((t - o + Number.EPSILON) * 100) / 100;
};

/** 调整金额（调整后 − 调整前）：带 ¥ 与 +/- 前缀，审批时直接可见本单调整了多少钱 */
const deltaYuan = (
  target: number | string | undefined | null,
  original: number | string | undefined | null
): string => {
  const d = subtract2(target, original);
  if (d === null) return '—';
  return `¥${d > 0 ? '+' : ''}${d.toFixed(2)}`;
};

/** 调整金额差额着色：增加绿色 / 减少红色 / 不变不着色 */
const deltaAmountClass = (
  target: number | string | undefined | null,
  original: number | string | undefined | null
): string => {
  const d = subtract2(target, original);
  if (d === null || d === 0) return '';
  return d > 0 ? 'amount-positive' : 'amount-negative';
};

const getAmountClass = (val: number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  if (val > 0) return 'amount-positive';
  if (val < 0) return 'amount-negative';
  return '';
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
};

const rowClassName = ({ row }: { row: any }) => (row.target ? 'target-row' : '');

// 「合同金额」与「调整后业绩」直接取调整单的 originalAmount / targetAmount，
// 不再按 details 累加：调整单执行后 details 查的是新 ACTIVE 事实，amount 已是
// 调整后的值，再累加会与单据头部的 originalAmount/targetAmount 不一致。

onMounted(async () => {
  loading.value = true;
  try {
    const res = props.kind === 'received'
      ? await receivedAdjustApi.getDetail(props.businessId)
      : await performanceApi.getAdjustDetail(props.businessId);
    detail.value = (res as any).data ?? null;
    if (!detail.value) {
      loadError.value = props.kind === 'received' ? '未找到该实收调整单' : '未找到该业绩调整单';
    }
  } catch {
    loadError.value = props.kind === 'received'
      ? '加载实收调整单详情失败'
      : '加载业绩调整单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.adjust-detail-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 4px 2px;
}
.detail-block {
  display: flex;
  flex-direction: column;
}
.block-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  margin: 6px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
  line-height: 1.2;
}
.block-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
  margin-left: 6px;
}
.contract-no {
  color: var(--el-color-primary);
  font-weight: 500;
}
/* 金额变动行内条：对齐合同详情 summary-bar（无底色/无边框，13px 标签 + 16px 粗值 + 灰箭头） */
.amount-bar-wrap {
  display: flex;
  flex-direction: column;
  padding: 2px 0;
}
.amount-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 0;
  padding: 6px 4px;
}
.amount-bar-sub {
  border-top: 1px dashed var(--el-border-color-lighter);
  margin: 0 4px;
  padding: 6px 0 2px;
}
.ab-item {
  display: inline-flex;
  align-items: baseline;
}
.ab-label {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  margin-right: 6px;
}
.ab-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  font-variant-numeric: tabular-nums;
}
.ab-value-sub {
  font-size: 13px;
  font-weight: 600;
}
.ab-arrow {
  color: var(--el-text-color-disabled);
  margin: 0 12px;
  font-size: 13px;
}
.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.amount-expected {
  color: var(--el-text-color-secondary);
}
.amount-red {
  color: var(--el-color-danger);
  font-variant-numeric: tabular-nums;
}
.amount-ink {
  color: #303133;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.amount-positive {
  color: var(--el-color-success);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-negative {
  color: var(--el-color-danger);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-received {
  color: #e6a23c;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.transfer-arrow {
  color: var(--el-color-primary);
}
.detail-table-wrap {
  max-height: 420px;
  overflow-y: auto;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
}
:deep(.target-row) {
  background-color: #fef0f0 !important;
}
:deep(.target-row:hover > td) {
  background-color: #fde2e2 !important;
}
:deep(.el-descriptions__body .el-descriptions__table .el-descriptions-item__label) {
  width: 100px;
}
</style>
