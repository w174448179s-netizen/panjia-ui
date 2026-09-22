<template>
  <div class="my-salary">
    <!-- ══════════ 顶部：期间选择 + 本人指标 ══════════ -->
    <el-card shadow="never" class="header-card">
      <div class="header-bar">
        <div class="header-left">
          <span class="page-title">工资查询</span>
          <el-select
            v-model="selectedBatchId"
            placeholder="选择工资期间"
            filterable
            style="width: 260px"
            :disabled="!batches.length"
            @change="loadDetail"
          >
            <el-option
              v-for="b in batches"
              :key="b.id"
              :label="`${b.period}（${statusLabel(b.status)}）`"
              :value="b.id"
            />
          </el-select>
          <el-tag v-if="currentBatch" :type="statusTag(currentBatch.status)" effect="light" size="large">
            {{ statusLabel(currentBatch.status) }}
          </el-tag>
        </div>
      </div>

      <template v-if="vo">
        <!-- 本人信息 -->
        <div class="emp-bar">
          <el-tag size="small" effect="plain">{{ vo.employee.deptName || '—' }}</el-tag>
          <span class="emp-name">{{ vo.employee.employeeName }}</span>
          <span class="emp-meta">工号：{{ vo.employee.employeeCode || '—' }}</span>
          <span class="emp-meta">职级：{{ vo.detail.levelCode || '—' }}</span>
          <el-tag size="small" :type="roleTagType(vo.detail.employeeRole)" effect="plain">
            {{ roleLabel(vo.detail.employeeRole) }}
          </el-tag>
          <el-tag v-if="vo.detail.isPartTime" size="small" type="warning" effect="plain">兼职</el-tag>
        </div>

        <div class="stat-row">
          <div class="stat-card net">
            <div class="stat-label">实发工资</div>
            <div class="stat-value">¥{{ fmt(vo.detail.net) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">应发工资</div>
            <div class="stat-value">¥{{ fmt(vo.detail.gross) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">扣款合计</div>
            <div class="stat-value deduct-text">¥{{ fmtNeg(vo.detail.deduct) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">个税</div>
            <div class="stat-value deduct-text">¥{{ fmtNeg(vo.detail.tax) }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">绩效等级 / 综合提点</div>
            <div class="stat-value stat-small">
              {{ vo.detail.perfGrade || '—' }}
              <span class="stat-divider">/</span>
              {{ vo.detail.finalRate != null ? (Number(vo.detail.finalRate) * 100).toFixed(1) + '%' : '—' }}
            </div>
          </div>
        </div>
      </template>
    </el-card>

    <!-- ══════════ 工资构成 + 结佣追溯（与工资明细页同一组件） ══════════ -->
    <el-card v-if="vo" shadow="never" class="detail-card" v-loading="loading">
      <PayrollTracePanel
        :row="vo.detail"
        :employee-name="vo.employee.employeeName"
        :period="vo.batch.period"
        my-mode
      />
    </el-card>

    <!-- 空态 -->
    <el-empty
      v-else-if="!loading"
      class="empty-state"
      description="暂无您的工资数据"
    >
      <template #image>
        <el-icon :size="56" color="#c0c4cc"><Wallet /></el-icon>
      </template>
      <div class="empty-tip">工资批次计算完成后，可在此查看本人各月工资及每笔结佣构成</div>
    </el-empty>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Wallet } from '@element-plus/icons-vue';
import { mySalaryApi, type MyPayrollDetailVO, type PayrollBatch } from '@/api/panjia/payroll';
import PayrollTracePanel from '../components/PayrollTracePanel.vue';

const batches = ref<PayrollBatch[]>([]);
const selectedBatchId = ref<number | string | null>(null);
const vo = ref<MyPayrollDetailVO | null>(null);
const loading = ref(false);

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CALCULATING: '计算中', CALCULATED: '已计算', FAILED: '失败',
  REVIEWING: '待审核', APPROVED: '已确认', LOCKED: '已锁定', PAID: '已发放',
};
const STATUS_TAG: Record<string, string> = {
  DRAFT: 'info', CALCULATING: 'warning', CALCULATED: '', FAILED: 'danger',
  REVIEWING: 'warning', APPROVED: 'success', LOCKED: 'success', PAID: 'success',
};
const statusLabel = (s: string) => STATUS_LABEL[s] || s;
const statusTag = (s: string) => (STATUS_TAG[s] || 'info') as any;
const roleLabel = (r: string) => ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r || '—');
const roleTagType = (r: string) => (r === 'MANAGER' ? 'warning' : r === 'DIRECTOR' ? 'danger' : 'info');
const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** 扣款展示：统一加负号 */
const fmtNeg = (n: number | null | undefined) => {
  const v = Math.abs(Number(n) || 0);
  return '-' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const currentBatch = computed(() => batches.value.find((b) => b.id === selectedBatchId.value) || null);

const loadBatches = async () => {
  try {
    const res = await mySalaryApi.listBatches();
    batches.value = (res as any).data ?? [];
    if (batches.value.length) {
      selectedBatchId.value = batches.value[0].id;
      await loadDetail();
    }
  } catch { /* 拦截器处理 */ }
};

const loadDetail = async () => {
  if (selectedBatchId.value == null) { vo.value = null; return; }
  loading.value = true;
  try {
    const res = await mySalaryApi.getDetail(selectedBatchId.value);
    vo.value = (res as any).data ?? null;
  } catch {
    vo.value = null;
  } finally {
    loading.value = false;
  }
};

onMounted(loadBatches);
</script>

<style scoped>
.my-salary { padding: 12px; background: #f5f7fa; min-height: 100%; }
.header-card :deep(.el-card__body) { padding: 14px 16px; }
.detail-card :deep(.el-card__body) { padding: 10px 12px; margin-top: 10px; }

.header-bar { display: flex; align-items: center; justify-content: space-between; }
.header-left { display: flex; align-items: center; gap: 12px; }
.page-title { font-size: 17px; font-weight: 600; color: #1f2d3d; }

.emp-bar { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
.emp-name { font-size: 16px; font-weight: 600; color: #1f2d3d; }
.emp-meta { font-size: 13px; color: #909399; }

.stat-row { display: flex; gap: 12px; margin-top: 14px; flex-wrap: wrap; }
.stat-card {
  flex: 1; min-width: 150px; background: #fafbfc; border: 1px solid #ebeef5;
  border-radius: 8px; padding: 12px 16px;
}
.stat-card.net { background: #f0f9eb; border-color: #d1edc4; }
.stat-label { font-size: 12px; color: #909399; margin-bottom: 4px; }
.stat-value { font-size: 22px; font-weight: 600; color: #1f2d3d; font-variant-numeric: tabular-nums; }
.stat-small { font-size: 17px; }
.stat-divider { color: #c0c4cc; font-weight: 400; margin: 0 6px; }
.deduct-text { color: #c0392b; }

.empty-state { margin-top: 60px; }
.empty-tip { font-size: 12px; color: #b0b3b8; }
</style>
