<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="batch">
      <el-descriptions :column="4" border size="small" class="detail-desc">
        <el-descriptions-item label="归属月">{{ batch.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="范围">{{ batch.deptScope || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTag(batch.status)">{{ statusLabel(batch.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="人数">{{ batch.employeeCount ?? details.length }}</el-descriptions-item>
        <el-descriptions-item label="应发合计">¥{{ fmt(batch.grossTotal) }}</el-descriptions-item>
        <el-descriptions-item label="实发合计">¥{{ fmt(batch.netTotal) }}</el-descriptions-item>
        <el-descriptions-item label="算薪次数">{{ batch.attempt ?? '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ batch.createTime || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">工资明细（{{ details.length }} 人）</div>
        <el-table :data="details" stripe border max-height="480" :summary-method="summaryMethod" show-summary>
          <el-table-column label="工号" width="120">
            <template #default="{ row }">{{ row.employeeName || employeeName(row.employeeId) }}</template>
          </el-table-column>
          <el-table-column label="职级" prop="levelCode" width="70" />
          <el-table-column label="角色" width="80">
            <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
          </el-table-column>
          <el-table-column label="业绩提成" prop="commissionIncome" width="110" align="right">
            <template #default="{ row }">{{ fmt(row.commissionIncome) }}</template>
          </el-table-column>
          <el-table-column label="团队提成" prop="teamIncome" width="100" align="right">
            <template #default="{ row }">{{ fmt(row.teamIncome) }}</template>
          </el-table-column>
          <el-table-column label="保底补足" prop="guaranteeFill" width="100" align="right">
            <template #default="{ row }">{{ fmt(row.guaranteeFill) }}</template>
          </el-table-column>
          <el-table-column label="门店提成" prop="storeIncome" width="100" align="right">
            <template #default="{ row }">{{ fmt(row.storeIncome) }}</template>
          </el-table-column>
          <el-table-column label="底薪" prop="baseSalary" width="90" align="right">
            <template #default="{ row }">{{ fmt(row.baseSalary) }}</template>
          </el-table-column>
          <el-table-column label="招聘奖" prop="mentorBonus" width="90" align="right">
            <template #default="{ row }">{{ fmt(row.mentorBonus) }}</template>
          </el-table-column>
          <el-table-column label="奖金" prop="bonus" width="90" align="right">
            <template #default="{ row }">{{ fmt(row.bonus) }}</template>
          </el-table-column>
          <el-table-column label="应发" prop="gross" width="110" align="right">
            <template #default="{ row }"><b>{{ fmt(row.gross) }}</b></template>
          </el-table-column>
          <el-table-column label="社保" prop="socialFee" width="90" align="right">
            <template #default="{ row }">{{ fmt(row.socialFee) }}</template>
          </el-table-column>
          <el-table-column label="公积金" prop="housingFund" width="80" align="right">
            <template #default="{ row }">{{ fmt(row.housingFund) }}</template>
          </el-table-column>
          <el-table-column label="考勤" prop="attendanceFee" width="80" align="right">
            <template #default="{ row }">{{ fmt(row.attendanceFee) }}</template>
          </el-table-column>
          <el-table-column label="积分" prop="pointsFee" width="70" align="right">
            <template #default="{ row }">{{ fmt(row.pointsFee) }}</template>
          </el-table-column>
          <el-table-column label="商保" prop="commercialInsurance" width="70" align="right">
            <template #default="{ row }">{{ fmt(row.commercialInsurance) }}</template>
          </el-table-column>
          <el-table-column label="其他扣" prop="otherDeduct" width="80" align="right">
            <template #default="{ row }">{{ fmt(row.otherDeduct) }}</template>
          </el-table-column>
          <el-table-column label="支出合计" prop="deduct" width="100" align="right">
            <template #default="{ row }">{{ fmt(row.deduct) }}</template>
          </el-table-column>
          <el-table-column label="个税" prop="tax" width="80" align="right">
            <template #default="{ row }">{{ fmt(row.tax) }}</template>
          </el-table-column>
          <el-table-column label="最终发放" prop="net" width="120" align="right">
            <template #default="{ row }"><b class="net-strong">{{ fmt(row.net) }}</b></template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { payrollApi } from '@/api/panjia/payroll';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const batch = ref<any>(null);
const details = ref<any[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

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
const roleLabel = (r: string) => (({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' } as Record<string, string>)[r] || r);

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MONEY_PROPS = [
  'commissionIncome', 'teamIncome', 'guaranteeFill', 'storeIncome', 'baseSalary', 'mentorBonus', 'bonus',
  'gross', 'socialFee', 'housingFund', 'attendanceFee', 'pointsFee', 'commercialInsurance', 'otherDeduct',
  'deduct', 'tax', 'net',
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
      sums[idx] = fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

onMounted(async () => {
  loading.value = true;
  try {
    const id = Number(props.businessId);
    const [batchRes, detRes]: any[] = await Promise.all([payrollApi.getBatch(id), payrollApi.getDetails(id), loadEmployees()]);
    batch.value = batchRes.data ?? null;
    details.value = detRes.data ?? [];
    if (!batch.value) loadError.value = '未找到该算薪批次';
  } catch {
    loadError.value = '加载算薪批次详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}
.net-strong {
  color: var(--el-color-primary);
}
</style>
