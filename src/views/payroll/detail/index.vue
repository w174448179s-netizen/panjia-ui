<template>
  <div class="payroll-detail" style="padding: 12px;">
    <!-- 筛选区 -->
    <el-card class="mb-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">工资明细</h3>
        <div class="flex items-center gap-3">
          <el-select
            v-model="selectedBatchId"
            placeholder="请选择工资批次"
            filterable
            clearable
            style="width: 300px"
            @change="loadDetails"
          >
            <el-option
              v-for="b in batches"
              :key="b.id"
              :label="`${b.period}（${statusLabel(b.status)}）`"
              :value="b.id"
            />
          </el-select>
          <el-button type="success" :disabled="!details.length" @click="exportExcel">导出 Excel</el-button>
        </div>
      </div>

      <!-- 批次概要 -->
      <div v-if="currentBatch" class="batch-summary">
        <el-descriptions :column="5" border size="small">
          <el-descriptions-item label="归属月">{{ currentBatch.period }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="statusTag(currentBatch.status)" size="small">{{ statusLabel(currentBatch.status) }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="人数">{{ currentBatch.employeeCount }}</el-descriptions-item>
          <el-descriptions-item label="应发合计">¥{{ fmt(currentBatch.grossTotal) }}</el-descriptions-item>
          <el-descriptions-item label="实发合计">¥{{ fmt(currentBatch.netTotal) }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-card>

    <!-- 明细表格 -->
    <el-card>
      <el-table
        v-loading="loading"
        :data="details"
        stripe
        border
        max-height="680"
        :summary-method="summaryMethod"
        show-summary
        :empty-text="selectedBatchId ? '该批次暂无明细数据' : '请先选择工资批次'"
      >
        <el-table-column label="员工ID" prop="employeeId" width="100" fixed="left" />
        <el-table-column label="部门ID" prop="deptId" width="100" />
        <el-table-column label="职级" prop="levelCode" width="80" />
        <el-table-column label="角色" width="90">
          <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
        </el-table-column>
        <el-table-column label="兼职" width="60" align="center">
          <template #default="{ row }">{{ row.isPartTime ? '是' : '否' }}</template>
        </el-table-column>
        <el-table-column label="业绩提成" prop="commissionIncome" width="120" align="right">
          <template #default="{ row }">¥{{ fmt(row.commissionIncome) }}</template>
        </el-table-column>
        <el-table-column label="团队提成" prop="teamIncome" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.teamIncome) }}</template>
        </el-table-column>
        <el-table-column label="个人新签" prop="personalNewsignIncome" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.personalNewsignIncome) }}</template>
        </el-table-column>
        <el-table-column label="门店提成" prop="storeIncome" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.storeIncome) }}</template>
        </el-table-column>
        <el-table-column label="底薪" prop="baseSalary" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.baseSalary) }}</template>
        </el-table-column>
        <el-table-column label="保底补足" prop="guaranteeFill" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.guaranteeFill) }}</template>
        </el-table-column>
        <el-table-column label="招聘奖励" prop="mentorBonus" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.mentorBonus) }}</template>
        </el-table-column>
        <el-table-column label="奖金" prop="bonus" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.bonus) }}</template>
        </el-table-column>
        <el-table-column label="其他收入" prop="otherIncome" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.otherIncome) }}</template>
        </el-table-column>
        <el-table-column label="应发合计" prop="gross" width="130" align="right">
          <template #default="{ row }"><b>¥{{ fmt(row.gross) }}</b></template>
        </el-table-column>
        <el-table-column label="社保" prop="socialFee" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.socialFee) }}</template>
        </el-table-column>
        <el-table-column label="公积金" prop="housingFund" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.housingFund) }}</template>
        </el-table-column>
        <el-table-column label="考勤扣款" prop="attendanceFee" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.attendanceFee) }}</template>
        </el-table-column>
        <el-table-column label="积分扣款" prop="pointsFee" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.pointsFee) }}</template>
        </el-table-column>
        <el-table-column label="商业保险" prop="commercialInsurance" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.commercialInsurance) }}</template>
        </el-table-column>
        <el-table-column label="宿舍费" prop="dormitoryFee" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.dormitoryFee) }}</template>
        </el-table-column>
        <el-table-column label="负工资结转" prop="negativeCarryover" width="120" align="right">
          <template #default="{ row }">¥{{ fmt(row.negativeCarryover) }}</template>
        </el-table-column>
        <el-table-column label="其他支出" prop="otherDeduct" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.otherDeduct) }}</template>
        </el-table-column>
        <el-table-column label="支出合计" prop="deduct" width="120" align="right">
          <template #default="{ row }">¥{{ fmt(row.deduct) }}</template>
        </el-table-column>
        <el-table-column label="个税" prop="tax" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.tax) }}</template>
        </el-table-column>
        <el-table-column label="实发" prop="net" width="120" align="right">
          <template #default="{ row }"><b class="text-primary">¥{{ fmt(row.net) }}</b></template>
        </el-table-column>
        <el-table-column label="单位社保" prop="employerSocial" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.employerSocial) }}</template>
        </el-table-column>
        <el-table-column label="绩效等级" prop="perfGrade" width="90" align="center" />
        <el-table-column label="综合费率" prop="finalRate" width="100" align="right">
          <template #default="{ row }">{{ row.finalRate != null ? (Number(row.finalRate) * 100).toFixed(2) + '%' : '—' }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { payrollApi, type PayrollBatch, type PayrollDetail } from '@/api/panjia/payroll';

const batches = ref<PayrollBatch[]>([]);
const details = ref<PayrollDetail[]>([]);
const selectedBatchId = ref<number | null>(null);
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
const statusTag = (s: string) => STATUS_TAG[s] || 'info';
const roleLabel = (r: string) => ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r || '—');
const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentBatch = computed(() => batches.value.find((b) => b.id === selectedBatchId.value) || null);

const loadBatches = async () => {
  try {
    const res = await payrollApi.listBatches();
    batches.value = (res as any).data ?? [];
    // 自动选中最新批次
    if (batches.value.length && !selectedBatchId.value) {
      selectedBatchId.value = batches.value[0].id;
      loadDetails();
    }
  } catch {
    /* 拦截器处理 */
  }
};

const loadDetails = async () => {
  if (!selectedBatchId.value) {
    details.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await payrollApi.getDetails(selectedBatchId.value);
    details.value = (res as any).data ?? [];
  } catch {
    details.value = [];
  } finally {
    loading.value = false;
  }
};

// 金额列汇总
const MONEY_PROPS = [
  'commissionIncome', 'teamIncome', 'personalNewsignIncome', 'storeIncome',
  'baseSalary', 'guaranteeFill', 'mentorBonus', 'bonus', 'otherIncome', 'gross',
  'socialFee', 'housingFund', 'attendanceFee', 'pointsFee', 'commercialInsurance',
  'dormitoryFee', 'negativeCarryover', 'otherDeduct', 'deduct', 'tax', 'net',
  'employerSocial',
];

const summaryMethod = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (MONEY_PROPS.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = '¥' + fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

// 导出 CSV（Excel 可直接打开）
const exportExcel = () => {
  if (!details.value.length) return;
  const headers = [
    '员工ID', '部门ID', '职级', '角色', '兼职',
    '业绩提成', '团队提成', '个人新签', '门店提成', '底薪', '保底补足', '招聘奖励', '奖金', '其他收入', '应发合计',
    '社保', '公积金', '考勤扣款', '积分扣款', '商业保险', '宿舍费', '负工资结转', '其他支出', '支出合计', '个税',
    '实发', '单位社保', '绩效等级',
  ];
  const keys = [
    'employeeId', 'deptId', 'levelCode', 'employeeRole', 'isPartTime',
    'commissionIncome', 'teamIncome', 'personalNewsignIncome', 'storeIncome', 'baseSalary', 'guaranteeFill', 'mentorBonus', 'bonus', 'otherIncome', 'gross',
    'socialFee', 'housingFund', 'attendanceFee', 'pointsFee', 'commercialInsurance', 'dormitoryFee', 'negativeCarryover', 'otherDeduct', 'deduct', 'tax',
    'net', 'employerSocial', 'perfGrade',
  ];
  const rows = details.value.map((r: any) =>
    keys.map((k) => {
      const v = r[k];
      if (v == null) return '';
      if (k === 'isPartTime') return v ? '是' : '否';
      if (typeof v === 'number') return v.toFixed(2);
      return String(v);
    })
  );
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  // BOM 头确保 Excel 正确识别 UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `工资明细_${currentBatch.value?.period || ''}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
};

onMounted(loadBatches);
</script>

<style scoped>
.batch-summary {
  margin-bottom: 12px;
}
</style>
