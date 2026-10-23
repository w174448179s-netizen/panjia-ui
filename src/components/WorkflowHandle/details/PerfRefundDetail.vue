<template>
  <!--
    退单审批（我的待办 → 办理弹窗）详情体。flowCode = perf_refund。
    展示：基础信息 + 冲减合计 + 退单明细快照（payload_json）+ 审批意见。
    只读展示，审批动作由 WorkflowHandle 弹窗底部按钮统一触发。
  -->
  <div v-loading="loading" class="perf-refund-detail">
    <el-alert
      v-if="statusHint"
      :type="statusHintType"
      :closable="false"
      show-icon
      :title="statusHint"
      class="status-alert"
    />

    <el-descriptions v-if="detail" :column="3" border size="small">
      <el-descriptions-item label="退单号">{{ detail.refundNo }}</el-descriptions-item>
      <el-descriptions-item label="合同号">{{ detail.contractNo }}</el-descriptions-item>
      <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
      <el-descriptions-item label="退单月份">{{ detail.refundPeriod }}</el-descriptions-item>
      <el-descriptions-item label="业务类型">{{ detail.bizType || '—' }}</el-descriptions-item>
      <el-descriptions-item label="门店/组别">{{ detail.deptName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="冲减新签">
        <span class="amount-negative">{{ formatAmount(detail.expectAmount) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="冲减实收">
        <span class="amount-negative">{{ formatAmount(detail.realAmount) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag size="small" effect="plain">{{ statusLabel(detail.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="退单原因" :span="3">{{ detail.reason || '—' }}</el-descriptions-item>
    </el-descriptions>

    <div class="detail-table-title">退单明细（负新签，归属月={{ detail?.refundPeriod }}）</div>
    <el-table :data="detailLines" border size="small" max-height="320">
      <el-table-column label="原归属月" prop="period" width="100" align="center" />
      <el-table-column label="员工ID" prop="employeeId" min-width="160" show-overflow-tooltip />
      <el-table-column label="工号" prop="employeeCode" width="120" />
      <el-table-column label="角色" prop="roleName" min-width="110" />
      <el-table-column label="占比" prop="shareRatio" width="90" align="center">
        <template #default="{ row }">{{ row.shareRatio != null ? row.shareRatio : '—' }}</template>
      </el-table-column>
      <el-table-column label="冲减金额" width="140" align="right">
        <template #default="{ row }">
          <span class="amount-negative">{{ formatAmount(row.amount) }}</span>
        </template>
      </el-table-column>
      <template #empty>
        <span class="empty-tip">无明细快照</span>
      </template>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { perfRefundApi } from '@/api/panjia/refund';
import type { PerfRefund, PerfRefundDetailLine } from '@/api/panjia/refund';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const detail = ref<PerfRefund | null>(null);

const statusLabel = (status?: string) => {
  const map: Record<string, string> = {
    SUBMITTED: '审批中',
    APPROVED: '已通过',
    EXECUTED: '已执行',
    REJECTED: '已驳回',
    CANCELLED: '已撤回',
  };
  return map[status ?? ''] ?? status ?? '—';
};

const statusHint = computed(() => {
  if (!detail.value) return '';
  switch (detail.value.status) {
    case 'EXECUTED':
      return `退单已执行：负新签与负实收已生成，落账月 ${detail.value.refundPeriod}；原事实保持不变，退单不可撤销。`;
    case 'REJECTED':
      return '该退单已驳回，未产生任何负流水。';
    case 'CANCELLED':
      return '该退单已由发起人撤回，未产生任何负流水。';
    default:
      return '审批通过后将生成负新签与负实收（归属月=退单月份），并阻断同合同再次退单。';
  }
});

const statusHintType = computed<'info' | 'error'>(() =>
  detail.value?.status === 'EXECUTED' ? 'error' : 'info');

const detailLines = computed<PerfRefundDetailLine[]>(() => {
  const raw = detail.value?.payloadJson;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
});

const formatAmount = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0.00';
  const num = Number(value);
  return (num > 0 ? '+' : '') + num.toFixed(2);
};

onMounted(async () => {
  if (props.businessId === undefined || props.businessId === null) return;
  loading.value = true;
  try {
    detail.value = (await perfRefundApi.detail(String(props.businessId))).data;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped lang="scss">
.perf-refund-detail {
  .status-alert {
    margin-bottom: 12px;
  }
  .detail-table-title {
    margin: 14px 0 8px;
    font-size: 13px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  .amount-negative {
    color: var(--el-color-danger);
  }
  .empty-tip {
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }
}
</style>
