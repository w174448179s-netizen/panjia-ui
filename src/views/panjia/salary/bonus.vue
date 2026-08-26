<template>
  <div class="panjia-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>奖金审批</span>
        </div>
      </template>
      <div class="page-content">
        <el-empty description="奖金审批页面 - 开发中" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts"></script>

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
