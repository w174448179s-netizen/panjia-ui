<template>
  <div class="m-page">
    <div class="m-filter">
      <input v-model="month" type="month" @change="load" />
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ month }} 暂无考勤数据</div>

    <div v-for="row in rows" :key="row.id" class="m-card">
      <div class="m-card-head">
        <span>{{ row.employeeName || '—' }} · {{ row.deptName || '—' }}</span>
        <span>{{ row.attendMonth }}</span>
      </div>

      <div class="m-hero">
        <span class="m-hero-num">{{ row.attendDays ?? 0 }}</span>
        <span class="m-hero-unit">出勤天数</span>
      </div>

      <div class="m-grid-3">
        <div>
          <label>休息</label>
          <b>{{ row.restDays ?? 0 }}</b>
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
          <b>{{ row.absentDays ?? 0 }}</b>
        </div>
        <div>
          <label>事假</label>
          <b>{{ row.personalLeaveDays ?? 0 }}</b>
        </div>
        <div>
          <label>病假</label>
          <b>{{ (row.sickClinicDays ?? 0) + (row.sickHospitalDays ?? 0) }}</b>
        </div>
      </div>

      <div v-if="row.remark" class="m-foot">备注：{{ row.remark }}</div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobileAttendance">
import { onMounted, ref } from 'vue';
import { attendanceApi } from '@/api/panjia/attendance';
import type { AttendanceRecord } from '@/api/panjia/types';
import { currentMonth } from '../utils';

const month = ref(currentMonth());
const loading = ref(false);
const rows = ref<AttendanceRecord[]>([]);

const load = async () => {
  if (!month.value) return;
  loading.value = true;
  try {
    const res: any = await attendanceApi.myList({
      monthStart: month.value,
      monthEnd: month.value,
      pageNum: 1,
      pageSize: 50
    });
    rows.value = res.data?.rows ?? [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
