<template>
  <!--
    结佣调整审批（我的待办 → 办理弹窗）详情体。
    三段式对齐新签调整详情（AdjustDetailPanel）：调整单基础信息 / 合同信息 / 受影响明细。
  -->
  <div v-loading="loading" class="adjust-detail-panel">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />

    <template v-if="detail">
      <!-- 调整单基础信息 -->
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调整类型">{{ typeLabel(detail.adjustType) }}</el-descriptions-item>
        <el-descriptions-item label="调整范围">
          <el-tag :type="detail.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
            {{ detail.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.adjustScope === 'DETAIL'" label="员工">
          {{ detail.employeeName ? `${detail.employeeName}（${detail.employeeCode || '—'}）` : '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="门店/组别">
          <span>{{ detail.deptName || '—' }}</span>
        </el-descriptions-item>
        <el-descriptions-item :label="isAddMember ? '合同业绩总额(调整前)' : '结佣业绩（调整前）'">
          <span class="amount">{{ formatYuan(detail.originalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="折算后（调整前）">
          <span class="amount amount-ink">{{ formatYuan(detail.convertedOriginalAmount) }}</span>
        </el-descriptions-item>
        <template v-if="detail.adjustType === 'AMOUNT' || detail.adjustType === 'DISCOUNT' || detail.adjustType === 'DIFF'">
          <el-descriptions-item label="调整金额">
            <span :class="deltaClass(detail.diffAmount)">{{ deltaYuan(detail.diffAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="调整金额（折算后）">
            <span :class="deltaClass(detail.convertedDiffAmount)">{{ deltaYuan(detail.convertedDiffAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="结佣业绩（调整后）">
            <span class="amount amount-red">{{ formatYuan(detail.newAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="折算后（调整后）">
            <span class="amount amount-ink">{{ formatYuan(detail.convertedNewAmount) }}</span>
          </el-descriptions-item>
        </template>
        <template v-if="isAddMember">
          <el-descriptions-item label="新增角色人业绩">
            <span class="amount-positive">+{{ formatYuan(detail.newAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="调整后合同总额">
            <span class="amount amount-ink">{{ formatNumber(afterTotal) }}</span>
            <el-tag :type="totalChanged ? 'warning' : 'success'" size="small" effect="plain" style="margin-left: 6px">
              {{ totalChanged ? `总额调整 ${totalChangedText}` : '总额不变' }}
            </el-tag>
          </el-descriptions-item>
        </template>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 合同信息 -->
      <div v-if="detail.contractNo" class="detail-block">
        <div class="block-title">合同信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同号">
            <span class="contract-no">{{ detail.contractNo || '—' }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="明细条数">{{ detail.detailCount ?? 0 }} 条</el-descriptions-item>
          <el-descriptions-item label="申请单 ID">{{ detail.applicationId || '—' }}</el-descriptions-item>
          <el-descriptions-item :label="isAddMember ? '合同业绩总额(调整前)' : '结佣业绩（调整前）'">
            <span class="amount">{{ formatYuan(detail.originalAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="折算后（调整前）">
            <span class="amount amount-ink">{{ formatYuan(detail.convertedOriginalAmount) }}</span>
          </el-descriptions-item>
          <template v-if="detail.adjustType === 'AMOUNT' || detail.adjustType === 'DISCOUNT' || detail.adjustType === 'DIFF'">
            <el-descriptions-item label="结佣业绩（调整后）">
              <span class="amount amount-red">{{ formatYuan(detail.newAmount) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="折算后（调整后）">
              <span class="amount amount-ink">{{ formatYuan(detail.convertedNewAmount) }}</span>
            </el-descriptions-item>
          </template>
          <template v-if="isAddMember">
            <el-descriptions-item label="新增角色人业绩">
              <span class="amount amount-positive">+{{ formatYuan(detail.newAmount) }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="调整后合同总额">
              <span class="amount amount-ink">{{ formatNumber(afterTotal) }}</span>
            </el-descriptions-item>
          </template>
          <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 受影响明细 -->
      <div v-if="detail.details && detail.details.length" class="detail-block">
        <div class="block-title">
          受影响明细
          <span class="block-subtitle">
            <template v-if="isAddMember">
              （增加角色人：既有角色人按快照扣减/调整后金额预演，新角色人调整前业绩为 0；{{
                totalChanged ? `合同总额同步调整 ${totalChangedText}` : '合同总额不变，从既有角色人扣减分摊给新角色人'
              }}）
            </template>
            <template v-else>
              （{{ detail.adjustScope === 'CONTRACT' ? '合同级调整：调整金额按各明细占比分摊' : '明细级调整：仅调整单条明细' }}）
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
                <span>{{ scope.row.roleName || scope.row.roleType || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="角色占比" width="100" align="right">
              <template #default="scope">
                <span>{{ formatRatio(scope.row.shareRatio) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="结佣业绩" width="120" align="right">
              <template #default="scope">
                <span class="amount amount-expected">{{ formatNumber(scope.row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="折算后" width="110" align="right">
              <template #default="scope">
                <span class="amount amount-ink">{{ formatNumber(scope.row.convertedAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="变动" width="110" align="right">
              <template #default="scope">
                <span :class="deltaClass(scope.row.deltaAmount)">{{ formatDelta(scope.row.deltaAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="调整后业绩" width="120" align="right">
              <template #default="scope">
                <span class="amount" :class="deltaClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.afterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="折算后" width="110" align="right">
              <template #default="scope">
                <span class="amount amount-ink" :class="deltaClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.convertedAfterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="scope">
                <el-tag v-if="isNewMemberRow(scope.row)" type="success" size="small" effect="dark">新增角色人</el-tag>
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
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionAdjust | null>(null);

/** 是否增加角色人单 */
const isAddMember = computed(() => detail.value?.adjustType === 'ADD_MEMBER');

/** ADD_MEMBER 调整后合同总额 = 明细预演调整后金额之和 */
const afterTotal = computed(() =>
  (detail.value?.details ?? []).reduce((sum, r) => sum + Number(r.afterAmount ?? 0), 0));

/** ADD_MEMBER 合同总额是否同时发生变化 */
const totalChanged = computed(() => {
  if (!isAddMember.value) return false;
  const origin = Number(detail.value?.originalAmount ?? 0);
  return Math.abs(afterTotal.value - origin) > 0.004;
});
const totalChangedText = computed(() => {
  const origin = Number(detail.value?.originalAmount ?? 0);
  const diff = afterTotal.value - origin;
  return `${origin.toFixed(2)} → ${afterTotal.value.toFixed(2)}（${diff > 0 ? '+' : ''}${diff.toFixed(2)}）`;
});

/** 新角色人行：ADD_MEMBER 目标行，且调整前为 0/空、变动为正（与新签调整面板同口径） */
const isNewMemberRow = (row: {
  target?: boolean;
  amount?: number | null;
  deltaAmount?: number | null;
}): boolean => {
  if (!isAddMember.value || !row.target) return false;
  if (row.amount === null || row.amount === undefined) return true;
  return Number(row.amount) === 0 && Number(row.deltaAmount ?? 0) > 0;
};

const TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整',
  ADD_MEMBER: '增加角色人',
  DISCOUNT: '折扣（旧）',
  DIFF: '差额补发（旧）',
};
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交', APPROVED: '已审批', REJECTED: '已拒绝', CANCELLED: '已取消', EXECUTED: '已执行',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'warning', APPROVED: 'primary', REJECTED: 'danger', CANCELLED: 'info', EXECUTED: 'success',
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

/** 调整金额：带 ¥ 与 +/- 前缀 */
const deltaYuan = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n > 0 ? '+' : ''}${n.toFixed(2)}`;
};

/** 差额着色：增加绿色 / 减少红色 / 不变或缺失不着色 */
const deltaClass = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const n = Number(val);
  if (Number.isNaN(n) || n === 0) return '';
  return n > 0 ? 'amount-positive' : 'amount-negative';
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
};

const rowClassName = ({ row }: { row: any }) => (row.target ? 'target-row' : '');

onMounted(async () => {
  loading.value = true;
  try {
    // 雪花 ID 以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度 →「调整单不存在」）
    const res: any = await commissionApi.getAdjust(props.businessId);
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该结佣调整单';
  } catch {
    loadError.value = '加载结佣调整单详情失败';
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
  width: 130px;
}
</style>
