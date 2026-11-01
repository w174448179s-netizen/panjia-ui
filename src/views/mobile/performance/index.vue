<template>
  <div class="m-page">
    <div class="m-filter">
      <select v-model="year" @change="load">
        <option v-for="y in years" :key="y" :value="y">{{ y }} 年</option>
      </select>
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ year }} 年暂无业绩数据</div>

    <div v-for="row in rows" :key="`${row.period}-${row.employeeId}`" class="m-card">
      <div class="m-card-head">
        <span>{{ row.employeeName || '—' }} · {{ row.deptName || '—' }}</span>
        <span>{{ row.period }}</span>
      </div>

      <div class="m-hero">
        <span class="m-hero-num">{{ formatMoney(row.totalAmount) }}</span>
        <span class="m-hero-unit">新签业绩（元）</span>
      </div>

      <div class="m-foot">合同数 {{ row.contractCount ?? 0 }} 份</div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobilePerformance">
import { onMounted, ref } from 'vue';
import { performanceApi, type PerformanceSummaryRow } from '@/api/panjia/performance';
import { formatMoney } from '../utils';

const now = new Date();
const year = ref(String(now.getFullYear()));
const years = [0, 1, 2, 3].map((offset) => String(now.getFullYear() - offset));
const loading = ref(false);
const rows = ref<PerformanceSummaryRow[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res: any = await performanceApi.listSummary({
      periodType: 'MONTH',
      year: year.value,
      pageNum: 1,
      pageSize: 100
    });
    rows.value = res.data?.rows ?? [];
  } finally {
    loading.value = false;
  }
};

onMounted(load);
</script>
