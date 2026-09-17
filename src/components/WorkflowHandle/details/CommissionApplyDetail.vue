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
        <el-descriptions-item label="归属门店">{{ detail.deptId ? deptName(detail.deptId) : '跨门店合作' }}</el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detail.itemCount ?? items.length }}</el-descriptions-item>
        <el-descriptions-item label="结佣合计">
          <span class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="应收合计">
          <span class="amount amount-expected">¥{{ formatAmount(detail.expectedAmount) }}</span>
          <el-tag v-if="detail.expectedAdjusted" type="warning" size="small" effect="plain" style="margin-left: 4px">已调整</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detail.currentNode ? nodeLabel(detail.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="实收对齐应收">{{ detail.aligned ? '已对齐' : '未对齐' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ applicantName(detail) }}</el-descriptions-item>
        <el-descriptions-item label="审批通过月">{{ detail.approvedMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDateTime(detail.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">每人结佣明细（{{ items.length }} 条）</div>
        <el-table :data="items" border size="small" max-height="420" class="detail-facts-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
          <el-table-column label="门店/组别" align="left" min-width="150" fixed="left">
            <template #default="scope">
              <span v-if="scope.row.deptPath" class="dept-wrap" :title="scope.row.deptPath">
                <span class="dept-store">{{ deptStore(scope.row.deptPath) }}</span>
                <span v-if="deptGroup(scope.row.deptPath)" class="dept-group"> · {{ deptGroup(scope.row.deptPath) }}</span>
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="工号" align="center" width="100">
            <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
          </el-table-column>
          <el-table-column label="姓名" align="center" min-width="110">
            <template #default="scope">
              <span class="person-name">{{ scope.row.employeeName || employeeName(scope.row.employeeId) || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <el-table-column label="新签业绩" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-expected">{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="结佣业绩" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" align="center" width="90">
            <template #default="scope">
              <el-tag :type="itemStatusTagType(scope.row.status)" size="small">{{ itemStatusLabel(scope.row.status) }}</el-tag>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该申请单暂无结佣明细" />
          </template>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { commissionApi, type CommissionApplication, type CommissionItemDetail } from '@/api/panjia/commission';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionApplication | null>(null);
const items = ref<CommissionItemDetail[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : Number(n).toFixed(2);
const formatDateTime = (val?: string | null): string => (val ? val.replace('T', ' ').substring(0, 19) : '—');

// 门店/组别 拆分展示（与实收详情同口径）
const deptParts = (path: string): string[] => path.split('-').map((s) => s.trim()).filter(Boolean);
const deptStore = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '—');
};
const deptGroup = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
};

const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '草稿', SUBMITTED: '审批中', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
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

const applicantName = (app: CommissionApplication) =>
  app.applicantName || (app.applicantId === 0 ? '系统自动' : employeeName(app.applicantId));

// 部门树（归属门店名称）——String key：19 位雪花 ID 超出 JS 安全整数，Number() 会丢精度
const deptMap = new Map<string, string>();
const buildDeptMap = (nodes: DeptNode[]) => {
  for (const n of nodes) {
    if (n.deptId != null) deptMap.set(String(n.deptId), n.deptName);
    if (n.children?.length) buildDeptMap(n.children);
  }
};
const deptName = (deptId: number | string | undefined) => {
  if (deptId == null) return '—';
  return deptMap.get(String(deptId)) ?? String(deptId);
};

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([
      loadEmployees(),
      employeeApi.deptTree().then((res: any) => buildDeptMap(res.data ?? [])),
    ]);
    // 雪花 ID 以字符串透传（19 位超出 JS 安全整数，Number() 会丢精度 →「申请单不存在」）
    const res: any = await commissionApi.getApplication(props.businessId);
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
.amount-expected {
  color: #909399;
}
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}
.dept-wrap {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  .dept-store {
    color: var(--el-text-color-primary);
    font-weight: 500;
  }
  .dept-group {
    color: var(--el-text-color-secondary);
  }
}
.person-name {
  font-weight: 500;
}
</style>
