<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="detail">
      <el-descriptions :column="2" border size="small" class="detail-desc">
        <el-descriptions-item label="员工">{{ detail.employeeName || detail.employeeId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整类型">
          <el-tag :type="typeTagType(detail.adjustType)" size="small">{{ typeLabel(detail.adjustType) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调整点数">
          <span v-if="detail.adjustRate != null" class="rate-deduct">{{ ratePercent(detail.adjustRate) }}</span>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="生效区间">{{ rangeText(detail) }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ detail.applyTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ detail.approveTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="驳回原因">{{ detail.rejectReason || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="detail.status === 'APPROVED'"
        type="success"
        :closable="false"
        show-icon
        title="该调整已通过，算薪时在生效区间内自动叠加到综合提点（已算薪月份不受后续作废影响）"
        class="detail-tip"
      />
      <el-alert
        v-else-if="detail.status === 'REJECTED'"
        type="warning"
        :closable="false"
        show-icon
        title="该调整已被驳回，申请人修改后可重新提交"
        class="detail-tip"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, toRefs, onMounted } from 'vue';
import { rateAdjustApi, type RateAdjust } from '@/api/panjia/rateadjust';
import { useDict } from '@/utils/dict';

// businessId 为雪花 ID，以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度）
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<RateAdjust | null>(null);

// 调整类型字典（配置驱动；NO_SOCIAL 也会出现在审批详情/溯源中，标签正常渲染）
const { rate_adjust_type } = toRefs<any>(useDict('rate_adjust_type'));
const TYPE_FALLBACK: Record<string, string> = {
  NO_SOCIAL: '未买社保扣点',
  PHONE_CHECK: '电话考核扣点',
  PERSONAL: '个人调整扣点'
};
const typeLabel = (t?: string | null) =>
  rate_adjust_type.value?.find((o: any) => o.value === t)?.label || TYPE_FALLBACK[t || ''] || t || '—';
const typeTagType = (t?: string | null) => {
  const map: Record<string, string> = { NO_SOCIAL: 'warning', PHONE_CHECK: 'primary', PERSONAL: 'danger' };
  return (map as any)[t || ''] || 'info';
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已撤销'
};
const STATUS_TAG: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info'
};
const statusLabel = (s?: string) => STATUS_LABEL[s || ''] || s || '—';
const statusTag = (s?: string) => STATUS_TAG[s || ''] || 'info';

const ratePercent = (v: number | string | null | undefined) => `${Number((Number(v) * 100).toFixed(2))}%`;

const rangeText = (row: RateAdjust) => {
  if (!row.startMonth) return '—';
  return row.endMonth ? `${row.startMonth} ~ ${row.endMonth}` : `${row.startMonth} ~ 长期`;
};

onMounted(async () => {
  loading.value = true;
  try {
    const res = await rateAdjustApi.getById(props.businessId);
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该提成点调整单';
  } catch {
    loadError.value = '加载提成点调整详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.rate-deduct {
  color: var(--el-color-danger);
  font-weight: 600;
}
.detail-tip {
  margin-top: 16px;
}
</style>
