<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />

    <template v-if="detail">
      <!-- 调整单基础信息 -->
      <el-descriptions :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detail.adjustNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="调整类型">{{ adjustTypeLabel(detail.adjustType) }}</el-descriptions-item>
        <el-descriptions-item label="调整范围">
          <el-tag :type="detail.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
            {{ detail.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detail.adjustScope !== 'CONTRACT'" label="员工">{{ detail.employeeName || employeeName(detail.employeeId) || '—' }}</el-descriptions-item>
        <el-descriptions-item label="门店/组别">
          <span>{{ detail.deptName || '—' }}</span>
          <span v-if="detail.adjustType === 'TRANSFER' && detail.targetDeptName" class="transfer-arrow"> → {{ detail.targetDeptName }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="原始金额">{{ formatOrigin(detail.originalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="调整后金额">
          <span class="amount-red">{{ formatNumber(detail.targetAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="申请人">{{ detail.applicantName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detail.createTime || '—' }}</el-descriptions-item>
        <el-descriptions-item label="调整原因" :span="2">{{ detail.reason || '—' }}</el-descriptions-item>
      </el-descriptions>

      <!-- 合同信息 -->
      <div v-if="detail.contractNo" class="contract-block">
        <div class="block-title">合同信息</div>
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="合同号">
            <span class="contract-no">{{ detail.contractNo }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="签约时间">{{ detail.businessDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="明细条数">{{ detail.detailCount || 0 }} 条</el-descriptions-item>
          <el-descriptions-item label="应收合计">
            <span class="amount amount-expected">¥{{ formatNumber(detail.expectedTotal) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="实收合计">
            <span class="amount amount-real">¥{{ formatNumber(detail.receivedTotal) }}</span>
          </el-descriptions-item>
          <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
        </el-descriptions>
      </div>

      <!-- 受影响明细列表 -->
      <div v-if="detail.details && detail.details.length" class="detail-block">
        <div class="block-title">
          受影响明细
          <span class="block-subtitle">（{{ detail.adjustScope === 'CONTRACT' ? '合同级调整：调整金额按各明细占比分摊' : '明细级调整：仅调整单条明细' }}）</span>
        </div>
        <div class="detail-table-wrap">
          <el-table :data="detail.details" size="small" border stripe :row-class-name="rowClassName">
            <el-table-column type="index" label="序号" width="50" align="center" />
            <el-table-column label="门店/组别" prop="deptPath" min-width="140" show-overflow-tooltip />
            <el-table-column label="工号" prop="employeeCode" width="90" />
            <el-table-column label="姓名" prop="employeeName" width="90" />
            <el-table-column label="所属角色" min-width="110">
              <template #default="scope">
                <span>{{ scope.row.roleName || scope.row.roleType || '—' }}</span>
              </template>
            </el-table-column>
            <el-table-column label="角色占比" width="90" align="right">
              <template #default="scope">
                <span>{{ formatRatio(scope.row.shareRatio) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="应收金额" width="120" align="right">
              <template #default="scope">
                <span class="amount amount-expected">{{ formatNumber(scope.row.amount) }}</span>
              </template>
            </el-table-column>

            <el-table-column label="变动" width="100" align="right">
              <template #default="scope">
                <span :class="getAmountClass(scope.row.deltaAmount)">{{ formatAmount(scope.row.deltaAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="调整后" width="110" align="right">
              <template #default="scope">
                <span class="amount" :class="getAmountClass(scope.row.deltaAmount)">{{ formatNumber(scope.row.afterAmount) }}</span>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="80" align="center">
              <template #default="scope">
                <el-tag v-if="scope.row.target" type="danger" size="small" effect="dark">调整行</el-tag>
                <el-tag v-else type="info" size="small" effect="plain">参考行</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { performanceApi, type AdjustDetailVO } from '@/api/panjia/performance';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<AdjustDetailVO | null>(null);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const ADJUST_TYPE_MAP: Record<string, string> = {
  AMOUNT: '金额调整', VOID: '业绩冲销', TRANSFER: '部门划转',
};
const adjustTypeLabel = (t: string) => ADJUST_TYPE_MAP[t] ?? t ?? '—';

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交', APPROVED: '已审批', REJECTED: '已拒绝', CANCELLED: '已取消', EXECUTED: '已执行',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'warning', APPROVED: 'primary', REJECTED: 'danger', CANCELLED: 'info', EXECUTED: 'success',
  };
  return (map as any)[s] || 'info';
};

const formatNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return n.toFixed(2);
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const prefix = n > 0 ? '+' : '';
  return prefix + n.toFixed(2);
};
const getAmountClass = (val: number | undefined): string => {
  if (val === undefined || val === null) return '';
  if (val > 0) return 'amount-positive';
  if (val < 0) return 'amount-negative';
  return '';
};
const formatOrigin = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

/** 安全金额相加：避免浮点精度问题，返回两位小数的数字 */
const addAmounts = (a: number | string | undefined | null, b: number | string | undefined | null): number => {
  const na = Number(a ?? 0) || 0;
  const nb = Number(b ?? 0) || 0;
  return Math.round((na + nb) * 100) / 100;
};

const formatRatio = (val: number | undefined | null): string => {
  if (val === undefined || val === null) return '—';
  return (val * 100).toFixed(2) + '%';
};

const rowClassName = ({ row }: { row: any }) => {
  if (row.target) return 'target-row';
  return '';
};

onMounted(async () => {
  loading.value = true;
  try {
    const [res] = await Promise.all([performanceApi.getAdjustDetail(props.businessId), loadEmployees()]);
    detail.value = (res as any).data ?? null;
    if (!detail.value) loadError.value = '未找到该业绩调整单';
  } catch {
    loadError.value = '加载业绩调整单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.wf-detail-body {
  padding: 8px 4px;
}
.block-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin: 18px 0 10px;
  padding-left: 8px;
  border-left: 3px solid var(--el-color-primary);
  line-height: 1.2;
}
.block-subtitle {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
  margin-left: 6px;
}
.contract-no {
  color: var(--el-color-primary);
  font-weight: 500;
}
.amount-positive {
  color: var(--el-color-success);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-negative {
  color: var(--el-color-danger);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-red {
  color: #f56c6c;
  font-variant-numeric: tabular-nums;
}
.amount-expected {
  color: #909399;
  font-variant-numeric: tabular-nums;
}
.transfer-arrow {
  color: var(--el-color-primary);
}
.detail-table-wrap {
  max-height: 360px;
  overflow-y: auto;
  border: 1px solid #ebeef5;
  border-radius: 4px;
}
:deep(.target-row) {
  background-color: #fef0f0 !important;
}
:deep(.target-row:hover > td) {
  background-color: #fde2e2 !important;
}
:deep(.el-descriptions__body .el-descriptions__table .el-descriptions-item__label) {
  width: 100px;
}
</style>
