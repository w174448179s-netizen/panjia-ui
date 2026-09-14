<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <el-descriptions v-if="detail" :column="2" border size="small">
      <el-descriptions-item label="归属月">{{ detail.period || '—' }}</el-descriptions-item>
      <el-descriptions-item label="员工">{{ detail.employeeName || employeeName(detail.employeeId) }}</el-descriptions-item>
      <el-descriptions-item label="子类型">{{ detail.subType || '—' }}</el-descriptions-item>
      <el-descriptions-item label="金额">¥{{ fmt(detail.amount) }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="事由" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
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

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_MAP: Record<string, string> = {
  PENDING: '待审批', APPROVED: '已审批', REJECTED: '已驳回', ACTIVE: '生效', CANCELLED: '已取消',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger', ACTIVE: 'success', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

onMounted(async () => {
  loading.value = true;
  try {
    await loadEmployees();
    const res: any = await payrollApi.getManual(Number(props.businessId));
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该奖金记录';
  } catch {
    loadError.value = '加载奖金详情失败';
  } finally {
    loading.value = false;
  }
});
</script>
