<template>
  <div class="m-page">
    <div class="m-filter">
      <input v-model="month" type="month" @change="load" />
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ month }} 暂无考勤数据</div>

    <div v-for="row in rows" :key="row.id" class="m-card m-card-tap" @click="openDetail(row)">
      <div class="m-card-head">
        <span>{{ row.employeeName || '—' }} · {{ row.deptName || '—' }}</span>
        <span>{{ row.attendMonth }}</span>
      </div>

      <div class="m-hero">
        <span class="m-hero-num">{{ formatDays(row.attendDays) }}</span>
        <span class="m-hero-unit">出勤天数</span>
      </div>

      <div class="m-grid-3">
        <div>
          <label>休息</label>
          <b>{{ formatDays(row.restDays) }}</b>
        </div>
        <div>
          <label>迟到</label>
          <b>{{ row.lateCount ?? 0 }}</b>
        </div>
        <div>
          <label>缺卡</label>
          <b>{{ row.missingCardCount ?? 0 }}</b>
        </div>
        <div>
          <label>旷工</label>
          <b>{{ formatDays(row.absentDays) }}</b>
        </div>
        <div>
          <label>事假</label>
          <b>{{ formatDays(row.personalLeaveDays) }}</b>
        </div>
        <div>
          <label>病假</label>
          <b>{{ formatDays((row.sickClinicDays ?? 0) + (row.sickHospitalDays ?? 0)) }}</b>
        </div>
      </div>

      <div v-if="row.remark" class="m-foot">备注：{{ row.remark }}</div>
      <div class="m-actions">
        <span class="m-detail-link">查看每日考勤明细 ›</span>
        <button type="button" class="m-btn" @click.stop="openApply(row)">申请修改</button>
      </div>
    </div>

    <!-- 每日考勤明细 -->
    <div v-if="detailVisible" class="m-mask" @click.self="detailVisible = false">
      <div class="m-sheet">
        <div class="m-sheet-head">
          <div>
            <p class="m-sheet-title">每日考勤明细</p>
            <p class="m-sheet-sub">{{ detailMonth }}</p>
          </div>
          <button type="button" class="m-sheet-close" @click="detailVisible = false">×</button>
        </div>
        <div class="m-sheet-body">
          <div v-if="detailLoading" class="m-tip">加载中…</div>
          <div v-else-if="!details.length" class="m-empty">暂无每日明细</div>
          <div v-for="item in details" :key="item.id" class="m-list-row">
            <div class="m-list-main">
              <b>{{ item.attendDate }}</b>
            </div>
            <div class="m-list-value">{{ item.status || '—' }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 申请考勤修改 -->
    <div v-if="applyVisible" class="m-mask" @click.self="applyVisible = false">
      <div class="m-sheet">
        <div class="m-sheet-head">
          <div>
            <p class="m-sheet-title">申请考勤修改</p>
            <p class="m-sheet-sub">{{ applyMonth }} · 只需填写要修改的项，不填表示不修改</p>
          </div>
          <button type="button" class="m-sheet-close" @click="applyVisible = false">×</button>
        </div>
        <div class="m-sheet-body">
          <div v-for="item in applyFields" :key="item.field" class="m-field">
            <label>
              {{ item.fieldName }}
              <span class="m-field-old">原值 {{ item.oldValue === '' ? '—' : item.oldValue }}</span>
            </label>
            <input
              v-if="item.kind === 'text'"
              v-model="item.newValue"
              type="text"
              maxlength="512"
              placeholder="不修改"
            />
            <input
              v-else
              v-model="item.newValue"
              type="number"
              inputmode="decimal"
              :step="item.kind === 'int' ? 1 : 0.01"
              min="0"
              placeholder="不修改"
            />
          </div>

          <div class="m-field">
            <label>修改说明</label>
            <textarea v-model="applyReason" rows="3" maxlength="500" placeholder="请说明修改原因" />
          </div>

          <div class="m-field">
            <label>截图凭证（至少 1 张）</label>
            <ImageUpload v-model="applyOssIds" :limit="5" :file-size="10" />
          </div>

          <div v-if="applyError" class="m-error">{{ applyError }}</div>

          <div class="m-sheet-actions">
            <button type="button" class="m-btn m-btn-plain" @click="applyVisible = false">取消</button>
            <button type="button" class="m-btn" :disabled="applySubmitting" @click="submitApply">
              {{ applySubmitting ? '提交中…' : '提交申请' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobileAttendance">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceDetail, AttendanceRecord } from '@/api/panjia/types';
import { currentMonth, formatDays } from '../utils';

/** 可修改字段（与 PC 考勤修改申请、后端白名单一致） */
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
  newValue: string;
}

const month = ref(currentMonth());
const loading = ref(false);
const rows = ref<AttendanceRecord[]>([]);

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailMonth = ref('');
const details = ref<AttendanceDetail[]>([]);

const applyVisible = ref(false);
const applyMonth = ref('');
const applyFields = ref<ApplyFieldRow[]>([]);
const applyReason = ref('');
const applyOssIds = ref('');
const applyError = ref('');
const applySubmitting = ref(false);

const load = async () => {
  if (!month.value) return;
  loading.value = true;
  try {
    // 后端按日期解析（yyyy-MM-dd），月份统一转成当月 1 号
    const monthDate = `${month.value}-01`;
    const res: any = await attendanceApi.myList({
      monthStart: monthDate,
      monthEnd: monthDate,
      pageNum: 1,
      pageSize: 50
    });
    rows.value = res.data?.rows ?? [];
  } finally {
    loading.value = false;
  }
};

/** 点击卡片加载该月每日考勤明细（接口按 yyyy-MM） */
const openDetail = async (row: AttendanceRecord) => {
  const targetMonth = row.attendMonth ? String(row.attendMonth).slice(0, 7) : month.value;
  if (!targetMonth) return;
  detailMonth.value = targetMonth;
  details.value = [];
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res: any = await attendanceApi.myDetails(targetMonth);
    details.value = res.data ?? [];
  } finally {
    detailLoading.value = false;
  }
};

const openApply = (row: AttendanceRecord) => {
  applyMonth.value = row.attendMonth || `${month.value}-01`;
  applyError.value = '';
  applyReason.value = '';
  applyOssIds.value = '';
  applyFields.value = FIELD_DEFS.map((def) => {
    const raw = (row as unknown as Record<string, unknown>)[def.field];
    return {
      field: def.field,
      fieldName: def.fieldName,
      kind: def.kind,
      oldValue: raw === null || raw === undefined ? '' : String(raw),
      newValue: ''
    };
  });
  applyVisible.value = true;
};

const submitApply = async () => {
  const changes = applyFields.value
    .filter((item) => String(item.newValue ?? '').trim() !== '')
    .map((item) => ({ field: item.field, newValue: String(item.newValue).trim() }));
  if (!changes.length) {
    applyError.value = '请至少填写一项要修改的新值';
    return;
  }
  if (!applyReason.value.trim()) {
    applyError.value = '请填写修改说明';
    return;
  }
  if (!applyOssIds.value) {
    applyError.value = '请至少上传 1 张截图凭证';
    return;
  }
  applyError.value = '';
  applySubmitting.value = true;
  try {
    await attendanceApi.rectifySubmit({
      attendMonth: applyMonth.value,
      changes,
      reason: applyReason.value.trim(),
      ossIds: applyOssIds.value
    });
    applyVisible.value = false;
    ElMessage.success('提交成功，请等待人事审批');
  } catch (e: any) {
    applyError.value = e?.message || '提交失败，请稍后重试';
  } finally {
    applySubmitting.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.m-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.m-actions .m-detail-link {
  margin-top: 0;
}

.m-field {
  margin-bottom: 12px;

  label {
    display: flex;
    justify-content: space-between;
    margin-bottom: 6px;
    font-size: 13px;
    color: #606266;
  }

  input,
  textarea {
    width: 100%;
    padding: 10px 12px;
    font-size: 15px;
    background: #fff;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    box-sizing: border-box;
    outline: none;
  }
}

.m-field-old {
  font-size: 12px;
  color: #909399;
}

.m-error {
  margin-bottom: 10px;
  font-size: 13px;
  color: #f56c6c;
}

.m-sheet-actions {
  display: flex;
  gap: 10px;
  padding: 4px 0 calc(10px + env(safe-area-inset-bottom));
}

.m-sheet-actions .m-btn {
  flex: 1;
  height: 42px;
  font-size: 15px;
  color: #fff;
  background: #1f6feb;
  border: 0;
  border-radius: 8px;

  &:disabled {
    opacity: 0.6;
  }
}

.m-sheet-actions .m-btn-plain {
  color: #606266;
  background: #fff;
  border: 1px solid #dcdfe6;
}
</style>
