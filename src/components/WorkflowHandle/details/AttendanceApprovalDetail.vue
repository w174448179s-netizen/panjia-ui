<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="approval">
      <el-descriptions :column="4" border size="small" class="detail-desc">
        <el-descriptions-item label="归属月">{{ approval.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(approval.status)">{{ statusLabel(approval.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="考勤总行数">{{ approval.totalCount ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="异常行数">{{ approval.abnormalCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="提交人">{{ approval.submitBy || '—' }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ approval.submitTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="异常请假合计">{{ fmt(approval.abnormalLeaveDays) }} 天</el-descriptions-item>
        <el-descriptions-item label="驳回原因">{{ approval.rejectReason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="!abnormalRows.length"
        type="success"
        :closable="false"
        show-icon
        title="本期考勤全部正常（无迟到/缺卡/旷工/请假），无需逐行审阅"
        class="abnormal-empty"
      />
      <div v-else class="detail-table-wrap">
        <div class="detail-table-title">
          异常考勤明细（{{ abnormalRows.length }} 行，仅异常行需要审阅；正常行免审）
        </div>
        <el-table :data="abnormalRows" stripe border max-height="420">
          <el-table-column label="工号" prop="employeeCode" width="100" align="center" />
          <el-table-column label="姓名" prop="employeeName" width="100" align="center" />
          <el-table-column label="考勤月份" prop="attendMonth" width="100" align="center" />
          <el-table-column label="迟到次数" prop="lateCount" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.lateCount) }}</template>
          </el-table-column>
          <el-table-column label="迟到(分)" prop="lateMinutes" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.lateMinutes) }}</template>
          </el-table-column>
          <el-table-column label="缺卡次数" prop="missingCardCount" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.missingCardCount) }}</template>
          </el-table-column>
          <el-table-column label="旷工(天)" prop="absentDays" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.absentDays) }}</template>
          </el-table-column>
          <el-table-column label="请假(天)" prop="leaveDays" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.leaveDays) }}</template>
          </el-table-column>
          <el-table-column label="备注" prop="remark" min-width="140" show-overflow-tooltip />
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceAbnormalRow, AttendanceApproval } from '@/api/panjia/types';

// businessId 为雪花 ID，以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度）
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const approval = ref<AttendanceApproval | null>(null);

const abnormalRows = computed<AttendanceAbnormalRow[]>(() => approval.value?.abnormalRows ?? []);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回'
};
const STATUS_TAG: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger'
};
const statusLabel = (s?: string) => STATUS_LABEL[s || ''] || s || '—';
const statusTag = (s?: string) => STATUS_TAG[s || ''] || 'info';

const fmt = (n: number | null | undefined) => (n == null ? '0' : `${Number(n)}`);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await attendanceApi.getApprovalDetail(props.businessId);
    approval.value = res.data ?? null;
    if (!approval.value) loadError.value = '未找到该考勤审批单';
  } catch {
    loadError.value = '加载考勤审批详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}
.abnormal-empty {
  margin-top: 16px;
}
</style>
