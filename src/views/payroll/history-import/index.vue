<template>
  <div class="app-container">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>历史工资导入</span>
          <el-tag type="info" size="small">仅超级管理员可操作</el-tag>
        </div>
      </template>

      <el-alert type="warning" :closable="false" show-icon class="mb-16">
        <template #title>
          此功能用于导入历史工资 Excel（7 个 sheet：工资表/店长/总监/新签业绩/结佣业绩/人事数据/绩效和扣款），
          导入后可在算薪批次中查询到对应期间的历史工资。同一期间已存在批次时自动跳过。
        </template>
      </el-alert>

      <el-form label-width="120px">
        <el-form-item label="工资归属月">
          <el-date-picker
            v-model="period"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="如 2026-07"
            :clearable="false"
            style="width: 200px"
          />
        </el-form-item>

        <el-form-item label="Excel 文件">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
            :file-list="fileList"
          >
            <el-button type="primary" plain>
              <el-icon><Upload /></el-icon>&nbsp;选择文件
            </el-button>
            <template #tip>
              <span class="el-upload__tip">仅支持 .xlsx 格式，7 个 sheet 结构与天街工资表一致</span>
            </template>
          </el-upload>
        </el-form-item>

        <el-form-item>
          <el-button
            type="primary"
            :loading="importing"
            :disabled="!period || !selectedFile"
            @click="doImport"
          >
            开始导入
          </el-button>
        </el-form-item>
      </el-form>

      <el-divider v-if="importResult" content-position="left">导入结果</el-divider>
      <el-result
        v-if="importResult"
        :icon="importSuccess ? 'success' : 'error'"
        :title="importSuccess ? '导入完成' : '导入失败'"
        :sub-title="importResult"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Upload } from '@element-plus/icons-vue';
import { orgCommissionTraceApi } from '@/api/panjia/payroll';

const period = ref('');
const fileList = ref<any[]>([]);
const selectedFile = ref<File | null>(null);
const importing = ref(false);
const importResult = ref('');
const importSuccess = ref(false);

const onFileChange = (file: any) => {
  selectedFile.value = file.raw;
  fileList.value = [file];
};

const onFileRemove = () => {
  selectedFile.value = null;
  fileList.value = [];
};

const doImport = async () => {
  if (!period.value || !selectedFile.value) return;
  importing.value = true;
  importResult.value = '';
  try {
    const res = await orgCommissionTraceApi.historyImport(period.value, selectedFile.value);
    importResult.value = (res as any).data ?? (res as any).msg ?? '完成';
    importSuccess.value = !importResult.value.includes('失败') && !importResult.value.includes('异常');
    ElMessage.success(importResult.value);
  } catch (err: any) {
    importResult.value = err?.message || '导入失败';
    importSuccess.value = false;
  } finally {
    importing.value = false;
  }
};
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mb-16 {
  margin-bottom: 16px;
}
</style>
