<template>
  <div class="app-container">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <span>绩效方案（员工档案按月指派；未指派的员工按默认方案「积分绩效」考核）</span>
          <el-button type="primary" icon="Plus" @click="openCreate">新建方案</el-button>
        </div>
      </template>

      <el-table :data="list" v-loading="loading" stripe border>
        <el-table-column label="编码" prop="code" width="150" />
        <el-table-column label="方案名称" prop="name" width="160" />
        <el-table-column label="类型" width="150" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTag(row.schemeType)" size="small">{{ typeLabel(row.schemeType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="适用岗位" width="100" align="center">
          <template #default="{ row }">{{ roleLabel(row.applicableRole) }}</template>
        </el-table-column>
        <el-table-column label="参数摘要" min-width="260">
          <template #default="{ row }">{{ summary(row as PerfScheme) }}</template>
        </el-table-column>
        <el-table-column label="默认" width="80" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.isDefault" type="warning" size="small">默认</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生效日" prop="effectiveFrom" width="120" align="center" />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" icon="Edit" @click="openEdit(row as PerfScheme)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialog.show" :title="dialog.isCreate ? '新建绩效方案' : '编辑绩效方案'" width="720px" destroy-on-close>
      <el-form :model="form" label-width="110px">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="方案编码" required>
              <el-input v-model="form.code" :disabled="!dialog.isCreate" placeholder="如 NEW_SIGN_RATE" maxlength="32" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="方案名称" required>
              <el-input v-model="form.name" maxlength="64" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="方案类型" required>
              <el-select v-model="form.schemeType" :disabled="!dialog.isCreate" style="width:100%">
                <el-option label="无绩效（不考核）" value="NONE" />
                <el-option label="积分绩效（等级扣提点）" value="GRADE_RATE" />
                <el-option label="业绩绩效A版（阶梯扣提点）" value="RATE_TIER" />
                <el-option label="业绩绩效B版（阶梯扣金额）" value="AMOUNT_TIER" />
                <el-option label="店长积分绩效（等级扣金额）" value="GRADE_AMOUNT" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="适用岗位">
              <el-select v-model="form.applicableRole" style="width:100%">
                <el-option label="不限" value="ALL" />
                <el-option label="仅经纪人" value="AGENT" />
                <el-option label="仅店长" value="MANAGER" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设为默认">
              <el-switch v-model="form.isDefault" />
              <span class="form-tip" style="margin-left:8px">员工未指派方案时按默认方案考核（应唯一）</span>
            </el-form-item>
          </el-col>
        </el-row>

        <!-- 积分绩效：等级阈值 + 扣点 -->
        <template v-if="form.schemeType === 'GRADE_RATE'">
          <el-divider content-position="left">积分等级与扣点</el-divider>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="A线标准">
                <el-input-number v-model="rc.gradeA" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="B线标准">
                <el-input-number v-model="rc.gradeB" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="晚提交罚款">
                <el-input-number v-model="rc.penaltyFee" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="A级扣点">
                <el-input-number v-model="rc.deductA" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="B级扣点">
                <el-input-number v-model="rc.deductB" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="C级扣点">
                <el-input-number v-model="rc.deductC" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <p class="form-tip">平均积分 ≥ A线为 A 级、≥ B线为 B 级、否则 C 级；扣点为负值（叠加到提成比例），无积分数据默认 A 级不扣。</p>
        </template>

        <!-- 业绩阶梯：扣提点 -->
        <template v-else-if="form.schemeType === 'RATE_TIER'">
          <el-divider content-position="left">业绩阶梯（考核当月个人新签业绩，未达标扣提点）</el-divider>
          <el-table :data="rc.tiers" border size="small" style="width:100%">
            <el-table-column label="业绩下限(元，含)" width="170">
              <template #default="{ row }">
                <el-input-number v-model="row.min" :min="0" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="业绩上限(元，不含，留空=无上限)" width="200">
              <template #default="{ row }">
                <el-input-number v-model="row.max" :min="0" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="扣点(负=扣)" width="180">
              <template #default="{ row }">
                <el-input-number v-model="row.rate" :min="-1" :max="1" :precision="4" :step="0.01" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" icon="Delete" @click="rc.tiers.splice($index, 1)"></el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" plain size="small" style="margin-top:8px" @click="addTier">+ 添加阶梯</el-button>
        </template>

        <!-- 业绩阶梯：扣金额 -->
        <template v-else-if="form.schemeType === 'AMOUNT_TIER'">
          <el-divider content-position="left">业绩阶梯（考核当月个人新签业绩，未达标扣款）</el-divider>
          <el-table :data="rc.tiers" border size="small" style="width:100%">
            <el-table-column label="业绩下限(元，含)" width="170">
              <template #default="{ row }">
                <el-input-number v-model="row.min" :min="0" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="业绩上限(元，不含，留空=无上限)" width="200">
              <template #default="{ row }">
                <el-input-number v-model="row.max" :min="0" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="扣款(元)" width="180">
              <template #default="{ row }">
                <el-input-number v-model="row.amount" :min="0" :precision="2" :controls="false" style="width:100%" />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="70" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" icon="Delete" @click="rc.tiers.splice($index, 1)"></el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-button type="primary" plain size="small" style="margin-top:8px" @click="addTier">+ 添加阶梯</el-button>
        </template>

        <!-- 店长积分绩效：等级阈值 + 扣金额 -->
        <template v-else-if="form.schemeType === 'GRADE_AMOUNT'">
          <el-divider content-position="left">积分等级与扣款</el-divider>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="A线标准">
                <el-input-number v-model="rc.gradeA" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="B线标准">
                <el-input-number v-model="rc.gradeB" :min="0" :precision="1" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <el-row :gutter="16">
            <el-col :span="8">
              <el-form-item label="A级扣款(元)">
                <el-input-number v-model="rc.feeA" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="B级扣款(元)">
                <el-input-number v-model="rc.feeB" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="C级扣款(元)">
                <el-input-number v-model="rc.feeC" :min="0" :precision="2" :controls="false" style="width:100%" />
              </el-form-item>
            </el-col>
          </el-row>
          <p class="form-tip">按平均积分定等级后扣固定金额（进应发扣减，不影响提成比例）；建议适用岗位选「仅店长」。</p>
        </template>

        <el-alert v-else-if="form.schemeType === 'NONE'" type="info" :closable="false" show-icon
          title="无绩效方案：该员工不参与绩效考核，不产生任何绩效扣点/扣款（适用于兼职人员等）。" />

        <el-form-item label="生效日" style="margin-top:8px">
          <el-date-picker v-model="form.effectiveFrom" type="date" value-format="YYYY-MM-DD" placeholder="默认今天" style="width:100%" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.show = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { payrollApi, type PerfScheme, type PerfSchemeType } from '@/api/panjia/payroll';

interface TierRow { min: number | null; max: number | null; rate?: number; amount?: number; }

const TYPE_LABELS: Record<PerfSchemeType, string> = {
  NONE: '无绩效',
  GRADE_RATE: '积分绩效',
  RATE_TIER: '业绩阶梯·扣提点',
  AMOUNT_TIER: '业绩阶梯·扣金额',
  GRADE_AMOUNT: '店长积分·扣金额'
};

const loading = ref(false);
const saving = ref(false);
const list = ref<PerfScheme[]>([]);

const defaultTier = (): TierRow[] => [{ min: 0, max: 8000, rate: -0.04, amount: 400 }];

const form = reactive<PerfScheme>({
  code: '',
  name: '',
  schemeType: 'GRADE_RATE',
  applicableRole: 'ALL',
  ruleContent: '{}',
  isDefault: false,
  effectiveFrom: ''
});

/** 编辑中的参数对象（保存时序列化回 ruleContent；按类型渲染） */
const rc = reactive<{
  gradeA: number; gradeB: number; penaltyFee: number; deductA: number; deductB: number; deductC: number;
  feeA: number; feeB: number; feeC: number;
  tiers: TierRow[];
}>({
  gradeA: 8, gradeB: 6, penaltyFee: 5, deductA: 0, deductB: -0.02, deductC: -0.04,
  feeA: 0, feeB: 300, feeC: 500,
  tiers: defaultTier()
});

const dialog = reactive({ show: false, isCreate: false });

const typeLabel = (t: string) => TYPE_LABELS[t as PerfSchemeType] ?? t;
const typeTag = (t: string) =>
  ({ NONE: 'info', GRADE_RATE: 'warning', RATE_TIER: 'primary', AMOUNT_TIER: 'primary', GRADE_AMOUNT: 'danger' } as const)[t as PerfSchemeType] ?? 'info';
const roleLabel = (r: string) => ({ ALL: '不限', AGENT: '经纪人', MANAGER: '店长' } as const)[r as 'ALL'] ?? r;

const fmtPct = (v?: number | null) =>
  v == null || Number(v) === 0 ? '—' : `${(Number(v) * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
const fmtMoney = (v?: number | null) => (v == null || Number(v) === 0 ? '—' : `${Number(v)}元`);

/** 参数摘要（列表直读，免展开） */
const summary = (row: PerfScheme) => {
  let j: any = {};
  try { j = JSON.parse(row.ruleContent || '{}'); } catch { /* 忽略坏数据 */ }
  switch (row.schemeType) {
    case 'GRADE_RATE':
      return `A线${j.gradeA ?? 8}/B线${j.gradeB ?? 6}；扣点 A${fmtPct(j.deductA)} B${fmtPct(j.deductB)} C${fmtPct(j.deductC)}；晚提交${fmtMoney(j.penaltyFee)}/次`;
    case 'GRADE_AMOUNT':
      return `A线${j.gradeA ?? 8}/B线${j.gradeB ?? 6}；扣款 A${fmtMoney(j.feeA)} B${fmtMoney(j.feeB)} C${fmtMoney(j.feeC)}`;
    case 'RATE_TIER':
      return (j.tiers ?? []).map((t: any) =>
        `[${t.min ?? 0},${t.max ?? '∞'})→${fmtPct(t.rate)}`).join(' ');
    case 'AMOUNT_TIER':
      return (j.tiers ?? []).map((t: any) =>
        `[${t.min ?? 0},${t.max ?? '∞'})→${fmtMoney(t.amount)}`).join(' ');
    default:
      return '不考核';
  }
};

const loadList = async () => {
  loading.value = true;
  try {
    // 拦截器返回 R 包装对象（{code,msg,data}），业务数据取 .data（与全站约定一致）
    const res = await payrollApi.perfSchemeList();
    list.value = res.data ?? [];
  } finally {
    loading.value = false;
  }
};

/** 打开弹窗：把 ruleContent 解析进编辑对象 */
const openEdit = (row: PerfScheme) => {
  dialog.isCreate = false;
  Object.assign(form, row);
  let j: any = {};
  try { j = JSON.parse(row.ruleContent || '{}'); } catch { /* 忽略坏数据 */ }
  rc.gradeA = j.gradeA ?? 8;
  rc.gradeB = j.gradeB ?? 6;
  rc.penaltyFee = j.penaltyFee ?? 5;
  rc.deductA = j.deductA ?? 0;
  rc.deductB = j.deductB ?? -0.02;
  rc.deductC = j.deductC ?? -0.04;
  rc.feeA = j.feeA ?? 0;
  rc.feeB = j.feeB ?? 300;
  rc.feeC = j.feeC ?? 500;
  rc.tiers = (j.tiers ?? []).map((t: any) => ({ min: t.min ?? 0, max: t.max ?? null, rate: t.rate, amount: t.amount }));
  dialog.show = true;
};

const openCreate = () => {
  dialog.isCreate = true;
  Object.assign(form, {
    code: '', name: '', schemeType: 'RATE_TIER', applicableRole: 'ALL',
    ruleContent: '{}', isDefault: false, effectiveFrom: ''
  });
  rc.gradeA = 8; rc.gradeB = 6; rc.penaltyFee = 5; rc.deductA = 0; rc.deductB = -0.02; rc.deductC = -0.04;
  rc.feeA = 0; rc.feeB = 300; rc.feeC = 500;
  rc.tiers = defaultTier();
  dialog.show = true;
};

const addTier = () => {
  const last = rc.tiers[rc.tiers.length - 1];
  const nextMin = last?.max ?? 0;
  rc.tiers.push({ min: nextMin, max: null, rate: 0, amount: 0 });
};

/** 编辑对象 → ruleContent JSON（按类型序列化，多余键不落） */
const serializeRc = (): string => {
  switch (form.schemeType) {
    case 'GRADE_RATE':
      return JSON.stringify({
        gradeA: rc.gradeA, gradeB: rc.gradeB, penaltyFee: rc.penaltyFee,
        deductA: rc.deductA, deductB: rc.deductB, deductC: rc.deductC
      });
    case 'GRADE_AMOUNT':
      return JSON.stringify({ gradeA: rc.gradeA, gradeB: rc.gradeB, feeA: rc.feeA, feeB: rc.feeB, feeC: rc.feeC });
    case 'RATE_TIER':
      return JSON.stringify({ tiers: rc.tiers.map((t) => ({ min: t.min, max: t.max, rate: t.rate ?? 0 })) });
    case 'AMOUNT_TIER':
      return JSON.stringify({ tiers: rc.tiers.map((t) => ({ min: t.min, max: t.max, amount: t.amount ?? 0 })) });
    default:
      return '{}';
  }
};

const save = async () => {
  if (!form.code?.trim() || !form.name?.trim()) {
    ElMessage.warning('请填写方案编码与名称');
    return;
  }
  saving.value = true;
  try {
    const payload: PerfScheme = {
      ...form,
      code: form.code.trim(),
      ruleContent: serializeRc(),
      effectiveFrom: form.effectiveFrom || undefined as unknown as string
    };
    await payrollApi.savePerfScheme(payload);
    ElMessage.success('已保存');
    dialog.show = false;
    await loadList();
  } finally {
    saving.value = false;
  }
};

onMounted(loadList);
</script>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.form-tip {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
</style>
