<template>
  <div class="m-page">
    <div class="m-filter">
      <input v-model="month" type="month" @change="load" />
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ month }} 暂无积分数据</div>

    <div v-for="row in rows" :key="row.id" class="m-card m-card-tap" @click="openDetail(row)">
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
      <div class="m-detail-link">查看每日积分明细 ›</div>
    </div>

    <!-- 每日积分明细 -->
    <div v-if="detailVisible" class="m-mask" @click.self="detailVisible = false">
      <div class="m-sheet">
        <div class="m-sheet-head">
          <div>
            <p class="m-sheet-title">每日积分明细</p>
            <p class="m-sheet-sub">{{ detailMonth }}</p>
          </div>
          <button type="button" class="m-sheet-close" @click="detailVisible = false">×</button>
        </div>
        <div class="m-sheet-body">
          <div v-if="detailLoading" class="m-tip">加载中…</div>
          <div v-else-if="!details.length" class="m-empty">暂无每日明细</div>
          <div v-for="item in details" :key="item.id" class="m-list-row">
            <div class="m-list-main">
              <b>{{ item.pointDate }}</b>
              <span v-if="item.isLateSubmit" class="m-tag" style="margin-left: 6px">晚提交</span>
              <span v-if="item.isValid === false" class="m-tag m-tag-red" style="margin-left: 6px">无效</span>
            </div>
            <div class="m-list-value">{{ item.score ?? 0 }} 分</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobileScore">
import { onMounted, ref } from 'vue';
import { scoreApi } from '@/api/panjia/score';
import type { ScoreDetail, ScoreRecord } from '@/api/panjia/types';
import { currentMonth, formatMoney } from '../utils';

const month = ref(currentMonth());
const loading = ref(false);
const rows = ref<ScoreRecord[]>([]);

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailMonth = ref('');
const details = ref<ScoreDetail[]>([]);

const load = async () => {
  if (!month.value) return;
  loading.value = true;
  try {
    // 后端按日期解析（yyyy-MM-dd），月份统一转成当月 1 号
    const monthDate = `${month.value}-01`;
    const res: any = await scoreApi.myList({
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

/** 点击卡片加载该月每日积分明细（接口按 yyyy-MM） */
const openDetail = async (row: ScoreRecord) => {
  const targetMonth = row.scoreMonth ? String(row.scoreMonth).slice(0, 7) : month.value;
  if (!targetMonth) return;
  detailMonth.value = targetMonth;
  details.value = [];
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res: any = await scoreApi.myDetails(targetMonth);
    details.value = res.data ?? [];
  } finally {
    detailLoading.value = false;
  }
};

onMounted(load);
</script>
