<template>
  <el-dialog
    v-model="visible"
    title="恢复合同业绩"
    width="560px"
    top="12vh"
    append-to-body
    destroy-on-close
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="恢复会把该合同原期间的全部已作废明细改为有效，并落到所选月份；业绩按所选月参与算薪/结佣。"
      class="tip-alert"
    />

    <el-descriptions :column="2" border size="small" class="info-desc">
      <el-descriptions-item label="合同号">{{ contract?.contractNo || '—' }}</el-descriptions-item>
      <el-descriptions-item label="订单号">{{ contract?.orderNo || '—' }}</el-descriptions-item>
      <el-descriptions-item label="原归属月">{{ originalPeriod || '—' }}</el-descriptions-item>
      <el-descriptions-item label="业务类型">{{ contract?.bizType || '—' }}</el-descriptions-item>
    </el-descriptions>

    <el-form :model="formData" label-width="90px">
      <el-form-item label="恢复月份" required>
        <el-date-picker
          v-model="formData.targetPeriod"
          type="month"
          format="YYYY-MM"
          value-format="YYYY-MM"
          placeholder="业绩落到该月"
          style="width: 200px"
          :disabled-date="disableFutureMonth"
        />
        <span class="form-tip">默认当前月，可改选其它未封账月份</span>
      </el-form-item>
      <el-form-item label="恢复原因" required>
        <el-input
          v-model="formData.reason"
          type="textarea"
          :rows="2"
          maxlength="200"
          show-word-limit
          placeholder="必填，如：误操作作废、补录到正确月份等"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="primary"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >确定恢复</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceManageContract } from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const submitting = ref(false);
const contract = ref<PerformanceManageContract | null>(null);
const originalPeriod = ref('');

const formData = reactive({
  targetPeriod: '',
  reason: '',
});

const canSubmit = computed(() => !!formData.targetPeriod && !!formData.reason.trim());

const currentPeriod = () => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${month}`;
};

const disableFutureMonth = (date: Date) => date.getTime() > Date.now();

const open = (row: PerformanceManageContract, period: string) => {
  contract.value = row;
  originalPeriod.value = period;
  formData.targetPeriod = period || currentPeriod();
  formData.reason = '';
  visible.value = true;
};

const handleSubmit = async () => {
  if (!contract.value || !canSubmit.value) return;
  submitting.value = true;
  try {
    await performanceApi.restoreByContract(
      originalPeriod.value,
      'PERF_EXPECT',
      contract.value.contractNo,
      formData.reason.trim(),
      contract.value.orderNo,
      formData.targetPeriod,
    );
    ElMessage.success(`已恢复，业绩计入 ${formData.targetPeriod}`);
    visible.value = false;
    emit('submitted');
  } catch (e: any) {
    ElMessage.error(e?.message || '恢复失败');
  } finally {
    submitting.value = false;
  }
};

defineExpose({ open });
</script>

<style scoped lang="scss">
.tip-alert {
  margin-bottom: 12px;
}
.info-desc {
  margin-bottom: 12px;
}
.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
