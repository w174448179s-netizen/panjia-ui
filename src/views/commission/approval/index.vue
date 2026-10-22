<template>
  <div class="commission-apply-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 筛选条件 -->
      <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="期间">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            clearable
            style="width: 150px"
            @change="handleScopeChange"
          />
        </el-form-item>
        <el-form-item label="门店/组别">
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            width="210px"
            @change="handleDeptChange"
          />
        </el-form-item>
        <el-form-item v-if="!isAgent" label="员工" prop="employeeId">
          <EmployeeSelect
            v-model="queryParams.employeeId"
            :dept-id="queryParams.deptId"
            width="230px"
            placeholder="姓名/工号搜索"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="类型" prop="bizType">
          <el-select
            v-model="queryParams.bizType"
            placeholder="全部类型"
            clearable
            filterable
            style="width: 160px"
            @change="handleQuery"
          >
            <el-option v-for="t in bizTypeOptions" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键字">
          <el-input
            v-model="queryParams.keyword"
            placeholder="合同号/订单号/房源"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <div class="summary-left">
          <span class="summary-text">
            共 <b>{{ summary.contractCount }}</b> 个合同 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            <b>{{ summary.detailCount }}</b> 条明细
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">
            结佣合计：<b>{{ formatAmount(summary.totalAmount) }}</b>
            <span class="summary-sub">（折算后 {{ formatAmount(summary.totalConvertedAmount) }}）</span>
            <span class="summary-sep">｜</span>
            实收合计：<b>{{ formatAmount(summary.totalReceivedAmount) }}</b>
            <span class="summary-sep">｜</span>
            新签合计：<b>{{ formatAmount(summary.totalExpectedAmount) }}</b>
            <span class="summary-sub">（折算后 {{ formatAmount(summary.totalExpectedConvertedAmount) }}）</span>
          </span>
          <el-button v-if="checkPermi(['commission:apply:batch'])" type="success" plain icon="DocumentChecked" @click="openBatchApprove">批量审批{{ selectedRows.length > 0 ? `(${selectedRows.length})` : '' }}</el-button>
        </div>
      </div>

      <!-- 合同维度表格 -->
      <el-table border class="data-table" :data="contractList" :empty-text="emptyText" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="50" :selectable="(row: CommissionContractVO) => row.status === 'SUBMITTED'" />
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <!-- 点击打开结佣申请详情 -->
            <el-button type="primary" link class="contract-link" @click="viewDetail(row as CommissionContractVO)">
              {{ contractOrOrderNo(row as CommissionContractVO) }}
            </el-button>
          </template>
        </el-table-column>
        <!-- 实收金额：实收调整（含结佣联动）生效时展示「原值 → 调整后值」 -->
        <el-table-column label="实收金额" align="right" width="210">
          <template #default="{ row }">
            <template v-if="row.receivedAmountAdjusted && row.originalReceivedAmount != null">
              <span class="amount-strike">¥{{ formatAmount(row.originalReceivedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-received">¥{{ formatAmount(row.receivedAmount) }}</span>
            </template>
            <span v-else class="amount amount-received">¥{{ formatAmount(row.receivedAmount) }}</span>
          </template>
        </el-table-column>
        <!-- 结佣业绩 -->
        <el-table-column label="结佣业绩" align="right" width="220" fixed="left">
          <template #default="{ row }">
            <el-tooltip
              v-if="num(row.amount) === 0"
              content="新签业绩缺失，请先导入或补录该合同新签"
              placement="top"
            >
              <span class="amount amount-zero">¥0.00</span>
            </el-tooltip>
            <span v-else class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>

        <el-table-column label="折算后" align="right" width="190">
          <template #default="{ row }">
            <span class="amount amount-ink">¥{{ formatAmount(row.convertedAmount) }}</span>
          </template>
        </el-table-column>
        <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值（同实收明细）；含增加角色人时打标 -->
        <el-table-column label="新签业绩" align="right" width="200">
          <template #default="{ row }">
            <template v-if="isAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalExpectedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-expected">¥{{ formatAmount(row.expectedAmount) }}</span>
            </template>
            <span v-else class="amount amount-expected">¥{{ formatAmount(row.expectedAmount) }}</span>
            <div v-if="row.hasAddMember" class="cell-sub">
              <el-tag type="warning" size="small" effect="plain">新增角色人</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="190">
          <template #default="{ row }">
            <template v-if="isAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalExpectedConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-ink">¥{{ formatAmount(row.expectedConvertedAmount) }}</span>
            </template>
            <span v-else class="amount amount-ink">¥{{ formatAmount(row.expectedConvertedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="当前节点" align="center" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.currentNode" type="warning" size="small">{{ nodeLabel(row.currentNode) }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" align="center" width="100">
          <template #default="{ row }">{{ row.bizType || '—' }}</template>
        </el-table-column>
        <el-table-column label="房源地址" align="left" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
        </el-table-column>
        <el-table-column label="签约/认购时间" align="center" width="170">
          <template #default="{ row }">{{ formatDateTime(row.businessDate) }}</template>
        </el-table-column>
        <el-table-column label="涉及人数" align="center" width="80">
          <template #default="{ row }">{{ row.employeeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="明细条数" align="center" width="80">
          <template #default="{ row }">{{ row.detailCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="120">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row as CommissionContractVO) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ row.applicantName || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="300" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row as CommissionContractVO)">详情</el-button>
              <el-button v-if="row.status === 'SUBMITTED' && row.applicationId && checkPermi(['workflow:task:edit'])" link type="success" :loading="approvalLoading" @click="onBizApprove(row.applicationId)">审批</el-button>
              <!-- 可作废：审批中 / 已驳回 / 已锁定；封账期间不可作废 -->
              <el-button v-if="['SUBMITTED', 'REJECTED', 'LOCKED'].includes(row.status) && canCancel(row as CommissionContractVO) && !row.periodClosed" link type="info" @click="cancel(row as CommissionContractVO)">作废</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="该条件下暂无可结佣合同" />
        </template>
      </el-table>

      <!-- 分页 -->
      <div class="pager-bar">
        <el-pagination
          background
          layout="total, sizes, prev, pager, next, jumper"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          @size-change="handleQuery"
          @current-change="getList"
        />
      </div>
    </el-card>

    <!-- 详情弹窗：结佣申请详情 -->
    <el-dialog v-model="showDetail" title="结佣详情" width="1100px" top="5vh" append-to-body destroy-on-close>
      <CommissionApplyDetail
        v-if="showDetail"
        :business-id="detailApplicationId ?? undefined"
        :period-closed="detailPeriodClosed"
        @cancelled="onDetailCancelled"
      />
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 批量审批弹窗：勾选/录入合同号 → 等待处理完成 → 展示结果 -->
    <el-dialog v-model="showBatchApprove" title="批量审批" width="600px" @close="resetBatchApproveDialog">
      <div v-if="batchApproveLoading" class="batch-waiting">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="waiting-text">正在批量审批，请耐心等待...</p>
        <p class="waiting-sub">共 {{ batchWaitingCount }} 张单据，逐单处理中</p>
      </div>

      <div v-else-if="batchApproveResult" class="batch-result">
        <el-result :icon="batchApproveResult.failed > 0 ? 'warning' : 'success'" :title="batchApproveSummary">
        </el-result>
        <div class="result-detail">
          <div v-if="batchApproveResult.successContracts.length" class="result-section">
            <div class="result-label success">成功（{{ batchApproveResult.success }}）</div>
            <div class="contract-list">{{ batchApproveResult.successContracts.join('、') }}</div>
          </div>
          <div v-if="batchApproveResult.skippedContracts.length" class="result-section">
            <div class="result-label skip">跳过（{{ batchApproveResult.skipped }}）</div>
            <div class="contract-list">{{ batchApproveResult.skippedContracts.join('、') }}</div>
          </div>
          <div v-if="batchApproveResult.failedContracts.length" class="result-section">
            <div class="result-label fail">失败（{{ batchApproveResult.failed }}）</div>
            <div class="contract-list">{{ batchApproveResult.failedContracts.join('、') }}</div>
          </div>
        </div>
      </div>

      <!-- 确认视图：勾选单据 / 录入合同号 两种模式 -->
      <template v-else>
        <div class="batch-confirm">
          <el-radio-group v-model="batchMode" class="batch-mode-switch">
            <el-radio-button value="select">勾选单据{{ selectedRows.length > 0 ? `（${selectedRows.length}）` : '' }}</el-radio-button>
            <el-radio-button value="manual">录入合同号</el-radio-button>
          </el-radio-group>

          <!-- 勾选模式 -->
          <template v-if="batchMode === 'select'">
            <p class="confirm-text">将批量审批以下 <b>{{ selectedRows.length }}</b> 张待审批单据：</p>
            <el-table :data="selectedRows" border max-height="320" size="small">
              <el-table-column label="合同号/订单号" align="center" min-width="160" show-overflow-tooltip>
                <template #default="{ row }">{{ contractOrOrderNo(row as CommissionContractVO) }}</template>
              </el-table-column>
              <el-table-column label="期间" align="center" width="90" prop="period" />
              <el-table-column label="结佣业绩" align="right" width="120">
                <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
              </el-table-column>
            </el-table>
            <el-empty v-if="selectedRows.length === 0" description="请先在列表勾选待审批单据，或切换到「录入合同号」" :image-size="60" />
          </template>

          <!-- 录入模式 -->
          <el-form v-else label-width="80px">
            <el-form-item label="结佣期间" required>
              <el-date-picker
                v-model="manualForm.period"
                type="month"
                value-format="YYYY-MM"
                placeholder="请选择月份"
                style="width: 100%"
              />
            </el-form-item>
            <el-form-item label="合同号" required>
              <el-input
                v-model="manualForm.contractNosText"
                type="textarea"
                :rows="8"
                placeholder="每行一个合同号/订单号（以列表展示的编号为准），或用逗号/空格分隔"
              />
            </el-form-item>
          </el-form>
          <div class="batch-hint">录入合同号将自动审批该合同下全部订单的结佣单；录入订单号仅审批该订单。将逐单审批当前节点，非您审批范围内的单据会跳过。</div>
        </div>
      </template>

      <template #footer>
        <el-button v-if="!batchApproveResult && !batchApproveLoading" @click="showBatchApprove = false">取消</el-button>
        <el-button v-if="!batchApproveResult && !batchApproveLoading" type="primary" @click="doBatchApprove">开始审批</el-button>
        <el-button v-if="batchApproveResult" type="primary" @click="closeBatchApprove">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 业务明细直接审批弹窗（与「我的待办」共用同一 WorkflowHandle 组件） -->
    <WorkflowHandle ref="workflowHandleRef" @handled="getList" />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import { commissionApi, type CommissionContractVO, type BatchResultDTO } from '@/api/panjia/commission';
import { performanceApi } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { useDeptScope } from '@/hooks/useDeptScope';
import { checkPermi } from '@/utils/permission';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { useUserStore } from '@/store/modules/user';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';
import CommissionApplyDetail from '@/components/WorkflowHandle/details/CommissionApplyDetail.vue';

const route = useRoute();
const userStore = useUserStore();
/** 经纪人：本人口径（后端强制按本人 employeeId 过滤），不展示员工筛选 */
const isAgent = computed(() => userStore.roles.includes('agent'));

/** 是否可以作废：超管全部可操作；其他用户仅本人发起的单据可操作 */
const canCancel = (row: CommissionContractVO): boolean => {
  if (userStore.roles.includes('admin') || userStore.roles.includes('superadmin')) return true;
  return String(row.applicantId) === String(userStore.userId);
};

/** 业务明细直接审批：通过 businessId 查当前用户可办理任务，复用 WorkflowHandle 弹窗 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandle>>();
const { loading: approvalLoading, handleBizApproval } = useBizApproval(
  async (businessId) => {
    const res: any = await commissionApi.getInstanceId(businessId);
    return res.data?.instanceId ?? null;
  },
);
const onBizApprove = (businessId: string | number) =>
  handleBizApproval(businessId, (task) => workflowHandleRef.value?.open(task));

const loading = ref(false);
const contractList = ref<CommissionContractVO[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '',
  deptId: undefined as string | undefined,
  employeeId: undefined as string | undefined,
  bizType: undefined as string | undefined,
  status: '' as string,
  keyword: '' as string,
});

// 汇总统计：后端按过滤后全集返回（跨页全局，不随分页变化）
const emptySummary = () => ({ contractCount: 0, employeeCount: 0, detailCount: 0, totalAmount: 0, totalConvertedAmount: 0, totalExpectedAmount: 0, totalExpectedConvertedAmount: 0, totalReceivedAmount: 0 });
const summary = ref(emptySummary());

// 数字安全转换
const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

// 金额格式化
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * 是否按「原值 → 调整后值」展示：需后端 expectedAdjusted 标记与调整前快照同时成立。
 * 两者缺一就退回单值展示，避免出现「0.00 → 12000.00」这类误导（同实收明细口径）。
 */
const isAdjusted = (
  row: { expectedAdjusted?: boolean | null; originalExpectedAmount?: number | string | null } | null | undefined,
): boolean => !!row?.expectedAdjusted && row.originalExpectedAmount != null;

// 合同号/订单号合并展示：一手房、房产金融、家装荐客以订单号为准，其它以合同号为准（空则回退）
const contractOrOrderNo = (row: CommissionContractVO): string =>
  resolveBizNo(row.bizType, row.contractNo, row.orderNo) || '—';

// 部门口径（全系统统一：所有用户查本部门及以下；详情弹窗的归属门店翻译在 CommissionApplyDetail 内自处理）
const { deptLocked, defaultDeptId } = useDeptScope();

// 类型下拉选项：随期间/部门数据范围实时变化（与列表同权限口径）
const bizTypeOptions = ref<string[]>([]);
const loadBizTypes = async () => {
  try {
    const res = await performanceApi.listSearchBizTypes({
      period: queryParams.period,
      deptId: isAgent.value ? undefined : queryParams.deptId,
      employeeId: isAgent.value ? undefined : queryParams.employeeId,
    });
    bizTypeOptions.value = res.data ?? [];
  } catch { bizTypeOptions.value = []; }
};

/** 期间变化：先按新范围刷新类型选项再查询 */
const handleScopeChange = () => loadBizTypes().then(handleQuery);
/** 门店/组别变化：原选中员工可能不在新部门范围内，清空员工筛选后再按新范围查询 */
const handleDeptChange = () => {
  queryParams.employeeId = undefined;
  handleScopeChange();
};

// 状态映射。SUBMITTED 全程统一叫「审批中」（发起后直到审批结束），
// 与工作流系统页（我发起的/我的已办，全局字典 waiting）保持同一叫法——
// 系统页状态是粗粒度运行中，无法按节点细分，两段式会导致页面间不一致
const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿', SUBMITTED: '审批中', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusLabel = (row: CommissionContractVO) => STATUS_MAP[row.status] || row.status || '—';
// 筛选下拉只列实际会出现在列表中的状态：
// APPROVED（审批通过直接落 LOCKED，不经过 APPROVED）不会出现；
// DRAFT 仅历史遗留（自动建单已取消，新发起即提交审批，不再产生草稿）
const HIDDEN_FILTER_STATUS = ['APPROVED'];
const statusOptions = Object.entries(STATUS_MAP)
  .filter(([value]) => !HIDDEN_FILTER_STATUS.includes(value))
  .map(([value, label]) => ({ value, label }));
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'primary', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.listContracts({
      // 期间留空即跨全部期间查询（仅录合同号也能查到任意期间的单据）
      period: queryParams.period || undefined,
      deptId: queryParams.deptId || undefined,
      employeeId: queryParams.employeeId || undefined,
      bizType: queryParams.bizType || undefined,
      status: queryParams.status || undefined,
      keyword: queryParams.keyword || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = res.data;
    contractList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
    summary.value = {
      contractCount: num(data?.summary?.contractCount) || total.value,
      employeeCount: num(data?.summary?.employeeCount),
      detailCount: num(data?.summary?.detailCount),
      totalAmount: num(data?.summary?.totalAmount),
      totalConvertedAmount: num(data?.summary?.totalConvertedAmount),
      totalExpectedAmount: num(data?.summary?.totalExpectedAmount),
      totalExpectedConvertedAmount: num(data?.summary?.totalExpectedConvertedAmount),
      totalReceivedAmount: num(data?.summary?.totalReceivedAmount),
    };
  } catch {
    contractList.value = [];
    total.value = 0;
    summary.value = emptySummary();
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

/** 空态提示 */
const emptyText = computed(() => '该条件下暂无可结佣合同');

const resetQuery = () => {
  Object.assign(queryParams, {
    // 受限角色重置回本部门默认值，不能清空为"全部"；期间保持当前选择不清空
    deptId: defaultDeptId(), employeeId: undefined, bizType: undefined, status: '', keyword: '', pageNum: 1,
  });
  loadBizTypes().then(getList);
};

// 审批节点中文名
const nodeLabel = (node?: string) => node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—');

// 批量审批：勾选/录入合同号 → 确认 → 等待 → 展示结果
const showBatchApprove = ref(false);
const batchApproveLoading = ref(false);
const batchApproveResult = ref<BatchResultDTO | null>(null);
const selectedRows = ref<CommissionContractVO[]>([]);

const onSelectionChange = (rows: CommissionContractVO[]) => {
  selectedRows.value = rows;
};

/** 批量方式：select=勾选列表单据；manual=手工录入合同号/订单号 */
const batchMode = ref<'select' | 'manual'>('select');
/** 录入模式表单 */
const manualForm = reactive({
  period: '' as string,
  contractNosText: '',
});
/** 等待视图展示的单据数（勾选=勾选数，录入=解析后的号码数） */
const batchWaitingCount = ref(0);

const openBatchApprove = () => {
  batchMode.value = selectedRows.value.length > 0 ? 'select' : 'manual';
  if (!manualForm.period) manualForm.period = queryParams.period || '';
  showBatchApprove.value = true;
};

const batchApproveSummary = computed(() => {
  const r = batchApproveResult.value;
  if (!r) return '';
  return `成功 ${r.success} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`;
});
const resetBatchApproveDialog = () => {
  batchApproveLoading.value = false;
  batchApproveResult.value = null;
  batchWaitingCount.value = 0;
};
const closeBatchApprove = () => {
  showBatchApprove.value = false;
  resetBatchApproveDialog();
  getList();
};
const doBatchApprove = async () => {
  let period = '';
  let contractNos: string[] = [];
  if (batchMode.value === 'select') {
    if (selectedRows.value.length === 0) {
      ElMessage.warning('请至少勾选一张待审批单据');
      return;
    }
    // 跨期间校验：批量审批接口按期间处理，不允许跨期间
    const periods = [...new Set(selectedRows.value.map((r) => r.period).filter(Boolean))];
    if (periods.length > 1) {
      ElMessage.warning(`所选单据跨多个期间（${periods.join('、')}），请按期间分别批量审批`);
      return;
    }
    period = periods[0] ?? '';
    if (!period) {
      ElMessage.warning('所选单据无有效期间');
      return;
    }
    // 提取合同号/订单号：优先订单号（精确），无订单号用合同号（展开全部订单）
    contractNos = selectedRows.value
      .map((row) => row.orderNo || row.contractNo)
      .filter(Boolean) as string[];
    if (contractNos.length === 0) {
      ElMessage.warning('所选单据无有效合同号/订单号');
      return;
    }
  } else {
    if (!manualForm.period) {
      ElMessage.warning('请选择结佣期间');
      return;
    }
    contractNos = manualForm.contractNosText
      .split(/[\n,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (contractNos.length === 0) {
      ElMessage.warning('请输入至少一个合同号');
      return;
    }
    period = manualForm.period;
  }
  batchWaitingCount.value = contractNos.length;
  batchApproveLoading.value = true;
  try {
    const res: any = await commissionApi.batchApproveByContract(period, contractNos);
    batchApproveResult.value = res.data;
  } catch { /* 拦截器处理 */ } finally {
    batchApproveLoading.value = false;
  }
};

// 作废：已发起单据作废（审批中/已驳回/草稿/已锁定）
const cancel = async (row: CommissionContractVO) => {
  if (!row.applicationId) return;
  const isLocked = row.status === 'LOCKED';
  try {
    await ElMessageBox.confirm(
      isLocked
        ? `确认作废已锁定申请单「${row.applyNo}」？\n作废后该单全部结佣明细将冲销，不再计入工资；业绩事实释放，可重新发起并按发起日生成当月结佣记录。`
        : `确认作废申请单「${row.applyNo}」？作废后不可恢复。`,
      '提示',
      { type: 'warning', dangerouslyUseHTMLString: false },
    );
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(row.applicationId);
    ElMessage.success('已作废');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 详情：结佣申请详情
const showDetail = ref(false);
// 传给 CommissionApplyDetail 的业务 ID
const detailApplicationId = ref<number | string | null>(null);
// 选中行的期间封账状态（封账后详情弹窗内隐藏作废按钮）
const detailPeriodClosed = ref(false);

const viewDetail = (row: CommissionContractVO) => {
  detailApplicationId.value = row.applicationId ?? null;
  detailPeriodClosed.value = !!row.periodClosed;
  showDetail.value = true;
};

/** 详情弹窗内作废后：关闭弹窗并刷新列表 */
const onDetailCancelled = () => {
  showDetail.value = false;
  getList();
};

// 工作流跳转：根据 query 参数打开详情（查看态；审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  // 复用 CommissionApplyDetail，详情数据由组件内部按 businessId 自取
  detailApplicationId.value = id;
  showDetail.value = true;
};

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/performance/apply', openFromWorkflow);

onMounted(async () => {
  // 受限角色（店长/总监）默认选中本部门，首屏即按本部门查询；
  // 期间默认取最新有数据的期间（非当前月），取不到则不选（跨全部期间查询）
  queryParams.deptId = defaultDeptId();
  try {
    const res = await commissionApi.listPeriods();
    const periods = res.data ?? [];
    queryParams.period = periods[0] ?? '';
  } catch { /* 期间加载失败保持不选，按全部期间查询 */ }
  loadBizTypes();
  getList();
});
</script>

<style lang="scss" scoped>
.commission-apply-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.filter-form {
  margin-bottom: 4px;
}

.summary-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 8px 4px 12px;
  flex-wrap: wrap;

  .summary-left {
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    flex-wrap: wrap;
  }

  .summary-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .summary-text {
    font-size: 13px;
    color: #606266;

    b {
      color: #303133;
      margin: 0 2px;
    }
  }

  .summary-amount {
    font-size: 13px;
    color: #606266;

    b {
      color: #f56c6c;
      font-size: 15px;
      margin-left: 4px;
    }

    .summary-sub {
      color: #909399;
      font-size: 12px;
    }

    .summary-sep {
      color: #dcdfe6;
      margin: 0 6px;
    }
  }
}

.data-table {
  width: 100%;

  .contract-link {
    font-weight: 600;
    padding: 0;
  }

  .table-actions {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }

  .contract-text {
    font-weight: 600;
    color: #303133;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-red {
    color: #f56c6c;
  }
  .amount-zero {
    color: #c0c4cc;
    cursor: help;
    border-bottom: 1px dashed #c0c4cc;
  }
  .amount-expected {
    color: #909399;
  }
  .amount-ink {
    color: #303133;
  }
  .amount-received {
    color: #e6a23c;
  }
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.batch-hint {
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 8px;
}

.batch-mode-switch {
  margin-bottom: 12px;
}

.confirm-text {
  font-size: 13px;
  color: #606266;
  margin: 0 0 8px;

  b {
    color: #303133;
  }
}

.batch-waiting {
  text-align: center;
  padding: 40px 0;

  .waiting-text {
    font-size: 15px;
    font-weight: 500;
    margin-top: 16px;
  }
  .waiting-sub {
    font-size: 13px;
    color: #909399;
    margin-top: 8px;
  }
}

.batch-result {
  .result-detail {
    margin-top: 8px;
  }

  .result-section {
    margin-bottom: 12px;
  }

  .result-label {
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 4px;

    &.success { color: #67c23a; }
    &.skip { color: #909399; }
    &.fail { color: #f56c6c; }
  }

  .contract-list {
    font-size: 12px;
    color: #606266;
    line-height: 1.6;
    word-break: break-all;
    background: var(--el-fill-color-light);
    border-radius: 4px;
    padding: 8px 10px;
    max-height: 120px;
    overflow-y: auto;
  }
}

/* ============ 「原值 → 调整后值」展示（列表 / 详情弹窗共用） ============
   有调整时：被调整掉的原值置灰加删除线，箭头连接调整后值；未调整时只渲染一个值。
   样式口径与「合同业绩明细」页 / 实收明细页保持一致。 */
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
/* 金额单元格下方的副标记（如「新增角色人」标签） */
.cell-sub {
  margin-top: 2px;
  line-height: 1.2;
}
</style>
