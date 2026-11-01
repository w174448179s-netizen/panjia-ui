<template>
  <div class="m-page">
    <div class="m-filter">
      <input v-model="month" type="month" @change="load" />
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ month }} 暂无积分数据</div>

    <div v-for="row in rows" :key="row.id" class="m-card">
      <div class="m-card-head">
        <span>{{ row.employeeName || '—' }} · {{ row.deptName || '—' }}</span>
        <span>{{ row.scoreMonth }}</span>
      </div>
      <div class="m-hero">
        <span class="m-hero-num">{{ row.totalPoints ?? '—' }}</span>
        <span class="m-hero-unit">总积分</span>
      </div>
      <div class="m-grid">
        <div>
          <label>平均积分</label>
          <b>{{ row.avgPoints ?? '—' }}</b>
        </div>
        <div>
          <label>绩效等级</label>
          <b>{{ row.grade || '—' }}</b>
        </div>
        <div>
          <label>出勤天数</label>
          <b>{{ row.attendDays ?? '—' }}</b>
        </div>
        <div>
          <label>晚提交</label>
          <b>{{ row.lateSubmitCount ?? 0 }} 次</b>
        </div>
      </div>
      <div class="m-foot">
        积分扣款 ¥{{ formatMoney(row.pointsFee) }}
        <span v-if="row.locked" class="m-tag" style="margin-left: 8px">期间已锁定</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobileScore">
import { onMounted, ref } from 'vue';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreRecord } from '@/api/panjia/types';
import { currentMonth, formatMoney } from '../utils';

const month = ref(currentMonth());
const loading = ref(false);
const rows = ref<ScoreRecord[]>([]);

const load = async () => {
  if (!month.value) return;
  loading.value = true;
  try {
    const res: any = await scoreApi.myList({
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
