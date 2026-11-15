<template>
  <div class="m-page">
    <div class="m-filter">
      <select v-model="periodType" @change="load">
        <option value="MONTH">本月</option>
        <option value="QUARTER">本季</option>
        <option value="YEAR">本年</option>
      </select>
      <select v-model="year" @change="load">
        <option v-for="y in years" :key="y" :value="y">{{ y }} 年</option>
      </select>
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">暂无排行数据</div>

    <div v-for="row in rows" :key="row.employeeId" class="m-card">
      <div class="m-card-head">
        <span>
          <b class="m-rank" :class="{ top: row.rank <= 3 }">{{ row.rank }}</b>
          {{ row.employeeName || '—' }} · {{ row.deptName || '—' }}
        </span>
        <span>{{ row.contractCount ?? 0 }} 份</span>
      </div>
      <div class="m-hero">
        <span class="m-hero-num">{{ formatMoney(row.totalAmount) }}</span>
        <span class="m-hero-unit">新签业绩（元）</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobilePerfRank">
import { onMounted, ref } from 'vue';
import { performanceApi, type PerformanceRankRow } from '@/api/panjia/performance';
import { formatMoney } from '../utils';

const now = new Date();
const periodType = ref<'MONTH' | 'QUARTER' | 'YEAR'>('MONTH');
const year = ref(String(now.getFullYear()));
const years = [0, 1, 2, 3].map((offset) => String(now.getFullYear() - offset));
const loading = ref(false);
const rows = ref<PerformanceRankRow[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const params: any = { periodType: periodType.value, year: year.value, pageNum: 1, pageSize: 50 };
    if (periodType.value === 'MONTH') params.month = now.getMonth() + 1;
    if (periodType.value === 'QUARTER') params.quarter = Math.floor(now.getMonth() / 3) + 1;
    const res: any = await performanceApi.listRank(params);
    rows.value = res.data?.rows ?? [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.m-rank {
  display: inline-block;
  min-width: 22px;
  font-size: 15px;
  color: #909399;
  text-align: center;

  &.top {
    color: #e6a23c;
  }
}
</style>
