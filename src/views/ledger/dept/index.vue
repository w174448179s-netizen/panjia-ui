<template>
  <div class="ledger-dept" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">部门收支表</h3>
        <div class="flex items-center gap-3">
          <el-date-picker
            v-model="period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择归属月"
            clearable
            @change="load"
            @keydown.enter.prevent="load"
          />
          <el-select
            v-model="selectedDeptId"
            placeholder="全部部门"
            clearable
            filterable
            style="width: 200px"
            @change="filterData"
          >
            <el-option
              v-for="d in deptList"
              :key="d.deptId"
              :label="d.deptName"
              :value="d.deptId"
            />
          </el-select>
          <el-button @click="load">刷新</el-button>
          <el-button type="success" :disabled="!tableData.length" @click="exportExcel">导出</el-button>
        </div>
      </div>

      <el-table
        v-loading="loading"
        :data="tableData"
        stripe
        border
        :summary-method="summaryMethod"
        show-summary
        :empty-text="period ? '该期间暂无部门收支数据' : '请先选择归属月'"
      >
        <el-table-column label="部门ID" prop="deptId" width="100" fixed="left" />
        <el-table-column label="人数" prop="employeeCount" width="70" align="center" fixed="left" />
        <!-- 收入项 -->
        <el-table-column label="业绩提成" prop="commissionIncome" width="120" align="right">
          <template #default="{ row }">¥{{ fmt(row.commissionIncome) }}</template>
        </el-table-column>
        <el-table-column label="团队提成" prop="teamIncome" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.teamIncome) }}</template>
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
        <el-table-column label="收入合计" prop="grossTotal" width="130" align="right">
          <template #default="{ row }"><b>¥{{ fmt(row.grossTotal) }}</b></template>
        </el-table-column>
        <!-- 支出项 -->
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
        <el-table-column label="其他支出" prop="otherDeduct" width="110" align="right">
          <template #default="{ row }">¥{{ fmt(row.otherDeduct) }}</template>
        </el-table-column>
        <el-table-column label="支出合计" prop="deductTotal" width="130" align="right">
          <template #default="{ row }">¥{{ fmt(row.deductTotal) }}</template>
        </el-table-column>
        <el-table-column label="个税" prop="tax" width="100" align="right">
          <template #default="{ row }">¥{{ fmt(row.tax) }}</template>
        </el-table-column>
        <el-table-column label="实发合计" prop="netTotal" width="140" align="right" fixed="right">
          <template #default="{ row }"><b class="text-primary">¥{{ fmt(row.netTotal) }}</b></template>
        </el-table-column>
        <el-table-column label="单位社保" prop="employerSocial" width="110" align="right" fixed="right">
          <template #default="{ row }">¥{{ fmt(row.employerSocial) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { payrollApi } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';

interface DeptLedgerRow {
  deptId: string;
  employeeCount: number;
  commissionIncome: number;
  teamIncome: number;
  storeIncome: number;
  baseSalary: number;
  guaranteeFill: number;
  mentorBonus: number;
  bonus: number;
  otherIncome: number;
  grossTotal: number;
  socialFee: number;
  housingFund: number;
  attendanceFee: number;
  pointsFee: number;
  commercialInsurance: number;
  dormitoryFee: number;
  otherDeduct: number;
  deductTotal: number;
  tax: number;
  netTotal: number;
  employerSocial: number;
}

const period = ref(new Date().toISOString().slice(0, 7));
const loading = ref(false);
const selectedDeptId = ref('');
const deptList = ref<DeptNode[]>([]);
const allData = ref<DeptLedgerRow[]>([]);

const fmt = (n: number) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const tableData = computed(() => {
  if (!selectedDeptId.value) return allData.value;
  return allData.value.filter((r) => String(r.deptId) === String(selectedDeptId.value));
});

const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptList.value = (res as any).data ?? [];
  } catch { /* ignore */ }
};

const load = async () => {
  if (!period.value) {
    allData.value = [];
    return;
  }
  loading.value = true;
  try {
    // 获取该期间所有批次
    const batchRes = await payrollApi.listBatches(period.value);
    const batches = (batchRes as any).data ?? [];
    if (!batches.length) {
      allData.value = [];
      return;
    }
    // 收集所有批次的明细
    const allDetails: any[] = [];
    for (const batch of batches) {
      try {
        const detailRes = await payrollApi.getDetails(batch.id);
        const details = (detailRes as any).data ?? [];
        allDetails.push(...details);
      } catch { /* skip batch */ }
    }
    // 按部门聚合
    const deptMap = new Map<string, DeptLedgerRow>();
    const numKeys = [
      'commissionIncome', 'teamIncome', 'storeIncome', 'baseSalary', 'guaranteeFill',
      'mentorBonus', 'bonus', 'otherIncome', 'socialFee', 'housingFund', 'attendanceFee',
      'pointsFee', 'commercialInsurance', 'dormitoryFee', 'otherDeduct', 'tax', 'net',
      'employerSocial', 'gross', 'deduct',
    ];
    allDetails.forEach((d: any) => {
      const deptId = String(d.deptId || '未知');
      if (!deptMap.has(deptId)) {
        deptMap.set(deptId, {
          deptId,
          employeeCount: 0,
          commissionIncome: 0, teamIncome: 0, storeIncome: 0, baseSalary: 0,
          guaranteeFill: 0, mentorBonus: 0, bonus: 0, otherIncome: 0, grossTotal: 0,
          socialFee: 0, housingFund: 0, attendanceFee: 0, pointsFee: 0,
          commercialInsurance: 0, dormitoryFee: 0, otherDeduct: 0, deductTotal: 0,
          tax: 0, netTotal: 0, employerSocial: 0,
        });
      }
      const row = deptMap.get(deptId)!;
      row.employeeCount++;
      numKeys.forEach((k) => {
        (row as any)[k === 'gross' ? 'grossTotal' : k === 'deduct' ? 'deductTotal' : k === 'net' ? 'netTotal' : k] +=
          Number(d[k]) || 0;
      });
    });
    allData.value = Array.from(deptMap.values()).sort((a, b) => b.grossTotal - a.grossTotal);
  } catch {
    allData.value = [];
  } finally {
    loading.value = false;
  }
};

const filterData = () => { /* computed handles filtering */ };

// 汇总
const MONEY_PROPS = [
  'commissionIncome', 'teamIncome', 'storeIncome', 'baseSalary', 'guaranteeFill',
  'mentorBonus', 'bonus', 'otherIncome', 'grossTotal', 'socialFee', 'housingFund',
  'attendanceFee', 'pointsFee', 'commercialInsurance', 'dormitoryFee', 'otherDeduct',
  'deductTotal', 'tax', 'netTotal', 'employerSocial',
];

const summaryMethod = ({ columns, data }: any) => {
  const sums: string[] = [];
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    if (col.property === 'employeeCount') {
      sums[idx] = String(data.reduce((s: number, r: any) => s + (r[col.property] || 0), 0));
      return;
    }
    if (MONEY_PROPS.includes(col.property)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[col.property]) || 0), 0);
      sums[idx] = '¥' + fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

const exportExcel = () => {
  if (!tableData.value.length) return;
  const headers = [
    '部门ID', '人数', '业绩提成', '团队提成', '门店提成', '底薪', '保底补足', '招聘奖励', '奖金', '其他收入', '收入合计',
    '社保', '公积金', '考勤扣款', '积分扣款', '商业保险', '宿舍费', '其他支出', '支出合计', '个税', '实发合计', '单位社保',
  ];
  const keys = [
    'deptId', 'employeeCount', 'commissionIncome', 'teamIncome', 'storeIncome', 'baseSalary',
    'guaranteeFill', 'mentorBonus', 'bonus', 'otherIncome', 'grossTotal',
    'socialFee', 'housingFund', 'attendanceFee', 'pointsFee', 'commercialInsurance',
    'dormitoryFee', 'otherDeduct', 'deductTotal', 'tax', 'netTotal', 'employerSocial',
  ];
  const rows = tableData.value.map((r) =>
    keys.map((k) => {
      const v = (r as any)[k];
      if (v == null) return '';
      if (typeof v === 'number') return v.toFixed(2);
      return String(v);
    })
  );
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `部门收支表_${period.value}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
  ElMessage.success('导出成功');
};

onMounted(() => {
  loadDeptTree();
  load();
});
</script>

<style scoped>
.text-primary { color: var(--el-color-primary); }
</style>
