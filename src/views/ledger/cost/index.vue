<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>门店成本录入</span>
        </div>
      </template>
      <div class="page-content">
        <el-empty description="门店成本录入页面 - 开发中">
          <template #image>
            <el-icon :size="80" color="var(--panjia-primary, #1a6fb5)"><House /></el-icon>
          </template>
        </el-empty>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { House } from '@element-plus/icons-vue';
</script>

<style lang="scss" scoped>
.panjia-page {
  padding: 16px;
}

.page-card {
  border-radius: 16px;
}

.card-header {
  font-weight: 600;
  font-size: 16px;
}

.page-content {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
