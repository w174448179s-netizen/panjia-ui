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
        <el-descriptions-item label="原始金额">{{ formatYuan(detail.originalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="调整后金额">
          <span class="amount-red">{{ formatYuan(detail.targetAmount) }}</span>
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
          <el-descriptions-item label="签约时间">{{ detail.businessDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="明细条数">{{ detail.detailCount ?? 0 }} 条</el-descriptions-item>
          <el-descriptions-item label="合同金额">
            <span class="amount">{{ formatYuan(contractAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="调整后金额">
            <span class="amount amount-red">{{ formatYuan(contractAfterAmount) }}</span>
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
            <el-table-column label="应收金额" width="120" align="right">
              <template #default="scope">
                <span class="amount amount-expected">{{ formatNumber(scope.row.amount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="变动" width="110" align="right">
              <template #default="scope">
                <span :class="getAmountClass(scope.row.deltaAmount)">{{ formatDelta(scope.row.deltaAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="调整后" width="120" align="right">
              <template #default="scope">
                <span class="amount" :class="getAmountClass(scope.row.deltaAmount)">
                  {{ formatNumber(scope.row.afterAmount) }}
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
import { ref, computed, onMounted } from 'vue';
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

const num = (v: number | string | undefined | null): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
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

/** 安全四舍五入到两位小数，规避浮点累加误差 */
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * 合同金额：合同下全部有效明细的应收合计。
 * 后端 expectedTotal 已是该口径，缺失时按明细行兜底累加。
 */
const contractAmount = computed<number>(() => {
  const d = detail.value;
  if (!d) return 0;
  if (d.expectedTotal !== undefined && d.expectedTotal !== null) return num(d.expectedTotal);
  return round2((d.details ?? []).reduce((sum, r) => sum + num(r.amount), 0));
});

/**
 * 调整后金额：合同级口径 = 合同金额 + 本次调整变动。
 * 明细级调整时单据上的 targetAmount 只是单条明细的目标值，不能代表合同，
 * 故优先按明细行的 afterAmount 汇总（合同级调整分摊后与该值一致）。
 */
const contractAfterAmount = computed<number>(() => {
  const d = detail.value;
  if (!d) return 0;
  const rows = d.details ?? [];
  if (rows.length) return round2(rows.reduce((sum, r) => sum + num(r.afterAmount), 0));
  return num(d.targetAmount);
});

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
