<template>
  <div class="m-page">
    <div class="m-filter">
      <input v-model="period" type="month" @change="load" />
      <button type="button" @click="load">刷新</button>
    </div>

    <div v-if="loading" class="m-tip">加载中…</div>
    <div v-else-if="!rows.length" class="m-empty">{{ period }} 暂无业绩数据</div>

    <div
      v-for="row in rows"
      :key="`${row.contractNo}-${row.period}`"
      class="m-card m-card-tap"
      @click="openDetail(row)"
    >
      <div class="m-card-head">
        <span>{{ row.contractNo }}</span>
        <span>{{ row.signDate || row.period }}</span>
      </div>

      <div class="m-hero">
        <span class="m-hero-num">{{ formatMoney(row.expectAmount) }}</span>
        <span class="m-hero-unit">新签业绩（元）</span>
      </div>

      <div class="m-grid">
        <div>
          <label>实收业绩</label>
          <b>{{ formatMoney(row.realAmount) }}</b>
        </div>
        <div>
          <label>业务类型</label>
          <b>{{ bizTypeText(row.bizType) }}</b>
        </div>
      </div>

      <div v-if="row.propertyAddress" class="m-foot">{{ row.propertyAddress }}</div>
      <div class="m-detail-link">查看经纪人业绩分配 ›</div>
    </div>

    <!-- 经纪人业绩分配明细 -->
    <div v-if="detailVisible" class="m-mask" @click.self="detailVisible = false">
      <div class="m-sheet">
        <div class="m-sheet-head">
          <div>
            <p class="m-sheet-title">经纪人业绩分配</p>
            <p class="m-sheet-sub">{{ detailBizNo }}</p>
          </div>
          <button type="button" class="m-sheet-close" @click="detailVisible = false">×</button>
        </div>

        <div class="m-sheet-body">
          <div v-if="detailLoading" class="m-tip">加载中…</div>
          <div v-else-if="!detailRows.length" class="m-empty">暂无分配明细</div>

          <div v-for="item in detailRows" :key="item.factId" class="m-alloc">
            <div class="m-alloc-head">
              <b>
                {{ item.employeeName || '—' }}
                <span v-if="item.employeeCode" class="m-alloc-code">（{{ item.employeeCode }}）</span>
              </b>
              <span class="m-tag">{{ item.roleType || item.roleName || '—' }}</span>
            </div>
            <div class="m-alloc-dept">{{ item.deptPath || '—' }}</div>
            <div class="m-grid-3 m-alloc-grid">
              <div>
                <label>角色占比</label>
                <b>{{ formatRatio(item.shareRatio) }}</b>
              </div>
              <div>
                <label>新签业绩</label>
                <b>{{ formatMoney(item.expectAmount) }}</b>
              </div>
              <div>
                <label>实收业绩</label>
                <b>{{ formatMoney(item.realAmount) }}</b>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts" name="MobilePerfSearch">
import { onMounted, ref } from 'vue';
import { performanceApi, type PerformanceFactSearch, type PerformanceSearchDetailRow } from '@/api/panjia/performance';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { currentMonth, formatMoney, formatRatio } from '../utils';

const period = ref(currentMonth());
const loading = ref(false);
const rows = ref<PerformanceFactSearch[]>([]);

const detailVisible = ref(false);
const detailLoading = ref(false);
const detailBizNo = ref('');
const detailRows = ref<PerformanceSearchDetailRow[]>([]);

// 后端 biz_type 存的是中文名称（一手房/房产金融/二手买卖…），直接展示
const bizTypeText = (type?: string) => type || '—';

const load = async () => {
  loading.value = true;
  try {
    const res: any = await performanceApi.searchByContract({
      period: period.value,
      pageNum: 1,
      pageSize: 50
    });
    rows.value = res.data?.rows ?? [];
  } finally {
    loading.value = false;
  }
};

/** 点击合同卡片查看该单号下各经纪人的业绩分配 */
const openDetail = async (row: PerformanceFactSearch) => {
  const bizNo = resolveBizNo(row.bizType, row.contractNo, row.orderNo);
  if (!bizNo) return;
  detailBizNo.value = bizNo;
  detailRows.value = [];
  detailVisible.value = true;
  detailLoading.value = true;
  try {
    const res: any = await performanceApi.getSearchDetails({ bizNo });
    detailRows.value = res.data ?? [];
  } finally {
    detailLoading.value = false;
  }
};

onMounted(load);
</script>

<style scoped>
.m-card-tap {
  cursor: pointer;
}

.m-detail-link {
  margin-top: 8px;
  font-size: 12px;
  color: #1f6feb;
  text-align: right;
}

.m-mask {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  background: rgba(0, 0, 0, 0.45);
}

.m-sheet {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-height: 82vh;
  overflow: hidden;
  background: #f2f4f7;
  border-radius: 16px 16px 0 0;
}

.m-sheet-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: #fff;
}

.m-sheet-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.m-sheet-sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

.m-sheet-close {
  padding: 0 6px;
  font-size: 22px;
  line-height: 1;
  color: #909399;
  background: transparent;
  border: 0;
}

.m-sheet-body {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.m-alloc {
  padding: 12px;
  margin-bottom: 10px;
  background: #fff;
  border-radius: 12px;
}

.m-alloc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
}

.m-alloc-code {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}

.m-alloc-dept {
  margin-top: 6px;
  font-size: 12px;
  color: #606266;
}

.m-alloc-grid {
  margin-top: 10px;

  label {
    display: block;
    font-size: 12px;
    color: #909399;
  }

  b {
    font-size: 14px;
    font-weight: 600;
  }
}
</style>
