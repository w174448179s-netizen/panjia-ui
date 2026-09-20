<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="approval">
      <el-descriptions :column="4" border size="small" class="detail-desc">
        <el-descriptions-item label="归属月">{{ approval.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(approval.status)">{{ statusLabel(approval.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="积分总人数">{{ approval.totalCount ?? 0 }}</el-descriptions-item>
        <el-descriptions-item label="提交时间">{{ approval.submitTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="A级（不扣点）">{{ approval.gradeACount ?? 0 }} 人</el-descriptions-item>
        <el-descriptions-item label="B级（-2%）">{{ approval.gradeBCount ?? 0 }} 人</el-descriptions-item>
        <el-descriptions-item label="C级（-4%）">{{ approval.gradeCCount ?? 0 }} 人</el-descriptions-item>
        <el-descriptions-item label="驳回原因">{{ approval.rejectReason || '—' }}</el-descriptions-item>
        <el-descriptions-item label="晚提交总次数">{{ approval.lateSubmitTotalCount ?? 0 }} 次</el-descriptions-item>
        <el-descriptions-item label="晚提交扣款总额">¥{{ (approval.lateSubmitTotalFee ?? 0).toFixed(2) }}</el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-if="!deductRows.length"
        type="success"
        :closable="false"
        show-icon
        title="本期全员 A 级（平均分 ≥ 8），无提成扣点行，无需逐行审阅"
        class="deduct-empty"
      />
      <div v-else class="detail-table-wrap">
        <div class="detail-table-title">
          扣点明细（{{ deductRows.length }} 行，仅 B/C 级需要审阅；A 级免审）
        </div>
        <el-table :data="deductRows" stripe border max-height="420">
          <el-table-column label="工号" prop="employeeCode" width="100" align="center" />
          <el-table-column label="姓名" prop="employeeName" width="100" align="center" />
          <el-table-column label="积分月份" prop="scoreMonth" width="100" align="center" />
          <el-table-column label="总积分" prop="totalPoints" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.totalPoints) }}</template>
          </el-table-column>
          <el-table-column label="出勤(天)" prop="attendDays" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.attendDays) }}</template>
          </el-table-column>
          <el-table-column label="平均积分" prop="avgPoints" width="90" align="center">
            <template #default="{ row }">{{ fmt(row.avgPoints) }}</template>
          </el-table-column>
          <el-table-column label="绩效等级" prop="grade" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="gradeTagType(row.grade)" effect="plain">{{ row.grade || '—' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="提成扣点" prop="deductRate" width="100" align="center">
            <template #default="{ row }">
              <span v-if="row.deductRate != null">{{ (Number(row.deductRate) * 100).toFixed(0) }}%</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- 晚提交扣款明细（所有 lateSubmitCount > 0 的行，总监核对豁免情况） -->
      <div v-if="lateSubmitRows.length" class="detail-table-wrap">
        <div class="detail-table-title">
          晚提交扣款明细（{{ lateSubmitRows.length }} 人，扣款 = 晚提交次数 × 5 元/次；
          经总监同意已豁免的次数由人事在积分列表调整后定格）
        </div>
        <el-table :data="lateSubmitRows" stripe border max-height="360">
          <el-table-column label="工号" prop="employeeCode" width="100" align="center" />
          <el-table-column label="姓名" prop="employeeName" width="100" align="center" />
          <el-table-column label="积分月份" prop="scoreMonth" width="100" align="center" />
          <el-table-column label="晚提交次数" prop="lateSubmitCount" width="100" align="center">
            <template #default="{ row }">{{ row.lateSubmitCount ?? 0 }}</template>
          </el-table-column>
          <el-table-column label="积分扣款(元)" prop="pointsFee" width="110" align="center">
            <template #default="{ row }">{{ row.pointsFee ? Number(row.pointsFee).toFixed(2) : '0.00' }}</template>
          </el-table-column>
        </el-table>
      </div>
      <el-alert
        v-else
        type="success"
        :closable="false"
        show-icon
        title="本期无晚提交扣款"
        class="deduct-empty"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreApproval, ScoreDeductRow, ScoreLateSubmitRow } from '@/api/panjia/types';

// businessId 为雪花 ID，以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度）
const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const approval = ref<ScoreApproval | null>(null);

const deductRows = computed<ScoreDeductRow[]>(() => approval.value?.deductRows ?? []);
const lateSubmitRows = computed<ScoreLateSubmitRow[]>(() => approval.value?.lateSubmitRows ?? []);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回'
};
const STATUS_TAG: Record<string, 'info' | 'warning' | 'success' | 'danger'> = {
  DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger'
};
const statusLabel = (s?: string) => STATUS_LABEL[s || ''] || s || '—';
const statusTag = (s?: string) => STATUS_TAG[s || ''] || 'info';

const gradeTagType = (grade?: string | null): 'success' | 'warning' | 'danger' => {
  if (grade === 'A') return 'success';
  if (grade === 'B') return 'warning';
  return 'danger';
};

const fmt = (n: number | null | undefined) => (n == null ? '0' : `${Number(n)}`);

onMounted(async () => {
  loading.value = true;
  try {
    const res = await scoreApi.getApprovalDetail(props.businessId);
    approval.value = res.data ?? null;
    if (!approval.value) loadError.value = '未找到该积分审批单';
  } catch {
    loadError.value = '加载积分审批详情失败';
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
.deduct-empty {
  margin-top: 16px;
}
</style>
