<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="detail">
      <el-descriptions :column="2" border size="small" class="detail-desc">
        <el-descriptions-item label="合同号">{{ detail.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="经纪人">{{ detail.employeeName || detail.employeeId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="提点加成">
          <span class="rate-add">+{{ ratePercent(detail.bonusRate) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ detail.applyTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ detail.approveTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="驳回原因" :span="2">{{ detail.rejectReason || '—' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{ detail.remark || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="detail.status === 'APPROVED'"
        type="success"
        :closable="false"
        show-icon
        title="该自购单已通过：算薪时该经纪人在此合同号上的结佣提点额外加成，其他合同与其他参与经纪人的提点不受影响"
        class="detail-tip"
      />
      <el-alert
        v-else-if="detail.status === 'REJECTED'"
        type="warning"
        :closable="false"
        show-icon
        title="该自购单已被驳回，申请人修改后可重新提交"
        class="detail-tip"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { selfPurchaseApi, type SelfPurchase } from '@/api/panjia/selfpurchase';

// businessId 为雪花 ID，以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度）
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<SelfPurchase | null>(null);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已撤销'
};
const STATUS_TAG: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info'
};
const statusLabel = (s?: string) => STATUS_LABEL[s || ''] || s || '—';
const statusTag = (s?: string) => STATUS_TAG[s || ''] || 'info';

const ratePercent = (v: number | string | null | undefined) =>
  `${Number((Number(v) * 100).toFixed(2))}%`;

onMounted(async () => {
  loading.value = true;
  try {
    const res = await selfPurchaseApi.getById(props.businessId);
    detail.value = res.data ?? null;
    if (!detail.value) loadError.value = '未找到该自购单';
  } catch {
    loadError.value = '加载自购单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.rate-add {
  color: var(--el-color-danger);
  font-weight: 600;
}
.detail-tip {
  margin-top: 16px;
}
</style>
