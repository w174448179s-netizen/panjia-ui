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
          <p class="tab-tip">仅展示本人的月度考勤汇总；如有异议可点「申请修改」提交人事审批。</p>
          <el-table v-loading="loading" border class="data-table" :data="attendanceList" @expand-change="handleExpandChange">
            <el-table-column type="expand">
              <template #default="{ row }">
                <div class="detail-expand">
                  <el-table
                    :data="detailMap[row.attendMonth?.slice(0, 7)] || []"
                    size="small"
                    border
                    v-loading="detailLoadingMap[row.attendMonth?.slice(0, 7)]"
                    max-height="300"
                  >
                    <el-table-column label="考勤日期" align="center" prop="attendDate" width="140" />
                    <el-table-column label="考勤状态" align="center" prop="status" min-width="120">
                      <template #default="{ row: r }">
                        <el-tag
                          v-if="r.status"
                          :type="attendStatusTagType(r.status)"
                          effect="plain"
                          size="small"
                        >{{ r.status }}</el-tag>
                        <span v-else>—</span>
                      </template>
                    </el-table-column>
                    <template #empty>
                      <span>该月无每日考勤明细</span>
                    </template>
                  </el-table>
                </div>
              </template>
            </el-table-column>
            <el-table-column label="考勤月份" align="center" width="120">
              <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="出勤(天)" align="center" prop="attendDays" width="90" />
            <el-table-column label="休息(天)" align="center" prop="restDays" width="90" />
            <el-table-column label="迟到次数" align="center" prop="lateCount" width="90" />
            <el-table-column label="迟到(分)" align="center" prop="lateMinutes" width="90" />
            <el-table-column label="缺卡次数" align="center" prop="missingCardCount" width="90" />
            <el-table-column label="旷工(天)" align="center" prop="absentDays" width="90" />
            <el-table-column label="请假(天)" align="center" prop="leaveDays" width="90" />
            <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
            <el-table-column label="操作" align="center" width="110" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link icon="EditPen" @click="openApply(row)">申请修改</el-button>
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
            <el-table-column label="考勤月份" align="center" width="100">
              <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" align="center" width="100">
              <template #default="{ row }">
                <el-tag :type="rectifyStatusTag(row.status)" size="small">{{ rectifyStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="修改项" align="left" min-width="220" show-overflow-tooltip>
              <template #default="{ row }">{{ changeSummary(row) }}</template>
            </el-table-column>
            <el-table-column label="修改说明" align="center" prop="reason" min-width="140" show-overflow-tooltip />
            <el-table-column label="提交时间" align="center" prop="submitTime" width="160" />
            <el-table-column label="操作" align="center" width="90" fixed="right">
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

    <!-- 申请详情弹窗 -->
    <el-dialog v-model="rectifyDetailVisible" title="修改申请详情" width="760px" append-to-body destroy-on-close>
      <template v-if="currentRectify">
        <el-descriptions :column="3" border size="small">
          <el-descriptions-item label="考勤月份">{{ currentRectify.attendMonth?.slice(0, 7) ?? '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="rectifyStatusTag(currentRectify.status)" size="small">{{ rectifyStatusLabel(currentRectify.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ currentRectify.submitTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="审批时间">{{ currentRectify.approveTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="涉及日期" :span="2">{{ currentRectify.involveDates || '—' }}</el-descriptions-item>
          <el-descriptions-item v-if="currentRectify.status === 'REJECTED'" label="驳回原因" :span="3">
            <span class="reject-reason">{{ currentRectify.rejectReason || '—' }}</span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section-title">修改明细</div>
        <el-table :data="currentRectify.changes || []" border size="small">
          <el-table-column label="字段" align="center" prop="fieldName" width="140" />
          <el-table-column label="原值" align="center" min-width="120">
            <template #default="{ row }">{{ row.oldValue === '' || row.oldValue == null ? '—' : row.oldValue }}</template>
          </el-table-column>
          <el-table-column label="新值" align="center" min-width="120">
            <template #default="{ row }">
              <span class="new-value">{{ row.newValue === '' || row.newValue == null ? '（清空）' : row.newValue }}</span>
            </template>
          </el-table-column>
        </el-table>

        <div class="detail-section-title">修改说明</div>
        <div class="reason-text">{{ currentRectify.reason || '—' }}</div>

        <div class="detail-section-title">截图凭证</div>
        <div v-if="rectifyImageUrls.length" class="image-list">
          <el-image
            v-for="(url, idx) in rectifyImageUrls"
            :key="idx"
            :src="url"
            :preview-src-list="rectifyImageUrls"
            :initial-index="idx"
            fit="cover"
            preview-teleported
            class="rectify-image"
          />
        </div>
        <span v-else>—</span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type {
  AttendanceDetail,
  AttendanceQuery,
  AttendanceRecord,
  AttendanceRectify,
  AttendanceRectifyQuery,
  AttendanceRectifyStatus
} from '@/api/panjia/types';
import ImageUpload from '@/components/ImageUpload/index.vue';
import modal from '@/plugins/modal';

const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);
const monthRange = ref<[string, string] | []>([]);
/** 当前 Tab：attendance 考勤查询 / rectify 我的修改申请 */
const activeTab = ref('attendance');

/** 每日明细缓存：attendMonth(yyyy-MM) → details 列表 */
const detailMap = ref<Record<string, AttendanceDetail[]>>({});
/** 每日明细加载中标记 */
const detailLoadingMap = ref<Record<string, boolean>>({});

/** 展开行时加载每日明细 */
const handleExpandChange = async (row: AttendanceRecord, expanded: any) => {
  const month = row.attendMonth?.slice(0, 7);
  if (!month) return;
  const isExpanded = Array.isArray(expanded)
    ? expanded.some((r: AttendanceRecord) => r.attendMonth?.slice(0, 7) === month)
    : Boolean(expanded);
  if (!isExpanded || detailMap.value[month]) return;
  detailLoadingMap.value[month] = true;
  try {
    const res = await attendanceApi.myDetails(month);
    detailMap.value[month] = res.data ?? [];
  } catch (e) {
    console.error('加载考勤每日明细失败', e);
    detailMap.value[month] = [];
  } finally {
    detailLoadingMap.value[month] = false;
  }
};

/** 考勤状态标签颜色 */
const attendStatusTagType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (status.includes('正常')) return 'success';
  if (status.includes('迟到') || status.includes('缺卡')) return 'warning';
  if (status.includes('旷工')) return 'danger';
  return 'info';
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
  { field: 'leaveDays', fieldName: '请假(天)', kind: 'decimal' },
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

// ==================== 申请详情 ====================

const rectifyDetailVisible = ref(false);
const currentRectify = ref<AttendanceRectify | null>(null);

const rectifyImageUrls = computed(() => {
  const urls = currentRectify.value?.ossUrls || '';
  return urls.split(',').map((u) => u.trim()).filter(Boolean);
});

const openRectifyDetail = (row: AttendanceRectify) => {
  currentRectify.value = row;
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

  .detail-expand {
    padding: 8px 12px 4px 48px;
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
    width: 120px;
    height: 120px;
    border-radius: 6px;
    border: 1px solid var(--el-border-color-lighter);
    cursor: pointer;
  }
}
</style>
