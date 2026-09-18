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
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/组别">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="全部门店/组别"
            clearable
            check-strictly
            style="width: 210px"
            @change="handleQuery"
          />
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
      <el-table border class="data-table" :data="contractList">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <!-- 无论是否已发起单据，都允许点击：未发起 → 跳合同业绩详情；已发起 → 打开结佣申请详情 -->
            <el-button type="primary" link class="contract-link" @click="viewDetail(row)">
              {{ contractOrOrderNo(row) }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="结佣业绩" align="right" width="120" fixed="left">
          <template #default="{ row }">
            <span class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="折算后" align="right" width="120">
          <template #default="{ row }">
            <span class="amount amount-ink">¥{{ formatAmount(row.convertedAmount) }}</span>
          </template>
        </el-table-column>
        <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值（同实收明细） -->
        <el-table-column label="新签业绩" align="right" width="200">
          <template #default="{ row }">
            <template v-if="isAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalExpectedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-expected">¥{{ formatAmount(row.expectedAmount) }}</span>
            </template>
            <span v-else class="amount amount-expected">¥{{ formatAmount(row.expectedAmount) }}</span>
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
        <el-table-column label="差异" align="center" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.aligned" type="success" size="small">已对齐</el-tag>
            <el-tag v-else-if="hasDiff(row)" type="danger" size="small">有差异</el-tag>
            <span v-else>—</span>
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
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ row.applicantName || '—' }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="260" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
              <el-button v-if="row.status === 'SUBMITTED' && row.applicationId && checkPermi(['workflow:task:edit'])" link type="success" :loading="approvalLoading" @click="onBizApprove(row.applicationId)">审批</el-button>
              <el-button
                v-if="canOriginate(row) || row.status === 'REJECTED'"
                link type="warning"
                :loading="submittingMap[contractOrOrderNo(row)]"
                @click="onSubmit(row as CommissionContractVO)">{{ row.status === 'REJECTED' ? '重提' : '提交' }}</el-button>
              <el-button v-if="(row.status === 'DRAFT' || row.status === 'SUBMITTED') && canCancel(row)" link type="info" @click="cancel(row)">作废</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无可结佣合同' : '请选择期间'" />
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

    <!-- 详情弹窗：复用 WorkflowHandle/details/CommissionApplyDetail（与实收详情同款容器、字段、样式） -->
    <el-dialog v-model="showDetail" title="结佣明细详情" width="1100px" top="5vh" append-to-body destroy-on-close>
      <CommissionApplyDetail v-if="showDetail" :business-id="detailApplicationId!" />
      <template #footer>
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 未发起行：合同业绩明细弹窗（复用合同业绩详情页组件，嵌入模式不跳页） -->
    <el-dialog v-model="showContractDetail" title="合同业绩明细" width="1100px" top="5vh" append-to-body destroy-on-close>
      <ContractDetail
        v-if="showContractDetail && detailContract"
        embedded
        :key="`${detailContract.contractNo}-${detailContract.period}`"
        :contract-no="detailContract.contractNo"
        :period="detailContract.period"
      />
      <template #footer>
        <el-button @click="showContractDetail = false">关闭</el-button>
      </template>
    </el-dialog>

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
          <el-form-item label="结算月" required>
            <el-date-picker
              v-model="batchApplyForm.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="请选择月份"
              style="width: 100%"
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
          <div class="batch-hint">将为每个合同号发起结佣申请并提交审批。已有未完结单的合同会跳过。</div>
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
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { checkPermi } from '@/utils/permission';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { useUserStore } from '@/store/modules/user';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';
import CommissionApplyDetail from '@/components/WorkflowHandle/details/CommissionApplyDetail.vue';
import ContractDetail from '@/views/performance/contract/detail.vue';

const route = useRoute();
const userStore = useUserStore();

/** 是否可以作废：超管全部可操作，普通用户只能操作自己发起的单据 */
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

// 当前月份（YYYY-MM）
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: currentPeriod(),
  deptId: undefined as string | undefined,
  status: '' as string,
  keyword: '' as string,
});

// 汇总统计（按合同维度）
const summary = computed(() => {
  const list = contractList.value;
  const totalAmount = list.reduce((s, r) => s + num(r.amount), 0);
  const detailCount = list.reduce((s, r) => s + (r.detailCount || 0), 0);
  return {
    contractCount: list.length,
    detailCount,
    employeeCount: 0,
    totalAmount,
  };
});

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

// 部门树（用于顶部门店筛选；详情弹窗的归属门店翻译在 CommissionApplyDetail 内自处理）
const deptTreeData = ref<DeptNode[]>([]);

const loadDeptTree = async () => {
  try {
    const res: any = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch { /* ignore */ }
};

// 状态映射
const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '草稿', SUBMITTED: '已提交', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
// 筛选下拉只列实际会出现在列表中的状态：
// DRAFT（发起即提交，无保存草稿入口）、APPROVED（审批通过直接落 LOCKED，不经过 APPROVED）不会出现
const HIDDEN_FILTER_STATUS = ['DRAFT', 'APPROVED'];
const statusOptions = Object.entries(STATUS_MAP)
  .filter(([value]) => !HIDDEN_FILTER_STATUS.includes(value))
  .map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    NONE: 'info', DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'primary', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

// 可发起：未发起 / 已作废（作废时明细已冲销，事实释放可重新发起）；净额为 0 的合同无可入账事实
const canOriginate = (row: CommissionContractVO) =>
  (row.status === 'NONE' || row.status === 'CANCELLED') && num(row.amount) !== 0;

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.listContracts({
      period: queryParams.period || currentPeriod(),
      deptId: queryParams.deptId || undefined,
      status: queryParams.status || undefined,
      keyword: queryParams.keyword || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = res.data;
    contractList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
  } catch {
    contractList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  Object.assign(queryParams, {
    period: currentPeriod(), deptId: undefined, status: '', keyword: '', pageNum: 1,
  });
  getList();
};

// 按钮 loading 状态（以 contractNo 为 key：未发起行无 applicationId，统一用 contractNo）
const submittingMap = reactive<Record<string, boolean>>({});

// 审批节点中文名
const nodeLabel = (node?: string) => node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—');

// 是否有差异（实收 vs 应收，均有值时比较；差异 1 元以内视为无差异）
const hasDiff = (row: CommissionContractVO) =>
  row.expectedAmount !== undefined && row.expectedAmount !== null
  && Math.abs(num(row.amount) - num(row.expectedAmount)) > 1;

// 批量发起（按合同号）
const showBatchApply = ref(false);
const batchApplyLoading = ref(false);
const batchApplyResult = ref<BatchResultDTO | null>(null);
const batchApplyForm = reactive({
  period: '' as string,
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
    ElMessage.warning('请选择结算月');
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

// 作废
const cancel = async (row: CommissionContractVO) => {
  try {
    await ElMessageBox.confirm(`确认作废申请单「${row.applyNo}」？作废后不可恢复。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(row.applicationId);
    ElMessage.success('已作废');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 详情
const showDetail = ref(false);
// 传给 CommissionApplyDetail 的业务 ID（已发起行才设；未发起行打开合同业绩明细弹窗）
const detailApplicationId = ref<number | string | null>(null);

// 未发起行：合同业绩明细弹窗（原地查看，不跳页）
const showContractDetail = ref(false);
const detailContract = ref<{ contractNo: string; period: string } | null>(null);

const viewDetail = async (row: CommissionContractVO) => {
  // 未发起：弹窗查看合同金额/累计结佣/业绩构成（复用合同业绩明细组件）
  if (!row.applicationId) {
    detailContract.value = {
      contractNo: resolveBizNo(row.bizType, row.contractNo, row.orderNo) || row.contractNo,
      period: row.period,
    };
    showContractDetail.value = true;
    return;
  }
  // 已发起：打开结佣申请详情对话框（复用 WorkflowHandle/details/CommissionApplyDetail，与实收详情同款）
  detailApplicationId.value = row.applicationId;
  showDetail.value = true;
};

// 发起并提交一步到位：后端 POST /commission/apply 一次完成发起+提交，并自动处理驳回单重提（不新建单）
const onSubmit = async (row: CommissionContractVO) => {
  const no = contractOrOrderNo(row);
  const isResubmit = row.status === 'REJECTED';
  const action = isResubmit ? '重新提交' : '发起并提交';
  try {
    await ElMessageBox.confirm(
      `确认为合同「${no}」${row.period} 月${action}？${
        isResubmit
          ? '该驳回单将重新进入审批流。'
          : '将按该合同当月实收业绩生成明细并直接进入审批流。'
      }`,
      action, { type: 'info' },
    );
  } catch {
    return;
  }
  // 业务键口径：与后端 selectContractSummaries 输出的 contractNo（= 发起/幂等/单据存储键）一致
  const bizNo = resolveBizNo(row.bizType, row.contractNo, row.orderNo) || row.contractNo;
  submittingMap[bizNo] = true;
  try {
    // 后端已合并发起+提交为一次调用；驳回单后端识别后重提，不新建单
    await commissionApi.createApplication({ period: row.period, contractNo: bizNo });
    ElMessage.success(`${action}成功`);
    getList();
  } catch { /* 拦截器处理（含部分失败提示） */ } finally {
    submittingMap[bizNo] = false;
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
  loadDeptTree();
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
  .amount-expected {
    color: #909399;
  }
  .amount-ink {
    color: #303133;
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
</style>
