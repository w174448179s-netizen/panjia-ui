<template>
  <div class="m-page">
    <!-- 合同查询密码门（与 PC 端一致：首次设置，之后验证） -->
    <div v-if="stage !== 'ready'" class="m-gate">
      <h3>{{ stage === 'needSet' ? '设置合同查询密码' : '请输入合同查询密码' }}</h3>
      <p>{{ stage === 'needSet' ? '首次查询需先设置密码，用于保护合同隐私' : '合同为敏感信息，请输入查询密码' }}</p>
      <input v-model="password" type="password" inputmode="numeric" maxlength="20" placeholder="请输入密码" @keyup.enter="submitPassword" />
      <p v-if="errorText" style="margin: 8px 0 0; color: #f56c6c">{{ errorText }}</p>
      <button type="button" :disabled="submitting" @click="submitPassword">
        {{ submitting ? '处理中…' : stage === 'needSet' ? '设置并查询' : '验证并查询' }}
      </button>
    </div>

    <template v-else>
      <div v-if="loading" class="m-tip">加载中…</div>
      <div v-else-if="!rows.length" class="m-empty">暂无合同记录</div>

      <div v-for="row in rows" :key="row.contractId" class="m-card">
        <div class="m-card-head">
          <span>{{ contractTypeText(row.contractType) }}</span>
          <span>{{ row.deptName || '—' }}</span>
        </div>
        <div class="m-hero">
          <span class="m-hero-num" style="font-size: 22px">{{ row.startDate }} ~ {{ row.endDate || '无固定期限' }}</span>
        </div>
        <div class="m-foot">
          {{ statusText(row.endDate) }}
          <span v-if="row.remark" style="margin-left: 8px">备注：{{ row.remark }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="MobileContract">
import { onMounted, ref } from 'vue';
import { contractApi } from '@/api/panjia/contract';
import type { Contract } from '@/api/panjia/types';

const stage = ref<'checking' | 'needSet' | 'needVerify' | 'ready'>('checking');
const password = ref('');
const errorText = ref('');
const submitting = ref(false);
const loading = ref(false);
const rows = ref<Contract[]>([]);

const CONTRACT_TYPE_TEXT: Record<string, string> = { LABOR: '劳动合同', PARTTIME: '兼职合同', OTHER: '其他合同' };
const contractTypeText = (type: string) => CONTRACT_TYPE_TEXT[type] || type;

const statusText = (endDate?: string | null) => {
  if (!endDate) return '无固定期限';
  const end = new Date(endDate).getTime();
  const today = new Date(new Date().toDateString()).getTime();
  if (end < today) return '已到期';
  if (end - today <= 30 * 24 * 3600 * 1000) return '30 天内到期';
  return '履行中';
};

const initGate = async () => {
  try {
    const res: any = await contractApi.myPasswordStatus();
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
      await contractApi.setMyPassword(password.value);
    }
    await contractApi.verifyMyPassword(password.value);
    stage.value = 'ready';
    await loadContracts();
  } catch (e: any) {
    errorText.value = e?.message || '密码验证失败';
  } finally {
    submitting.value = false;
  }
};

const loadContracts = async () => {
  loading.value = true;
  try {
    const res: any = await contractApi.myList();
    rows.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

onMounted(initGate);
</script>
