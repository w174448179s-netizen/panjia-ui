<template>
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
          <div class="compose-head">扣款项 <span>合计 ¥{{ fmt(row.deduct) }} · 个税 ¥{{ fmt(row.tax) }}</span></div>
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
        <div class="compose-block result">
          <div class="compose-head">结果</div>
          <div class="compose-item">
            <span class="compose-name">实发工资</span>
            <span class="compose-val net-val">¥{{ fmt(row.net) }}</span>
          </div>
          <div class="compose-item">
            <span class="compose-name">公司承担社保</span>
            <span class="compose-val muted">¥{{ fmt(row.employerSocial) }}（不扣工资，计入部门收支）</span>
          </div>
          <div class="compose-item">
            <span class="compose-name">绩效等级 / 综合提点</span>
            <span class="compose-val muted">{{ row.perfGrade || '—' }} / {{ row.finalRate != null ? (Number(row.finalRate) * 100).toFixed(1) + '%' : '—' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 右：溯源链路 -->
    <div class="trace-right">
      <div class="trace-title">
        <el-icon><Link /></el-icon>
        溯源链路
      </div>
      <el-steps direction="vertical" :active="4" class="trace-steps">
        <el-step title="工资明细项" description="本批次计算结果（规则快照，锁定后不可改）" />
        <el-step title="结佣记录 / 录入单据" description="结佣审批单、奖金审批单、考勤/积分导入批次" />
        <el-step title="合同角色人业绩行" description="原始行 + 调整行版本链，原始行永不修改" />
        <el-step title="贝壳导入批次" description="理房通到账明细表原始数据（只读存档）" />
      </el-steps>
      <div v-if="row.commissionIncome" class="trace-action">
        <el-button size="small" type="primary" plain :loading="traceLoading" @click="loadCommissionTrace">
          查看结佣明细（¥{{ fmt(row.commissionIncome) }} 提成对应的每笔结佣）
        </el-button>
      </div>
      <div v-if="traceItems.length" class="trace-commission">
        <el-table :data="traceItems" size="small" border max-height="260">
          <el-table-column label="业务类型" prop="bizType" width="90" />
          <el-table-column label="费用项目" prop="feeItem" min-width="100" show-overflow-tooltip />
          <el-table-column label="金额" align="right" width="110">
            <template #default="{ row: it }">
              <span :class="{ 'deduct-text': Number(it.amount) < 0 }">¥{{ fmt(it.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row: it }">
              <el-tag v-if="it.status === 'REVERSED'" type="danger" size="small">红冲/退单</el-tag>
              <el-tag v-else-if="it.status === 'APPROVED'" type="success" size="small">已审批</el-tag>
              <el-tag v-else type="info" size="small">{{ it.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="业绩事实" width="110" align="center">
            <template #default="{ row: it }">
              <span v-if="it.performanceFactId" class="fact-id">#{{ it.performanceFactId }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="trace-footnote">金额为该员工在对应结佣审批单中的分摊金额；红冲行为退单回冲，可继续在「业绩明细 → 合同详情」中查看原始合同。</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Tickets, Link } from '@element-plus/icons-vue';
import { mySalaryApi, orgCommissionTraceApi, type CommissionTraceItem, type PayrollDetail } from '@/api/panjia/payroll';

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

/* ───────────── 工资构成列定义（含溯源口径） ───────────── */
interface ColDef { prop: string; label: string; source: string }

const INCOME_COLS: ColDef[] = [
  { prop: 'commissionIncome', label: '业绩提成', source: '结佣计薪业绩 × 快照提点' },
  { prop: 'teamIncome', label: '团队提成', source: '团队新签计薪业绩 × 10%' },
  { prop: 'personalNewsignIncome', label: '个人新签', source: '本人新签计薪业绩 × 70%' },
  { prop: 'storeIncome', label: '门店提成', source: '各门店新签业绩 × 跳点比例' },
  { prop: 'baseSalary', label: '底薪/保底', source: '职级规则配置（历史快照）' },
  { prop: 'guaranteeFill', label: '保底补足', source: 'MAX(保底, 团队+个人新签) 补足部分' },
  { prop: 'mentorBonus', label: '招聘奖励', source: '师徒关系档案：徒弟结佣 × 2%' },
  { prop: 'bonus', label: '奖金', source: '奖金审批单' },
  { prop: 'otherIncome', label: '其他收入', source: '收入录入记录（补贴/补发等）' },
];

const DEDUCT_COLS: ColDef[] = [
  { prop: 'socialFee', label: '社保', source: '1637.15 × 职级比例' },
  { prop: 'housingFund', label: '公积金', source: '员工档案自缴金额' },
  { prop: 'attendanceFee', label: '考勤扣款', source: '考勤Excel导入：迟到×20 + 旷工/请假标准' },
  { prop: 'pointsFee', label: '积分扣款', source: '积分Excel导入：处罚次数 × 5元' },
  { prop: 'commercialInsurance', label: '商业保险', source: '人事数据（21元/月）' },
  { prop: 'dormitoryFee', label: '宿舍费', source: '人事数据（住宿名单）' },
  { prop: 'negativeCarryover', label: '负工资结转', source: '上月负工资余额（系统自动结转）' },
  { prop: 'otherDeduct', label: '其他支出', source: '支出录入记录（培训费/罚款等）' },
];

const incomeItems = INCOME_COLS
  .filter((c) => !isZero((props.row as any)[c.prop]))
  .map((c) => ({ label: c.label, value: Number((props.row as any)[c.prop]) || 0, source: c.source }));

const deductItems = DEDUCT_COLS
  .filter((c) => !isZero((props.row as any)[c.prop]))
  .map((c) => ({ label: c.label, value: Math.abs(Number((props.row as any)[c.prop])) || 0, source: c.source }));

/* ───────────── 结佣追溯（走 payroll 接口，不依赖 commission 菜单权限） ───────────── */
const traceLoading = ref(false);
const traceItems = ref<CommissionTraceItem[]>([]);

const loadCommissionTrace = async () => {
  if (traceLoading.value) return;
  traceLoading.value = true;
  try {
    const res: any = props.myMode
      ? await mySalaryApi.myCommissionTrace(props.period)
      : await orgCommissionTraceApi.list(props.period, props.row.employeeId);
    traceItems.value = (res?.data ?? []) as CommissionTraceItem[];
    if (!traceItems.value.length) ElMessage.info('当月结佣单中未找到该员工的分摊明细');
  } catch {
    ElMessage.warning('结佣明细加载失败，请稍后重试');
  } finally {
    traceLoading.value = false;
  }
};
</script>

<style scoped>
/* 展开追溯面板（组织页 / 个人页共用） */
.trace-panel { display: flex; gap: 24px; padding: 8px 12px 16px 40px; background: #fafbfc; }
.trace-left { flex: 1.6; min-width: 0; }
.trace-right { flex: 1; min-width: 300px; border-left: 1px dashed #dcdfe6; padding-left: 24px; }
.trace-title { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1f2d3d; margin-bottom: 10px; }
.compose-grid { display: flex; flex-direction: column; gap: 10px; }
.compose-block { background: #fff; border: 1px solid #ebeef5; border-radius: 6px; padding: 10px 12px; }
.compose-block.income { border-left: 3px solid #67c23a; }
.compose-block.deduct { border-left: 3px solid #f56c6c; }
.compose-block.result { border-left: 3px solid #409eff; }
.compose-head { display: flex; justify-content: space-between; font-size: 12px; color: #909399; margin-bottom: 6px; }
.compose-item { display: flex; justify-content: space-between; align-items: baseline; padding: 3px 0; font-size: 13px; gap: 12px; }
.compose-name { color: #303133; display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.compose-src { font-style: normal; font-size: 11px; color: #b0b3b8; }
.compose-val { font-variant-numeric: tabular-nums; color: #303133; white-space: nowrap; }
.compose-empty { color: #c0c4cc; font-size: 12px; padding: 4px 0; }
.net-val { font-weight: 700; color: #0a7d43; font-size: 15px; }
.muted { color: #909399; font-size: 12px; white-space: normal; }
.deduct-text { color: #c0392b; }

.trace-steps :deep(.el-step__title) { font-size: 13px; }
.trace-steps :deep(.el-step__description) { font-size: 12px; }
.trace-action { margin-top: 8px; }
.trace-commission { margin-top: 10px; }
.trace-footnote { margin-top: 6px; font-size: 11px; color: #b0b3b8; line-height: 1.6; }
.fact-id { color: #909399; font-family: monospace; }
</style>
