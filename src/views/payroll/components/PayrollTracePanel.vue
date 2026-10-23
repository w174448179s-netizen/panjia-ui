<template>
  <div class="trace-wrap">
  <div class="trace-panel">
    <!-- 左：工资构成 -->
    <div class="trace-left">
      <div class="trace-title">
        <el-icon><Tickets /></el-icon>
        {{ employeeName || `员工${row.employeeId}` }} · 工资构成（{{ period }}）
      </div>
      <div class="compose-grid">
        <div class="compose-block income">
          <div class="compose-head">收入项 <span>应发 ¥{{ fmt(row.gross) }}</span></div>
          <div v-for="it in incomeItems" :key="it.label" class="compose-item">
            <span class="compose-name">
              {{ it.label }}
              <!-- 业绩提成：跨月回溯时展示全部算薪分笔过程（与列表「算薪提成」列同口径） -->
              <span v-if="it.steps.length" class="compose-steps">
                <i v-for="(s, i) in it.steps" :key="i" class="compose-src">{{ s }}</i>
              </span>
              <i v-else class="compose-src">{{ it.source }}</i>
            </span>
            <span class="compose-val">+{{ fmt(it.value) }}</span>
          </div>
          <div v-if="!incomeItems.length" class="compose-empty">本期无收入项</div>
        </div>
        <div class="compose-block deduct">
          <div class="compose-head">扣款项 <span>合计 ¥-{{ fmt(row.deduct) }} · 个税 ¥-{{ fmt(row.tax) }}</span></div>
          <div v-for="it in deductItems" :key="it.label" class="compose-item">
            <span class="compose-name">{{ it.label }}<i class="compose-src">{{ it.source }}</i></span>
            <span class="compose-val">-{{ fmt(it.value) }}</span>
          </div>
          <div v-if="!deductItems.length && !row.tax" class="compose-empty">本期无扣款项</div>
          <div v-if="row.tax" class="compose-item">
            <span class="compose-name">个税扣除<i class="compose-src">系统按累计预扣法计算</i></span>
            <span class="compose-val">-{{ fmt(row.tax) }}</span>
          </div>
        </div>
        <div v-if="rateAdjustItems.length" class="compose-block rate">
          <div class="compose-head">提成点调整 <span>算薪时叠加到综合提点</span></div>
          <div v-for="(it, idx) in rateAdjustItems" :key="idx" class="compose-item">
            <span class="compose-name">
              <el-tag :type="rateTagType(it.type)" size="small" effect="plain">{{ rateTypeLabel(it.type) }}</el-tag>
              <i class="compose-src">{{ rateSourceLabel(it.source) }}</i>
            </span>
            <span class="compose-val deduct-text">
              {{ ratePercent(it.rate) }}
              <i v-if="it.reason" class="compose-src">（{{ it.reason }}）</i>
            </span>
          </div>
        </div>
        <div class="compose-block result">
          <div class="compose-head">结果</div>
          <div class="compose-item">
            <span class="compose-name">实发工资<i class="compose-src">应发 - 扣款，未减个税</i></span>
            <span class="compose-val">¥{{ fmt(grossMinusDeduct(row)) }}</span>
          </div>
          <div class="compose-item">
            <span class="compose-name">最终发放<i class="compose-src">实发工资 - 个税</i></span>
            <span class="compose-val net-val">¥{{ fmt(row.net) }}</span>
          </div>
          <div class="compose-item">
            <span class="compose-name">绩效方案 / 等级 / 综合提点<i class="compose-src">按员工指派方案考核（未指派=默认积分绩效）</i></span>
            <span class="compose-val muted">{{ schemeLabel(row) }} / {{ row.perfGrade || '—' }} / {{ row.finalRate != null ? (Number(row.finalRate) * 100).toFixed(1) + '%' : '—' }}</span>
          </div>
        </div>
      </div>
      <div v-if="row.commissionIncome" class="trace-action">
        <el-button size="small" type="primary" plain :loading="traceLoading" @click="openTraceDialog">
          查看结佣明细（¥{{ fmt(row.commissionIncome) }} 提成对应的每笔结佣业绩）
        </el-button>
      </div>
    </div>
  </div>

  <el-dialog
    v-model="traceDialogVisible"
    :title="`结佣明细追溯 · ${employeeName || ''}（${period}）`"
    width="1100px"
    destroy-on-close
  >
    <!-- 第一部分：个人结佣明细 -->
    <div class="trace-section-title">个人结佣明细</div>
    <el-table :data="traceItems" size="small" border max-height="300" show-summary :summary-method="traceSummary">
      <el-table-column label="签约/认购时间" width="170" align="center">
        <template #default="{ row: it }">{{ formatDate(it.businessDate) || '—' }}</template>
      </el-table-column>
      <el-table-column label="合同号/订单号" min-width="180" show-overflow-tooltip>
        <template #default="{ row: it }">
          <span class="contract-no">{{ resolveBizNo(it.bizType, it.contractNo, it.orderNo) || '—' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="结佣业绩" align="right" width="130">
        <template #default="{ row: it }">
          <span :class="{ 'deduct-text': Number(it.amount) < 0 }">¥{{ fmt(it.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="折算后" align="right" width="130">
        <template #default="{ row: it }">
          <span :class="{ 'deduct-text': Number(it.convertedAmount) < 0 }">¥{{ fmt(it.convertedAmount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" prop="bizType" width="100" show-overflow-tooltip />
      <el-table-column label="房源地址" min-width="200" show-overflow-tooltip>
        <template #default="{ row: it }">{{ it.propertyAddress || '—' }}</template>
      </el-table-column>
      <el-table-column label="所属角色" prop="roleType" width="90" align="center">
        <template #default="{ row: it }">{{ it.roleType || '—' }}</template>
      </el-table-column>
      <el-table-column label="角色占比" width="90" align="center">
        <template #default="{ row: it }">{{ it.shareRatio != null ? (Number(it.shareRatio) * 100).toFixed(2) + '%' : '—' }}</template>
      </el-table-column>
      <el-table-column label="结算日期" width="110" align="center">
        <template #default="{ row: it }">{{ it.approvedMonth || '—' }}</template>
      </el-table-column>
    </el-table>

    <!-- 第二部分：门店新签明细（店长） -->
    <template v-if="isManager && teamNewSignItems.length">
      <div class="trace-section-title" style="margin-top: 16px">门店新签明细</div>
      <el-table :data="teamNewSignItems" size="small" border max-height="300" show-summary :summary-method="teamSummary">
        <el-table-column label="签约/认购时间" width="170" align="center">
          <template #default="{ row: it }">{{ formatDate(it.businessDate) || '—' }}</template>
        </el-table-column>
        <el-table-column label="合同号/订单号" min-width="180" show-overflow-tooltip>
          <template #default="{ row: it }">
            <span class="contract-no">{{ resolveBizNo(it.bizType, it.contractNo, it.orderNo) || '—' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="新签业绩" align="right" width="130">
          <template #default="{ row: it }">¥{{ fmt(it.amount) }}</template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="130">
          <template #default="{ row: it }">¥{{ fmt(it.convertedAmount) }}</template>
        </el-table-column>
        <el-table-column label="类型" prop="bizType" width="100" show-overflow-tooltip />
        <el-table-column label="房源地址" min-width="200" show-overflow-tooltip>
          <template #default="{ row: it }">{{ it.propertyAddress || '—' }}</template>
        </el-table-column>
        <el-table-column label="员工工号" prop="employeeCode" width="100" align="center">
          <template #default="{ row: it }">{{ it.employeeCode || '—' }}</template>
        </el-table-column>
        <el-table-column label="所属角色" prop="roleType" width="90" align="center">
          <template #default="{ row: it }">{{ it.roleType || '—' }}</template>
        </el-table-column>
        <el-table-column label="角色占比" width="90" align="center">
          <template #default="{ row: it }">{{ it.shareRatio != null ? (Number(it.shareRatio) * 100).toFixed(2) + '%' : '—' }}</template>
        </el-table-column>
      </el-table>
    </template>
    <div class="trace-footnote">
      结佣业绩 = 已审批结佣业绩；新签业绩 = 应收业绩（门店团队成员）；折算后 = 业绩金额 × 当前生效折算因子（折算只作用于新签，结佣是贝壳实收到手值、原样取用，此列仅供对照）；签约/认购时间、房源地址、角色占比由业绩事实 enrich。
    </div>
  </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRefs } from 'vue';
import { ElMessage } from 'element-plus';
import { Tickets } from '@element-plus/icons-vue';
import { mySalaryApi, orgCommissionTraceApi, type CommissionTraceItem, type PayrollDetail } from '@/api/panjia/payroll';
import { grossMinusDeduct } from './payroll-export';
import { useDict } from '@/utils/dict';
import { resolveBizNo } from '@/utils/panjiaBiz';

const props = defineProps<{
  row: PayrollDetail;
  employeeName?: string;
  period: string;
  /** true=本人工资查询（后端按登录态解析 employeeId）；false=组织工资明细（传 employeeId） */
  myMode?: boolean;
}>();

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isZero = (v: number | null | undefined) => !v || Number(v) === 0;
const formatDate = (val?: string | null): string => {
  if (!val) return '';
  return val.replace('T', ' ').substring(0, 19);
};

/* ───────────── 工资构成列定义（含溯源口径，带实际数值） ───────────── */
interface ColDef { prop: string; label: string; source: string | ((row: PayrollDetail) => string) }

const INCOME_COLS: ColDef[] = [
  { prop: 'commissionIncome', label: '业绩提成', source: (r) => {
    const rate = Number(r.finalRate) || 0;
    const base = rate > 0 ? Number(r.commissionIncome) / rate : 0;
    return `结佣业绩 ¥${fmt(base)} × 快照提点 ${(rate * 100).toFixed(1)}% = ¥${fmt(r.commissionIncome)}`;
  } },
  { prop: 'teamIncome', label: '团队提成', source: (r) => {
    const base = Number(r.teamIncome) / 0.1;
    return `团队新签业绩 ¥${fmt(base)} × 10% = ¥${fmt(r.teamIncome)}`;
  } },
  // 个人新签提成只作保底比较基准、不进应发（2026-10-19 口径），不在收入项展示，算式见「保底补足」区
  { prop: 'storeIncome', label: '门店提成', source: '各门店新签业绩 × 跳点比例' },
  { prop: 'baseSalary', label: '底薪', source: (r) => `职级规则快照：¥${fmt(r.baseSalary)}（保底职级无底薪）` },
  { prop: 'guaranteeFill', label: '保底补足', source: (r) => {
    try {
      const gp = JSON.parse((r as any).guaranteeCalcProcess || 'null');
      if (gp && typeof gp === 'object') {
        const triggered = Number(gp.fill) !== 0;
        return `保底 ¥${fmt(gp.minSalary)} vs ${gp.compareLabel} ¥${fmt(gp.compareValue)} → 取大者，补足 ¥${fmt(gp.fill)}（${triggered ? '已触发' : '未触发'}）`;
      }
    } catch { /* 回退默认口径 */ }
    return `职级保底 ¥${fmt((r as any).minSalary)}：MAX(保底, 对应提成) 补足 ¥${fmt(r.guaranteeFill)}`;
  } },
  { prop: 'mentorBonus', label: '伯乐奖励', source: (r) => {
    // 按职级规则模式自适应：RATE_ADD=加点比例（mentorAdd 仅该模式落地）；AMOUNT_RATIO=独立金额
    if ((r as any).mentorAdd != null) {
      const add = Number((r as any).mentorAdd);
      return `伯乐加点 ${(add * 100).toFixed(1)}%（RATE_ADD，已计入最终提成比例）`;
    }
    const apprentice = Number(r.mentorBonus) / 0.02;
    return `千里马结佣 ¥${fmt(apprentice)} × 2% = ¥${fmt(r.mentorBonus)}`;
  } },
  { prop: 'bonus', label: '奖金', source: '奖金审批单' },
  { prop: 'otherIncome', label: '其他收入', source: '收入录入记录（补贴/补发等）' },
];

const DEDUCT_COLS: ColDef[] = [
  { prop: 'socialFee', label: '社保', source: (r) => {
    const ratio = Number(r.socialFee) / 1637.15;
    return `基数 1637.15 × 职级比例 ${(ratio * 100).toFixed(1)}% = ¥${fmt(r.socialFee)}`;
  } },
  { prop: 'housingFund', label: '公积金', source: (r) => `员工档案自缴：¥${fmt(r.housingFund)}` },
  { prop: 'attendanceFee', label: '考勤扣款', source: (r) => `考勤导入：¥${fmt(Math.abs(Number(r.attendanceFee)))}` },
  { prop: 'pointsFee', label: '积分扣款', source: (r) => `积分日报晚提交：¥${fmt(r.pointsFee)}` },
  {
    // 绩效方案金额扣款（业绩绩效B版/店长积分绩效）：推导链取 perf_calc_process（方案/等级或阶梯/业绩/扣款）
    prop: 'perfDeductFee',
    label: '业绩扣款',
    source: (r) => {
      const p = perfProcess(r);
      if (p) {
        const bits = [`${p.schemeName || p.schemeCode || '绩效方案'}（${SCHEME_TYPE_LABELS[p.schemeType] || p.schemeType}）`];
        if (p.grade) bits.push(`绩效等级 ${p.grade}`);
        if (p.tierMin != null || p.tierMax != null) {
          bits.push(`业绩 ¥${fmt(p.perf)} ∈ [${p.tierMin ?? 0}, ${p.tierMax ?? '∞'})`);
        }
        bits.push(`扣款 ¥${fmt(p.fee)}`);
        return bits.join('；');
      }
      return '绩效方案金额扣款（未达标固定扣款）';
    }
  },
  { prop: 'commercialInsurance', label: '商业保险', source: (r) => `人事数据：¥${fmt(r.commercialInsurance)}/月` },
  { prop: 'dormitoryFee', label: '宿舍费', source: (r) => `人事数据（住宿）：¥${fmt(r.dormitoryFee)}` },
  { prop: 'negativeCarryover', label: '负工资结转', source: (r) => `上月负工资余额：¥${fmt(Math.abs(Number(r.negativeCarryover)))}` },
  { prop: 'otherDeduct', label: '其他支出', source: '支出录入记录（培训费/罚款等）' },
];

const resolveSource = (c: ColDef, row: PayrollDetail) => typeof c.source === 'function' ? c.source(row) : c.source;

/* ───────────── 绩效方案溯源（perfCalcProcess：{schemeCode,schemeName,schemeType,grade?,tierMin?,tierMax?,perf?,deduct?,fee?}） ───────────── */
const SCHEME_TYPE_LABELS: Record<string, string> = {
  NONE: '无绩效',
  GRADE_RATE: '积分绩效',
  RATE_TIER: '业绩阶梯·扣提点',
  AMOUNT_TIER: '业绩阶梯·扣金额',
  GRADE_AMOUNT: '店长积分·扣金额'
};

interface PerfProcess {
  schemeCode?: string;
  schemeName?: string;
  schemeType?: string;
  grade?: string;
  tierMin?: number | null;
  tierMax?: number | null;
  perf?: number;
  deduct?: number;
  fee?: number;
}

/** 解析绩效方案计算过程 JSON（未触发也落地；历史批次无此字段返回 null） */
const perfProcess = (row: PayrollDetail): PerfProcess | null => {
  try {
    const p = JSON.parse((row as any).perfCalcProcess || 'null');
    return p && typeof p === 'object' ? (p as PerfProcess) : null;
  } catch {
    return null;
  }
};

/** 绩效方案展示名：优先取溯源 JSON 的方案名；历史批次（无 JSON）按默认口径显示 */
const schemeLabel = (row: PayrollDetail): string => {
  const p = perfProcess(row);
  if (p?.schemeName) return p.schemeName;
  return '默认（积分绩效）';
};

/* ───────────── 结佣提成跨月回溯分笔过程（引擎落地 commissionCalcProcess：[{month,perf,rate,income}]） ───────────── */
interface CommissionCalcStep {
  month: string;
  perf: number;
  rate: number;
  income: number;
  /** 命中自购单合同号的折算业绩（存在时单独按加成后提点计算） */
  spPerf?: number;
  /** 自购单加成金额（业绩 × 加点点数） */
  spIncome?: number;
  /** 自购单加点点数（如 0.10 = +10 个百分点） */
  spBonus?: number;
}

/** 分笔过程文案：自购单加成单独标注，其余按当期快照提点 */
const stepText = (s: CommissionCalcStep, prefix = '结佣业绩'): string =>
  `${prefix} ¥${fmt(s.perf)} × ${s.month}快照提点 ${(Number(s.rate) * 100).toFixed(1)}% = ¥${fmt(s.income)}`
  + (Number(s.spPerf) ? `（含自购单加成 ¥${fmt(s.spPerf)} × +${(Number(s.spBonus) * 100).toFixed(1)} 个点 = +¥${fmt(s.spIncome)}）` : '');

const calcSteps = (row: PayrollDetail): CommissionCalcStep[] => {
  try {
    const arr = JSON.parse((row as any).commissionCalcProcess || '[]');
    return Array.isArray(arr) ? (arr as CommissionCalcStep[]) : [];
  } catch {
    return [];
  }
};

/** 保底补足计算过程行（保底职级落地，未触发也展示推导链） */
const guaranteeSteps = (row: PayrollDetail): string[] => {
  try {
    const gp = JSON.parse((row as any).guaranteeCalcProcess || 'null');
    if (!gp || typeof gp !== 'object') return [];
    const lines: string[] = [`保底 ¥${fmt(gp.minSalary)} vs ${gp.compareLabel} ¥${fmt(gp.compareValue)}`];
    for (const s of gp.newsignSteps || []) {
      lines.push(stepText(s, '新签业绩'));
    }
    if ((gp.newsignSteps || []).length > 0) {
      lines.push(`+${fmt(gp.compareValue)}（按新签月分笔）`);
    }
    for (const s of gp.steps || []) {
      lines.push(`${s.label} ¥${fmt(s.value)}`);
    }
    const triggered = Number(gp.fill) !== 0;
    lines.push(`取大者补足 ¥${fmt(gp.fill)}（${triggered ? '已触发' : '未触发'}）`);
    return lines;
  } catch {
    return [];
  }
};

const incomeItems = INCOME_COLS
  // 保底补足：未触发（0 值）但保底职级有计算过程时也展示，让员工看到"有没有触发"
  .filter((c) => !isZero((props.row as any)[c.prop])
    || (c.prop === 'guaranteeFill' && !!(props.row as any).guaranteeCalcProcess))
  .map((c) => ({
    label: c.label,
    value: Number((props.row as any)[c.prop]) || 0,
    source: resolveSource(c, props.row),
    // 业绩提成有跨月回溯过程时逐笔展示，否则回落到单行口径说明
    steps: c.prop === 'commissionIncome'
      ? calcSteps(props.row).map((s) => stepText(s))
      : c.prop === 'guaranteeFill'
        ? guaranteeSteps(props.row)
        : [] as string[],
  }));

const deductItems = DEDUCT_COLS
  .filter((c) => !isZero((props.row as any)[c.prop]))
  .map((c) => ({ label: c.label, value: Math.abs(Number((props.row as any)[c.prop])) || 0, source: resolveSource(c, props.row) }));

/* ───────────── 提成点调整溯源（rateAdjustJson：{type,rate,reason,source,adjustId} 数组） ───────────── */
interface RateAdjustTraceItem {
  type: string;
  rate: number | string;
  reason?: string;
  source?: string;
  adjustId?: number | string | null;
}

const rateAdjustItems = computed<RateAdjustTraceItem[]>(() => {
  const raw = props.row.rateAdjustJson;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as RateAdjustTraceItem[]) : [];
  } catch {
    return [];
  }
});

// 调整类型标签走字典 rate_adjust_type（配置驱动；NO_SOCIAL=未买社保扣点）
const { rate_adjust_type } = toRefs<any>(useDict('rate_adjust_type'));
const RATE_TYPE_FALLBACK: Record<string, string> = {
  NO_SOCIAL: '未买社保扣点',
  PHONE_CHECK: '电话考核扣点',
  PERSONAL: '个人调整扣点'
};
const rateTypeLabel = (t?: string | null) =>
  rate_adjust_type.value?.find((o: any) => o.value === t)?.label || RATE_TYPE_FALLBACK[t || ''] || t || '—';
const rateTagType = (t?: string | null) => {
  const map: Record<string, string> = { NO_SOCIAL: 'warning', PHONE_CHECK: 'primary', PERSONAL: 'danger' };
  return (map as any)[t || ''] || 'info';
};
const rateSourceLabel = (s?: string | null) => (s === 'APPROVAL' ? '审批' : s === 'AUTO' ? '自动' : s || '—');
const ratePercent = (v: number | string | null | undefined) => `${Number((Number(v) * 100).toFixed(2))}%`;

/* ───────────── 结佣追溯（走 payroll 接口，不依赖 commission 菜单权限） ───────────── */
const traceLoading = ref(false);
const traceItems = ref<CommissionTraceItem[]>([]);
const traceDialogVisible = ref(false);

/** 店长角色：弹窗追加门店新签明细 */
const isManager = computed(() => props.row.employeeRole === 'MANAGER');
const teamNewSignItems = ref<CommissionTraceItem[]>([]);

const openTraceDialog = async () => {
  if (traceLoading.value) return;
  traceLoading.value = true;
  try {
    const [commRes, teamRes] = await Promise.all([
      props.myMode
        ? mySalaryApi.myCommissionTrace(props.period)
        : orgCommissionTraceApi.list(props.period, props.row.employeeId),
      isManager.value
        ? (props.myMode
            ? mySalaryApi.myTeamNewSign(props.period)
            : orgCommissionTraceApi.teamNewSign(props.period, props.row.deptId))
        : Promise.resolve(null),
    ]);
    traceItems.value = ((commRes as any)?.data ?? []) as CommissionTraceItem[];
    teamNewSignItems.value = ((teamRes as any)?.data ?? []) as CommissionTraceItem[];
    traceDialogVisible.value = true;
    if (!traceItems.value.length && !teamNewSignItems.value.length) ElMessage.info('当月无结佣/新签明细数据');
  } catch {
    ElMessage.warning('明细加载失败，请稍后重试');
  } finally {
    traceLoading.value = false;
  }
};

/** 弹窗合计行：结佣业绩/折算后合计 */
const traceSummary = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((_col: any, idx: number) => {
    if (idx === 0) { sums[idx] = '合计'; return; }
    if (idx === 6) {
      sums[idx] = `¥${fmt(data.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0))}`;
    } else if (idx === 7) {
      sums[idx] = `¥${fmt(data.reduce((s: number, r: any) => s + (Number(r.convertedAmount) || 0), 0))}`;
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

/** 门店新签明细合计行 */
const teamSummary = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((_col: any, idx: number) => {
    if (idx === 0) { sums[idx] = '合计'; return; }
    if (idx === 7) {
      sums[idx] = `¥${fmt(data.reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0))}`;
    } else if (idx === 8) {
      sums[idx] = `¥${fmt(data.reduce((s: number, r: any) => s + (Number(r.convertedAmount) || 0), 0))}`;
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};
</script>

<style scoped>
/* 展开追溯面板（组织页 / 个人页共用） */
.trace-panel { padding: 8px 12px 16px 40px; background: #fafbfc; }
.trace-title { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1f2d3d; margin-bottom: 10px; }
.compose-grid { display: flex; flex-direction: column; gap: 10px; }
.compose-block { background: #fff; border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 12px; }
.compose-block.income { border-left: 3px solid #67c23a; }
.compose-block.deduct { border-left: 3px solid #f56c6c; }
.compose-block.result { border-left: 3px solid #409eff; }
.compose-block.rate { border-left: 3px solid #e6a23c; }
.compose-head { display: flex; justify-content: space-between; font-size: 12px; color: #909399; margin-bottom: 6px; }
.compose-item { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; font-size: 13px; gap: 12px; }
.compose-name { color: #303133; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.compose-src { font-style: normal; font-size: 11px; color: #b0b3b8; }
/* 跨月回溯分笔过程：纵向排列每笔计算式 */
.compose-steps { display: flex; flex-direction: column; gap: 2px; text-align: left; }
.compose-val { font-variant-numeric: tabular-nums; color: #303133; white-space: nowrap; }
.compose-empty { color: #c0c4cc; font-size: 12px; padding: 4px 0; }
.net-val { font-weight: 700; color: #0a7d43; font-size: 15px; }
.muted { color: #909399; font-size: 12px; white-space: normal; }
.deduct-text { color: #c0392b; }
.amount-ink { color: #595959; }

.trace-action { margin-top: 8px; }
.trace-section-title { font-weight: 600; font-size: 13px; color: #303133; margin-bottom: 8px; }
.trace-footnote { margin-top: 6px; font-size: 11px; color: #b0b3b8; line-height: 1.6; }
.contract-cell { display: flex; align-items: baseline; gap: 0; }
.contract-no { font-weight: 600; }
.order-no { color: #909399; font-size: 12px; }
</style>
