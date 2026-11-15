<template>
  <div class="app-container ledger-report-page">
    <el-card shadow="never">
      <div class="query-bar">
        <span class="page-title">部门收支分析表</span>
        <el-date-picker
          v-model="period"
          type="month"
          value-format="YYYY-MM"
          placeholder="归属月"
          :clearable="false"
          style="width: 150px"
          @change="loadReport"
        />
        <el-button type="primary" plain icon="Search" @click="loadReport">生成报表</el-button>
        <div class="flex-1" />
        <el-button icon="Download" :disabled="!report" @click="exportExcel">导出 Excel</el-button>
      </div>

      <div v-loading="loading" class="report-scroll">
        <div v-if="report" class="report-sheet">
          <div class="report-title">
            {{ report.rootDeptName }} 部门收支分析表
            <span class="period">{{ report.period }}</span>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th class="subject-col">一级科目</th>
                <th class="subject-col">二级科目</th>
                <th class="subject-col">三级科目</th>
                <th class="subject-col">四级科目</th>
                <th v-for="col in report.columns" :key="col.deptId" class="dept-col">
                  {{ col.deptName }}
                </th>
                <th class="total-col">合计</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, index) in report.rows"
                :key="index"
                :class="{
                  'total-row': row.totalRow,
                  'profit-row': row.totalRow && row.totalLabel === '营业利润'
                }"
              >
                <template v-if="row.totalRow">
                  <td :colspan="4" class="label-cell">{{ row.totalLabel }}</td>
                </template>
                <template v-else>
                  <template v-for="level in 4" :key="level">
                    <td
                      v-if="row.spans[level - 1]"
                      :rowspan="row.spans[level - 1]"
                      :class="['subject-cell', `level-${level}`]"
                    >
                      {{ row.level === level ? row.subjectName : '' }}
                    </td>
                  </template>
                </template>
                <td
                  v-for="ci in report.columns.length"
                  :key="ci"
                  class="money-cell"
                  :class="{ negative: isNegative(row.values?.[ci - 1]) }"
                >
                  {{ displayMoney(row.values?.[ci - 1]) }}
                </td>
                <td class="money-cell total-cell" :class="{ negative: row.total != null && row.total < 0 }">
                  {{ displayMoney(row.total) }}
                </td>
              </tr>
            </tbody>
          </table>
          <div class="report-footer">
            <span>说明：支出以负数展示；佣金收入取实收明细（有效明细+已审批），工资取薪资格应发合计；</span>
            <span>手工录入按生效期间与归属月相交整笔计入；“未分配”为非末级部门上的数据。</span>
          </div>
        </div>
        <el-empty v-else-if="!loading" description="请选择归属月生成报表" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import * as XLSX from 'xlsx';
import { ledgerApi, type LedgerReport } from '@/api/panjia/ledger';

const loading = ref(false);
const period = ref(currentMonth());
const report = ref<LedgerReport | null>(null);

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

async function loadReport() {
  if (!period.value) {
    ElMessage.warning('请选择归属月');
    return;
  }
  loading.value = true;
  try {
    report.value = await ledgerApi.getReport(period.value);
  } finally {
    loading.value = false;
  }
}

function displayMoney(value?: number | null) {
  if (value === null || value === undefined) return '';
  if (Math.abs(value) < 0.005) return '-';
  return value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function isNegative(value?: number | null) {
  return typeof value === 'number' && value < 0;
}

function exportExcel() {
  if (!report.value) return;
  const data = report.value;
  const header = ['一级科目', '二级科目', '三级科目', '四级科目', ...data.columns.map((c) => c.deptName), '合计'];
  const title = `${data.rootDeptName} 部门收支分析表（${data.period}）`;
  const aoa: any[][] = [[title], header];
  const merges: any[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } }
  ];

  data.rows.forEach((row, rowIndex) => {
    const excelRow = rowIndex + 2;
    if (row.totalRow) {
      const line: any[] = [row.totalLabel || '', '', '', ''];
      for (let ci = 0; ci < data.columns.length; ci++) line.push(exportValue(row.values?.[ci]));
      line.push(exportValue(row.total));
      aoa.push(line);
      merges.push({ s: { r: excelRow, c: 0 }, e: { r: excelRow, c: 3 } });
      return;
    }
    const levels = ['', '', '', ''];
    if (row.level >= 1 && row.level <= 4) {
      levels[row.level - 1] = row.subjectName || '';
    }
    const line: any[] = [...levels];
    for (let ci = 0; ci < data.columns.length; ci++) line.push(exportValue(row.values?.[ci]));
    line.push(exportValue(row.total));
    aoa.push(line);

    for (let lv = 0; lv < 4; lv++) {
      const span = row.spans?.[lv] || 0;
      if (span > 1 && levels[lv]) {
        merges.push({ s: { r: excelRow, c: lv }, e: { r: excelRow + span - 1, c: lv } });
      }
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = merges;
  ws['!cols'] = [
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    ...data.columns.map(() => ({ wch: 14 })),
    { wch: 14 }
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '部门收支分析');
  XLSX.writeFile(wb, `${data.rootDeptName}_部门收支分析表_${data.period}.xlsx`);
}

function exportValue(value?: number | null) {
  if (value === null || value === undefined || Math.abs(value) < 0.005) return '';
  return value;
}

onMounted(loadReport);
</script>

<style scoped>
.ledger-report-page {
  padding: 16px;
}
.query-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.page-title {
  font-size: 16px;
  font-weight: 600;
  margin-right: 8px;
}
.flex-1 {
  flex: 1;
}
.report-scroll {
  overflow: auto;
  min-height: 200px;
}
.report-sheet {
  min-width: 900px;
}
.report-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  padding: 12px 0 16px;
  color: #303133;
}
.report-title .period {
  margin-left: 12px;
  font-size: 14px;
  font-weight: 400;
  color: #606266;
}
.report-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  table-layout: fixed;
}
.report-table th,
.report-table td {
  border: 1px solid #cfd8e3;
  padding: 6px 8px;
  text-align: center;
  vertical-align: middle;
}
.report-table th {
  background: #eef3f9;
  font-weight: 600;
  color: #303133;
  position: sticky;
  top: 0;
  z-index: 2;
}
.report-table .subject-col {
  width: 120px;
}
.report-table .dept-col {
  width: 120px;
}
.report-table .total-col {
  width: 110px;
}
.subject-cell {
  text-align: left;
  font-weight: 500;
  background: #fbfcfe;
}
.subject-cell.level-1 {
  background: #f2f6fb;
  font-weight: 600;
}
.money-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.total-cell {
  font-weight: 600;
  background: #fafbfd;
}
.negative {
  color: #c0392b;
}
.total-row td {
  background: #f7f9fc;
  font-weight: 700;
}
.total-row .label-cell {
  text-align: left;
  letter-spacing: 1px;
}
.profit-row td {
  background: #eef7ee;
  color: #1f7a33;
}
.report-footer {
  margin-top: 8px;
  color: #909399;
  font-size: 12px;
  line-height: 20px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
</style>
