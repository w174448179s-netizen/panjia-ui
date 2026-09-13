<template>
  <div class="payroll-adjust" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">调整与补发</h3>
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
        <el-form-item label="类型">
          <el-select v-model="queryParams.adjustType" placeholder="全部类型" clearable style="width: 140px" @change="handleQuery">
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="员工">
          <el-select
            v-model="queryParams.employeeId"
            placeholder="搜索员工姓名/工号"
            filterable
            remote
            clearable
            :remote-method="searchEmployee"
            :loading="empLoading"
            style="width: 220px"
            @change="handleQuery"
          >
            <el-option
              v-for="emp in empOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 工具栏 -->
      <div class="flex items-center gap-2 mb-4">
        <el-button @click="getList">刷新</el-button>
        <el-button type="primary" @click="openAdd">+ 新增调整</el-button>
      </div>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="adjustList" stripe border>
        <el-table-column label="期间" prop="targetPeriod" width="110" />
        <el-table-column label="员工" min-width="140">
          <template #default="{ row }">{{ empDisplay(row.employeeId) }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.adjustType)" size="small">{{ typeLabel(row.adjustType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" prop="amount" width="130" align="right">
          <template #default="{ row }">
            <b :class="amountClass(row.amount)">¥{{ fmt(row.amount) }}</b>
          </template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无调整记录" /></template>
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

    <!-- 新增弹窗 -->
    <el-dialog v-model="showAdd" title="新增调整/补发" width="520px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="调整类型" prop="adjustType">
          <el-select v-model="form.adjustType" placeholder="请选择类型" style="width:100%">
            <el-option v-for="opt in typeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="目标期间" prop="targetPeriod">
          <el-date-picker v-model="form.targetPeriod" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            placeholder="搜索员工姓名/工号"
            filterable
            remote
            :remote-method="searchEmployeeForForm"
            :loading="empLoading"
            style="width:100%"
          >
            <el-option
              v-for="emp in formEmpOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="金额" prop="amount">
          <el-input-number v-model="form.amount" :precision="2" :step="100" controls-position="right" style="width:100%" />
          <div style="font-size: 12px; color: var(--el-text-color-secondary); margin-top: 4px;">正数补发，负数扣回</div>
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入调整原因" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="调整详情" width="520px">
      <el-descriptions v-if="detailData" :column="2" border size="small">
        <el-descriptions-item label="期间">{{ detailData.targetPeriod }}</el-descriptions-item>
        <el-descriptions-item label="员工">{{ empDisplay(detailData.employeeId) }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeLabel(detailData.adjustType) }}</el-descriptions-item>
        <el-descriptions-item label="金额">¥{{ fmt(detailData.amount) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ detailData.createTime }}</el-descriptions-item>
        <el-descriptions-item label="原因" :span="2">{{ detailData.reason || '—' }}</el-descriptions-item>
      </el-descriptions>
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
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { payrollApi, type PayrollAdjust } from '@/api/panjia/payroll';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();
const flowType = ref<string>('');
const flowTaskId = ref<string>('');

const loading = ref(false);
const adjustList = ref<PayrollAdjust[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  adjustType: '' as string,
  status: '' as string,
  employeeId: '' as string,
});

const TYPE_MAP: Record<string, string> = {
  ADJUST: '调整', SUPPLEMENT: '补发', RECOVER: '退单追回',
};
const typeOptions = Object.entries(TYPE_MAP).map(([value, label]) => ({ value, label }));
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = { ADJUST: 'warning', SUPPLEMENT: 'success', RECOVER: 'danger' };
  return (map as any)[t] || 'info';
};

const STATUS_MAP: Record<string, string> = {
  SUBMITTED: '已提交', APPROVED: '已审批', REJECTED: '已拒绝', CANCELLED: '已取消', EXECUTED: '已执行',
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    SUBMITTED: 'warning', APPROVED: 'primary', REJECTED: 'danger', CANCELLED: 'info', EXECUTED: 'success',
  };
  return (map as any)[s] || 'info';
};

const fmt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amountClass = (n: number | undefined) => {
  if (n == null) return '';
  if (n > 0) return 'text-success';
  if (n < 0) return 'text-danger';
  return '';
};

// 员工搜索
const empOptions = ref<Employee[]>([]);
const formEmpOptions = ref<Employee[]>([]);
const empLoading = ref(false);
const empCache = ref<Map<string, Employee>>(new Map());
let empTimer: ReturnType<typeof setTimeout> | null = null;

const empDisplay = (id: number) => {
  const emp = empCache.value.get(String(id));
  return emp ? `${emp.employeeName}（${emp.employeeCode}）` : String(id);
};

const doSearch = async (keyword: string, target: 'filter' | 'form') => {
  empLoading.value = true;
  try {
    const res = await employeeApi.list({ employeeName: keyword || undefined, pageSize: 20 });
    const rows = (res as any).data?.rows ?? [];
    rows.forEach((emp: Employee) => empCache.value.set(emp.employeeId, emp));
    if (target === 'filter') empOptions.value = rows;
    else formEmpOptions.value = rows;
  } finally {
    empLoading.value = false;
  }
};

const searchEmployee = (keyword: string) => {
  if (empTimer) clearTimeout(empTimer);
  empTimer = setTimeout(() => doSearch(keyword, 'filter'), 300);
};

const searchEmployeeForForm = (keyword: string) => {
  if (empTimer) clearTimeout(empTimer);
  empTimer = setTimeout(() => doSearch(keyword, 'form'), 300);
};

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res = await payrollApi.listAdjusts({
      period: queryParams.period || undefined,
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = (res as any).data;
    adjustList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
    // 预加载员工信息
    preloadEmployees();
  } catch {
    adjustList.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
};

const preloadEmployees = async () => {
  const ids = [...new Set(adjustList.value.map((r) => String(r.employeeId)))];
  const missing = ids.filter((id) => !empCache.value.has(id));
  if (!missing.length) return;
  try {
    const res = await employeeApi.list({ pageSize: 100 });
    const rows = (res as any).data?.rows ?? [];
    rows.forEach((emp: Employee) => empCache.value.set(emp.employeeId, emp));
  } catch { /* ignore */ }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  Object.assign(queryParams, { period: '', adjustType: '', status: '', employeeId: '', pageNum: 1 });
  getList();
};

// 新增
const showAdd = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();
const form = reactive({
  adjustType: 'ADJUST',
  targetPeriod: '',
  employeeId: null as string | null,
  amount: 0,
  reason: '',
});

const rules = {
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  targetPeriod: [{ required: true, message: '请选择目标期间', trigger: 'change' }],
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
};

const openAdd = () => {
  Object.assign(form, { adjustType: 'ADJUST', targetPeriod: '', employeeId: null, amount: 0, reason: '' });
  formEmpOptions.value = [];
  showAdd.value = true;
};

const submit = async () => {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    await payrollApi.createAdjust({
      ...form,
      employeeId: form.employeeId as any,
    });
    ElMessage.success('提交成功');
    showAdd.value = false;
    getList();
  } finally {
    submitting.value = false;
  }
};

// 详情
const showDetail = ref(false);
const detailData = ref<PayrollAdjust | null>(null);

const viewDetail = async (row: PayrollAdjust) => {
  detailData.value = row;
  showDetail.value = true;
  try {
    const res = await payrollApi.getAdjust(row.id);
    detailData.value = (res as any).data ?? row;
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

// 工作流跳转
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  const taskId = route.query.taskId as string;
  if (!id || !type) return;
  flowType.value = type;
  flowTaskId.value = taskId || '';
  try {
    const res = await payrollApi.getAdjust(Number(id));
    detailData.value = (res as any).data;
    showDetail.value = true;
  } catch {
    ElMessage.error('加载单据失败');
  }
};

onMounted(() => {
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
.text-success { color: var(--el-color-success); font-weight: 600; }
.text-danger { color: var(--el-color-danger); font-weight: 600; }
</style>
