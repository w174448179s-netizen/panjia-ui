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
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 汇总条 -->
      <div class="summary-bar">
        <div class="summary-left">
          <span class="summary-text">
            共 <b>{{ summary.applyCount }}</b> 个申请单 ·
            涉及 <b>{{ summary.employeeCount }}</b> 人 ·
            合计 <b>{{ summary.itemCount }}</b> 条明细
          </span>
        </div>
        <div class="summary-right">
          <span class="summary-amount">结佣合计：<b>{{ formatAmount(summary.totalAmount) }}</b></span>
          <el-button type="primary" icon="Plus" @click="openCreate">发起结佣</el-button>
        </div>
      </div>

      <!-- 表格 -->
      <el-table border class="data-table" :data="appList">
        <el-table-column label="申请单号" align="center" min-width="200" show-overflow-tooltip fixed="left">
          <template #default="{ row }">
            <el-button type="primary" link class="apply-link" @click="viewDetail(row)">
              {{ row.applyNo }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="期间" align="center" width="100">
          <template #default="{ row }">{{ row.period }}</template>
        </el-table-column>
        <el-table-column label="门店" align="center" width="140">
          <template #default="{ row }">{{ deptName(row.deptId) }}</template>
        </el-table-column>
        <el-table-column label="明细数" align="center" width="90">
          <template #default="{ row }">{{ row.itemCount }}</template>
        </el-table-column>
        <el-table-column label="合计金额" align="right" width="130">
          <template #default="{ row }">
            <span class="amount amount-red">¥{{ formatAmount(row.totalAmount) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" width="100">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" align="center" width="100">
          <template #default="{ row }">{{ row.applicantId === 0 ? '系统' : (row.applicantId || '—') }}</template>
        </el-table-column>
        <el-table-column label="创建时间" align="center" width="160">
          <template #default="{ row }">{{ row.createTime }}</template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="220" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="详情" placement="top">
              <el-button link type="primary" icon="View" @click="viewDetail(row)"></el-button>
            </el-tooltip>
            <template v-if="row.status === 'DRAFT' || row.status === 'SUBMITTED'">
              <el-tooltip content="增量重拉" placement="top">
                <el-button link type="success" icon="Refresh" @click="refresh(row)"></el-button>
              </el-tooltip>
              <el-tooltip v-if="row.status === 'DRAFT'" content="提交" placement="top">
                <el-button link type="warning" icon="Upload" @click="submit(row)"></el-button>
              </el-tooltip>
              <el-tooltip v-if="row.status === 'SUBMITTED'" content="通过" placement="top">
                <el-button link type="success" icon="CircleCheck" @click="approve(row, true)"></el-button>
              </el-tooltip>
              <el-tooltip v-if="row.status === 'SUBMITTED'" content="驳回" placement="top">
                <el-button link type="danger" icon="CircleClose" @click="approve(row, false)"></el-button>
              </el-tooltip>
              <el-tooltip content="作废" placement="top">
                <el-button link type="info" icon="Delete" @click="cancel(row)"></el-button>
              </el-tooltip>
            </template>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty :description="queryParams.period ? '该期间暂无结佣申请' : '暂无结佣申请单'" />
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

    <!-- 发起结佣弹窗 -->
    <el-dialog v-model="showCreate" title="发起结佣" width="480px" destroy-on-close>
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="100px">
        <el-form-item label="结算月" prop="period">
          <el-date-picker v-model="createForm.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="门店" prop="deptId">
          <el-tree-select
            v-model="createForm.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="选择门店"
            check-strictly
            style="width:100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">发起</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="结佣申请单详情" width="1000px" top="5vh">
      <el-descriptions v-if="detailApp" :column="3" border size="small" class="detail-desc">
        <el-descriptions-item label="申请单号">{{ detailApp.applyNo }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailApp.period }}</el-descriptions-item>
        <el-descriptions-item label="门店">{{ deptName(detailApp.deptId) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailApp.status)" size="small">{{ statusLabel(detailApp.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detailApp.itemCount }}</el-descriptions-item>
        <el-descriptions-item label="合计金额">
          <span class="amount amount-red">¥{{ formatAmount(detailApp.totalAmount) }}</span>
        </el-descriptions-item>
        <el-descriptions-item label="发起人">{{ detailApp.applicantId === 0 ? '系统自动' : (detailApp.applicantId || '—') }}</el-descriptions-item>
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
import type { FormInstance } from 'element-plus';
import { commissionApi, type CommissionApplication, type CommissionItem } from '@/api/panjia/commission';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode } from '@/api/panjia/types';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();

// 工作流跳转参数
const flowType = ref<string>(''); // view | approval
const flowTaskId = ref<string>('');

const loading = ref(false);
const appList = ref<CommissionApplication[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  deptId: undefined as string | undefined,
  status: '' as string,
});

// 汇总统计
const summary = computed(() => {
  const list = appList.value;
  const totalAmount = list.reduce((s, r) => s + (r.totalAmount || 0), 0);
  const itemCount = list.reduce((s, r) => s + (r.itemCount || 0), 0);
  return {
    applyCount: list.length,
    itemCount,
    employeeCount: 0,
    totalAmount,
  };
});

// 金额格式化
const formatAmount = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
  DRAFT: '草稿', SUBMITTED: '已提交', APPROVED: '已通过', LOCKED: '已锁定', REJECTED: '已驳回', CANCELLED: '已作废',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'primary', LOCKED: 'success', REJECTED: 'danger', CANCELLED: 'info',
  };
  return (map as any)[s] || 'info';
};

const ITEM_STATUS_MAP: Record<string, string> = {
  PENDING: '待审批', APPROVED: '已通过', REVERSED: '已冲销',
};
const itemStatusLabel = (s: string) => ITEM_STATUS_MAP[s] || s || '—';
const itemStatusTagType = (s: string) => {
  const map: Record<string, string> = { PENDING: 'warning', APPROVED: 'success', REVERSED: 'danger' };
  return (map as any)[s] || 'info';
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res: any = await commissionApi.listApplications({
      period: queryParams.period || undefined,
      deptId: queryParams.deptId ? Number(queryParams.deptId) : undefined,
      status: queryParams.status || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = res.data;
    appList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
  } catch {
    appList.value = [];
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
  Object.assign(queryParams, { period: '', deptId: undefined, status: '', pageNum: 1 });
  getList();
};

// 发起
const showCreate = ref(false);
const creating = ref(false);
const createFormRef = ref<FormInstance>();
const createForm = reactive({ period: '', deptId: undefined as string | undefined });
const createRules = {
  period: [{ required: true, message: '请选择结算月', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择门店', trigger: 'change' }],
};

const openCreate = () => {
  createForm.period = '';
  createForm.deptId = undefined;
  showCreate.value = true;
};

const doCreate = async () => {
  if (!createFormRef.value) return;
  try {
    await createFormRef.value.validate();
  } catch {
    return;
  }
  creating.value = true;
  try {
    await commissionApi.createApplication({ period: createForm.period, deptId: Number(createForm.deptId) });
    ElMessage.success('发起成功');
    showCreate.value = false;
    getList();
  } finally {
    creating.value = false;
  }
};

// 增量重拉
const refresh = async (row: CommissionApplication) => {
  try {
    await ElMessageBox.confirm(`确认对申请单「${row.applyNo}」执行增量重拉？将追加新导入的实收业绩。`, '提示', { type: 'info' });
  } catch {
    return;
  }
  try {
    await commissionApi.refreshApplication(row.id);
    ElMessage.success('增量重拉完成');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 提交
const submit = async (row: CommissionApplication) => {
  try {
    await ElMessageBox.confirm(`确认提交申请单「${row.applyNo}」？提交后进入审批流程。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.submitApplication(row.id);
    ElMessage.success('已提交');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 审批
const approve = async (row: CommissionApplication, pass: boolean) => {
  const action = pass ? '通过' : '驳回';
  try {
    await ElMessageBox.confirm(`确认${action}申请单「${row.applyNo}」？${pass ? '通过后结佣明细将锁定并进入工资计算。' : ''}`, '提示', { type: pass ? 'success' : 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.approveApplication(row.id, pass);
    ElMessage.success(`已${action}`);
    getList();
  } catch { /* 拦截器处理 */ }
};

// 作废
const cancel = async (row: CommissionApplication) => {
  try {
    await ElMessageBox.confirm(`确认作废申请单「${row.applyNo}」？作废后不可恢复。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.cancelApplication(row.id);
    ElMessage.success('已作废');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 详情
const showDetail = ref(false);
const detailApp = ref<CommissionApplication | null>(null);
const detailItems = ref<CommissionItem[]>([]);

const viewDetail = async (row: CommissionApplication) => {
  detailApp.value = row;
  detailItems.value = [];
  showDetail.value = true;
  await loadEmployeeMap();
  try {
    const res: any = await commissionApi.getApplication(row.id);
    const data = res.data ?? {};
    detailApp.value = data.application ?? row;
    detailItems.value = data.items ?? [];
  } catch { /* 使用列表数据 */ }
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

onMounted(() => {
  loadDeptTree();
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

  .apply-link {
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
</style>
