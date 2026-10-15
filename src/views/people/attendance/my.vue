<template>
  <div class="p-2 app-container people-attendance-my-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="考勤月份">
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 考勤查询 / 我的修改申请（Tab 切换，共用上方月份筛选） -->
    <el-card shadow="hover" class="table-panel">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="考勤查询" name="attendance">
          <p class="tab-tip">仅展示本人的月度考勤汇总；点「详情」查看每日考勤明细，如有异议可点「申请修改」提交人事审批。</p>
          <el-table v-loading="loading" border class="data-table" :data="attendanceList">
            <el-table-column label="考勤月份" align="center" width="120">
              <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="出勤(天)" align="center" prop="attendDays" width="90" />
            <el-table-column label="休息(天)" align="center" prop="restDays" width="90" />
            <el-table-column label="迟到次数" align="center" prop="lateCount" width="90" />
            <el-table-column label="迟到(分)" align="center" prop="lateMinutes" width="90" />
            <el-table-column label="缺卡次数" align="center" prop="missingCardCount" width="90" />
            <el-table-column label="旷工(天)" align="center" prop="absentDays" width="80" />
            <el-table-column label="事假(天)" align="center" prop="personalLeaveDays" width="80" />
            <el-table-column label="病假诊所(天)" align="center" prop="sickClinicDays" width="100" />
            <el-table-column label="病假二甲(天)" align="center" prop="sickHospitalDays" width="100" />
            <el-table-column label="请假合计(天)" align="center" prop="leaveDays" width="100" />
            <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
            <el-table-column label="操作" align="center" width="200" fixed="right">
              <template #default="{ row }">
                <div class="op-btns">
                  <el-button type="primary" link icon="View" @click="openDetail(row)">详情</el-button>
                  <el-button type="primary" link icon="EditPen" @click="openApply(row)">申请修改</el-button>
                </div>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无本人考勤记录" />
            </template>
          </el-table>

          <el-pagination
            v-show="total > 0"
            v-model:page="queryParams.pageNum"
            v-model:limit="queryParams.pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            class="pagination-wrap"
            layout="total, sizes, prev, pager, next, jumper"
            @pagination="getList"
          />
        </el-tab-pane>

        <el-tab-pane label="我的修改申请" name="rectify">
          <p class="tab-tip">本人提交的考勤修改记录（含截图与说明），审批通过后考勤数据自动更新。</p>
          <el-table v-loading="rectifyLoading" border class="data-table" :data="rectifyList">
            <el-table-column label="考勤期间" align="center" width="100">
              <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" align="center" width="90">
              <template #default="{ row }">
                <el-tag :type="rectifyStatusTag(row.status)" size="small">{{ rectifyStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="修改项" align="left" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ changeSummary(row) }}</template>
            </el-table-column>
            <el-table-column label="修改说明" align="center" prop="reason" min-width="130" show-overflow-tooltip />
            <el-table-column label="提交时间" align="center" prop="submitTime" width="160" />
            <el-table-column label="审批时间" align="center" width="160">
              <template #default="{ row }">{{ row.approveTime || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" align="center" width="100" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link icon="View" @click="openRectifyDetail(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无修改申请记录" />
            </template>
          </el-table>

          <el-pagination
            v-show="rectifyTotal > 0"
            v-model:page="rectifyQuery.pageNum"
            v-model:limit="rectifyQuery.pageSize"
            :total="rectifyTotal"
            :page-sizes="[10, 20, 50]"
            class="pagination-wrap"
            layout="total, sizes, prev, pager, next"
            @pagination="getRectifyList"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 发起修改申请弹窗 -->
    <el-dialog v-model="applyVisible" title="申请修改考勤" width="720px" append-to-body destroy-on-close>
      <el-form label-width="90px">
        <el-form-item label="考勤月份">
          <el-input :model-value="applyMonthText" disabled style="width: 160px" />
        </el-form-item>
        <el-form-item label="修改项">
          <el-table :data="applyFields" border size="small" class="apply-field-table">
            <el-table-column label="字段" align="center" prop="fieldName" width="110" />
            <el-table-column label="原值" align="center" width="110">
              <template #default="{ row }">{{ row.oldValue === '' || row.oldValue == null ? '—' : row.oldValue }}</template>
            </el-table-column>
            <el-table-column label="新值（留空 = 不修改）" align="center" min-width="180">
              <template #default="{ row }">
                <el-input-number
                  v-if="row.kind !== 'text'"
                  v-model="row.newValue"
                  :min="0"
                  :precision="row.kind === 'int' ? 0 : 2"
                  :controls="false"
                  placeholder="不修改"
                  style="width: 140px"
                />
                <el-input v-else v-model="row.newValue" maxlength="512" placeholder="不修改" style="width: 220px" />
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
        <el-form-item label="涉及日期">
          <el-date-picker
            v-model="applyForm.involveDates"
            type="dates"
            value-format="YYYY-MM-DD"
            placeholder="选择涉及的日期（可多选）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="修改说明" required>
          <el-input
            v-model="applyForm.reason"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
            placeholder="请说明修改原因（必填）"
          />
        </el-form-item>
        <el-form-item label="截图凭证" required>
          <div class="apply-upload">
            <ImageUpload v-model="applyForm.ossIds" :limit="5" :file-size="10" />
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="applyVisible = false">取 消</el-button>
        <el-button type="primary" :loading="applySubmitting" @click="submitApply">提交申请</el-button>
      </template>
    </el-dialog>

    <!-- 考勤每日明细（本人） -->
    <AttendanceDetailDialog v-model="detailVisible" mode="my" :attend-month="detailMonth" />

    <!-- 申请详情弹窗（复用工作流审批详情组件，与人事端「考勤管理→修改记录」保持一致） -->
    <el-dialog v-model="rectifyDetailVisible" title="考勤修改申请详情" width="860px" append-to-body destroy-on-close>
      <AttendanceRectifyDetail v-if="rectifyDetailId" :business-id="rectifyDetailId" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type {
  AttendanceQuery,
  AttendanceRecord,
  AttendanceRectify,
  AttendanceRectifyQuery,
  AttendanceRectifyStatus
} from '@/api/panjia/types';
import AttendanceDetailDialog from '@/components/AttendanceDetailDialog/index.vue';
import ImageUpload from '@/components/ImageUpload/index.vue';
import AttendanceRectifyDetail from '@/components/WorkflowHandle/details/AttendanceRectifyDetail.vue';
import modal from '@/plugins/modal';

const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);
const monthRange = ref<[string, string] | []>([]);
/** 当前 Tab：attendance 考勤查询 / rectify 我的修改申请 */
const activeTab = ref('attendance');

/** 每日明细弹窗（复用共享组件，与考勤管理「考勤汇总→详情」一致） */
const detailVisible = ref(false);
const detailMonth = ref('');

const openDetail = (row: AttendanceRecord) => {
  detailMonth.value = row.attendMonth || '';
  detailVisible.value = true;
};

const queryParams = reactive<AttendanceQuery>({
  pageNum: 1,
  pageSize: 10,
  monthStart: undefined,
  monthEnd: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    const [monthStart, monthEnd] = monthRange.value || [];
    // 仅传月份条件；员工身份由后端按登录用户强制限定
    const res = await attendanceApi.myList({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      monthStart: monthStart || undefined,
      monthEnd: monthEnd || undefined
    });
    attendanceList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询本人考勤失败');
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  rectifyQuery.pageNum = 1;
  getList();
  getRectifyList();
};

const resetQuery = () => {
  monthRange.value = [];
  queryParams.pageNum = 1;
  rectifyQuery.pageNum = 1;
  getList();
  getRectifyList();
};

// ==================== 修改申请 ====================

/** 可修改字段定义（与后端白名单一致） */
const FIELD_DEFS = [
  { field: 'attendDays', fieldName: '出勤(天)', kind: 'decimal' },
  { field: 'restDays', fieldName: '休息(天)', kind: 'decimal' },
  { field: 'lateCount', fieldName: '迟到次数', kind: 'int' },
  { field: 'lateMinutes', fieldName: '迟到(分)', kind: 'int' },
  { field: 'missingCardCount', fieldName: '缺卡次数', kind: 'int' },
  { field: 'absentDays', fieldName: '旷工(天)', kind: 'decimal' },
  { field: 'personalLeaveDays', fieldName: '事假(天)', kind: 'decimal' },
  { field: 'sickClinicDays', fieldName: '病假诊所(天)', kind: 'decimal' },
  { field: 'sickHospitalDays', fieldName: '病假二甲(天)', kind: 'decimal' },
  { field: 'remark', fieldName: '备注', kind: 'text' }
] as const;

interface ApplyFieldRow {
  field: string;
  fieldName: string;
  kind: string;
  oldValue: string;
  newValue: any;
}

const applyVisible = ref(false);
const applySubmitting = ref(false);
const applyMonth = ref('');
const applyFields = ref<ApplyFieldRow[]>([]);
const applyForm = reactive<{ involveDates: string[]; reason: string; ossIds: string }>({
  involveDates: [],
  reason: '',
  ossIds: ''
});

const applyMonthText = computed(() => applyMonth.value?.slice(0, 7) || '—');

/** 打开申请弹窗：以选中行当前值为原值 */
const openApply = (row: AttendanceRecord) => {
  applyMonth.value = row.attendMonth || '';
  applyFields.value = FIELD_DEFS.map((def) => {
    const raw = (row as any)[def.field];
    return {
      field: def.field,
      fieldName: def.fieldName,
      kind: def.kind,
      oldValue: raw == null ? '' : String(raw),
      newValue: undefined
    };
  });
  applyForm.involveDates = [];
  applyForm.reason = '';
  applyForm.ossIds = '';
  applyVisible.value = true;
};

const submitApply = async () => {
  const changes = applyFields.value
    .filter((f) => f.newValue !== undefined && f.newValue !== null && String(f.newValue).trim() !== '')
    .map((f) => ({ field: f.field, newValue: String(f.newValue).trim() }));
  if (!changes.length) {
    modal.msgWarning('请至少填写一项要修改的新值');
    return;
  }
  if (!applyForm.reason.trim()) {
    modal.msgWarning('请填写修改说明');
    return;
  }
  if (!applyForm.ossIds) {
    modal.msgWarning('请至少上传 1 张截图凭证');
    return;
  }
  applySubmitting.value = true;
  try {
    await attendanceApi.rectifySubmit({
      attendMonth: applyMonth.value,
      changes,
      involveDates: applyForm.involveDates.length ? applyForm.involveDates.join(',') : undefined,
      reason: applyForm.reason.trim(),
      ossIds: applyForm.ossIds
    });
    modal.msgSuccess('提交成功，请等待人事审批');
    applyVisible.value = false;
    rectifyQuery.pageNum = 1;
    getRectifyList();
  } catch (e: any) {
    modal.msgError(e?.message || '提交失败');
  } finally {
    applySubmitting.value = false;
  }
};

// ==================== 我的申请记录 ====================

const rectifyLoading = ref(false);
const rectifyList = ref<AttendanceRectify[]>([]);
const rectifyTotal = ref(0);
const rectifyQuery = reactive<AttendanceRectifyQuery>({ pageNum: 1, pageSize: 10 });

const getRectifyList = async () => {
  rectifyLoading.value = true;
  try {
    const [monthStart, monthEnd] = monthRange.value || [];
    const res = await attendanceApi.rectifyMyPage({
      pageNum: rectifyQuery.pageNum,
      pageSize: rectifyQuery.pageSize,
      monthStart: monthStart || undefined,
      monthEnd: monthEnd || undefined
    });
    rectifyList.value = res.data?.rows ?? [];
    rectifyTotal.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询修改申请失败');
  } finally {
    rectifyLoading.value = false;
  }
};

const RECTIFY_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELED: '已取消'
};
const RECTIFY_STATUS_TAG: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELED: 'info'
};
const rectifyStatusLabel = (s?: AttendanceRectifyStatus | string) => RECTIFY_STATUS_LABEL[s || ''] || s || '—';
const rectifyStatusTag = (s?: AttendanceRectifyStatus | string) => RECTIFY_STATUS_TAG[s || ''] || 'info';

/** 修改项摘要：字段 原值→新值；... */
const changeSummary = (row: AttendanceRectify) => {
  const items = row.changes || [];
  if (!items.length) return '—';
  return items.map((c) => `${c.fieldName} ${c.oldValue === '' || c.oldValue == null ? '—' : c.oldValue}→${c.newValue === '' ? '（清空）' : c.newValue}`).join('；');
};

// ==================== 申请详情（复用工作流审批详情组件，与人事端保持一致） ====================

const rectifyDetailVisible = ref(false);
const rectifyDetailId = ref('');

const openRectifyDetail = (row: AttendanceRectify) => {
  rectifyDetailId.value = row.id;
  rectifyDetailVisible.value = true;
};

onMounted(() => {
  getList();
  getRectifyList();
});
</script>

<style lang="scss" scoped>
.people-attendance-my-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .tab-tip {
    margin: 0 0 10px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  /* 全局 .data-table .el-button.is-link 把 link 按钮压成 28px 图标按钮（相邻仅 4px !important），
     本页操作列用文字按钮，需覆盖回自适应宽度/自适应留白并统一间距，避免文字被压缩后互相重叠 */
  .data-table {
    :deep(.el-button.is-link) {
      width: auto !important;
      min-width: 0 !important;
      padding: 0 6px !important;
      background: transparent !important;
    }

    :deep(.el-button.is-link + .el-button.is-link) {
      margin-left: 0 !important;
    }
  }

  .op-btns {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }

  .apply-field-table {
    width: 100%;
  }

  .apply-upload {
    width: 100%;
  }
}
</style>
