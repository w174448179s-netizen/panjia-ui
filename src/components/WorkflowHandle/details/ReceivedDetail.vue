<template>
  <div v-loading="loading" class="wf-detail-body">
    <el-alert v-if="loadError" type="error" :title="loadError" :closable="false" show-icon />
    <template v-if="detail">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="审批单号">{{ detail.applyNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detail.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detail.status)" size="small">{{ statusLabel(detail.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">{{ detail.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detail.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detail.currentNode ? nodeLabel(detail.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ applicantName(detail.applicantName, detail.applicantId) }}</el-descriptions-item>
        <el-descriptions-item label="审批人">{{ detail.approverName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ formatDateTime(detail.approveTime) }}</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(detail.receivedAmount) }}</span>
          <span class="amount-gray" style="margin-left: 8px">折算后 ¥{{ formatAmount(detail.receivedConvertedAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="应收合计" :span="2">
          <template v-if="detail.expectedAdjusted">
            <span class="amount-strike">¥{{ formatAmount(detail.originalExpectedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-expected">¥{{ formatAmount(detail.expectedAmount) }}</span>
          </template>
          <template v-else>
            ¥{{ formatAmount(detail.expectedAmount) }}
          </template>
          <el-tag v-if="detail.expectedAdjusted" type="warning" size="small" effect="plain" style="margin-left: 6px">已调整</el-tag>
          <span class="converted-inline">折算后
            <template v-if="detail.expectedAdjusted">
              <span class="amount-strike">¥{{ formatAmount(detail.originalExpectedConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
            </template>
            <span class="amount amount-ink">¥{{ formatAmount(detail.expectedConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(detail.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">每人实收明细（{{ facts.length }} 条）</div>
        <el-table :data="facts" border max-height="420" class="detail-facts-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
          <el-table-column label="门店/组别" align="left" min-width="150">
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
              <span class="person-name">{{ scope.row.employeeName || employeeName(scope.row.employeeId) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="新签业绩" align="right" width="180">
            <template #default="scope">
              <template v-if="scope.row.expectedAdjusted">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalExpectedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
              </template>
              <span v-else class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="190">
            <template #default="scope">
              <template v-if="scope.row.expectedAdjusted">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该合同暂无实收明细" />
          </template>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { receivedApi, type ReceivedApply, type ReceivedFact } from '@/api/panjia/received';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{ businessId: string | number }>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<ReceivedApply | null>(null);
const facts = ref<ReceivedFact[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toFixed(2);
const formatDateTime = (val?: string | null): string => (val ? val.replace('T', ' ').substring(0, 19) : '—');
const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const pct = n * 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2)}%`;
};

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};
const nodeLabel = (node?: string) => (node === 'FINANCE' ? '财务审批' : node === 'DIRECTOR' ? '总监审批' : (node || '—'));

// 门店/组别拆分：deptPath 形如「集团-门店-组别」，门店取倒数第二段，组别取最后一段
const deptParts = (path: string): string[] => path.split('-').map((s) => s.trim()).filter(Boolean);
const deptStore = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 2] : (parts[0] ?? '—');
};
const deptGroup = (path: string): string => {
  const parts = deptParts(path);
  return parts.length >= 2 ? parts[parts.length - 1] : '';
};

/** 发起人姓名由后端翻译，直接展示；空值 = 系统自动发起（如导入归档自动建单） */
const applicantName = (name?: string | null, userId?: number | string | null) => {
  if (name) return name;
  if (userId === null || userId === undefined || String(userId).trim() === '') return '系统自动';
  return '—';
};

onMounted(async () => {
  loading.value = true;
  try {
    const [res] = await Promise.all([receivedApi.getDetail(props.businessId), loadEmployees()]);
    detail.value = (res as any).data?.apply ?? null;
    facts.value = (res as any).data?.facts ?? [];
    if (!detail.value) loadError.value = '未找到该实收审批单';
  } catch {
    loadError.value = '加载实收审批单详情失败';
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
/* 与「实收审批」详情界面同款金额样式：调整箭头 / 置灰 / 折算后内联段 */
.amount-ink {
  color: #303133;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.amount-expected {
  color: #909399;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-gray {
  color: #909399;
  font-weight: 400;
  font-size: 13px;
}
.amount-strike {
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #c0c4cc;
  text-decoration: line-through;
}
.amount-arrow {
  margin: 0 4px;
  color: #c0c4cc;
}
.converted-inline {
  margin-left: 10px;
  font-size: 13px;
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
.person-name {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.dept-wrap {
  line-height: 1.5;
  word-break: break-word;
}
.dept-store {
  font-weight: 600;
  color: var(--el-text-color-primary);
}
.dept-group {
  color: var(--el-text-color-secondary);
}
</style>
