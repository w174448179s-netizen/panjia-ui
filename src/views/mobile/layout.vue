<template>
  <div class="m-shell">
    <header class="m-header">
      <div class="m-header-main">
        <p class="m-hello">你好，{{ userStore.nickname || '同事' }}</p>
        <h1>{{ title }}</h1>
      </div>
    </header>

    <main class="m-body">
      <router-view />
    </main>

    <nav class="m-tabs">
      <router-link
        v-for="tab in tabs"
        :key="tab.path"
        :to="tab.path"
        class="m-tab"
        :class="{ active: route.path.startsWith(tab.path) }"
      >
        {{ tab.label }}
      </router-link>
    </nav>
  </div>
</template>

<script setup lang="ts" name="MobileLayout">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useUserStore } from '@/store/modules/user';

const route = useRoute();
const userStore = useUserStore();

const tabs = [
  { path: '/m/score', label: '积分' },
  { path: '/m/attendance', label: '考勤' },
  { path: '/m/payroll', label: '工资' },
  { path: '/m/perf-search', label: '业绩查询' },
  { path: '/m/more', label: '更多' }
];

const title = computed(() => (route.meta.title as string) || '综合查询');
</script>

<style lang="scss">
/* 移动端全局样式（非 scoped，子页面复用） */
.m-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f2f4f7;
  color: #303133;
  -webkit-tap-highlight-color: transparent;
}

.m-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 18px 14px;
  color: #fff;
  background: linear-gradient(135deg, #1f6feb, #0b4fc4);

  h1 {
    margin: 4px 0 0;
    font-size: 20px;
    font-weight: 600;
  }
}

.m-hello {
  margin: 0;
  font-size: 13px;
  opacity: 0.85;
}

.m-btn {
  padding: 6px 12px;
  font-size: 13px;
  color: #1f6feb;
  background: #ecf3ff;
  border: 1px solid #c6dcff;
  border-radius: 14px;
}

.m-body {
  flex: 1;
  width: 100%;
  max-width: 720px;
  padding: 12px 12px 76px;
  margin: 0 auto;
  box-sizing: border-box;
}

.m-tabs {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 10;
  display: flex;
  padding: 6px 0 calc(6px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.06);
}

.m-tab {
  flex: 1;
  padding: 8px 0;
  font-size: 14px;
  color: #606266;
  text-align: center;
  text-decoration: none;

  &.active {
    font-weight: 600;
    color: #1f6feb;
  }
}

.m-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.m-filter {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  background: #fff;
  border-radius: 10px;

  input,
  select {
    flex: 1;
    height: 34px;
    padding: 0 8px;
    font-size: 14px;
    color: #303133;
    background: #f5f7fa;
    border: 1px solid #e4e7ed;
    border-radius: 8px;
    outline: none;
  }

  button {
    height: 34px;
    padding: 0 14px;
    font-size: 14px;
    color: #fff;
    background: #1f6feb;
    border: 0;
    border-radius: 8px;
  }
}

.m-card {
  padding: 14px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.m-card-head {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #909399;
}

.m-hero {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin: 10px 0 12px;
}

.m-hero-num {
  font-size: 34px;
  font-weight: 700;
  color: #1f6feb;
}

.m-hero-unit {
  font-size: 13px;
  color: #909399;
}

.m-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px 12px;

  label {
    display: block;
    font-size: 12px;
    color: #909399;
  }

  b {
    font-size: 16px;
    font-weight: 600;
  }
}

.m-grid-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.m-foot {
  margin-top: 12px;
  padding-top: 10px;
  font-size: 13px;
  color: #606266;
  border-top: 1px solid #f0f0f0;
}

.m-tip,
.m-empty {
  padding: 28px 0;
  font-size: 14px;
  color: #909399;
  text-align: center;
}

.m-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 12px;
  color: #1f6feb;
  background: #ecf3ff;
  border-radius: 10px;
}

.m-chips {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
  overflow-x: auto;
}

.m-chip {
  flex: none;
  padding: 8px 14px;
  font-size: 13px;
  color: #606266;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 16px;

  &.active {
    font-weight: 600;
    color: #fff;
    background: #1f6feb;
    border-color: #1f6feb;
  }
}

.m-card-tap {
  cursor: pointer;
}

.m-detail-link {
  margin-top: 8px;
  font-size: 12px;
  color: #1f6feb;
  text-align: right;
}

.m-tag-red {
  color: #f56c6c;
  background: #fef0f0;
}

/* 底部抽屉（各移动端页面共用） */
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

.m-list-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 8px;
  font-size: 14px;
  background: #fff;
  border-radius: 10px;
}

.m-list-value {
  font-weight: 600;
  color: #1f6feb;
}

.m-gate {
  padding: 30px 18px;
  text-align: center;
  background: #fff;
  border-radius: 12px;

  h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }

  p {
    margin: 0 0 16px;
    font-size: 13px;
    color: #909399;
  }

  input {
    width: 100%;
    height: 40px;
    padding: 0 12px;
    font-size: 15px;
    border: 1px solid #dcdfe6;
    border-radius: 8px;
    box-sizing: border-box;
    outline: none;
  }

  button {
    width: 100%;
    height: 40px;
    margin-top: 12px;
    font-size: 15px;
    color: #fff;
    background: #1f6feb;
    border: 0;
    border-radius: 8px;
  }
}
</style>
