<template>
  <div class="received-apply-page">
    <el-card class="page-card" v-loading="loading">
      <!-- 审批态提示条：由「我的待办」点【去处理】跳转而来 -->
      <el-alert
        v-if="flowType === 'approval'"
        class="flow-banner"
        type="warning"
        :closable="false"
        show-icon
      >
        <template #title>
          正在审批：<b>{{ detailApp?.applyNo || '—' }}</b>
          <span class="flow-banner-sep">|</span>
          {{ detailApp?.contractNo || detailApp?.orderNo || '—' }}
          <span v-if="detailApp?.propertyAddress"> · {{ detailApp.propertyAddress }}</span>
          <span v-if="detailApp?.period"> · {{ detailApp.period }}</span>
          <span class="flow-banner-amount">实收 ¥{{ formatAmount(detailApp?.receivedAmount) }}</span>
        </template>
      </el-alert>

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
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="节点">
          <el-select v-model="queryParams.currentNode" placeholder="全部节点" clearable style="width: 130px" @change="handleQuery">
            <el-option label="财务审批" value="FINANCE" />
            <el-option label="总监审批" value="DIRECTOR" />
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
          <el-button type="warning" plain icon="EditPen" @click="openManualSubmit">手工提交</el-button>
          <el-upload
            :show-file-list="false"
            :auto-upload="true"
            :http-request="handleBatchApproveUpload"
            accept=".xlsx,.xls"
          >
            <el-button type="success" plain icon="DocumentChecked">Excel批量审批</el-button>
          </el-upload>
        </div>
      </div>

      <!-- 审批单表格 -->
      <el-table border class="data-table" :data="applyList">
        <el-table-column label="合同号/订单号" align="center" min-width="180" fixed="left">
          <template #default="{ row }">
            <el-button type="primary" link class="contract-link" @click="viewDetail(row)">{{ row.contractNo || row.orderNo || '—' }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="新签业绩" align="right" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ formatAmount(row.expectedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实收业绩" align="right" width="120">
          <template #default="{ row }">
            <span class="amount amount-red">¥{{ formatAmount(row.receivedAmount) }}</span>
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
        <el-table-column label="操作" align="center" width="200" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'DRAFT' || row.status === 'REJECTED'" link type="warning" @click="resubmit(row)">重新提交</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" link type="success" @click="approve(row)">通过</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" link type="danger" @click="reject(row)">驳回</el-button>
            <el-button v-if="row.status === 'DRAFT' || row.status === 'SUBMITTED'" link type="info" @click="cancel(row)">作废</el-button>
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
        </el-descriptions-item>
        <el-descriptions-item label="应收合计" :span="2">¥{{ formatAmount(detailApp.expectedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detailApp.propertyAddress || '—' }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">每人实收明细（{{ detailFacts.length }} 条）</div>
        <el-table :data="detailFacts" border max-height="420" class="detail-facts-table">
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
              <span class="person-name">{{ scope.row.employeeName || employeeName(scope.row.employeeId) || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="所属角色" align="center" min-width="100">
            <template #default="scope">{{ scope.row.roleType || scope.row.roleName || '—' }}</template>
          </el-table-column>
          <el-table-column label="角色占比" align="center" width="90">
            <template #default="scope">{{ formatRatio(scope.row.shareRatio) }}</template>
          </el-table-column>
          <el-table-column label="应收金额" align="right" width="120">
            <template #default="scope">
              <span class="amount">{{ formatAmount(scope.row.expectedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="实收金额" align="right" width="120">
            <template #default="scope">
              <span class="amount amount-red">¥{{ formatAmount(scope.row.amount) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="该合同暂无实收明细" />
          </template>
        </el-table>
      </div>

      <template #footer>
        <!-- 审批态：办理待办任务（不再走业务接口，避免越权与状态错位） -->
        <template v-if="flowType === 'approval'">
          <el-button type="success" :loading="taskOperating" @click="handleFlowPass">通 过</el-button>
          <el-button type="danger" :loading="taskOperating" @click="handleFlowReject">驳 回</el-button>
          <el-button @click="showDetail = false">取 消</el-button>
        </template>
        <template v-else>
          <el-button v-if="detailApp?.status === 'SUBMITTED'" type="success" @click="approve(detailApp); showDetail = false">审批通过</el-button>
          <el-button v-if="detailApp?.status === 'SUBMITTED'" type="danger" @click="reject(detailApp); showDetail = false">驳回</el-button>
          <el-button @click="showDetail = false">关闭</el-button>
        </template>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { receivedApi, type ReceivedApply, type ReceivedFact } from '@/api/panjia/received';
import { employeeApi } from '@/api/panjia/employee';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();

// 工作流跳转参数（由「我的待办」点【去处理】带入）
const flowType = ref<string>(''); // view | approval
const flowTaskId = ref<string>('');

const loading = ref(false);
const applyList = ref<ReceivedApply[]>([]);
const total = ref(0);

const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: currentPeriod(),
  status: '',
  currentNode: '',
  keyword: '',
});

const num = (v: number | string | null | undefined): number => {
  if (v === undefined || v === null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};
const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
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
 * 基于 @Translation 按 userId 取昵称）。
 * 不在前端查用户表：业务角色（店长/财务/人事/经纪人）没有 system:user:query 权限，直查会 403。
 * 空值即「系统自动」——导入归档等无人值守发起，不留空白。
 */
const applicantName = (name?: string | null, userId?: number | string | null) => {
  if (name) return name;
  if (userId === null || userId === undefined || String(userId).trim() === '') return '系统自动';
  return `用户#${userId}`;
};

const getList = async () => {
  loading.value = true;
  try {
    const res: any = await receivedApi.list({
      period: queryParams.period || undefined,
      status: queryParams.status || undefined,
      currentNode: queryParams.currentNode || undefined,
      keyword: queryParams.keyword || undefined,
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
const resetQuery = () => {
  Object.assign(queryParams, {
    period: currentPeriod(), status: '', currentNode: '', keyword: '', pageNum: 1,
  });
  getList();
};

// 详情
const showDetail = ref(false);
const detailApp = ref<ReceivedApply | null>(null);
const detailFacts = ref<ReceivedFact[]>([]);

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

const approve = async (row: ReceivedApply) => {
  try {
    await ElMessageBox.confirm(`确认通过实收审批单「${row.applyNo}」？`, '审批通过', { type: 'success' });
  } catch {
    return;
  }
  try {
    await receivedApi.approve(row.id);
    ElMessage.success('已通过');
    getList();
  } catch { /* 拦截器处理 */ }
};

const reject = async (row: ReceivedApply) => {
  try {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回', {
      confirmButtonText: '确认驳回',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: (v: string) => !!(v && v.trim()) || '驳回原因为必填项',
    });
    await receivedApi.reject(row.id, value);
    ElMessage.success('已驳回');
    getList();
  } catch { /* 取消或错误 */ }
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
    ElMessage.success('已重新提交');
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

// Excel 批量审批
const handleBatchApproveUpload = async (options: any) => {
  const period = queryParams.period || currentPeriod();
  try {
    const res: any = await receivedApi.batchApprove(options.file as File, period);
    const r = res?.data;
    if (r && r.failedRows?.length) {
      ElMessageBox.alert(
        `成功 ${r.successCount} 条，失败 ${r.failedRows.length} 条：\n`
        + r.failedRows.slice(0, 20).map((f: any) => `· ${f.contractNo}：${f.reason}`).join('\n'),
        '批量审批结果', { confirmButtonText: '知道了' },
      );
    } else {
      ElMessage.success(`批量审批完成，成功 ${r?.successCount ?? 0} 条`);
    }
    getList();
  } catch { /* 拦截器处理 */ }
};

// 工作流：通过（办理待办任务，完成后由监听器回写单据状态）
const handleFlowPass = async () => {
  const ok = await passTask(flowTaskId.value);
  if (ok) {
    showDetail.value = false;
    getList();
  }
};

// 工作流：驳回
const handleFlowReject = async () => {
  const ok = await rejectTask(flowTaskId.value);
  if (ok) {
    showDetail.value = false;
    getList();
  }
};

// 工作流跳转：从「我的待办」点【去处理】进入，按 query 参数直接打开待审单据
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  const taskId = route.query.taskId as string;
  if (!id || !type) return;
  flowType.value = type;
  flowTaskId.value = taskId || '';
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
    // 背景列表对齐到该单据期间，便于审批人顺带看到同期间其他单据
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

.flow-banner {
  margin-bottom: 12px;

  b {
    font-weight: 600;
  }

  .flow-banner-sep {
    margin: 0 4px;
    color: var(--el-text-color-placeholder);
  }

  .flow-banner-amount {
    margin-left: 8px;
    color: #f56c6c;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
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
}

.data-table {
  width: 100%;

  .contract-link {
    font-weight: 600;
    padding: 0;
  }

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .amount-red {
    color: #f56c6c;
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

  .amount {
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    color: #909399;
  }
}
</style>
