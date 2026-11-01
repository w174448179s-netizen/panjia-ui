<template>
  <div class="m-page">
    <!-- 工资查询密码门（与 PC 端一致：首次设置密码，之后每次查询需验证） -->
    <div v-if="stage !== 'ready'" class="m-gate">
      <h3>{{ stage === 'needSet' ? '设置工资查询密码' : '请输入工资查询密码' }}</h3>
      <p>{{ stage === 'needSet' ? '首次查询需先设置密码，用于保护工资隐私' : '工资为敏感信息，请输入查询密码' }}</p>
      <input v-model="password" type="password" inputmode="numeric" maxlength="20" placeholder="请输入密码" @keyup.enter="submitPassword" />
      <p v-if="errorText" style="margin: 8px 0 0; color: #f56c6c">{{ errorText }}</p>
      <button type="button" :disabled="submitting" @click="submitPassword">
        {{ submitting ? '处理中…' : stage === 'needSet' ? '设置并查询' : '验证并查询' }}
      </button>
    </div>

    <template v-else>
      <div v-if="batches.length" class="m-chips">
        <button
          v-for="batch in batches"
          :key="batch.id"
          type="button"
          class="m-chip"
          :class="{ active: batch.id === currentBatchId }"
          @click="selectBatch(batch.id)"
        >
          {{ batch.period }}
        </button>
      </div>

      <div v-if="loading" class="m-tip">加载中…</div>
      <div v-else-if="!detail" class="m-empty">暂无可查询的工资单</div>

      <div v-else class="m-card">
        <div class="m-card-head">
          <span>{{ employee?.employeeName || '—' }} · {{ employee?.deptName || '—' }}</span>
          <span>{{ batch?.period }}</span>
        </div>

        <div class="m-hero">
          <span class="m-hero-num">{{ formatMoney(detail.net) }}</span>
          <span class="m-hero-unit">实发工资（元）</span>
        </div>

        <div class="m-grid">
          <div>
            <label>应发</label>
            <b>{{ formatMoney(detail.gross) }}</b>
          </div>
          <div>
            <label>扣款合计</label>
            <b>{{ formatMoney(detail.deduct) }}</b>
          </div>
          <div>
            <label>个税</label>
            <b>{{ formatMoney(detail.tax) }}</b>
          </div>
          <div>
            <label>绩效等级</label>
            <b>{{ detail.perfGrade || '—' }}</b>
          </div>
        </div>

        <div class="m-foot">
          综合提点 {{ percent(detail.finalRate) }} · 工号 {{ employee?.employeeCode || '—' }}
          <span v-if="detail.ackTime" class="m-tag" style="margin-left: 8px">已核对</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="MobilePayroll">
import { onMounted, ref } from 'vue';
import { mySalaryApi, type MyPayrollDetailVO, type PayrollBatch } from '@/api/panjia/payroll';
import { formatMoney } from '../utils';

const stage = ref<'checking' | 'needSet' | 'needVerify' | 'ready'>('checking');
const password = ref('');
const errorText = ref('');
const submitting = ref(false);

const batches = ref<PayrollBatch[]>([]);
const currentBatchId = ref<number | string>('');
const loading = ref(false);
const detail = ref<MyPayrollDetailVO['detail'] | null>(null);
const batch = ref<PayrollBatch | null>(null);
const employee = ref<MyPayrollDetailVO['employee'] | null>(null);

const percent = (value?: number | null) => (value === null || value === undefined ? '—' : `${(value * 100).toFixed(1)}%`);

const initGate = async () => {
  try {
    const res: any = await mySalaryApi.passwordStatus();
    stage.value = res.data?.hasPassword ? 'needVerify' : 'needSet';
  } catch {
    stage.value = 'needVerify';
    errorText.value = '密码状态检测失败，请重试';
  }
};

const submitPassword = async () => {
  if (!password.value) {
    errorText.value = '请输入密码';
    return;
  }
  submitting.value = true;
  errorText.value = '';
  try {
    if (stage.value === 'needSet') {
      await mySalaryApi.setPassword(password.value);
    }
    await mySalaryApi.verifyPassword(password.value);
    stage.value = 'ready';
    await loadBatches();
  } catch (e: any) {
    errorText.value = e?.message || '密码验证失败';
  } finally {
    submitting.value = false;
  }
};

const loadBatches = async () => {
  loading.value = true;
  try {
    const res: any = await mySalaryApi.listBatches();
    batches.value = res.data ?? [];
    if (batches.value.length) {
      await selectBatch(batches.value[0].id);
    }
  } finally {
    loading.value = false;
  }
};

const selectBatch = async (batchId: number | string) => {
  currentBatchId.value = batchId;
  loading.value = true;
  try {
    const res: any = await mySalaryApi.getDetail(batchId);
    detail.value = res.data?.detail ?? null;
    batch.value = res.data?.batch ?? null;
    employee.value = res.data?.employee ?? null;
  } catch {
    detail.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(initGate);
</script>
