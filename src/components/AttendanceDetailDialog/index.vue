<template>
  <el-dialog v-model="visible" :title="title" width="720px" append-to-body destroy-on-close>
    <el-table v-loading="loading" border size="small" :data="details" max-height="440">
      <el-table-column label="考勤日期" align="center" prop="attendDate" width="140" />
      <el-table-column label="考勤状态" align="center" prop="status" min-width="160">
        <template #default="{ row }">
          <el-tag v-if="row.status" :type="statusTagType(row.status)" effect="plain" size="small">{{ row.status }}</el-tag>
          <span v-else>—</span>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="该月暂无每日考勤明细" />
      </template>
    </el-table>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceDetail } from '@/api/panjia/types';
import modal from '@/plugins/modal';

/**
 * 考勤每日明细弹窗（考勤管理「考勤汇总」与考勤查询「考勤查询」共用）。
 * mode=my 走本人明细接口（服务端强制本人）；mode=manage 按 employeeId 查询（人事/总监）。
 */
const props = withDefaults(
  defineProps<{
    modelValue: boolean;
    /** 考勤月份（yyyy-MM） */
    attendMonth?: string;
    /** 员工 ID（mode=manage 必传） */
    employeeId?: string | number;
    /** 员工姓名（仅用于标题展示） */
    employeeName?: string;
    mode?: 'my' | 'manage';
  }>(),
  { mode: 'my' }
);

const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v)
});

const loading = ref(false);
const details = ref<AttendanceDetail[]>([]);

const title = computed(() => {
  const parts = ['考勤每日明细'];
  if (props.employeeName) parts.push(props.employeeName);
  // 后端返回 yyyy-MM-dd，标题只展示到月（与列表「考勤月份」口径一致）
  if (props.attendMonth) parts.push(props.attendMonth.slice(0, 7));
  return parts.join('｜');
});

/** 考勤状态标签颜色（与列表口径一致） */
const statusTagType = (status: string): 'success' | 'warning' | 'danger' | 'info' => {
  if (status.includes('正常')) return 'success';
  if (status.includes('迟到') || status.includes('缺卡')) return 'warning';
  if (status.includes('旷工')) return 'danger';
  return 'info';
};

const load = async () => {
  const month = props.attendMonth?.slice(0, 7);
  details.value = [];
  if (!month) return;
  loading.value = true;
  try {
    const res =
      props.mode === 'my'
        ? await attendanceApi.myDetails(month)
        : await attendanceApi.detailsByEmployee(props.employeeId as string | number, month);
    details.value = res.data ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '查询考勤每日明细失败');
  } finally {
    loading.value = false;
  }
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) load();
  }
);
</script>
