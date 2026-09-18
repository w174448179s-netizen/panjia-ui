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
        <el-descriptions-item label="结佣合计">
          <span class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
          <span class="amount amount-gray" style="margin-left: 8px">折算后 ¥{{ formatAmount(totalConvertedAmount) }}</span>
        </el-descriptions-item>
        <!-- 新签合计（应收业绩）：有调整时展示「原值 → 调整后值」，折算后同形式 -->
        <el-descriptions-item label="新签合计">
          <template v-if="detailAdjusted">
            <span class="amount-strike">¥{{ formatAmount(detail.originalExpectedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-red">¥{{ formatAmount(detail.expectedAmount) }}</span>
          </template>
          <template v-else>
            <span class="amount amount-red">¥{{ formatAmount(detail.expectedAmount) }}</span>
          </template>
          <span class="converted-inline">
            折算后
            <span v-if="detailAdjusted" class="amount-strike">¥{{ formatAmount(totalOriginalExpectedConvertedAmount) }}</span>
            <span v-if="detailAdjusted" class="amount-arrow">→</span>
            <span class="amount amount-ink">¥{{ formatAmount(totalExpectedConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <!-- 结佣特有：发起时实收与应收是否一致（差额单据为「未对齐」） -->
        <el-descriptions-item label="是否对齐">
          <el-tag v-if="detail.aligned != null" :type="detail.aligned ? 'success' : 'warning'" size="small" effect="plain">
            {{ detail.aligned ? '已对齐' : '未对齐' }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(detail.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">每人结佣明细（{{ items.length }} 条）</div>
        <el-table :data="items" border max-height="420" class="detail-facts-table">
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
          <el-table-column label="结佣业绩" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值 -->
          <el-table-column label="新签业绩" align="right" width="190">
            <template #default="scope">
              <template v-if="isAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalExpectedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
              </template>
              <span v-else class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="180">
            <template #default="scope">
              <template v-if="isAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.expectedConvertedAmount) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该申请单暂无结佣明细" />
          </template>
        </el-table>
      </div>
    </template>
    <!-- 未发起模式：无审批单，界面骨架与审批详情一致，明细为该合同新签业绩构成 -->
    <template v-else-if="summary">
      <el-descriptions :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="期间">{{ summary.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag type="info" size="small">未发起</el-tag></el-descriptions-item>
        <el-descriptions-item label="是否对齐">—</el-descriptions-item>
        <el-descriptions-item label="合同号">{{ summary.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ summary.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">—</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(summary.amount) }}</span>
          <span class="converted-inline">折算后 <span class="amount amount-ink">¥{{ formatAmount(summary.convertedAmount) }}</span></span>
        </el-descriptions-item>
        <el-descriptions-item label="新签合计" :span="2">
          <span class="amount amount-red">¥{{ formatAmount(summary.expectedAmount) }}</span>
          <span class="converted-inline">折算后 <span class="amount amount-ink">¥{{ formatAmount(summary.expectedConvertedAmount) }}</span></span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(summary.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ summary.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>
      <div class="detail-table-wrap">
        <div class="detail-table-title">每人业绩明细（{{ perfRows.length }} 条）</div>
        <el-table :data="perfRows" border max-height="420" class="detail-facts-table">
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
            <template #default="scope"><span class="person-name">{{ scope.row.employeeName || '—' }}</span></template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedAmount != null" class="amount amount-red">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收折算后" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedConvertedAmount != null" class="amount amount-ink">¥{{ formatAmount(scope.row.receivedConvertedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="新签业绩" align="right" width="190">
            <template #default="scope">
              <template v-if="isPerfAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount">¥{{ formatAmount(scope.row.amount) }}</span>
              </template>
              <span v-else class="amount">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="180">
            <template #default="scope">
              <template v-if="isPerfAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalConvertedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
              </template>
              <span v-else class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实收业绩" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedAmount != null" class="amount amount-red">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="实收折算后" align="right" width="140">
            <template #default="scope">
              <span v-if="scope.row.receivedConvertedAmount != null" class="amount amount-ink">¥{{ formatAmount(scope.row.receivedConvertedAmount) }}</span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该合同暂无新签业绩明细" />
          </template>
        </el-table>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { commissionApi, type CommissionApplication, type CommissionItemDetail, type CommissionContractVO } from '@/api/panjia/commission';
import { performanceApi, type PerformanceManageRow } from '@/api/panjia/performance';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{
  /** 已发起模式：结佣申请单 businessId（工作流查看/办理、结佣明细页已发起行） */
  businessId?: string | number;
  /** 未发起模式：合同行摘要。无审批单，按同款界面骨架展示新签业绩构成 */
  summary?: CommissionContractVO | null;
  /** 未发起模式的查询号（合同号，一手房等无合同号时传订单号） */
  bizNo?: string;
}>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionApplication | null>(null);
const items = ref<CommissionItemDetail[]>([]);
/** 未发起模式：合同新签业绩构成明细（listManageContractDetails，factType=PERF_EXPECT） */
const perfRows = ref<PerformanceManageRow[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

/** 头部「折算后合计」：按明细逐行折算后金额求和，与表格同源，避免合计与明细对不上 */
const totalConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.convertedAmount), 0));
const totalExpectedConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.expectedConvertedAmount), 0));
/** 调整前应收的折算后合计：与明细列同源，供「应收合计」展示「原折算 → 调整后折算」 */
const totalOriginalExpectedConvertedAmount = computed(() =>
  items.value.reduce((s, it) => s + num(it.originalConvertedAmount), 0));

/**
 * 是否按「原值 → 调整后值」展示：需后端 expectedAdjusted 标记与调整前值同时成立。
 * 两者缺一（如差额行无关联业绩事实）就退回单值展示，避免出现「0.00 → 12000.00」这类误导。
 * 详情头部（CommissionApplication）与每人明细行（CommissionItemDetail）共用同一判定。
 */
const isAdjusted = (
  row: { expectedAdjusted?: boolean | null; originalExpectedAmount?: number | string | null } | null | undefined,
): boolean => !!row?.expectedAdjusted && row.originalExpectedAmount != null;
const detailAdjusted = computed(() => isAdjusted(detail.value));

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
  NONE: '未发起', DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
/** SUBMITTED 全程「审批中」，与结佣明细列表、工作流系统页（字典 waiting）保持一致 */
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    NONE: 'info', DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};
const nodeLabel = (node?: string) => (node === 'FINANCE' ? '财务审批' : node === 'DIRECTOR' ? '总监审批' : (node || '—'));

// 门店/组别拆分：deptPath 形如「集团-门店-组别」，门店取倒数第二段，组别取最后一段（与实收详情同口径）
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
  if (userId === null || userId === undefined || String(userId).trim() === '' || Number(userId) === 0) return '系统自动';
  return '—';
};

/** 未发起模式业绩行：金额与调整前不一致即视为已调整（与合同业绩明细页同口径） */
const isPerfAdjusted = (row: { amount?: number | string | null; originalAmount?: number | string | null }): boolean =>
  num(row.amount) !== num(row.originalAmount);

/** 业绩行合并 key：员工 + 所属角色（实收口径与应收口径的行按此对应） */
const perfKey = (row: { employeeId?: string | null; roleType?: string | null; roleName?: string | null }): string =>
  `${row.employeeId}|${row.roleType || row.roleName || ''}`;

onMounted(async () => {
  // 未发起模式：无审批单，按合同/订单号拉新签业绩构成（PERF_EXPECT），
  // 并发拉实收口径（PERF_REAL）按员工+角色合并，补充每人实收金额
  if (props.businessId == null || props.businessId === '') {
    if (props.summary && props.bizNo) {
      loading.value = true;
      try {
        const period = String(props.summary.period || '');
        const nos = String(props.bizNo);
        const [expectRes, realRes] = await Promise.all([
          performanceApi.listManageContractDetails({ period, factType: 'PERF_EXPECT', contractNos: nos }),
          performanceApi.listManageContractDetails({ period, factType: 'PERF_REAL', contractNos: nos }),
        ]);
        // 实收按「员工+角色」聚合（同 key 多条时累加）
        const realMap = new Map<string, { amount: number; converted: number }>();
        for (const r of (realRes.data ?? []) as PerformanceManageRow[]) {
          const key = perfKey(r);
          const prev = realMap.get(key);
          realMap.set(key, {
            amount: num(prev?.amount) + num(r.amount),
            converted: num(prev?.converted) + num(r.convertedAmount),
          });
        }
        perfRows.value = ((expectRes.data ?? []) as PerformanceManageRow[]).map((row) => {
          const real = realMap.get(perfKey(row));
          return { ...row, receivedAmount: real ? real.amount : null, receivedConvertedAmount: real ? real.converted : null };
        });
      } catch {
        loadError.value = '加载业绩明细失败';
      } finally {
        loading.value = false;
      }
    }
    return;
  }
  loading.value = true;
  try {
    const [res] = await Promise.all([commissionApi.getApplication(props.businessId), loadEmployees()]);
    const data = (res as any).data ?? {};
    detail.value = data.application ?? null;
    items.value = data.items ?? [];
    if (!detail.value) loadError.value = '未找到该结佣审批单';
  } catch {
    loadError.value = '加载结佣审批单详情失败';
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
.amount-ink {
  color: #303133;
}
.amount-gray {
  color: #909399;
  font-weight: 400;
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
/* ============ 「原值 → 调整后值」展示（头部应收合计 / 每人明细两列共用） ============
   有调整时：被调整掉的原值置灰加删除线，箭头连接调整后值；未调整时只渲染一个值。
   口径与「合同业绩明细」页 / 实收明细页保持一致。 */
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
/* 应收合计右侧的折算后内联段：灰字标签 + 值，与左侧应收合计同一格并排 */
.converted-inline {
  margin-left: 10px;
  font-size: 13px;
  color: #909399;
}
</style>
