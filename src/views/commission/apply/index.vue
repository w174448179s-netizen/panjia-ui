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
          <span class="summary-amount">结佣合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
          <el-button v-if="checkPermi(['commission:apply:add'])" type="primary" icon="Plus" @click="showBatchApply = true">
            批量发起
          </el-button>
          <el-button v-if="checkPermi(['commission:apply:batch'])" type="success" plain icon="DocumentChecked" @click="showBatchApprove = true">批量审批</el-button>
        </div>
      </div>

      <!-- 合同维度表格 -->
      <el-table border class="data-table" :data="contractList" :empty-text="emptyText">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <!-- 点击打开结佣申请详情 -->
            <el-button type="primary" link class="contract-link" @click="viewDetail(row)">
              {{ contractOrOrderNo(row) }}
            </el-button>
          </template>
        </el-table-column>
        <!-- 结佣业绩：结佣调整生效时展示「原值 → 调整后值」，未调整只展示一个值 -->
        <el-table-column label="结佣业绩" align="right" width="220" fixed="left">
          <template #default="{ row }">
            <template v-if="isReceivedAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
            </template>
            <el-tooltip
              v-else-if="num(row.amount) === 0"
              content="新签业绩缺失，请先导入或补录该合同新签"
              placement="top"
            >
              <span class="amount amount-zero">¥0.00</span>
            </el-tooltip>
            <span v-else class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
            <!-- 在途合同级 AMOUNT 调整：展示审批中调整后合计 -->
            <div v-if="row.adjustPending && row.adjustPendingType === 'AMOUNT' && row.adjustPendingAmount != null" class="pending-line">
              <span class="amount-arrow">→</span>
              <span class="amount amount-warn">¥{{ formatAmount(row.adjustPendingAmount) }}</span>
              <el-tag type="warning" size="small" effect="plain" style="margin-left: 4px">审批中</el-tag>
            </div>
            <div v-else-if="row.adjustPending && row.adjustPendingType === 'ADD_MEMBER'" class="pending-line">
              <el-tag type="success" size="small" effect="plain">增加角色人审批中</el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="190">
          <template #default="{ row }">
            <template v-if="isReceivedAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalReceivedConvertedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-ink">¥{{ formatAmount(row.convertedAmount) }}</span>
            </template>
            <span v-else class="amount amount-ink">¥{{ formatAmount(row.convertedAmount) }}</span>
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
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row) }}</el-tag>
            <el-tag v-if="row.adjustPending" type="warning" size="small" effect="plain" style="margin-left: 4px">调整审批中</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ row.applicantName || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="300" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
              <!-- 结佣调整：仅已锁定（LOCKED）且已发起、期间未封账的行可发起；权限仅限财务/总监 -->
              <el-button v-if="row.status === 'LOCKED' && row.applicationId && !row.periodClosed && checkPermi(['commission:adjust:add'])" link type="warning" @click="onAdjust(row)">调整</el-button>
              <el-button v-if="row.status === 'SUBMITTED' && row.applicationId && checkPermi(['workflow:task:edit'])" link type="success" :loading="approvalLoading" @click="onBizApprove(row.applicationId)">审批</el-button>
              <el-button
                v-if="canOriginate(row) || row.status === 'REJECTED'"
                link type="warning"
                :loading="submittingMap[contractOrOrderNo(row)]"
                @click="onSubmit(row as CommissionContractVO)">{{ row.status === 'REJECTED' ? '重提' : '提交' }}</el-button>
              <!-- 可作废：草稿 / 审批中 / 已驳回 / 已锁定；已作废除外；封账期间不可作废 -->
              <el-button v-if="['DRAFT', 'SUBMITTED', 'REJECTED', 'LOCKED'].includes(row.status) && canCancel(row) && !row.periodClosed" link type="info" @click="cancel(row)">作废</el-button>
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

    <!-- 结佣调整弹窗：直接打开合同级调整，不经过详情页 -->
    <CommissionApplyDetail
      v-if="adjustApplicationId"
      :business-id="adjustApplicationId"
      :auto-adjust="true"
      :adjust-only="true"
      :period-closed="adjustPeriodClosed"
      @adjusted="onAdjusted"
      @adjust-closed="adjustApplicationId = null"
    />

    <!-- 批量发起弹窗：录入合同号 → 等待处理完成 → 展示结果 -->
    <el-dialog v-model="showBatchApply" title="批量发起结佣" width="560px" @close="resetBatchApply">
      <div v-if="batchApplyLoading" class="batch-waiting">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="waiting-text">正在批量发起，请耐心等待...</p>
        <p class="waiting-sub">共 {{ batchApplyForm.parsedCount }} 个合同号，逐张处理中</p>
      </div>

      <div v-else-if="batchApplyResult" class="batch-result">
        <el-result :icon="batchApplyResult.failed > 0 ? 'warning' : 'success'" :title="batchApplySummary">
        </el-result>
        <div class="result-detail">
          <div v-if="batchApplyResult.successContracts.length" class="result-section">
            <div class="result-label success">成功（{{ batchApplyResult.success }}）</div>
            <div class="contract-list">{{ batchApplyResult.successContracts.join('、') }}</div>
          </div>
          <div v-if="batchApplyResult.skippedContracts.length" class="result-section">
            <div class="result-label skip">跳过（{{ batchApplyResult.skipped }}）</div>
            <div class="contract-list">{{ batchApplyResult.skippedContracts.join('、') }}</div>
          </div>
          <div v-if="batchApplyResult.failedContracts.length" class="result-section">
            <div class="result-label fail">失败（{{ batchApplyResult.failed }}）</div>
            <div class="contract-list">{{ batchApplyResult.failedContracts.join('、') }}</div>
          </div>
        </div>
      </div>

      <template v-else>
        <el-form label-width="80px">
          <el-form-item label="结佣期间" required>
            <el-date-picker
              v-model="batchApplyForm.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="请选择结佣月份"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="合同号" required>
            <el-input
              v-model="batchApplyForm.contractNosText"
              type="textarea"
              :rows="10"
              placeholder="每行一个合同号/订单号（以列表展示的编号为准），或用逗号/空格分隔"
            />
          </el-form-item>
          <div class="batch-hint">
            将按所选结佣期间为每个合同号发起结佣申请并提交审批（结佣期间不按实收日期，历史实收审批通过且未结佣的均可发起）。已有未完结单的合同会跳过。
          </div>
        </el-form>
      </template>

      <template #footer>
        <el-button v-if="!batchApplyResult && !batchApplyLoading" @click="showBatchApply = false">取消</el-button>
        <el-button v-if="!batchApplyResult && !batchApplyLoading" type="primary" @click="doBatchApply">开始发起</el-button>
        <el-button v-if="batchApplyResult" type="primary" @click="closeBatchApply">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 批量审批弹窗：录入合同号 → 等待处理完成 → 展示结果 -->
    <el-dialog v-model="showBatchApprove" title="批量审批" width="560px" @close="resetBatchApproveDialog">
      <div v-if="batchApproveLoading" class="batch-waiting">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="waiting-text">正在批量审批，请耐心等待...</p>
        <p class="waiting-sub">共 {{ batchApproveForm.parsedCount }} 个合同号，逐单处理中</p>
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

      <template v-else>
        <el-form label-width="80px">
          <el-form-item label="结算月" required>
            <el-date-picker
              v-model="batchApproveForm.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="请选择月份"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="合同号" required>
            <el-input
              v-model="batchApproveForm.contractNosText"
              type="textarea"
              :rows="10"
              placeholder="每行一个合同号/订单号（以列表展示的编号为准），或用逗号/空格分隔"
            />
          </el-form-item>
          <div class="batch-hint">将逐单审批当前节点，非您审批范围内的单据会跳过。</div>
        </el-form>
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

// 期间默认空：不预选月份，空期间 = 跨全部期间查询；用户需要时自行选择月份
const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  deptId: undefined as string | undefined,
  employeeId: undefined as string | undefined,
  bizType: undefined as string | undefined,
  status: '' as string,
  keyword: '' as string,
});

// 汇总统计：后端按过滤后全集返回（跨页全局，不随分页变化）
const emptySummary = () => ({ contractCount: 0, employeeCount: 0, detailCount: 0, totalAmount: 0 });
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

/**
 * 结佣业绩（PERF_REAL）是否按「原值 → 调整后值」展示：需后端 receivedAdjusted 标记与
 * 调整前合计同时成立（结佣调整 AMOUNT 生效）。
 */
const isReceivedAdjusted = (
  row: { receivedAdjusted?: boolean | null; originalAmount?: number | string | null } | null | undefined,
): boolean => !!row?.receivedAdjusted && row.originalAmount != null;

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
// DRAFT 会出现——实收审批通过后系统自动生成草稿单，等人工提交
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

// 可提交：已作废（需有金额）或草稿（始终可提交，
// 明细可能因新签调整被冲销，提交时后端自动从当前新签事实重建）；驳回单走「重提」
const canOriginate = (row: CommissionContractVO) =>
  row.status === 'DRAFT'
  || (row.status === 'CANCELLED' && num(row.amount) !== 0);

// 列表
const getList = async () => {
  // 必须选择期间或录入关键字，避免全表扫描
  if (!queryParams.period && !queryParams.keyword?.trim()) {
    contractList.value = [];
    total.value = 0;
    summary.value = emptySummary();
    return;
  }
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

/** 空态提示：引导用户选择查询条件 */
const emptyText = computed(() => {
  if (!queryParams.period && !queryParams.keyword?.trim()) {
    return '请选择结佣期间或录入关键字查询';
  }
  return '该条件下暂无可结佣合同';
});

const resetQuery = () => {
  Object.assign(queryParams, {
    // 受限角色重置回本部门默认值，不能清空为"全部"；期间重置为空（跨全部期间）
    period: '', deptId: defaultDeptId(), employeeId: undefined, bizType: undefined, status: '', keyword: '', pageNum: 1,
  });
  loadBizTypes().then(getList);
};

// 按钮 loading 状态（以 contractNo 为 key）
const submittingMap = reactive<Record<string, boolean>>({});

// 审批节点中文名
const nodeLabel = (node?: string) => node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—');

// 批量发起（按合同号）
const showBatchApply = ref(false);
const batchApplyLoading = ref(false);
const batchApplyResult = ref<BatchResultDTO | null>(null);
const batchApplyForm = reactive({
  period: '',
  contractNosText: '',
  parsedCount: 0,
});
const batchApplySummary = computed(() => {
  const r = batchApplyResult.value;
  if (!r) return '';
  return `成功 ${r.success} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`;
});
const resetBatchApply = () => {
  batchApplyForm.period = '';
  batchApplyForm.contractNosText = '';
  batchApplyForm.parsedCount = 0;
  batchApplyLoading.value = false;
  batchApplyResult.value = null;
};
const closeBatchApply = () => {
  showBatchApply.value = false;
  resetBatchApply();
  getList();
};
const doBatchApply = async () => {
  if (!batchApplyForm.period) {
    ElMessage.warning('请选择结佣期间');
    return;
  }
  const contractNos = batchApplyForm.contractNosText
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (contractNos.length === 0) {
    ElMessage.warning('请输入至少一个合同号');
    return;
  }
  batchApplyForm.parsedCount = contractNos.length;
  batchApplyLoading.value = true;
  try {
    // 传发起人选择的结佣期间；实收事实跨期查找，不按实收月归属
    const res: any = await commissionApi.batchApplyByContract(batchApplyForm.period, contractNos);
    batchApplyResult.value = res.data;
  } catch { /* 拦截器处理 */ } finally {
    batchApplyLoading.value = false;
  }
};

// 批量审批
const showBatchApprove = ref(false);
const batchApproveLoading = ref(false);
const batchApproveResult = ref<BatchResultDTO | null>(null);
const batchApproveForm = reactive({
  period: '' as string,
  contractNosText: '',
  parsedCount: 0,
});
const batchApproveSummary = computed(() => {
  const r = batchApproveResult.value;
  if (!r) return '';
  return `成功 ${r.success} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`;
});
const resetBatchApproveDialog = () => {
  batchApproveForm.period = '';
  batchApproveForm.contractNosText = '';
  batchApproveForm.parsedCount = 0;
  batchApproveLoading.value = false;
  batchApproveResult.value = null;
};
const closeBatchApprove = () => {
  showBatchApprove.value = false;
  resetBatchApproveDialog();
  getList();
};
const doBatchApprove = async () => {
  if (!batchApproveForm.period) {
    ElMessage.warning('请选择结算月');
    return;
  }
  const contractNos = batchApproveForm.contractNosText
    .split(/[\n,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (contractNos.length === 0) {
    ElMessage.warning('请输入至少一个合同号');
    return;
  }
  batchApproveForm.parsedCount = contractNos.length;
  batchApproveLoading.value = true;
  try {
    const res: any = await commissionApi.batchApproveByContract(batchApproveForm.period, contractNos);
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
// 选中行的期间封账状态（封账后详情弹窗内隐藏作废/调整按钮）
const detailPeriodClosed = ref(false);

const viewDetail = (row: CommissionContractVO) => {
  detailApplicationId.value = row.applicationId ?? null;
  detailPeriodClosed.value = !!row.periodClosed;
  showDetail.value = true;
};

/** 结佣调整入口（仅 LOCKED）：直接弹出合同级调整弹窗，不经过详情页 */
// applicationId 可能为大整数字符串（后端 BigNumberSerializer 超范围序列化为 string），禁止 Number() 转换以免丢精度
const adjustApplicationId = ref<string | number | null>(null);
const adjustPeriodClosed = ref(false);
const onAdjust = (row: CommissionContractVO) => {
  if (row.status !== 'LOCKED' || !row.applicationId) {
    ElMessage.warning('仅已锁定的结佣单可发起调整');
    return;
  }
  adjustApplicationId.value = row.applicationId;
  adjustPeriodClosed.value = !!row.periodClosed;
};
/** 调整提交后关闭调整弹窗并刷新列表 */
const onAdjusted = () => {
  adjustApplicationId.value = null;
  getList();
};

/** 详情弹窗内作废后：关闭弹窗并刷新列表 */
const onDetailCancelled = () => {
  showDetail.value = false;
  getList();
};

// 发起并提交一步到位：后端 POST /commission/apply 一次完成发起+提交，并自动处理驳回单重提（不新建单）
const onSubmit = async (row: CommissionContractVO) => {
  const no = contractOrOrderNo(row);
  if (!no || no === '—') {
    ElMessage.warning('该合同缺少合同号/订单号，无法发起');
    return;
  }
  // 提交中拦截：防止连点重复弹出确认框/重复提交
  if (submittingMap[no]) return;
  // 在途互斥预检：同合同当月已有审批中的申请单时，前端直接拦截，避免提交后才被后端拒绝
  try {
    const res = await commissionApi.checkApplyInFlight(row.period, no);
    if (res.data) {
      ElMessage.warning('该合同当月已有审批中的结佣申请单，请待其审批完成后再发起');
      return;
    }
  } catch { /* 预检失败不阻断，交后端兜底 */ }
  const isResubmit = row.status === 'REJECTED';
  const isDraft = row.status === 'DRAFT';
  const action = isResubmit ? '重新提交' : isDraft ? '提交' : '发起并提交';
  try {
    await ElMessageBox.confirm(
      `确认为合同「${no}」${row.period} 月${action}？${
        isResubmit
          ? '该驳回单将重新进入审批流。'
          : isDraft
            ? '该结佣单已由实收审批通过自动生成，提交后直接进入审批流。'
            : '将按该合同当月实收业绩生成明细并直接进入审批流。'
      }`,
      action, { type: 'info' },
    );
  } catch {
    return;
  }
  submittingMap[no] = true;
  try {
    // 后端已合并发起+提交为一次调用；驳回单后端识别后重提，不新建单
    await commissionApi.createApplication({ period: row.period, contractNo: no });
    ElMessage.success(`${action}成功`);
    // 等列表刷新完成再结束转圈：行状态即时变为「审批中」，按钮随之消失，
    // 避免转圈结束后列表仍是旧状态导致用户以为没点上而重复提交
    await getList();
  } catch { /* 拦截器处理（含部分失败提示） */ } finally {
    submittingMap[no] = false;
  }
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

onMounted(() => {
  // 受限角色（店长/总监）默认选中本部门，首屏即按本部门查询；
  // 期间默认留空，首屏跨全部期间查询，不再预选当前月/最新有数据期间
  queryParams.deptId = defaultDeptId();
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
  .amount-warn {
    color: #e6a23c;
  }
  .pending-line {
    font-size: 12px;
    line-height: 1.4;
    margin-top: 2px;
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
  margin-top: 4px;
  padding-left: 80px;
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
