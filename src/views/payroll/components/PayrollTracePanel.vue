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
            <span class="compose-name">{{ it.label }}<i class="compose-src">{{ it.source }}</i></span>
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
            <span class="compose-name">实发工资</span>
            <span class="compose-val net-val">¥{{ fmt(row.net) }}</span>
          </div>
          <div class="compose-item">
            <span class="compose-name">绩效等级 / 综合提点</span>
            <span class="compose-val muted">{{ row.perfGrade || '—' }} / {{ row.finalRate != null ? (Number(row.finalRate) * 100).toFixed(1) + '%' : '—' }}</span>
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
        <template #default="{ row: it }">{{ formatDate(it.signDate) || it.businessDate || '—' }}</template>
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
          <template #default="{ row: it }">{{ formatDate(it.signDate) || it.businessDate || '—' }}</template>
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
  { prop: 'personalNewsignIncome', label: '个人新签', source: (r) => {
    const base = Number(r.personalNewsignIncome) / 0.7;
    return `本人新签业绩 ¥${fmt(base)} × 70% = ¥${fmt(r.personalNewsignIncome)}`;
  } },
  { prop: 'storeIncome', label: '门店提成', source: '各门店新签业绩 × 跳点比例' },
  { prop: 'baseSalary', label: '底薪/保底', source: (r) => `职级规则快照：¥${fmt(r.baseSalary)}` },
  { prop: 'guaranteeFill', label: '保底补足', source: (r) => {
    const combined = Number(r.teamIncome) + Number(r.personalNewsignIncome);
    return `MAX(保底 ¥${fmt(r.baseSalary)}, 团队+个人新签 ¥${fmt(combined)}) 补足 ¥${fmt(r.guaranteeFill)}`;
  } },
  { prop: 'mentorBonus', label: '招聘奖励', source: (r) => {
    const apprentice = Number(r.mentorBonus) / 0.02;
    return `徒弟结佣 ¥${fmt(apprentice)} × 2% = ¥${fmt(r.mentorBonus)}`;
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
  { prop: 'commercialInsurance', label: '商业保险', source: (r) => `人事数据：¥${fmt(r.commercialInsurance)}/月` },
  { prop: 'dormitoryFee', label: '宿舍费', source: (r) => `人事数据（住宿）：¥${fmt(r.dormitoryFee)}` },
  { prop: 'negativeCarryover', label: '负工资结转', source: (r) => `上月负工资余额：¥${fmt(Math.abs(Number(r.negativeCarryover)))}` },
  { prop: 'otherDeduct', label: '其他支出', source: '支出录入记录（培训费/罚款等）' },
];

const resolveSource = (c: ColDef, row: PayrollDetail) => typeof c.source === 'function' ? c.source(row) : c.source;

const incomeItems = INCOME_COLS
  .filter((c) => !isZero((props.row as any)[c.prop]))
  .map((c) => ({ label: c.label, value: Number((props.row as any)[c.prop]) || 0, source: resolveSource(c, props.row) }));

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
