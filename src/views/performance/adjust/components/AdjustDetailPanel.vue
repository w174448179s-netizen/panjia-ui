<template>
  <div v-loading="loading" class="adjust-detail-panel">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />

    <template v-if="detail">
      <!-- 调整单基础信息 -->
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调整类型">{{ adjustTypeLabel(detail.adjustType) }}</el-descriptions-item>
        <el-descriptions-item label="调整范围">
          <el-tag :type="detail.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
            {{ detail.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.adjustScope !== 'CONTRACT'" label="员工">
          {{ detail.employeeName || employeeName(detail.employeeId) }}
        </el-descriptions-item>
        <el-descriptions-item label="门店/组别">
          <span>{{ detail.deptName || '—' }}</span>
          <span v-if="detail.adjustType === 'TRANSFER' && detail.targetDeptName" class="transfer-arrow">
            → {{ detail.targetDeptName }}
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="新签业绩">{{ formatYuan(detail.originalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="折算后业绩">
          <span class="amount-ink">{{ formatYuan(detail.convertedOriginalAmount) }}</span>
        </el-descriptions-item>
        <template v-if="detail.adjustType === 'AMOUNT'">
          <el-descriptions-item label="调整金额">
            <span :class="deltaAmountClass(detail.targetAmount, detail.originalAmount)">
              {{ deltaYuan(detail.targetAmount, detail.originalAmount) }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="调整金额（折算后）">
            <span :class="deltaAmountClass(detail.convertedTargetAmount, detail.convertedOriginalAmount)">
              {{ deltaYuan(detail.convertedTargetAmount, detail.convertedOriginalAmount) }}
            </span>
          </el-descriptions-item>
        </template>
        <el-descriptions-item label="调整后业绩">
          <span class="amount-red">{{ formatYuan(detail.targetAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="折算后业绩">
          <span class="amount-ink">{{ formatYuan(detail.convertedTargetAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 合同信息 -->
      <div v-if="detail.contractNo" class="detail-block">
        <div class="block-title">合同信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同号">
            <span class="contract-no">{{ detail.contractNo }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="签约/认购时间">{{ detail.businessDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="明细条数">{{ detail.detailCount ?? 0 }} 条</el-descriptions-item>
          <el-descriptions-item label="新签业绩">
            <span class="amount">{{ formatYuan(detail.originalAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="折算后业绩">
            <span class="amount amount-ink">{{ formatYuan(detail.convertedOriginalAmount) }}</span>
          </el-descriptions-item>
          <template v-if="detail.adjustType === 'AMOUNT'">
            <el-descriptions-item label="调整金额">
              <span class="amount" :class="deltaAmountClass(detail.targetAmount, detail.originalAmount)">
                {{ deltaYuan(detail.targetAmount, detail.originalAmount) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item label="调整金额（折算后）">
              <span class="amount" :class="deltaAmountClass(detail.convertedTargetAmount, detail.convertedOriginalAmount)">
                {{ deltaYuan(detail.convertedTargetAmount, detail.convertedOriginalAmount) }}
              </span>
            </el-descriptions-item>
          </template>
          <el-descriptions-item label="调整后业绩">
            <span class="amount amount-red">{{ formatYuan(detail.targetAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="折算后业绩">
            <span class="amount amount-ink">{{ formatYuan(detail.convertedTargetAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 受影响明细 -->
      <div v-if="detail.details && detail.details.length" class="detail-block">
        <div class="block-title">
          受影响明细
          <span class="block-subtitle">
            （{{ detail.adjustScope === 'CONTRACT' ? '合同级调整：调整金额按各明细占比分摊' : '明细级调整：仅调整单条明细' }}）
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
            <el-table-column label="新签业绩" width="120" align="right">
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
                <span :class="getAmountClass(scope.row.deltaAmount)">{{ formatDelta(scope.row.deltaAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="调整后业绩" width="120" align="right">
              <template #default="scope">
                <span class="amount" :class="getAmountClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.afterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="折算后" width="110" align="right">
              <template #default="scope">
                <span class="amount amount-ink" :class="getAmountClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.convertedAfterAmount) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.target" type="danger" size="small" effect="dark">调整行</el-tag>
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
import { ref, onMounted } from 'vue';
import { performanceApi, type AdjustDetailVO } from '@/api/panjia/performance';
import { useEmployeeMap } from '@/components/WorkflowHandle/useEmployeeMap';

/**
 * 业绩调整单详情面板（唯一模板）。
 *
 * 「业绩调整 → 详情」与「我的待办 → 业绩调整审批」曾经各写了一份几乎相同的模板，
 * 口径与列宽长期漂移。现统一由本组件承担，两处只传入 businessId。
 */
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<AdjustDetailVO | null>(null);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const ADJUST_TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整',
  VOID: '业绩冲销',
  TRANSFER: '部门划转'
};
const adjustTypeLabel = (t: string) => ADJUST_TYPE_MAP[t] ?? t ?? '—';

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
    const [res] = await Promise.all([performanceApi.getAdjustDetail(props.businessId), loadEmployees()]);
    detail.value = (res as any).data ?? null;
    if (!detail.value) loadError.value = '未找到该业绩调整单';
  } catch {
    loadError.value = '加载业绩调整单详情失败';
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
