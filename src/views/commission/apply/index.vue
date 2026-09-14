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
          <el-button type="primary" icon="Plus" :loading="batchCreating" @click="openBatchCreate">
            批量发起{{ queryParams.period ? `（${queryParams.period}）` : '' }}
          </el-button>
          <el-upload
            :show-file-list="false"
            :auto-upload="true"
            :http-request="handleBatchInitiateUpload"
            accept=".xlsx,.xls"
          >
            <el-button type="primary" plain icon="Upload">Excel批量发起</el-button>
          </el-upload>
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

      <!-- 合同维度表格 -->
      <el-table border class="data-table" :data="contractList">
        <el-table-column label="合同号/订单号" align="center" min-width="180" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-button v-if="row.applicationId" type="primary" link class="contract-link" @click="viewDetail(row)">
              {{ contractOrOrderNo(row) }}
            </el-button>
            <span v-else class="contract-text">{{ contractOrOrderNo(row) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实收(结佣)" align="right" width="120" fixed="left">
          <template #default="{ row }">
            <span class="amount amount-red">¥{{ formatAmount(row.amount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="应收" align="right" width="120">
          <template #default="{ row }">
            <span class="amount">¥{{ formatAmount(row.expectedAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="差异/节点" align="center" width="110">
          <template #default="{ row }">
            <el-tag v-if="row.aligned" type="success" size="small">已对齐</el-tag>
            <el-tag v-else-if="hasDiff(row)" type="danger" size="small">有差异</el-tag>
            <el-tag v-else-if="row.currentNode" type="warning" size="small">{{ nodeLabel(row.currentNode) }}</el-tag>
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
          <template #default="{ row }">{{ row.applicantId === 0 ? '系统' : (applicantName(row.applicantId) || '—') }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="220" fixed="right">
          <template #default="{ row }">
            <el-tooltip v-if="row.applicationId" content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="viewDetail(row)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="canOriginate(row)" content="发起" placement="top">
              <el-button link type="primary" icon="Plus" @click="originate(row as CommissionContractVO)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'DRAFT' || row.status === 'REJECTED'" content="提交" placement="top">
              <el-button link type="warning" icon="Upload" @click="submit(row)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'SUBMITTED'" content="通过" placement="top">
              <el-button link type="success" icon="CircleCheck" @click="approve(row, true)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'SUBMITTED'" content="驳回" placement="top">
              <el-button link type="danger" icon="CircleClose" @click="approve(row, false)"></el-button>
            </el-tooltip>
            <el-tooltip v-if="row.status === 'DRAFT' || row.status === 'SUBMITTED'" content="作废" placement="top">
              <el-button link type="info" icon="Delete" @click="cancel(row)"></el-button>
            </el-tooltip>
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

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="结佣明细详情" width="1000px" top="5vh">
      <el-descriptions v-if="detailApp" :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="申请单号">{{ detailApp.applyNo }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailApp.period }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailApp.status)" size="small">{{ statusLabel(detailApp.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="合同号">{{ detailApp.contractNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="订单号">{{ detailApp.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="签约时间">{{ formatDateTime(detailApp.businessDate) }}</el-descriptions-item>
        <el-descriptions-item label="房源地址" :span="3">{{ detailApp.propertyAddress || '—' }}</el-descriptions-item>
        <el-descriptions-item label="归属门店">{{ detailApp.deptId ? deptName(detailApp.deptId) : '跨门店合作' }}</el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detailApp.itemCount }}</el-descriptions-item>
        <el-descriptions-item label="实收合计">
          <span class="amount amount-red">¥{{ formatAmount(detailApp.totalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="应收合计">¥{{ formatAmount(detailApp.expectedAmount) }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ detailApp.currentNode ? nodeLabel(detailApp.currentNode) : '—' }}</el-descriptions-item>
        <el-descriptions-item label="实收对齐应收">{{ detailApp.aligned ? '已对齐' : '未对齐' }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ detailApp.applicantId === 0 ? '系统自动' : (applicantName(detailApp.applicantId) || '—') }}</el-descriptions-item>
        <el-descriptions-item label="审批通过月">{{ detailApp.approvedMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailApp.createTime }}</el-descriptions-item>
      </el-descriptions>

      <div class="detail-table-wrap">
        <div class="detail-table-title">结佣明细（{{ detailItems.length }} 条）</div>
        <el-table :data="detailItems" border size="small" max-height="450" class="detail-table">
          <el-table-column label="序号" type="index" width="55" align="center" />
          <el-table-column label="员工" min-width="120">
            <template #default="{ row }">{{ employeeName(row.employeeId) }}</template>
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

      <template #footer>
        <template v-if="flowType === 'approval'">
          <el-button type="success" :loading="taskOperating" @click="handleFlowPass">通过</el-button>
          <el-button type="danger" :loading="taskOperating" @click="handleFlowReject">驳回</el-button>
        </template>
        <el-button @click="showDetail = false">{{ flowType === 'approval' ? '取消' : '关闭' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { commissionApi, type CommissionApplication, type CommissionContractVO, type CommissionItem } from '@/api/panjia/commission';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();

// 工作流跳转参数
const flowType = ref<string>(''); // view | approval
const flowTaskId = ref<string>('');

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

// 合同号/订单号合并展示
const contractOrOrderNo = (row: CommissionContractVO): string => {
  if (row.bizType === '一手房') {
    return row.orderNo || row.contractNo || '—';
  }
  return row.contractNo || row.orderNo || '—';
};

// 部门树
const deptTreeData = ref<DeptNode[]>([]);
const deptMap = new Map<number, string>();

const loadDeptTree = async () => {
  try {
    const res: any = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
    buildDeptMap(deptTreeData.value);
  } catch { /* ignore */ }
};

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

// 员工姓名映射
const employeeMap = new Map<number, string>();
const employeeName = (empId: number | undefined) => {
  if (empId == null) return '—';
  return employeeMap.get(empId) ?? `员工#${empId}`;
};

// 发起人姓名（从员工映射取）
const applicantName = (applicantId: number | undefined) => {
  if (applicantId == null) return '—';
  return employeeMap.get(applicantId) ?? `用户#${applicantId}`;
};

const loadEmployeeMap = async () => {
  try {
    const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
    const rows = res.data?.rows ?? [];
    for (const e of rows) {
      if (e.employeeId != null) employeeMap.set(Number(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
    }
  } catch { /* ignore */ }
};

// 状态映射
const STATUS_MAP: Record<string, string> = {
  NONE: '未发起', DRAFT: '草稿', SUBMITTED: '已提交', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
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

const ITEM_STATUS_MAP: Record<string, string> = {
  DRAFT: '待提交', PENDING: '待审批', APPROVED: '已通过', REVERSED: '已冲销',
};
const itemStatusLabel = (s: string) => ITEM_STATUS_MAP[s] || s || '—';
const itemStatusTagType = (s: string) => {
  const map: Record<string, string> = { DRAFT: 'info', PENDING: 'warning', APPROVED: 'success', REVERSED: 'danger' };
  return (map as any)[s] || 'info';
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.listContracts({
      period: queryParams.period || currentPeriod(),
      deptId: queryParams.deptId ? Number(queryParams.deptId) : undefined,
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

// 单个合同发起
const originate = async (row: CommissionContractVO) => {
  const no = contractOrOrderNo(row);
  try {
    await ElMessageBox.confirm(
      `确认为合同「${no}」${row.period} 月发起结佣？将按该合同当月实收业绩生成申请单（草稿）。`,
      '发起结佣', { type: 'info' },
    );
  } catch {
    return;
  }
  try {
    await commissionApi.createApplication({ period: row.period, contractNo: row.contractNo });
    ElMessage.success('发起成功');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 批量发起
const batchCreating = ref(false);
const openBatchCreate = async () => {
  const period = queryParams.period || currentPeriod();
  const scope = queryParams.deptId ? '当前选中门店（含下级）范围内' : '全部门店';
  try {
    await ElMessageBox.confirm(
      `确认为${scope}${period} 月所有「未发起」合同批量创建结佣明细？`,
      '批量发起结佣', { type: 'info' },
    );
  } catch {
    return;
  }
  batchCreating.value = true;
  try {
    const res: any = await commissionApi.batchCreateApplications({
      period,
      deptId: queryParams.deptId ? Number(queryParams.deptId) : undefined,
    });
    ElMessage.success(res?.msg || '批量发起完成');
    getList();
  } catch { /* 拦截器处理（含部分失败提示） */ } finally {
    batchCreating.value = false;
  }
};

// 提交
const submit = async (row: CommissionContractVO) => {
  try {
    await ElMessageBox.confirm(`确认提交申请单「${row.applyNo}」？提交后进入审批流程。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.submitApplication(row.applicationId);
    ElMessage.success('已提交');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 审批节点中文名
const nodeLabel = (node?: string) => node === 'DIRECTOR' ? '总监审批' : node === 'FINANCE' ? '财务审批' : (node || '—');

// 是否有差异（实收 vs 应收，均有值时比较）
const hasDiff = (row: CommissionContractVO) =>
  row.expectedAmount !== undefined && row.expectedAmount !== null
  && num(row.amount) !== num(row.expectedAmount);

// 审批（通过：按当前节点办理，总监节点有差异会自动对齐并转财务）
const approve = async (row: CommissionContractVO, pass: boolean) => {
  const action = pass ? '通过' : '驳回';
  try {
    await ElMessageBox.confirm(`确认${action}申请单「${row.applyNo}」？${pass ? '通过后结佣明细将锁定并进入工资计算。' : ''}`, '提示', { type: pass ? 'success' : 'warning' });
  } catch {
    return;
  }
  try {
    if (pass) {
      await commissionApi.approveApplication(row.applicationId!);
    } else {
      await commissionApi.rejectApplication(row.applicationId!);
    }
    ElMessage.success(`已${action}`);
    getList();
  } catch { /* 拦截器处理 */ }
};

// Excel 批量发起上传
const handleBatchInitiateUpload = async (options: any) => {
  const period = queryParams.period || currentPeriod();
  try {
    const res: any = await commissionApi.batchInitiate(options.file as File, period);
    const r = res?.data;
    if (r && r.failedRows?.length) {
      ElMessageBox.alert(
        `成功 ${r.successCount} 条，失败 ${r.failedRows.length} 条：\n`
        + r.failedRows.slice(0, 20).map((f: any) => `· ${f.contractNo}：${f.reason}`).join('\n'),
        '批量发起结果', { confirmButtonText: '知道了' },
      );
    } else {
      ElMessage.success(`批量发起完成，成功 ${r?.successCount ?? 0} 条`);
    }
    getList();
  } catch { /* 拦截器处理 */ }
};

// Excel 批量审批上传
const handleBatchApproveUpload = async (options: any) => {
  const period = queryParams.period || currentPeriod();
  try {
    const res: any = await commissionApi.batchApprove(options.file as File, period);
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
const detailApp = ref<CommissionApplication | null>(null);
const detailItems = ref<CommissionItem[]>([]);

const viewDetail = async (row: CommissionContractVO) => {
  if (!row.applicationId) return;
  detailItems.value = [];
  showDetail.value = true;
  await loadEmployeeMap();
  try {
    const res: any = await commissionApi.getApplication(row.applicationId);
    const data = res.data ?? {};
    detailApp.value = data.application ?? null;
    detailItems.value = data.items ?? [];
  } catch { /* 错误已提示 */ }
};

// 工作流：通过
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

// 工作流跳转：根据 query 参数打开详情
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  const taskId = route.query.taskId as string;
  if (!id || !type) return;
  flowType.value = type;
  flowTaskId.value = taskId || '';
  await loadEmployeeMap();
  try {
    const res: any = await commissionApi.getApplication(Number(id));
    const data = res.data ?? {};
    detailApp.value = data.application;
    detailItems.value = data.items ?? [];
    showDetail.value = true;
  } catch {
    ElMessage.error('加载单据失败');
  }
};

const formatDateTime = (val?: string | null): string => {
  if (!val) return '—';
  return val.replace('T', ' ').substring(0, 19);
};

onMounted(() => {
  loadDeptTree();
  loadEmployeeMap();
  getList();
  openFromWorkflow();
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
</style>
