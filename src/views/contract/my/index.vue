<template>
  <div class="my-contract">
    <!-- ══════════ 密码门：未验证前遮罩 + 弹窗 ══════════ -->
    <template v-if="!verified">
      <el-card shadow="never" class="lock-card">
        <div class="lock-wrapper">
          <el-icon :size="64" color="#909399"><Lock /></el-icon>
          <div class="lock-title">合同查询已锁定</div>
          <div class="lock-desc" v-if="hasPassword === null">正在检测...</div>
          <div class="lock-desc" v-else-if="hasPassword">请输入密码解锁</div>
          <div class="lock-desc" v-else>首次使用，请先设置查询密码</div>
          <div class="lock-tip" v-if="hasPassword === false">
            密码将同时用于「工资查询」
          </div>
        </div>
      </el-card>
      <!-- 密码弹窗 -->
      <el-dialog
        v-model="pwdDialogVisible"
        :title="hasPassword ? '输入合同查询密码' : '设置合同查询密码'"
        width="420px"
        :close-on-click-modal="false"
        :show-close="false"
        center
        append-to-body
      >
        <el-form ref="pwdFormRef" :model="pwdForm" :rules="pwdRules" label-width="0" @submit.prevent>
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
        </el-form>
        <template #footer>
          <el-button v-if="hasPassword" type="primary" size="large" :loading="pwdLoading" @click="onPwdConfirm">解锁</el-button>
          <el-button v-else type="primary" size="large" :loading="pwdLoading" @click="onPwdConfirm">确认设置</el-button>
        </template>
      </el-dialog>
    </template>

    <!-- ══════════ 合同列表 ══════════ -->
    <template v-else>
      <el-card shadow="never" class="header-card">
        <div class="header-bar">
          <div class="header-left">
            <span class="page-title">合同查询</span>
            <el-tag type="info" effect="light" size="small" class="unlock-hint">
              <el-icon><Timer /></el-icon>1分钟无操作自动锁定
            </el-tag>
            <el-tag type="primary" effect="light" size="small">共 {{ contractList.length }} 份合同</el-tag>
          </div>
          <div class="header-right">
            <el-button text size="small" @click="lockNow">
              <el-icon><Lock /></el-icon>锁定
            </el-button>
          </div>
        </div>
      </el-card>

      <el-card shadow="never" class="detail-card" v-loading="loading">
        <el-table :data="contractList" border stripe class="contract-table" empty-text="暂无合同记录">
          <el-table-column label="合同类型" align="center" prop="contractType" width="120">
            <template #default="scope">
              <dict-tag :options="panjia_contract_type" :value="scope.row.contractType" />
            </template>
          </el-table-column>
          <el-table-column label="开始日期" align="center" prop="startDate" width="120" />
          <el-table-column label="到期日期" align="center" prop="endDate" width="120">
            <template #default="scope">
              <span v-if="scope.row.endDate">{{ scope.row.endDate }}</span>
              <span v-else class="no-limit">无固定期限</span>
            </template>
          </el-table-column>
          <el-table-column label="合同状态" align="center" width="120">
            <template #default="scope">
              <el-tag v-if="!scope.row.endDate" type="info" size="small">无固定期限</el-tag>
              <el-tag v-else-if="isExpired(scope.row.endDate)" type="danger" size="small">已到期</el-tag>
              <el-tag v-else-if="isExpiringSoon(scope.row.endDate)" type="warning" size="small">30天内到期</el-tag>
              <el-tag v-else type="success" size="small">履行中</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="签约门店" align="center" prop="deptName" min-width="180" show-overflow-tooltip />
          <el-table-column label="身份证扫描件" align="center" width="140">
            <template #default="scope">
              <template v-if="idCardUrls(scope.row).length">
                <el-image
                  v-for="(url, idx) in idCardUrls(scope.row)"
                  :key="idx"
                  :src="url"
                  :preview-src-list="idCardUrls(scope.row)"
                  :initial-index="idx"
                  preview-teleported
                  fit="cover"
                  class="id-card-thumb"
                />
              </template>
              <span v-else class="no-file">—</span>
            </template>
          </el-table-column>
          <el-table-column label="备注" align="center" prop="remark" min-width="150" show-overflow-tooltip />
          <el-table-column label="操作" align="center" width="100" fixed="right">
            <template #default="scope">
              <el-tooltip content="打印合同" placement="top">
                <el-button link type="primary" icon="Printer" @click="handlePrint(scope.row)" />
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, nextTick, computed, toRefs } from 'vue';
import { ElMessage, type FormInstance, type FormRules } from 'element-plus';
import { Lock, Timer, Printer } from '@element-plus/icons-vue';
import { contractApi, type Contract } from '@/api/panjia/contract';
import { useDict } from '@/utils/dict';
import { renderContractHtml, renderCustomContractHtml } from '@/views/people/contract/contractTemplates';

const { panjia_contract_type } = toRefs<any>(useDict('panjia_contract_type'));
const dictLabel = (value: string) =>
  panjia_contract_type.value?.find((d: any) => d.value === value)?.label ?? value ?? '';

// ==================== 密码门状态 ====================
const verified = ref(false);
const hasPassword = ref<boolean | null>(null);
const pwdDialogVisible = ref(true);
const pwdLoading = ref(false);
const pwdFormRef = ref<FormInstance>();

const pwdForm = reactive({ password: '', confirmPassword: '' });

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

const initPasswordGate = async () => {
  try {
    const res = await contractApi.myPasswordStatus();
    hasPassword.value = res.data?.hasPassword ?? false;
    pwdDialogVisible.value = true;
    nextTick(() => pwdFormRef.value?.validate().catch(() => void 0));
  } catch {
    ElMessage.error('密码状态检测失败');
  }
};

const onPwdConfirm = async () => {
  try {
    await pwdFormRef.value?.validate();
  } catch {
    return;
  }
  pwdLoading.value = true;
  try {
    if (!hasPassword.value) {
      await contractApi.setMyPassword(pwdForm.password);
      ElMessage.success('密码设置成功');
      hasPassword.value = true;
    }
    await contractApi.verifyMyPassword(pwdForm.password);
    verified.value = true;
    pwdDialogVisible.value = false;
    startIdleTimer();
    await loadData();
  } catch { /* 拦截器处理 */ }
  finally { pwdLoading.value = false; }
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
const lockNow = () => {
  stopIdleTimer();
  verified.value = false;
  contractList.value = [];
  employeeInfo.value = null;
  loading.value = false;
  pwdForm.password = ''; pwdForm.confirmPassword = '';
  pwdDialogVisible.value = true;
};
onMounted(initPasswordGate);
onUnmounted(stopIdleTimer);

// ==================== 合同数据 ====================
const contractList = ref<Contract[]>([]);
const employeeInfo = ref<any>(null);
const loading = ref(false);

const loadData = async () => {
  loading.value = true;
  try {
    const [listRes, empRes] = await Promise.all([
      contractApi.myList(),
      contractApi.myEmployee(),
    ]);
    contractList.value = (listRes as any).data ?? [];
    employeeInfo.value = (empRes as any).data ?? null;
  } catch { /* 拦截器处理 */ }
  finally { loading.value = false; }
};

// ==================== 合同状态工具 ====================
const isExpired = (endDate: string) => new Date(endDate) < new Date(new Date().toDateString());
const isExpiringSoon = (endDate: string) => {
  const d = new Date(endDate);
  const now = new Date(new Date().toDateString());
  const diff = (d.getTime() - now.getTime()) / 86400000;
  return diff >= 0 && diff <= 30;
};
const idCardUrls = (row: any): string[] => {
  if (!row?.idCardUrls?.length) return [];
  return row.idCardUrls.filter((u: string | null) => u);
};

// ==================== 打印合同 ====================
const handlePrint = async (row: Contract) => {
  const emp = employeeInfo.value;
  if (!emp) { ElMessage.error('员工信息加载失败，请刷新重试'); return; }
  const printData = {
    partyA: emp.deptName ?? row.deptName ?? '',
    employeeName: row.employeeName ?? '',
    genderLabel: emp.genderLabel ?? '',
    idCard: emp.idCard ?? '',
    employeeCode: row.employeeCode ?? '',
    phone: emp.phone ?? '',
    contractTypeLabel: dictLabel(row.contractType),
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    bankName: emp.bankName ?? '',
    bankBranch: emp.bankBranch ?? '',
    bankCardNo: emp.bankCardNo ?? '',
    printDate: new Date().toISOString().slice(0, 10),
  };
  // 优先使用客户自定义模板，未配置则用内置默认模板
  try {
    const tplRes = await contractApi.listTemplates();
    const tplList: any[] = (tplRes as any).data ?? [];
    const tpl = tplList.find((t) => t.contractType === row.contractType);
    let html: string;
    if (tpl && !tpl.useDefault && tpl.url) {
      try {
        const resp = await fetch(tpl.url);
        html = renderCustomContractHtml(await resp.text(), printData);
      } catch {
        html = renderContractHtml(row.contractType, printData);
      }
    } else {
      html = renderContractHtml(row.contractType, printData);
    }
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  } catch {
    ElMessage.error('打印模板加载失败');
  }
};
</script>

<style scoped>
.my-contract { padding: 12px; background: #f5f7fa; min-height: 100%; }
.header-card :deep(.el-card__body) { padding: 12px 16px; }
.detail-card :deep(.el-card__body) { padding: 0; }

/* 锁定态 */
.lock-card :deep(.el-card__body) { padding: 80px 20px; }
.lock-wrapper { text-align: center; color: #606266; }
.lock-title { font-size: 18px; font-weight: 600; margin-top: 18px; color: #303133; }
.lock-desc { font-size: 14px; color: #909399; margin-top: 8px; }
.lock-tip { font-size: 12px; color: #c0c4cc; margin-top: 12px; }

/* 已解锁态 */
.header-bar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; }
.header-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.header-right { display: flex; align-items: center; gap: 10px; }
.page-title { font-size: 17px; font-weight: 600; color: #1f2d3d; }
.unlock-hint { display: inline-flex; align-items: center; gap: 3px; }

.contract-table { margin: 0; }
.no-limit, .no-file { color: #909399; }
.id-card-thumb { width: 40px; height: 28px; margin: 1px; border-radius: 3px; cursor: pointer; }
</style>
