<template>
  <div class="my-salary">
    <!-- ══════════ 密码门：未验证前遮罩 + 弹窗 ══════════ -->
    <template v-if="!verified">
      <el-card shadow="never" class="lock-card">
        <div class="lock-wrapper">
          <el-icon :size="64" color="#909399"><Lock /></el-icon>
          <div class="lock-title">工资查询已锁定</div>
          <div class="lock-desc" v-if="hasPassword === null">正在检测...</div>
          <div class="lock-desc" v-else-if="hasPassword">请输入密码解锁</div>
          <div class="lock-desc" v-else>首次使用，请先设置查询密码</div>
        </div>
      </el-card>
      <!-- 密码弹窗 -->
      <el-dialog
        v-model="pwdDialogVisible"
        :title="hasPassword ? '输入工资查询密码' : '设置工资查询密码'"
        width="420px"
        :close-on-click-modal="false"
        :show-close="false"
        center
        append-to-body
      >
        <el-form
          ref="pwdFormRef"
          :model="pwdForm"
          :rules="pwdRules"
          label-width="0"
          @submit.prevent
        >
          <el-form-item prop="password">
            <el-input
              v-model="pwdForm.password"
              type="password"
              :placeholder="hasPassword ? '请输入密码' : '请设置密码（至少4位）'"
              show-password
              size="large"
              clearable
              @keyup.enter="onPwdConfirm"
            />
          </el-form-item>
          <el-form-item v-if="!hasPassword" prop="confirmPassword">
            <el-input
              v-model="pwdForm.confirmPassword"
              type="password"
              placeholder="请再次输入密码"
              show-password
              size="large"
              clearable
              @keyup.enter="onPwdConfirm"
            />
          </el-form-item>
          <el-form-item v-if="hasPassword" prop="newPassword" v-show="resetMode">
            <el-input
              v-model="pwdForm.newPassword"
              type="password"
              placeholder="新密码（至少4位）"
              show-password
              size="large"
              clearable
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button v-if="hasPassword" type="primary" size="large" :loading="pwdLoading" @click="onPwdConfirm">
            解锁
          </el-button>
          <el-button v-else type="primary" size="large" :loading="pwdLoading" @click="onPwdConfirm">
            确认设置
          </el-button>
        </template>
        <div class="pwd-footer-tip" v-if="hasPassword">
          <el-button link type="primary" size="small" @click="resetMode = true">忘记密码？联系管理员重置</el-button>
        </div>
      </el-dialog>
    </template>

    <!-- ══════════ 顶部：期间选择 + 本人指标 ══════════ -->
    <el-card v-else shadow="never" class="header-card">
      <div class="header-bar">
        <div class="header-left">
          <span class="page-title">工资查询</span>
          <el-tag type="info" effect="light" size="small" class="unlock-hint">
            <el-icon><Timer /></el-icon>
            1分钟无操作自动锁定
          </el-tag>
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
        <!-- 员工核对（纯留痕，不影响审批流）：已核对显示留痕时间；批次锁定/发放后不再提供核对按钮 -->
        <div v-if="vo" class="header-right">
          <el-tag v-if="vo.detail.ackTime" type="success" effect="light" size="large">
            已核对 {{ String(vo.detail.ackTime).replace('T', ' ').slice(0, 16) }}
          </el-tag>
          <el-button
            v-else-if="currentBatch && !['LOCKED', 'PAID'].includes(currentBatch.status)"
            type="primary"
            plain
            :loading="acking"
            @click="onAck"
          >
            核对工资
          </el-button>
          <el-button text size="small" @click="lockNow">
            <el-icon><Lock /></el-icon>
            锁定
          </el-button>
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
    <el-card v-if="verified && vo" shadow="never" class="detail-card" v-loading="loading">
      <PayrollTracePanel
        :row="vo.detail"
        :employee-name="vo.employee.employeeName"
        :period="vo.batch.period"
        my-mode
      />
    </el-card>

    <!-- 空态 -->
    <el-empty
      v-else-if="verified && !loading"
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
import { ref, computed, onMounted, onUnmounted, reactive, nextTick } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Wallet, Lock, Timer } from '@element-plus/icons-vue';
import { mySalaryApi, type MyPayrollDetailVO, type PayrollBatch } from '@/api/panjia/payroll';
import PayrollTracePanel from '../components/PayrollTracePanel.vue';

// ==================== 密码门状态 ====================
const verified = ref(false);
const hasPassword = ref<boolean | null>(null); // null=未检测
const pwdDialogVisible = ref(true);
const pwdLoading = ref(false);
const resetMode = ref(false);
const pwdFormRef = ref<FormInstance>();

const pwdForm = reactive({
  password: '',
  confirmPassword: '',
  newPassword: '',
});

const pwdRules = computed<FormRules>(() => ({
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 4, message: '密码至少 4 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_r, v, cb) => {
        if (v !== pwdForm.password) cb(new Error('两次密码不一致'));
        else cb();
      },
      trigger: 'blur',
    },
  ],
}));

/** 首次进入检测密码状态，自动弹窗 */
const initPasswordGate = async () => {
  try {
    const res = await mySalaryApi.passwordStatus();
    hasPassword.value = res.data?.hasPassword ?? false;
    pwdDialogVisible.value = true;
    nextTick(() => pwdFormRef.value?.validate().catch(() => void 0));
  } catch {
    ElMessage.error('密码状态检测失败');
  }
};

/** 密码弹窗确认：验证 or 设置 */
const onPwdConfirm = async () => {
  try {
    await pwdFormRef.value?.validate();
  } catch {
    return;
  }
  pwdLoading.value = true;
  try {
    if (!hasPassword.value) {
      // 首次设置
      await mySalaryApi.setPassword(pwdForm.password);
      ElMessage.success('密码设置成功');
      hasPassword.value = true;
    }
    // 验证密码（修改模式也先走验证，后面可扩展修改流程）
    await mySalaryApi.verifyPassword(pwdForm.password);
    verified.value = true;
    pwdDialogVisible.value = false;
    startIdleTimer();
    await loadBatches();
  } catch {
    // 拦截器处理错误提示
  } finally {
    pwdLoading.value = false;
  }
};

// ==================== 1 分钟自动锁定 ====================
const IDLE_TIMEOUT = 60_000;
let idleTimer: number | null = null;

const resetIdleTimer = () => {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => lockNow(), IDLE_TIMEOUT);
};

const startIdleTimer = () => {
  resetIdleTimer();
  document.addEventListener('click', resetIdleTimer);
  document.addEventListener('keydown', resetIdleTimer);
  document.addEventListener('scroll', resetIdleTimer);
  document.addEventListener('mousemove', resetIdleTimer);
};

const stopIdleTimer = () => {
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  document.removeEventListener('click', resetIdleTimer);
  document.removeEventListener('keydown', resetIdleTimer);
  document.removeEventListener('scroll', resetIdleTimer);
  document.removeEventListener('mousemove', resetIdleTimer);
};

/** 手动锁定 / 自动锁定 */
const lockNow = () => {
  stopIdleTimer();
  verified.value = false;
  // 清空数据
  batches.value = [];
  vo.value = null;
  selectedBatchId.value = null;
  loading.value = false;
  acking.value = false;
  // 重置密码表单
  pwdForm.password = '';
  pwdForm.confirmPassword = '';
  pwdForm.newPassword = '';
  resetMode.value = false;
  pwdDialogVisible.value = true;
};

onMounted(initPasswordGate);
onUnmounted(stopIdleTimer);

// ==================== 工资数据加载 ====================
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

// 员工核对工资：纯留痕标记（后端写明细行 ack_time），不影响工资审批流；幂等
const acking = ref(false);
const onAck = async () => {
  if (selectedBatchId.value == null || acking.value) return;
  acking.value = true;
  try {
    const res = await mySalaryApi.ackDetail(selectedBatchId.value);
    if (vo.value && (res as any).data) {
      vo.value.detail.ackTime = (res as any).data.ackTime || new Date().toISOString();
    }
    ElMessage.success('核对完成，已留痕');
  } catch {
    /* 拦截器处理 */
  } finally {
    acking.value = false;
  }
};
</script>

<style scoped>
.my-salary { padding: 12px; background: #f5f7fa; min-height: 100%; }
.header-card :deep(.el-card__body) { padding: 14px 16px; }
.detail-card :deep(.el-card__body) { padding: 10px 12px; margin-top: 10px; }

/* 锁定态 */
.lock-card :deep(.el-card__body) { padding: 60px 20px; }
.lock-wrapper { text-align: center; color: #606266; }
.lock-title { font-size: 18px; font-weight: 600; margin-top: 18px; color: #303133; }
.lock-desc { font-size: 14px; color: #909399; margin-top: 8px; }
.pwd-footer-tip { text-align: center; margin-top: 4px; }

/* 已解锁态 */
.unlock-hint { margin-right: 4px; display: inline-flex; align-items: center; gap: 3px; }
.header-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.header-right { display: flex; align-items: center; gap: 10px; }
.page-title { font-size: 17px; font-weight: 600; color: #1f2d3d; }

.emp-bar { display: flex; align-items: center; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
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
