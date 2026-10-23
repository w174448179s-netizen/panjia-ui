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
        <!-- 结佣合计（折算后同值） -->
        <el-descriptions-item label="结佣合计">
          <span class="amount amount-red">¥{{ formatAmount(detail.totalAmount) }}</span>
          <span class="converted-inline">
            折算后
            <span class="amount amount-ink">¥{{ formatAmount(totalConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <!-- 实收合计：客户实际到账金额（PERF_REAL 事实合计）；实收调整（含结佣联动）生效时展示「原值 → 调整后值」 -->
        <el-descriptions-item label="实收合计">
          <template v-if="isRealAmountAdjusted">
            <span class="amount-strike">¥{{ formatAmount(totalOriginalRealAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-received">¥{{ formatAmount(totalReceivedAmount) }}</span>
          </template>
          <span v-else class="amount amount-received">¥{{ formatAmount(totalReceivedAmount) }}</span>
        </el-descriptions-item>
        <!-- 新签合计（应收业绩）：有调整时展示「原值 → 调整后值」，折算后同形式 -->
        <el-descriptions-item label="新签合计">
          <template v-if="detailAdjusted">
            <span class="amount-strike">¥{{ formatAmount(detail.originalExpectedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-red">¥{{ formatAmount(totalExpectedAmount) }}</span>
          </template>
          <template v-else>
            <span class="amount amount-red">¥{{ formatAmount(totalExpectedAmount) }}</span>
          </template>
          <span class="converted-inline">
            折算后
            <span v-if="detailAdjusted" class="amount-strike">¥{{ formatAmount(totalOriginalExpectedConvertedAmount) }}</span>
            <span v-if="detailAdjusted" class="amount-arrow">→</span>
            <span class="amount amount-ink">¥{{ formatAmount(totalExpectedConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="签约/认购时间">{{ formatDateTime(detail.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="2">{{ detail.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">
          <span>每人结佣明细（{{ items.length }} 条）</span>
          <el-button v-if="detail && detail.status === 'LOCKED' && !props.periodClosed && !props.contractNo && !props.orderNo" type="danger" size="small" @click="onCancel">作废</el-button>
        </div>
        <el-table :data="items" border max-height="420" class="detail-facts-table" :row-class-name="itemRowClassName">
          <el-table-column label="序号" type="index" width="55" align="center" />
          <el-table-column label="期间" align="center" width="90" fixed="left">
            <template #default="scope">{{ scope.row.period || '—' }}</template>
          </el-table-column>
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
          <el-table-column label="姓名" align="center" min-width="120">
            <template #default="scope">
              <span class="person-name">{{ scope.row.employeeName || employeeName(scope.row.employeeId) }}</span>
              <el-tag v-if="scope.row.manualAdjust" type="success" size="small" effect="dark" style="margin-left: 4px">新增角色人</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <!-- 实收金额：同合同+员工+角色维度，正数行=累计到本行期间、负数退单行=当期负部；
               实收调整（含结佣联动）生效时展示「原值 → 调整后值」 -->
          <el-table-column label="实收金额" align="right" width="200">
            <template #default="scope">
              <template v-if="isRealAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalReceivedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-received">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
              </template>
              <span v-else class="amount amount-received">¥{{ formatAmount(scope.row.receivedAmount) }}</span>
            </template>
          </el-table-column>
          <!-- 结佣业绩 -->
          <el-table-column label="结佣业绩" align="right" width="220">
            <template #default="scope">
              <span class="amount" :class="scope.row.manualAdjust ? 'amount-positive' : 'amount-red'">¥{{ formatAmount(scope.row.amount) }}</span>
              <span v-if="scope.row.manualAdjust" class="new-member-delta">（新增）</span>
            </template>
          </el-table-column>

          <el-table-column label="折算后" align="right" width="190">
            <template #default="scope">
              <span class="amount amount-ink">¥{{ formatAmount(scope.row.convertedAmount) }}</span>
            </template>
          </el-table-column>
          <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值；新增角色人行原值 0、金额绿色 -->
          <el-table-column label="新签业绩" align="right" width="190">
            <template #default="scope">
              <div>
                <template v-if="isAdjusted(scope.row)">
                  <span class="amount-strike">¥{{ formatAmount(scope.row.originalExpectedAmount) }}</span>
                  <span class="amount-arrow">→</span>
                  <span class="amount" :class="scope.row.manualAdjust ? 'amount-positive' : ''">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
                  <span
                    v-if="scope.row.manualAdjust"
                    class="amount-positive"
                    style="font-size:12px; margin-left:2px"
                  >(+{{ formatAmount(scope.row.expectedAmount) }})</span>
                </template>
                <span v-else class="amount">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
              </div>
              <div v-if="scope.row.expectPeriod" class="text-muted text-xs">{{ scope.row.expectPeriod }}</div>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { commissionApi, type CommissionApplication, type CommissionItemDetail } from '@/api/panjia/commission';
import { useEmployeeMap } from '../useEmployeeMap';

const props = defineProps<{
  /** 结佣申请单 businessId（工作流查看/办理、结佣明细页详情） */
  businessId?: string | number;
  /** 未选期间时按合同跨期展示（8、9、10 月逐笔，含退单冲减单）；与 businessId 同时传时优先跨期 */
  contractNo?: string;
  orderNo?: string;
  /** 该期间是否已封账（封账后隐藏作废按钮） */
  periodClosed?: boolean;
}>();

const loading = ref(false);
const loadError = ref('');
const detail = ref<CommissionApplication | null>(null);
const items = ref<CommissionItemDetail[]>([]);

const { load: loadEmployees, name: employeeName } = useEmployeeMap();

/** 头部「折算后合计」：按明细逐行折算后金额求和，与表格同源，避免合计与明细对不上 */
const totalConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.convertedAmount), 0));
const totalExpectedConvertedAmount = computed(() => items.value.reduce((s, it) => s + num(it.expectedConvertedAmount), 0));
/** 头部「新签合计」：同样按明细行 expectedAmount 求和——退单 TD 冲减单的申请单快照为 0，
 *  若用快照会出现「新签合计 0 但折算后 -420.34」的自相矛盾 */
const totalExpectedAmount = computed(() => items.value.reduce((s, it) => s + num(it.expectedAmount), 0));
/**
 * 实收金额是「同合同+员工+角色+期间」维度的聚合值（正数行=累计到本行期间，负数退单行=当期负部），
 * 同人同角色跨期有多条结佣明细时（如正常期 + 退单冲减期）逐行求和会重复计数，
 * 故合计必须先按（员工+角色+期间）去重。
 */
const distinctRealRows = computed(() => {
  const map = new Map<string, CommissionItemDetail>();
  for (const it of items.value) {
    const key = `${it.employeeCode ?? it.employeeId ?? ''}|${it.roleType ?? it.roleName ?? ''}|${it.period ?? ''}`;
    if (!map.has(key)) map.set(key, it);
  }
  return [...map.values()];
});
/** 实收合计：按（员工+角色+期间）去重后求和（同表格列口径，但同组只计一次） */
const totalReceivedAmount = computed(() => distinctRealRows.value.reduce((s, it) => s + num(it.receivedAmount), 0));
/**
 * 实收合计「原值 → 调整后值」：实收调整 / 结佣联动 supersede rd 事实后，
 * 逐行 originalReceivedAmount（链最早值，未调整行=receivedAmount）按（员工+角色）去重求和为原值合计。
 * 命名区分应收业绩口径的合计。
 */
const totalOriginalRealAmount = computed(() =>
  distinctRealRows.value.reduce((s, it) => s + num(it.originalReceivedAmount ?? it.receivedAmount), 0));
const isRealAmountAdjusted = computed(() =>
  items.value.some((it) => it.originalReceivedAmount != null && num(it.originalReceivedAmount) !== num(it.receivedAmount)));
/** 行级实收金额是否按「原值 → 调整后值」展示：原值与当前值不等即为已调整 */
const isRealAdjusted = (
  row: { receivedAmount?: number | string | null; originalReceivedAmount?: number | string | null } | null | undefined,
): boolean => !!row && row.originalReceivedAmount != null && num(row.receivedAmount) !== num(row.originalReceivedAmount);
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
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
/** SUBMITTED 全程「审批中」，与结佣明细列表、工作流系统页（字典 waiting）保持一致 */
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
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

/** 新增角色人行高亮（已生效 MANUAL-ADJ/CADJ）：浅绿底，一眼可辨 */
const itemRowClassName = ({ row }: { row: any }): string =>
  row.manualAdjust ? 'new-member-row' : '';

const emit = defineEmits(['cancelled']);

/** 作废已锁定申请单：冲销全部明细，不再计入工资，可重新发起 */
const onCancel = async () => {
  if (!detail.value) return;
  try {
    await ElMessageBox.confirm(
      `确认作废已锁定申请单「${detail.value.applyNo}」？\n作废后该单全部结佣明细将冲销，不再计入工资；业绩事实释放，可重新发起并按发起日生成当月结佣记录。`,
      '提示',
      { type: 'warning' },
    );
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(detail.value.id);
    ElMessage.success('已作废');
    emit('cancelled');
  } catch { /* 拦截器处理 */ }
};

/** 加载申请单详情 + 每人明细（未选期间时按合同跨期合并，明细逐笔带期间） */
const loadDetail = async () => {
  const crossPeriod = !!(props.contractNo || props.orderNo);
  if (!crossPeriod && (props.businessId == null || props.businessId === '')) return;
  loading.value = true;
  try {
    const [res] = await Promise.all([
      crossPeriod
        ? commissionApi.getContractDetail(props.contractNo, props.orderNo)
        : commissionApi.getApplication(props.businessId as string | number),
      loadEmployees(),
    ]);
    const data = (res as any).data ?? {};
    detail.value = data.application ?? null;
    items.value = data.items ?? [];
    if (!detail.value) loadError.value = '未找到该结佣审批单';
  } catch {
    loadError.value = '加载结佣审批单详情失败';
  } finally {
    loading.value = false;
  }
};

onMounted(loadDetail);
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
.amount-positive { color: #67c23a; font-weight: 600; }
/* 实收金额：客户实际到账，醒目橙色（与列表页「实收金额」列同色系） */
.amount-received { color: #e6a23c; }
.detail-table-wrap {
  margin-top: 16px;
}
.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
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
/* 新增角色人行：浅绿底高亮（与调整详情「新增角色人」标签同色系） */
:deep(.new-member-row) {
  background-color: #f0f9eb !important;
}
:deep(.new-member-row:hover > td) {
  background-color: #e1f3d8 !important;
}
.new-member-delta {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 600;
  color: #67c23a;
}
</style>
