<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <el-descriptions v-if="detail" :column="2" border size="small">
      <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
      <el-descriptions-item label="类型">
        <el-tag :type="typeTagType(detail.adjustType)" size="small">{{ typeLabel(detail.adjustType) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="申请单ID">{{ detail.applicationId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="明细ID">{{ detail.itemId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
      <el-descriptions-item label="目标月">{{ detail.targetPeriod || '—' }}</el-descriptions-item>
      <el-descriptions-item v-if="detail.adjustType === 'DISCOUNT'" label="折后金额">¥{{ fmt(detail.newAmount) }}</el-descriptions-item>
      <el-descriptions-item v-if="detail.adjustType === 'DIFF'" label="差额金额">¥{{ fmt(detail.diffAmount) }}</el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="发起人ID">{{ detail.applicantId || '—' }}</el-descriptions-item>
      <el-descriptions-item label="创建时间" :span="2">{{ detail.createTime || '—' }}</el-descriptions-item>
      <el-descriptions-item label="原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
    </el-descriptions>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionAdjust | null>(null);

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_MAP: Record<string, string> = { DISCOUNT: '折扣', DIFF: '差额补发', VOID: '作废' };
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = { DISCOUNT: 'warning', DIFF: 'primary', VOID: 'danger' };
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

onMounted(async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.getAdjust(Number(props.businessId));
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该结佣调整单';
  } catch {
    loadError.value = '加载结佣调整单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>
