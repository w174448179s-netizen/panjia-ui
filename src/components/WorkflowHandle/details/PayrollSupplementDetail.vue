<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <el-descriptions v-if="detail" :column="2" border size="small">
      <el-descriptions-item label="期间">{{ detail.targetPeriod || '—' }}</el-descriptions-item>
      <el-descriptions-item label="员工">{{ detail.employeeName || employeeName(detail.employeeId) }}</el-descriptions-item>
      <el-descriptions-item label="类型">
        <el-tag :type="typeTagType(detail.adjustType)" size="small">{{ typeLabel(detail.adjustType) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="金额">
        <span :class="amountClass(detail.amount)">¥{{ fmt(detail.amount) }}</span>
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { payrollApi } from '@/api/panjia/payroll';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<any>(null);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const TYPE_MAP: Record<string, string> = { ADJUST: '调整', SUPPLEMENT: '补发', RECOVER: '退单追回' };
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = { ADJUST: 'warning', SUPPLEMENT: 'success', RECOVER: 'danger' };
  return (map as any)[t] || 'info';
};

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

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amountClass = (n: number | undefined) => {
  if (n == null) return '';
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return '';
};

onMounted(async () => {
  loading.value = true;
  try {
    await loadEmployees();
    const res: any = await payrollApi.getAdjust(Number(props.businessId));
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该调整/补发单';
  } catch {
    loadError.value = '加载调整/补发单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.text-success { color: var(--el-color-success); font-weight: 600; }
.text-danger { color: var(--el-color-danger); font-weight: 600; }
</style>
