<template>
  <div class="received-apply-page">
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
        <el-form-item label="门店/组别" prop="deptId">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            check-strictly
            style="width: 200px"
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
            共 <b>{{ total }}</b> 张实收审批单 ·
            实收合计 <b class="amount-red">{{ formatAmount(summaryAmount) }}</b>
          </span>
        </div>
        <div class="summary-right">
          <el-button v-if="checkPermi(['perf:received:submit'])" type="warning" plain icon="EditPen" @click="openManualSubmit">手工提交</el-button>
          <el-button v-if="checkPermi(['perf:received:batch'])" type="success" plain icon="DocumentChecked" @click="showBatchApprove = true">批量审批</el-button>
        </div>
      </div>

      <!-- 审批单表格 -->
      <el-table border class="data-table" :data="applyList">
        <el-table-column label="合同号/订单号" align="center" min-width="180" fixed="left">
          <template #default="{ row }">
            <el-button type="primary" link class="contract-link" @click="viewDetail(row)">{{ contractOrOrderNo(row) }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="实收业绩" align="right" width="120">
                  <template #default="{ row }">
                    <span class="amount amount-red">¥{{ formatAmount(row.receivedAmount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="折算后" align="right" width="120">
                  <template #default="{ row }">
                    <span class="amount amount-ink">¥{{ formatAmount(row.receivedConvertedAmount) }}</span>
                  </template>
                </el-table-column>
        <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值 -->
        <el-table-column label="新签业绩" align="right" width="200">
          <template #default="{ row }">
            <template v-if="isAdjusted(row)">
              <span class="amount-strike">¥{{ formatAmount(row.originalExpectedAmount) }}</span>
              <span class="amount-arrow">→</span>
              <span class="amount amount-red">¥{{ formatAmount(row.expectedAmount) }}</span>
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

        <el-table-column label="类型" align="center" width="100">
          <template #default="{ row }">{{ row.bizType || '—' }}</template>
        </el-table-column>
        <el-table-column label="房源地址" align="left" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
        </el-table-column>
        <el-table-column label="签约/认购时间" align="center" width="170">
          <template #default="{ row }">{{ formatDateTime(row.businessDate) }}</template>
        </el-table-column>
        <el-table-column label="涉及人数" align="center" width="90">
          <template #default="{ row }">{{ row.employeeCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="明细条数" align="center" width="90">
          <template #default="{ row }">{{ row.itemCount ?? 0 }}</template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="当前节点" align="center" width="100">
          <template #default="{ row }">{{ row.currentNode ? nodeLabel(row.currentNode) : '—' }}</template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ applicantName(row.applicantName, row.applicantId) }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
              <el-button v-if="row.status === 'SUBMITTED' && checkPermi(['perf:received:approve'])" link type="success" :loading="approvalLoading" @click="onBizApprove(row.id)">审批</el-button>
              <el-button v-if="row.status === 'DRAFT' || row.status === 'REJECTED'" link type="warning" @click="resubmit(row)">重提</el-button>
              <el-button v-if="(row.status === 'DRAFT' || row.status === 'SUBMITTED') && canCancel(row)" link type="info" @click="cancel(row)">作废</el-button>
            </div>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无实收审批单' : '请选择期间'" />
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

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="实收业绩审批单详情" width="960px" top="5vh">
      <el-descriptions v-if="detailApp" :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="审批单号">{{ detailApp.applyNo }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailApp.period }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailApp.status)" size="small">{{ statusLabel(detailApp.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">{{ detailApp.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detailApp.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detailApp.currentNode ? nodeLabel(detailApp.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">
          {{ applicantName(detailApp.applicantName, detailApp.applicantId) }}
        </el-descriptions-item>
        <el-descriptions-item label="审批人">
          {{ detailApp.approverName || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="审批时间">{{ formatDateTime(detailApp.approveTime) }}</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(detailApp.receivedAmount) }}</span>
          <span class="amount amount-gray" style="margin-left: 8px">折算后 ¥{{ formatAmount(detailApp.receivedConvertedAmount) }}</span>
        </el-descriptions-item>
        <!-- 新签业绩（应收合计）：有调整时展示「原值 → 调整后值」，折算后同形式 -->
        <el-descriptions-item label="应收合计" :span="2">
          <template v-if="detailAdjusted">
            <span class="amount-strike">¥{{ formatAmount(detailApp.originalExpectedAmount) }}</span>
            <span class="amount-arrow">→</span>
            <span class="amount amount-red">¥{{ formatAmount(detailApp.expectedAmount) }}</span>
          </template>
          <template v-else>
            <span class="amount amount-expected">¥{{ formatAmount(detailApp.expectedAmount) }}</span>
          </template>
          <span class="converted-inline">
            折算后
            <span v-if="detailAdjusted" class="amount-strike">¥{{ formatAmount(detailApp.originalExpectedConvertedAmount) }}</span>
            <span v-if="detailAdjusted" class="amount-arrow">→</span>
            <span class="amount amount-ink">¥{{ formatAmount(detailApp.expectedConvertedAmount) }}</span>
          </span>
        </el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detailApp.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">每人实收明细（{{ detailFacts.length }} 条）</div>
        <el-table :data="detailFacts" border max-height="420" class="detail-facts-table">

          <el-table-column label="门店/组别" align="left" min-width="150">
            <template #default="scope">
              <span v-if="scope.row.deptPath" class="dept-wrap" :title="scope.row.deptPath">
                <span class="dept-store">{{ deptStore(scope.row.deptPath) }}</span>
                <span v-if="deptGroup(scope.row.deptPath)" class="dept-group"> · {{ deptGroup(scope.row.deptPath) }}</span>
              </span>
              <span v-else>—</span>
            </template>
          </el-table-column>
          <el-table-column label="工号" align="center" width="120">
            <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
          </el-table-column>
          <el-table-column label="姓名" align="center" min-width="80">
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
          <!-- 新签业绩：有调整时展示「原值 → 调整后值」，未调整只展示一个值 -->
          <el-table-column label="新签业绩" align="right" width="200">
            <template #default="scope">
              <template v-if="isAdjusted(scope.row)">
                <span class="amount-strike">¥{{ formatAmount(scope.row.originalExpectedAmount) }}</span>
                <span class="amount-arrow">→</span>
                <span class="amount amount-red">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
              </template>
              <span v-else class="amount amount-expected">¥{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="190">
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
            <el-empty description="该合同暂无实收明细" />
          </template>
        </el-table>
      </div>

      <template #footer>
        <!-- 审批统一由「我的待办」弹窗办理（工作流任务接口），本页只提供查看；不提供业务直批入口 -->
        <el-button @click="showDetail = false">关闭</el-button>
      </template>
    </el-dialog>

    <!-- 手工提交弹窗 -->
    <el-dialog v-model="showManual" title="手工提交实收业绩" width="460px">
      <el-form label-width="80px">
        <el-form-item label="结算月">
          <el-date-picker v-model="manualForm.period" type="month" value-format="YYYY-MM" style="width: 100%" />
        </el-form-item>
        <el-form-item label="合同号">
          <el-input v-model="manualForm.contractNo" placeholder="合同号（无审批单将自动建单）" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="manualLoading" @click="doManualSubmit">提交</el-button>
        <el-button @click="showManual = false">取消</el-button>
      </template>
    </el-dialog>

    <!-- 批量审批弹窗：录入合同号 → 等待处理完成 → 展示结果 -->
    <el-dialog v-model="showBatchApprove" title="批量审批" width="560px" @close="resetBatchApprove">
      <!-- 等待视图 -->
      <div v-if="batchApproveLoading" class="batch-waiting">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="waiting-text">正在批量审批，请耐心等待...</p>
        <p class="waiting-sub">共 {{ batchApproveForm.parsedCount }} 个合同号，逐单处理中</p>
      </div>

      <!-- 结果视图 -->
      <div v-else-if="batchApproveResult" class="batch-result">
        <el-result :icon="batchApproveResult.failed > 0 ? 'warning' : 'success'" :title="batchResultSummary">
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

      <!-- 输入视图 -->
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
          <div class="batch-hint">将逐单审批当前节点，非您审批范围内的单据会跳过并提示原因。</div>
        </el-form>
      </template>

      <template #footer>
        <el-button v-if="!batchApproveResult && !batchApproveLoading" @click="showBatchApprove = false">取消</el-button>
        <el-button v-if="!batchApproveResult && !batchApproveLoading" type="primary" @click="doBatchApprove">开始审批</el-button>
        <el-button v-if="batchApproveResult" type="primary" @click="closeBatchResult">关闭</el-button>
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
import { receivedApi, type ReceivedApply, type ReceivedFact, type BatchApproveResult } from '@/api/panjia/received';
import { employeeApi } from '@/api/panjia/employee';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { useDeptScope } from '@/hooks/useDeptScope';
import { checkPermi } from '@/utils/permission';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { useUserStore } from '@/store/modules/user';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';

const route = useRoute();
const userStore = useUserStore();

/** 是否可以作废：超管全部可操作，普通用户只能操作自己发起的单据 */
const canCancel = (row: ReceivedApply): boolean => {
  if (userStore.roles.includes('admin') || userStore.roles.includes('superadmin')) return true;
  return String(row.applicantId) === String(userStore.userId);
};

/** 业务明细直接审批：通过 businessId 查当前用户可办理任务，复用 WorkflowHandle 弹窗 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandle>>();
const { loading: approvalLoading, handleBizApproval } = useBizApproval(
  async (businessId) => {
    const res: any = await receivedApi.getInstanceId(businessId);
    return res.data?.instanceId ?? null;
  },
);
const onBizApprove = (businessId: string | number) =>
  handleBizApproval(businessId, (task) => workflowHandleRef.value?.open(task));

const loading = ref(false);
const applyList = ref<ReceivedApply[]>([]);
const total = ref(0);

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ==================== 门店/组别筛选（全系统统一口径：所有用户查本部门及以下） ====================
const { deptLocked, defaultDeptId, deptTreeData, loadDeptTree } = useDeptScope();

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: currentPeriod(),
  status: '',
  keyword: '',
  deptId: defaultDeptId(),
});

const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toFixed(2);

/**
 * 是否按「原值 → 调整后值」展示：需后端 expectedAdjusted 标记与原值同时成立。
 * 两者缺一（如老数据无提交快照）就退回单值展示，避免出现「0.00 → 12000.00」这类误导。
 * 列表行（ReceivedApply）与每人明细行（ReceivedFact）共用同一判定。
 */
const isAdjusted = (
  row: { expectedAdjusted?: boolean | null; originalExpectedAmount?: number | string | null } | null | undefined,
): boolean => !!row?.expectedAdjusted && row.originalExpectedAmount != null;

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

// ==================== 门店/组别 拆分展示（与合同业绩明细同口径） ====================
// deptPath 形如「集团-门店-组别」（2~3 段）：门店取倒数第二段（无上级时取首段），组别取最后一段
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

const summaryAmount = computed(() => applyList.value.reduce((s, r) => s + num(r.receivedAmount), 0));

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已作废',
};
// 筛选下拉只列实际会出现在列表中的状态：实收单导入即提交，无「保存草稿」入口，DRAFT（待提交）不会落库展示
const HIDDEN_FILTER_STATUS = ['DRAFT'];
const statusOptions = Object.entries(STATUS_MAP)
  .filter(([value]) => !HIDDEN_FILTER_STATUS.includes(value))
  .map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};
const nodeLabel = (node?: string) => node === 'FINANCE' ? '财务审批' : node === 'DIRECTOR' ? '总监审批' : (node || '—');

// 员工姓名（明细表里给的是员工 ID，走员工档案表）
const employeeMap = new Map<number, string>();
const employeeName = (empId: number | string | undefined) => {
  if (empId == null) return '';
  return employeeMap.get(Number(empId)) ?? '';
};

const loadEmployeeMap = async () => {
  try {
    const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
    for (const e of res.data?.rows ?? []) {
      if (e.employeeId != null) employeeMap.set(Number(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
    }
  } catch { /* ignore */ }
};

/**
 * 发起人/审批人姓名由后端统一翻译（ReceivedApply.applicantName / approverName，
 * 基于 @Translation 按 userId 取昵称），列表与详情一律直接展示姓名。
 * 不在前端查用户表：业务角色（店长/财务/人事/经纪人）没有 system:user:query 权限，直查会 403。
 * 空值即「系统自动」——导入归档等无人值守发起，不留空白。
 */
const applicantName = (name?: string | null, userId?: number | string | null) => {
  if (name) return name;
  if (userId === null || userId === undefined || String(userId).trim() === '') return '系统自动';
  return '—';
};

const getList = async () => {
  loading.value = true;
  try {
    const res: any = await receivedApi.list({
      period: queryParams.period || undefined,
      status: queryParams.status || undefined,
      keyword: queryParams.keyword || undefined,
      deptId: queryParams.deptId || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    applyList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch {
    applyList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

// 合同号/订单号合并展示：一手房、房产金融、家装荐客以订单号为准，其它以合同号为准（空则回退）
const contractOrOrderNo = (row: ReceivedApply): string =>
  resolveBizNo(row.bizType, row.contractNo, row.orderNo) || '—';
const resetQuery = () => {
  Object.assign(queryParams, {
    period: currentPeriod(), status: '', keyword: '',
    deptId: defaultDeptId(), pageNum: 1,
  });
  getList();
};

// 详情
const showDetail = ref(false);
const detailApp = ref<ReceivedApply | null>(null);
const detailFacts = ref<ReceivedFact[]>([]);
/** 详情弹窗的「应收合计」是否按「原值 → 调整后值」展示（同一处判定复用三遍，提为 computed） */
const detailAdjusted = computed(() => isAdjusted(detailApp.value));

const viewDetail = async (row: ReceivedApply) => {
  showDetail.value = true;
  detailApp.value = row;
  detailFacts.value = [];
  await loadEmployeeMap();
  try {
    const res: any = await receivedApi.getDetail(row.id);
    detailApp.value = res.data?.apply ?? row;
    detailFacts.value = res.data?.facts ?? [];
  } catch { /* 拦截器处理 */ }
};

const cancel = async (row: ReceivedApply) => {
  try {
    await ElMessageBox.confirm(`确认作废实收审批单「${row.applyNo}」？作废后不可恢复。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await receivedApi.cancel(row.id);
    ElMessage.success('已作废');
    getList();
  } catch { /* 拦截器处理 */ }
};

const resubmit = async (row: ReceivedApply) => {
  try {
    await receivedApi.resubmit(row.id);
    ElMessage.success('已重提');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 手工提交
const showManual = ref(false);
const manualLoading = ref(false);
const manualForm = reactive({ period: currentPeriod(), contractNo: '' });
const openManualSubmit = () => {
  manualForm.period = queryParams.period || currentPeriod();
  manualForm.contractNo = '';
  showManual.value = true;
};
const doManualSubmit = async () => {
  if (!manualForm.period || !manualForm.contractNo.trim()) {
    ElMessage.warning('请填写结算月与合同号');
    return;
  }
  manualLoading.value = true;
  try {
    await receivedApi.submit(manualForm.period, manualForm.contractNo.trim());
    ElMessage.success('提交成功');
    showManual.value = false;
    handleQuery();
  } catch { /* 拦截器处理 */ } finally {
    manualLoading.value = false;
  }
};

// 批量审批：录入 → 等待 → 展示结果
const showBatchApprove = ref(false);
const batchApproveLoading = ref(false);
const batchApproveResult = ref<BatchApproveResult | null>(null);
const batchApproveForm = reactive({
  period: '' as string,
  contractNosText: '',
  parsedCount: 0,
});

const batchResultSummary = computed(() => {
  const r = batchApproveResult.value;
  if (!r) return '';
  return `成功 ${r.success} 个，跳过 ${r.skipped} 个，失败 ${r.failed} 个`;
});

const resetBatchApprove = () => {
  batchApproveForm.period = '';
  batchApproveForm.contractNosText = '';
  batchApproveForm.parsedCount = 0;
  batchApproveLoading.value = false;
  batchApproveResult.value = null;
};

const closeBatchResult = () => {
  showBatchApprove.value = false;
  resetBatchApprove();
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
    const res: any = await receivedApi.batchApproveByContractAsync(batchApproveForm.period, contractNos);
    batchApproveResult.value = res.data;
  } catch { /* 拦截器处理 */ } finally {
    batchApproveLoading.value = false;
  }
};

// 工作流跳转：从「我的已办/我的单据」等查看态进入本页时，按 query 参数直接打开单据详情
// （审批办理已改为「我的待办」原地弹窗，本页不再承担审批态入口）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  await loadEmployeeMap();
  try {
    const res: any = await receivedApi.getDetail(id);
    const apply: ReceivedApply | null = res.data?.apply ?? null;
    if (!apply) {
      ElMessage.error('加载单据失败');
      return;
    }
    detailApp.value = apply;
    detailFacts.value = res.data?.facts ?? [];
    // 背景列表对齐到该单据期间，便于查看人顺带看到同期间其他单据
    if (apply.period) {
      queryParams.period = apply.period;
      queryParams.pageNum = 1;
      getList();
    }
    showDetail.value = true;
  } catch {
    ElMessage.error('加载单据失败');
  }
};

// 本页会被 keep-alive 缓存复用，跳转进来时 onMounted 不一定触发 → 由该 Hook 兜住（含原因说明）
useWorkflowRouteOpen('/performance/received', openFromWorkflow);

onMounted(() => {
  loadDeptTree();
  loadEmployeeMap();
  getList();
});
</script>

<style lang="scss" scoped>
.received-apply-page {
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
}

.summary-text {
  font-size: 13px;
  color: #606266;

  b {
    color: #303133;
    margin: 0 2px;
  }

  .amount-red {
    color: #f56c6c;
  }
  .amount-expected {
    color: #909399;
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
}

.pager-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

.detail-table-wrap {
  margin-top: 16px;
}

.detail-table-title {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
}

.detail-table {
  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-red {
    color: #f56c6c;
  }
}

.detail-facts-table {
  .person-name {
    font-weight: 600;
    color: #303133;
  }

  .dept-wrap {
    line-height: 1.5;
    word-break: break-word;
  }

  .dept-store {
    font-weight: 600;
    color: #303133;
  }

  .dept-group {
    color: #909399;
  }

  /* 仅统一数字字体与字重；颜色交由 amount-expected / amount-red / amount-ink 语义类决定 */
  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
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

/* 折算后金额列：中性色（不加红绿涨跌语义），与各业绩页口径一致 */
.amount-ink {
  color: #303133;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}
.amount-gray {
  color: #909399;
  font-weight: 400;
}

/* ============ 「原值 → 调整后值」展示（列表两列 / 详情应收合计 / 每人明细 共用） ============
   有调整时：被调整掉的原值置灰加删除线，箭头连接调整后值；
   未调整时：只渲染一个值。
   样式口径与「合同业绩明细」页 .amount-strike / .amount-arrow 保持一致。 */
.amount-expected {
  color: #909399;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.amount-red {
  color: #f56c6c;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
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
/* 详情「应收合计」右侧的折算后内联段：灰字标签 + 值，与左侧应收合计同一格并排 */
.converted-inline {
  margin-left: 10px;
  font-size: 13px;
  color: #909399;
}
</style>
