<template>
  <el-dialog
    v-model="visible"
    title="合同退单"
    width="880px"
    top="6vh"
    append-to-body
    destroy-on-close
    class="contract-refund-dialog"
  >
    <div v-loading="loading">
      <el-alert
        type="warning"
        :closable="false"
        show-icon
        title="退单与业绩冲正是两回事：退单以合同为单位全额冲退，审批通过后在退单月份自动生成负新签、负实收与负结佣，且不可撤销。"
        class="tip-alert"
      />

      <el-descriptions :column="3" border size="small" class="info-desc">
        <el-descriptions-item label="合同号">{{ contract?.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ contract?.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务类型">{{ contract?.bizType || '—' }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ contract?.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <el-form :model="formData" label-width="90px" class="refund-form">
        <el-form-item label="退单月份" required>
          <el-date-picker
            v-model="formData.refundPeriod"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM"
            placeholder="负流水归属月"
            style="width: 200px"
            :disabled-date="disableFutureMonth"
            @update:model-value="loadPreview"
          />
          <span class="form-tip">负新签 / 负实收均落在该月；已封账（已发薪）月份不可退单</span>
        </el-form-item>
        <el-form-item label="退单原因" required>
          <el-input
            v-model="formData.reason"
            type="textarea"
            :rows="2"
            maxlength="200"
            show-word-limit
            placeholder="如：客户退房 / 合同作废 / 录入错误"
          />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="preview?.blocked"
        type="error"
        :closable="false"
        show-icon
        :title="preview.blocked"
        class="block-alert"
      />

      <div v-if="preview && !preview.blocked" class="refund-summary-bar">
        <div class="summary-cell">
          <span class="summary-label">冲减新签</span>
          <b class="amount-negative">{{ formatAmount(preview.expectAmount) }}</b>
          <span class="summary-sub">（{{ preview.factCount }} 笔）</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">冲减实收</span>
          <b class="amount-negative">{{ formatAmount(preview.realAmount) }}</b>
          <span class="summary-sub">（{{ preview.realCount }} 笔）</span>
        </div>
        <div class="summary-cell">
          <span class="summary-label">冲减结佣</span>
          <b class="amount-negative">{{ formatAmount(preview.commissionAmount ?? 0) }}</b>
          <span class="summary-sub">（已结佣部分）</span>
        </div>
        <div class="summary-cell tip-cell">
          原事实不动，仅新增负数流水，全部落在 {{ preview.refundPeriod }}：
          负新签 + 负实收 + 已结佣部分的负结佣（未结佣部分在下次发起结佣时自动按负数抵扣）
        </div>
      </div>

      <div v-if="preview && preview.details?.length" class="detail-block">
        <div class="detail-title">冲减新签明细（落 {{ preview.refundPeriod }}）</div>
        <el-table :data="preview.details" border size="small" max-height="240">
          <el-table-column label="原归属月" prop="period" width="90" />
          <el-table-column label="落账月份" width="90">
            <template #default="{ row }">{{ row.refundPeriod ?? preview?.refundPeriod }}</template>
          </el-table-column>
          <el-table-column label="员工ID" prop="employeeId" min-width="150" show-overflow-tooltip />
          <el-table-column label="工号" prop="employeeCode" width="120" />
          <el-table-column label="角色" prop="roleName" min-width="100" />
          <el-table-column label="占比" width="90">
            <template #default="{ row }">{{ row.shareRatio != null ? row.shareRatio : '—' }}</template>
          </el-table-column>
          <el-table-column label="冲减金额" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-negative">{{ formatAmount(row.amount) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-if="preview && preview.realDetails?.length" class="detail-block">
        <div class="detail-title">冲减实收明细（落 {{ preview.refundPeriod }}）</div>
        <el-table :data="preview.realDetails" border size="small" max-height="240">
          <el-table-column label="原归属月" prop="period" width="90" />
          <el-table-column label="落账月份" width="90">
            <template #default="{ row }">{{ row.refundPeriod ?? preview?.refundPeriod }}</template>
          </el-table-column>
          <el-table-column label="员工ID" prop="employeeId" min-width="150" show-overflow-tooltip />
          <el-table-column label="工号" prop="employeeCode" width="120" />
          <el-table-column label="角色" prop="roleName" min-width="100" />
          <el-table-column label="冲减金额" width="130" align="right">
            <template #default="{ row }">
              <span class="amount-negative">{{ formatAmount(row.amount) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button
        type="danger"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="handleSubmit"
      >确认退单并提交审批</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { createPerfRefund, perfRefundApi } from '@/api/panjia/refund';
import type { PerfRefundPreview } from '@/api/panjia/refund';
import type { PerformanceManageContract } from '@/api/panjia/performance';

const emit = defineEmits<{ (e: 'submitted'): void }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const contract = ref<PerformanceManageContract | null>(null);
const preview = ref<PerfRefundPreview | null>(null);

const formData = reactive({
  refundPeriod: '',
  reason: '',
});

const canSubmit = computed(
  () => !!formData.refundPeriod && !!formData.reason.trim() && !!preview.value && !preview.value.blocked,
);

const formatAmount = (value?: number) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '0.00';
  const num = Number(value);
  return (num > 0 ? '+' : '') + num.toFixed(2);
};

const disableFutureMonth = (date: Date) => date.getTime() > Date.now();

const open = (row: PerformanceManageContract) => {
  contract.value = row;
  formData.refundPeriod = '';
  formData.reason = '';
  preview.value = null;
  visible.value = true;
};

const loadPreview = async () => {
  if (!contract.value || !formData.refundPeriod) {
    preview.value = null;
    return;
  }
  loading.value = true;
  try {
    // 注意：panjiaRequest 返回的是 R<> 信封（{ code, msg, data }），预览数据在 data 中
    const res = await perfRefundApi.preview(
      contract.value.contractNo,
      formData.refundPeriod,
      contract.value.orderNo,
    );
    preview.value = res.data ?? null;
  } catch (e: any) {
    preview.value = null;
    ElMessage.error(e?.message || '退单预览失败');
  } finally {
    loading.value = false;
  }
};

const handleSubmit = async () => {
  if (!contract.value || !canSubmit.value) return;
  submitting.value = true;
  try {
    await createPerfRefund({
      contractNo: contract.value.contractNo,
      orderNo: contract.value.orderNo,
      refundPeriod: formData.refundPeriod,
      reason: formData.reason.trim(),
    });
    ElMessage.success('退单已提交审批');
    visible.value = false;
    emit('submitted');
  } catch (e: any) {
    ElMessage.error(e?.message || '退单提交失败');
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
.block-alert {
  margin: 12px 0;
}
.info-desc {
  margin-bottom: 12px;
}
.refund-form {
  margin-bottom: 4px;
}
.form-tip {
  margin-left: 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.refund-summary-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 10px 12px;
  margin-bottom: 12px;
  background: var(--el-fill-color-light);
  border-radius: 4px;
  flex-wrap: wrap;
}
.summary-cell {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.summary-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.summary-sub {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.summary-cell.tip-cell {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex: 1;
}
.amount-negative {
  color: var(--el-color-danger);
}
.detail-block + .detail-block {
  margin-top: 12px;
}
.detail-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}
</style>
