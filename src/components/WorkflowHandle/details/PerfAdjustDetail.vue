<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <el-descriptions v-if="detail" :column="2" border size="small">
      <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="调整类型">{{ adjustTypeLabel(detail.adjustType) }}</el-descriptions-item>
      <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
      <el-descriptions-item label="员工">{{ detail.employeeName || employeeName(detail.employeeId) }}</el-descriptions-item>
      <el-descriptions-item label="门店/组别">
        <span>{{ detail.deptName || '—' }}</span>
        <span v-if="detail.adjustType === 'TRANSFER' && detail.targetDeptName" class="transfer-arrow"> → {{ detail.targetDeptName }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="原始金额">{{ formatOrigin(detail.originAmount) }}</el-descriptions-item>
      <el-descriptions-item label="变动金额">
        <span :class="getAmountClass(detail.deltaAmount)">{{ formatAmount(detail.deltaAmount) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="申请人">{{ detail.applicantName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="审批人">{{ detail.approverName || '—' }}</el-descriptions-item>
      <el-descriptions-item label="审批时间">{{ detail.approveTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="执行时间">{{ detail.executeTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间" :span="2">{{ detail.createTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { performanceApi } from '@/api/panjia/performance';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<any>(null);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const ADJUST_TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整', VOID: '业绩冲销', TRANSFER: '部门划转',
};
const adjustTypeLabel = (t: string) => ADJUST_TYPE_MAP[t] ?? t ?? '—';

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

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const prefix = n > 0 ? '+' : '';
  return prefix + n.toFixed(2);
};
const getAmountClass = (val: number | undefined): string => {
  if (val === undefined || val === null) return '';
  if (val > 0) return 'amount-positive';
  if (val < 0) return 'amount-negative';
  return '';
};
const formatOrigin = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

onMounted(async () => {
  loading.value = true;
  try {
    const [res] = await Promise.all([performanceApi.getAdjust(props.businessId), loadEmployees()]);
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
</style>
