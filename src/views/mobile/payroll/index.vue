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

        <!-- 工资明细：收入项 / 扣款项 -->
        <div class="m-detail-head" @click="detailOpen = !detailOpen">
          <span>工资明细</span>
          <span class="m-detail-toggle">{{ detailOpen ? '收起' : '展开' }}</span>
        </div>

        <div v-if="detailOpen" class="m-detail">
          <div class="m-detail-group">
            <div class="m-detail-title">收入项</div>
            <div v-for="item in incomeItems" :key="item.label" class="m-detail-row">
              <div class="m-detail-name">
                <span>{{ item.label }}</span>
                <i v-if="item.steps?.length" class="m-detail-src">
                  <span v-for="(step, idx) in item.steps" :key="idx">{{ step }}</span>
                </i>
                <i v-else-if="item.source" class="m-detail-src">{{ item.source }}</i>
              </div>
              <b>+{{ formatMoney(item.value) }}</b>
            </div>
            <div v-if="!incomeItems.length" class="m-detail-empty">本期无收入项</div>
          </div>
          <div class="m-detail-group">
            <div class="m-detail-title">扣款项</div>
            <div v-for="item in deductItems" :key="item.label" class="m-detail-row">
              <div class="m-detail-name">
                <span>{{ item.label }}</span>
                <i v-if="item.source" class="m-detail-src">{{ item.source }}</i>
              </div>
              <b class="deduct">-{{ formatMoney(item.value) }}</b>
            </div>
            <div v-if="!deductItems.length" class="m-detail-empty">本期无扣款项</div>
          </div>
          <div class="m-detail-group">
            <div class="m-detail-title">结果</div>
            <div class="m-detail-row">
              <div class="m-detail-name">
                <span>实发工资</span>
                <i class="m-detail-src">应发 - 扣款，未减个税</i>
              </div>
              <b>{{ formatMoney(Number(detail.gross ?? 0) - Number(detail.deduct ?? 0)) }}</b>
            </div>
            <div class="m-detail-row">
              <div class="m-detail-name">
                <span>最终发放</span>
                <i class="m-detail-src">实发工资 - 个税</i>
              </div>
              <b>{{ formatMoney(detail.net) }}</b>
            </div>
            <div class="m-detail-row">
              <div class="m-detail-name">
                <span>绩效方案 / 等级 / 综合提点</span>
                <i class="m-detail-src">按员工指派方案考核（未指派=默认积分绩效）</i>
              </div>
              <b class="m-detail-muted">{{ schemeLabel(detail) }} / {{ detail.perfGrade || '—' }} / {{ percent(detail.finalRate) }}</b>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts" name="MobilePayroll">
import { computed, onMounted, ref } from 'vue';
import { mySalaryApi, type MyPayrollDetailVO, type PayrollBatch } from '@/api/panjia/payroll';
import { formatMoney } from '../utils';

const detailOpen = ref(true);

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

/** 金额格式化（计算过程展示用） */
const fmt2 = (value: unknown) =>
  Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 解析引擎落地的计算过程 JSON */
const parseJson = (raw: unknown) => {
  try {
    const parsed = JSON.parse(String(raw ?? 'null'));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

interface CalcStep {
  month: string;
  perf: number;
  rate: number;
  income: number;
  spPerf?: number;
  spIncome?: number;
  spBonus?: number;
  /** 该期间的伯乐加点（RATE_ADD 期间才有值，已计入当期提点） */
  mentorAdd?: number;
}

/** 结佣提成跨月分笔过程 */
const calcSteps = (d: any): CalcStep[] => {
  const arr = parseJson(d?.commissionCalcProcess);
  return Array.isArray(arr) ? (arr as CalcStep[]) : [];
};

const stepText = (step: CalcStep) => {
  const base = `结佣业绩 ¥${fmt2(step.perf)} × ${step.month}快照提点 ${(Number(step.rate) * 100).toFixed(1)}% = ¥${fmt2(step.income)}`;
  const mentorAdd = Number(step.mentorAdd) || 0;
  const addNote = mentorAdd > 0 ? `（含伯乐加点 ${Number((mentorAdd * 100).toFixed(2))}%）` : '';
  if (!Number(step.spPerf)) return base + addNote;
  const points = (Number(step.spBonus) / Number(step.spPerf)) * 100;
  return `${base}${addNote}（含自购单加成 ¥${fmt2(step.spPerf)} 按 ${(Number(step.rate) * 100).toFixed(1)}% + ${points.toFixed(1)} 个点 = ¥${fmt2(step.spIncome)}）`;
};

/** 伯乐奖励计算过程（mentorBonusCalcProcess，引擎落地：结佣月/千里马当月结佣业绩/实际比例/金额） */
interface MentorBonusCalcStep {
  month: string;
  base: number;
  ratio: number;
  bonus: number;
}

const mentorBonusSteps = (d: any): MentorBonusCalcStep[] => {
  const arr = parseJson(d?.mentorBonusCalcProcess);
  return Array.isArray(arr) ? (arr as MentorBonusCalcStep[]) : [];
};

const mentorBonusStepText = (s: MentorBonusCalcStep) =>
  `${s.month || '—'} 千里马当月结佣业绩 ¥${fmt2(s.base)} × ${Number((Number(s.ratio) * 100).toFixed(2))}% = ¥${fmt2(s.bonus)}`;

/** 保底补足推导链 */
const guaranteeSteps = (d: any): string[] => {
  const gp = parseJson(d?.guaranteeCalcProcess);
  if (!gp) return [];
  const lines: string[] = [`保底 ¥${fmt2(gp.minSalary)} vs ${gp.compareLabel} ¥${fmt2(gp.compareValue)}`];
  (gp.newsignSteps || []).forEach((s: CalcStep) => lines.push(stepText(s)));
  for (const s of gp.steps || []) lines.push(`${s.label} ¥${fmt2(s.value)}`);
  lines.push(`取大者补足 ¥${fmt2(gp.fill)}（${Number(gp.fill) !== 0 ? '已触发' : '未触发'}）`);
  return lines;
};

/** 绩效方案计算过程（业绩扣款溯源） */
const perfSource = (d: any): string => {
  const p = parseJson(d?.perfCalcProcess);
  if (!p) return '绩效方案金额扣款（未达标固定扣款）';
  const labels: Record<string, string> = {
    NONE: '无绩效',
    GRADE_RATE: '积分绩效',
    RATE_TIER: '业绩阶梯·扣提点',
    AMOUNT_TIER: '业绩阶梯·扣金额',
    GRADE_AMOUNT: '店长积分·扣金额'
  };
  const bits = [`${p.schemeName || p.schemeCode || '绩效方案'}（${labels[p.schemeType] || p.schemeType || '—'}）`];
  if (p.grade) bits.push(`绩效等级 ${p.grade}`);
  if (p.tierMin != null || p.tierMax != null) {
    bits.push(`业绩 ¥${fmt2(p.perf)} ∈ [${p.tierMin ?? 0}, ${p.tierMax ?? '∞'})`);
  }
  bits.push(`扣款 ¥${fmt2(p.fee)}`);
  return bits.join('；');
};

/** 绩效方案名称（结果组展示） */
const schemeLabel = (d: any): string => {
  const p = parseJson(d?.perfCalcProcess);
  return p?.schemeName || '默认（积分绩效）';
};

interface DetailLine {
  label: string;
  value: number;
  source?: string;
  steps?: string[];
}

/** 收入项（与 PC 工资构成口径一致，只列有值的项，并带计算过程） */
const incomeItems = computed<DetailLine[]>(() => {
  const d: any = detail.value;
  if (!d) return [];
  const rate = Number(d.finalRate) || 0;
  const rows: DetailLine[] = [
    {
      label: '业绩提成',
      value: Number(d.commissionIncome ?? 0),
      source: rate > 0
        ? `结佣业绩 ¥${fmt2(Number(d.commissionIncome) / rate)} × 快照提点 ${(rate * 100).toFixed(1)}% = ¥${fmt2(d.commissionIncome)}`
        : '',
      steps: calcSteps(d).map(stepText)
    },
    { label: '团队提成', value: Number(d.teamIncome ?? 0), source: `团队新签业绩 ¥${fmt2(Number(d.teamIncome) / 0.1)} × 10% = ¥${fmt2(d.teamIncome)}` },
    { label: '门店提成', value: Number(d.storeIncome ?? 0), source: '各门店新签业绩 × 跳点比例' },
    { label: '底薪', value: Number(d.baseSalary ?? 0), source: `职级规则快照：¥${fmt2(d.baseSalary)}（保底职级无底薪）` },
    {
      label: '保底补足',
      value: Number(d.guaranteeFill ?? 0),
      source: `职级保底 ¥${fmt2(d.minSalary)}：MAX(保底, 对应提成) 补足 ¥${fmt2(d.guaranteeFill)}`,
      steps: guaranteeSteps(d)
    },
    {
      label: '伯乐奖励',
      value: Number(d.mentorBonus ?? 0),
      source: d.mentorAdd != null
        ? `伯乐加点 ${(Number(d.mentorAdd) * 100).toFixed(1)}%（已计入最终提成比例）`
        : mentorBonusSteps(d).length
          ? '千里马当月结佣业绩 × 本算薪月职级规则比例'
          : Number(d.mentorBonus) > 0
            ? `按本算薪月职级规则比例计算 = ¥${fmt2(d.mentorBonus)}（历史批次未记录明细）`
            : '',
      steps: mentorBonusSteps(d).map(mentorBonusStepText)
    },
    { label: '奖金', value: Number(d.bonus ?? 0), source: '奖金审批单' },
    { label: '其他收入', value: Number(d.otherIncome ?? 0), source: '收入录入记录（补贴/补发等）' }
  ];
  // 保底补足未触发（0）但有计算过程时仍展示，让员工看到是否触发
  return rows.filter((item) => item.value !== 0 || (item.label === '保底补足' && !!d.guaranteeCalcProcess));
});

/** 扣款项（与 PC 工资构成口径一致，只列有值的项，并带计算过程） */
const deductItems = computed<DetailLine[]>(() => {
  const d: any = detail.value;
  if (!d) return [];
  const rows: DetailLine[] = [
    { label: '社保', value: d.socialFee, source: `基数 1637.15 × 职级比例 ${((Number(d.socialFee) / 1637.15) * 100).toFixed(1)}% = ¥${fmt2(d.socialFee)}` },
    { label: '公积金', value: d.housingFund, source: `员工档案自缴：¥${fmt2(d.housingFund)}` },
    { label: '考勤扣款', value: d.attendanceFee, source: `考勤导入：¥${fmt2(Math.abs(Number(d.attendanceFee ?? 0)))}` },
    { label: '积分扣款', value: d.pointsFee, source: `积分日报晚提交：¥${fmt2(d.pointsFee)}` },
    { label: '业绩扣款', value: d.perfDeductFee, source: perfSource(d) },
    { label: '商业保险', value: d.commercialInsurance, source: `人事数据：¥${fmt2(d.commercialInsurance)}/月` },
    { label: '宿舍费', value: d.dormitoryFee, source: `人事数据（住宿）：¥${fmt2(d.dormitoryFee)}` },
    { label: '负工资结转', value: d.negativeCarryover, source: `上月负工资余额：¥${fmt2(Math.abs(Number(d.negativeCarryover ?? 0)))}` },
    { label: '其他支出', value: d.otherDeduct, source: '支出录入记录（培训费/罚款等）' },
    { label: '个税', value: d.tax, source: '系统按累计预扣法计算' }
  ];
  return rows
    .filter((item) => Number(item.value ?? 0) !== 0)
    .map((item) => ({ ...item, value: Math.abs(Number(item.value ?? 0)) }));
});

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

<style lang="scss" scoped>
.m-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 6px;
  margin-top: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  border-top: 1px solid #f0f2f5;
}

.m-detail-toggle {
  font-size: 13px;
  font-weight: 400;
  color: #909399;
}

.m-detail-group {
  padding-top: 8px;
}

.m-detail-title {
  padding: 4px 0;
  font-size: 13px;
  color: #909399;
}

.m-detail-empty {
  padding: 6px 0 8px;
  font-size: 13px;
  color: #c0c4cc;
}

.m-detail-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 7px 0;
  font-size: 14px;
  color: #606266;

  b {
    font-weight: 600;
    color: #303133;
    white-space: nowrap;
  }

  .deduct {
    color: #f56c6c;
  }
}

.m-detail-name {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.m-detail-src {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-style: normal;
  font-size: 11px;
  line-height: 1.5;
  color: #b0b3b8;
  word-break: break-all;
}

.m-detail-muted {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  text-align: right;
  white-space: normal;
}
</style>
