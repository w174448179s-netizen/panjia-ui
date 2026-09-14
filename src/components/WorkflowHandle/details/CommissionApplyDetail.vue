<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="detail">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="申请单号">{{ detail.applyNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">{{ detail.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="签约时间">{{ formatDateTime(detail.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
        <el-descriptions-item label="归属门店">{{ detail.deptId ? deptName(detail.deptId) : '跨门店合作' }}</el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detail.itemCount ?? items.length }}</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="应收合计">¥{{ formatAmount(detail.expectedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detail.currentNode ? nodeLabel(detail.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="实收对齐应收">{{ detail.aligned ? '已对齐' : '未对齐' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ detail.applicantName || (detail.applicantId === 0 ? '系统自动' : employeeName(detail.applicantId)) }}</el-descriptions-item>
        <el-descriptions-item label="审批通过月">{{ detail.approvedMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail.createTime) }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">结佣明细（{{ items.length }} 条）</div>
        <el-table :data="items" border size="small" max-height="450" class="detail-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
          <el-table-column label="员工" min-width="120">
            <template #default="{ row }">{{ row.employeeName || employeeName(row.employeeId) }}</template>
          </el-table-column>
          <el-table-column label="业务类型" align="center" width="110">
            <template #default="{ row }">{{ row.bizType || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色类型" align="center" width="110">
            <template #default="{ row }">{{ row.roleType || '—' }}</template>
          </el-table-column>
          <el-table-column label="费用项" align="center" min-width="100">
            <template #default="{ row }">{{ row.feeItem || '—' }}</template>
          </el-table-column>
          <el-table-column label="金额" align="right" width="120">
            <template #default="{ row }">
              <span class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" width="90">
            <template #default="{ row }">
              <el-tag :type="itemStatusTagType(row.status)" size="small">{{ itemStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { commissionApi, type CommissionApplication, type CommissionItem } from '@/api/panjia/commission';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionApplication | null>(null);
const items = ref<CommissionItem[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDateTime = (val?: string | null): string => (val ? val.replace('T', ' ').substring(0, 19) : '—');

const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '草稿', SUBMITTED: '已提交', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    NONE: 'info', DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'primary', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};
const nodeLabel = (node?: string) => (node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—'));

const ITEM_STATUS_MAP: Record<string, string> = {
  DRAFT: '待提交', PENDING: '待审批', APPROVED: '已通过', REVERSED: '已冲销',
};
const itemStatusLabel = (s: string) => ITEM_STATUS_MAP[s] || s || '—';
const itemStatusTagType = (s: string) => {
  const map: Record<string, string> = { DRAFT: 'info', PENDING: 'warning', APPROVED: 'success', REVERSED: 'danger' };
  return (map as any)[s] || 'info';
};

// 部门树（归属门店名称）
const deptMap = new Map<number, string>();
const buildDeptMap = (nodes: DeptNode[]) => {
  for (const n of nodes) {
    if (n.deptId != null) deptMap.set(Number(n.deptId), n.deptName);
    if (n.children?.length) buildDeptMap(n.children);
  }
};
const deptName = (deptId: number | undefined) => {
  if (deptId == null) return '—';
  return deptMap.get(deptId) ?? String(deptId);
};

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadEmployees(),
      employeeApi.deptTree().then((res: any) => buildDeptMap(res.data ?? [])),
    ]);
    const res: any = await commissionApi.getApplication(Number(props.businessId));
    const data = res.data ?? {};
    detail.value = data.application ?? null;
    items.value = data.items ?? [];
    if (!detail.value) loadError.value = '未找到该结佣申请单';
  } catch {
    loadError.value = '加载结佣申请单详情失败';
  } finally {
    loading.value = false;
  }
});
</script>

<style lang="scss" scoped>
.amount {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.amount-red {
  color: #f56c6c;
}
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}
</style>
