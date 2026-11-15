<template>
  <div class="m-page">
    <router-link v-for="item in items" :key="item.path" :to="item.path" class="m-card m-entry">
      <span>{{ item.label }}</span>
      <span class="m-entry-arrow">›</span>
    </router-link>
  </div>
</template>

<script setup lang="ts" name="MobileMore">
const items = [
  { path: '/m/performance', label: '业绩汇总' },
  { path: '/m/perf-rank', label: '业绩排行' },
  { path: '/m/contract', label: '合同查询' }
];
</script>

<style scoped>
.m-entry {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 15px;
  color: #303133;
  text-decoration: none;
}

.m-entry-arrow {
  font-size: 20px;
  color: #c0c4cc;
}
</style>
