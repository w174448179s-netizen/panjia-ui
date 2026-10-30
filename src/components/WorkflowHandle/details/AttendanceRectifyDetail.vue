<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="rectify">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="考勤月份">{{ rectify.attendMonth?.slice(0, 7) || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(rectify.status)" size="small">{{ statusLabel(rectify.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ rectify.submitTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="工号">{{ rectify.employeeCode || '—' }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ rectify.employeeName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ rectify.approveTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="涉及日期" :span="3">{{ rectify.involveDates || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="rectify.status === 'REJECTED'" label="驳回原因" :span="3">
          <span class="reject-reason">{{ rectify.rejectReason || '—' }}</span>
        </el-descriptions-item>
      </el-descriptions>

      <div class="detail-section-title">修改明细（{{ (rectify.changes || []).length }} 项）</div>
      <el-table :data="rectify.changes || []" stripe border size="small" max-height="300">
        <el-table-column label="字段" align="center" prop="fieldName" width="140" />
        <el-table-column label="原值" align="center" min-width="140">
          <template #default="{ row }">{{ row.oldValue === '' || row.oldValue == null ? '—' : row.oldValue }}</template>
        </el-table-column>
        <el-table-column label="新值" align="center" min-width="140">
          <template #default="{ row }">
            <span class="new-value">{{ row.newValue === '' || row.newValue == null ? '（清空）' : row.newValue }}</span>
          </template>
        </el-table-column>
      </el-table>

      <div class="detail-section-title">修改说明</div>
      <div class="reason-text">{{ rectify.reason || '—' }}</div>

      <div class="detail-section-title">截图凭证（{{ imageUrls.length }} 张，点击放大）</div>
      <div v-if="imageUrls.length" class="image-list">
        <el-image
          v-for="(url, idx) in imageUrls"
          :key="idx"
          :src="url"
          :preview-src-list="imageUrls"
          :initial-index="idx"
          fit="cover"
          preview-teleported
          class="rectify-image"
        />
      </div>
      <span v-else>—</span>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceRectify } from '@/api/panjia/types';

// businessId 为雪花 ID，以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度）
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const rectify = ref<AttendanceRectify | null>(null);

const imageUrls = computed(() => {
  const urls = rectify.value?.ossUrls || '';
  return urls.split(',').map((u) => u.trim()).filter(Boolean);
});

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '待审批', APPROVED: '已通过', REJECTED: '已驳回', CANCELED: '已取消'
};
const STATUS_TAG: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELED: 'info'
};
const statusLabel = (s?: string) => STATUS_LABEL[s || ''] || s || '—';
const statusTag = (s?: string) => STATUS_TAG[s || ''] || 'info';

const load = async () => {
  loading.value = true;
  loadError.value = '';
  try {
    const res = await attendanceApi.rectifyGetById(String(props.businessId));
    rectify.value = res.data ?? null;
    if (!rectify.value) {
      loadError.value = '未查询到考勤修改申请详情';
    }
  } catch (e: any) {
    loadError.value = e?.message || '加载考勤修改申请详情失败';
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style lang="scss" scoped>
.wf-detail-body {
  .detail-desc {
    margin-bottom: 4px;
  }

  .detail-section-title {
    margin: 14px 0 8px;
    font-weight: 600;
    font-size: 13px;
  }

  .reason-text {
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--el-text-color-regular);
  }

  .reject-reason {
    color: var(--el-color-danger);
  }

  .new-value {
    color: var(--el-color-primary);
    font-weight: 600;
  }

  .image-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .rectify-image {
    width: 140px;
    height: 140px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
  }
}
</style>
