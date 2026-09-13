<template>
  <div class="commission-apply" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">结佣申请</h3>
        <el-button type="primary" @click="openCreate">+ 发起结佣</el-button>
      </div>

      <!-- 筛选 -->
      <el-form :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="期间">
          <el-date-picker
            v-model="queryParams.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            clearable
            style="width: 160px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="全部门店"
            clearable
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
        <el-form-item>
          <el-button type="primary" @click="handleQuery">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="appList" stripe border>
        <el-table-column label="申请单号" prop="applyNo" min-width="200" show-overflow-tooltip />
        <el-table-column label="期间" prop="period" width="100" />
        <el-table-column label="门店" width="140">
          <template #default="{ row }">{{ deptName(row.deptId) }}</template>
        </el-table-column>
        <el-table-column label="明细数" prop="itemCount" width="90" align="center" />
        <el-table-column label="合计金额" width="140" align="right">
          <template #default="{ row }">¥{{ fmt(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="发起人" width="100" align="center">
          <template #default="{ row }">{{ row.applicantId === 0 ? '系统' : (row.applicantId || '—') }}</template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="280" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <template v-if="row.status === 'DRAFT' || row.status === 'SUBMITTED'">
              <el-button link type="success" @click="refresh(row)">增量重拉</el-button>
              <el-button v-if="row.status === 'DRAFT'" link type="warning" @click="submit(row)">提交</el-button>
              <el-button v-if="row.status === 'SUBMITTED'" link type="success" @click="approve(row, true)">通过</el-button>
              <el-button v-if="row.status === 'SUBMITTED'" link type="danger" @click="approve(row, false)">驳回</el-button>
              <el-button link type="info" @click="cancel(row)">作废</el-button>
            </template>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无结佣申请单" /></template>
      </el-table>

      <!-- 分页 -->
      <div class="pagination-wrap">
        <el-pagination
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
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
    <el-dialog v-model="showDetail" title="结佣申请单详情" width="900px" top="5vh">
      <el-descriptions v-if="detailApp" :column="3" border size="small">
        <el-descriptions-item label="申请单号">{{ detailApp.applyNo }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailApp.period }}</el-descriptions-item>
        <el-descriptions-item label="门店">{{ deptName(detailApp.deptId) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailApp.status)" size="small">{{ statusLabel(detailApp.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="明细数">{{ detailApp.itemCount }}</el-descriptions-item>
        <el-descriptions-item label="合计金额">¥{{ fmt(detailApp.totalAmount) }}</el-descriptions-item>
        <el-descriptions-item label="发起人">{{ detailApp.applicantId === 0 ? '系统自动' : (detailApp.applicantId || '—') }}</el-descriptions-item>
        <el-descriptions-item label="审批通过月">{{ detailApp.approvedMonth || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailApp.createTime }}</el-descriptions-item>
      </el-descriptions>

      <div class="mt-4">
        <div class="text-sm font-medium mb-2">结佣明细（{{ detailItems.length }} 条）</div>
        <el-table :data="detailItems" stripe border size="small" max-height="400">
          <el-table-column label="明细ID" prop="id" width="120" />
          <el-table-column label="业绩事实ID" prop="performanceFactId" width="120">
            <template #default="{ row }">{{ row.performanceFactId || '—' }}</template>
          </el-table-column>
          <el-table-column label="期间" prop="period" width="90" />
          <el-table-column label="员工ID" prop="employeeId" width="100" />
          <el-table-column label="业务类型" prop="bizType" width="100" />
          <el-table-column label="角色类型" prop="roleType" width="100" />
          <el-table-column label="金额" width="120" align="right">
            <template #default="{ row }">¥{{ fmt(row.amount) }}</template>
          </el-table-column>
          <el-table-column label="状态" width="90" align="center">
            <template #default="{ row }">
              <el-tag :type="itemStatusTagType(row.status)" size="small">{{ itemStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="创建时间" prop="createTime" width="160" />
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
import { ref, reactive, onMounted } from 'vue';
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

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

<style scoped>
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
.mt-4 {
  margin-top: 16px;
}
.text-sm {
  font-size: 14px;
}
.font-medium {
  font-weight: 500;
}
.mb-2 {
  margin-bottom: 8px;
}
</style>
