<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>钉钉同步</span>
          <span class="sub-tip">考勤与积分均可按月手工同步，记录保留在各自页签</span>
        </div>
      </template>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="考勤同步" name="attendance">
          <DingTalkSyncPanel type="ATTENDANCE" />
        </el-tab-pane>
        <el-tab-pane label="积分同步" name="score">
          <DingTalkSyncPanel type="SCORE" />
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup lang="ts" name="PeopleDingTalk">
import { ref } from 'vue';
import DingTalkSyncPanel from './components/DingTalkSyncPanel.vue';

const activeTab = ref('attendance');
</script>

<style lang="scss" scoped>
.panjia-page {
  padding: 16px;
}

.page-card {
  border-radius: 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.sub-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  font-weight: 400;
}
</style>
