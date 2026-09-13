<template>
  <div class="performance-adjust-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams" @submit.prevent>
          <el-form-item label="期间" prop="period">
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
          <el-form-item label="调整类型" prop="adjustType">
            <el-select
              v-model="queryParams.adjustType"
              placeholder="全部类型"
              clearable
              style="width: 150px"
              @change="handleQuery"
            >
              <el-option
                v-for="opt in adjustTypeOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="状态" prop="status">
            <el-select
              v-model="queryParams.status"
              placeholder="全部状态"
              clearable
              style="width: 130px"
              @change="handleQuery"
            >
              <el-option
                v-for="opt in statusOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="员工" prop="employeeId">
            <el-select
              v-model="queryParams.employeeId"
              placeholder="搜索员工姓名/工号"
              filterable
              remote
              clearable
              :remote-method="searchEmployee"
              :loading="employeeLoading"
              style="width: 220px"
              @change="handleQuery"
            >
              <el-option
                v-for="emp in employeeOptions"
                :key="emp.employeeId"
                :label="`${emp.employeeName}（${emp.employeeCode}）`"
                :value="emp.employeeId"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="门店/组别" prop="deptId">
            <el-tree-select
              v-model="queryParams.deptId"
              :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' }"
              value-key="deptId"
              node-key="deptId"
              placeholder="全部门店/组别"
              clearable
              check-strictly
              style="width: 220px"
              @change="handleQuery"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <!-- 工具栏 -->
        <div class="toolbar">
          <el-button icon="Refresh" @click="getList">刷新</el-button>
          <el-button type="primary" icon="Plus" @click="handleCreate">新增调整单</el-button>
        </div>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="adjustList"
          :default-sort="{ prop: 'createTime', order: 'descending' }"
        >
          <el-table-column label="调整单号" align="center" prop="adjustNo" min-width="180" show-overflow-tooltip />
          <el-table-column label="期间" align="center" prop="period" width="100" />
          <el-table-column label="员工" align="center" width="110" show-overflow-tooltip>
            <template #default="scope">
              {{ scope.row.employeeName || scope.row.employeeId || '—' }}
            </template>
          </el-table-column>
          <el-table-column label="门店/组别" align="center" min-width="150" show-overflow-tooltip>
            <template #default="scope">
              <span>{{ scope.row.deptName || '—' }}</span>
              <span v-if="scope.row.adjustType === 'TRANSFER' && scope.row.targetDeptName"
                class="transfer-arrow"> → {{ scope.row.targetDeptName }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整类型" align="center" width="100">
            <template #default="scope">
              {{ adjustTypeMap[scope.row.adjustType] ?? scope.row.adjustType }}
            </template>
          </el-table-column>
          <el-table-column label="变动金额" align="center" prop="deltaAmount" width="120">
            <template #default="scope">
              <span :class="getAmountClass(scope.row.deltaAmount)">
                {{ formatAmount(scope.row.deltaAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="原因" align="center" prop="reason" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" align="center" width="100">
            <template #default="scope">
              <el-tag :type="statusTagType(scope.row.status)" size="small">
                {{ statusMap[scope.row.status] ?? scope.row.status }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="申请时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="110" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-tooltip content="详情" placement="top">
                <el-button link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
              </el-tooltip>
              <!-- 审批走 RuoYi 工作流（perf_adjust），不在本页直接通过/拒绝；提交后仅可取消 -->
              <el-tooltip v-if="scope.row.status === 'SUBMITTED'" content="取消" placement="top">
                <el-button link type="info" icon="Close" @click="handleCancel(scope.row)"></el-button>
              </el-tooltip>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && adjustList.length === 0" class="empty-wrap">
          <el-empty description="暂无调整单" />
        </div>

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
      </div>
    </el-card>

    <!-- 新增/详情弹窗 -->
    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.title"
      width="640px"
      append-to-body
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="formData"
        :rules="formRules"
        label-width="100px"
        :disabled="formDialog.mode === 'detail'"
      >
        <el-form-item label="调整类型" prop="adjustType">
          <el-select v-model="formData.adjustType" placeholder="请选择调整类型" style="width: 100%">
            <el-option
              v-for="opt in adjustTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="期间" prop="period">
          <el-date-picker
            v-model="formData.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
            style="width: 100%"
            @change="loadFactOptions"
          />
        </el-form-item>
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="formData.employeeId"
            placeholder="搜索员工姓名/工号"
            filterable
            remote
            :remote-method="searchEmployeeForForm"
            :loading="employeeLoading"
            style="width: 100%"
            @change="onFormEmployeeChange"
          >
            <el-option
              v-for="emp in formEmployeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="formData.employeeId" label="门店/组别">
          <el-input :model-value="selectedEmployeeDept" disabled placeholder="选择员工后自动带出" />
        </el-form-item>
        <el-form-item label="关联业绩" prop="factId">
          <el-select
            v-model="formData.factId"
            placeholder="先选期间和员工后自动加载"
            :loading="factLoading"
            :disabled="!formData.period || !formData.employeeId"
            style="width: 100%"
          >
            <el-option
              v-for="f in factOptions"
              :key="f.id"
              :label="factOptionLabel(f)"
              :value="f.id"
            />
          </el-select>
          <div v-if="formData.factId" class="fact-amount-hint">
            当前原始金额：¥{{ formatAmount(selectedFact?.originAmount) }}
          </div>
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'AMOUNT'" label="变动金额" prop="deltaAmount">
          <el-input-number
            v-model="formData.deltaAmount"
            :min="-99999999"
            :max="99999999"
            :precision="2"
            :step="100"
            style="width: 100%"
          />
          <div class="form-hint">正数调增，负数调减；调整后原始金额 = 当前 + 变动金额</div>
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'TRANSFER'" label="目标门店" prop="targetDeptId">
          <el-tree-select
            v-model="formData.targetDeptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' }"
            value-key="deptId"
            node-key="deptId"
            placeholder="请选择目标门店/组别"
            check-strictly
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input
            v-model="formData.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入调整原因"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template v-if="formDialog.mode === 'detail'">
        <el-descriptions v-if="detailData" :column="2" border size="small" class="detail-desc">
          <el-descriptions-item label="状态">
            <el-tag :type="statusTagType(detailData.status)" size="small">
              {{ statusMap[detailData.status] ?? detailData.status }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="调整单号">{{ detailData.adjustNo }}</el-descriptions-item>
          <el-descriptions-item label="申请人">{{ detailData.applicantName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{ detailData.approverName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="审批时间">{{ detailData.approveTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="执行时间">{{ detailData.executeTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间" :span="2">{{ detailData.createTime }}</el-descriptions-item>
        </el-descriptions>
      </template>

      <template #footer>
        <el-button @click="formDialog.visible = false">{{ flowType === 'approval' ? '取消' : '关 闭' }}</el-button>
        <template v-if="flowType === 'approval'">
          <el-button type="success" :loading="taskOperating" @click="handleFlowPass">通过</el-button>
          <el-button type="danger" :loading="taskOperating" @click="handleFlowReject">驳回</el-button>
        </template>
        <el-button
          v-if="formDialog.mode === 'create'"
          type="primary"
          :loading="submitLoading"
          @click="handleSubmit"
        >
          提 交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceAdjust, AdjustQuery, AdjustCreateForm, PerformanceFact } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode, Employee } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useRoute } from 'vue-router';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();
const flowType = ref<string>('');
const flowTaskId = ref<string>('');

// ==================== 枚举 ====================
const adjustTypeMap: Record<string, string> = {
  AMOUNT: '金额调整',
  VOID: '业绩冲销',
  TRANSFER: '部门划转'
};
const adjustTypeOptions = Object.entries(adjustTypeMap).map(([value, label]) => ({ value, label }));

const statusMap: Record<string, string> = {
  SUBMITTED: '已提交',
  APPROVED: '已审批',
  REJECTED: '已拒绝',
  CANCELLED: '已取消',
  EXECUTED: '已执行'
};
const statusOptions = Object.entries(statusMap).map(([value, label]) => ({ value, label }));

type TagType = 'primary' | 'success' | 'warning' | 'info' | 'danger';
const statusTagType = (status: string): TagType => {
  const map: Record<string, TagType> = {
    SUBMITTED: 'warning',
    APPROVED: 'primary',
    REJECTED: 'danger',
    CANCELLED: 'info',
    EXECUTED: 'success'
  };
  return map[status] ?? 'info';
};

// ==================== 部门树（与人员页同源） ====================
const deptTreeData = ref<DeptNode[]>([]);
const loadDeptTree = async () => {
  try {
    const res = await employeeApi.deptTree();
    deptTreeData.value = res.data ?? [];
  } catch (e) {
    console.error('[adjust] 部门树加载失败', e);
  }
};

// ==================== 员工远程搜索（筛选条用） ====================
const employeeOptions = ref<Employee[]>([]);
const employeeLoading = ref(false);
let empSearchTimer: ReturnType<typeof setTimeout> | null = null;
const searchEmployee = (keyword: string) => {
  if (empSearchTimer) clearTimeout(empSearchTimer);
  empSearchTimer = setTimeout(async () => {
    employeeLoading.value = true;
    try {
      const res = await employeeApi.list({ employeeName: keyword || undefined, pageSize: 20 });
      employeeOptions.value = res.data?.rows ?? [];
    } finally {
      employeeLoading.value = false;
    }
  }, 300);
};

// 表单内员工搜索（独立选项集，避免与筛选条串数据）
const formEmployeeOptions = ref<Employee[]>([]);
const searchEmployeeForForm = (keyword: string) => {
  if (empSearchTimer) clearTimeout(empSearchTimer);
  empSearchTimer = setTimeout(async () => {
    employeeLoading.value = true;
    try {
      const res = await employeeApi.list({ employeeName: keyword || undefined, pageSize: 20 });
      formEmployeeOptions.value = res.data?.rows ?? [];
    } finally {
      employeeLoading.value = false;
    }
  }, 300);
};

// ==================== 筛选 & 分页 ====================
const queryParams = reactive<AdjustQuery & { pageNum: number; pageSize: number }>({
  pageNum: 1,
  pageSize: 20,
  period: undefined,
  adjustType: undefined,
  status: undefined,
  employeeId: undefined,
  deptId: undefined
});

// ==================== 列表 ====================
const loading = ref(false);
const total = ref(0);
const adjustList = ref<PerformanceAdjust[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.listAdjusts({
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      period: queryParams.period || undefined,
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      employeeId: queryParams.employeeId || undefined,
      deptId: queryParams.deptId || undefined
    });
    adjustList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
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
    period: undefined,
    adjustType: undefined,
    status: undefined,
    employeeId: undefined,
    deptId: undefined,
    pageNum: 1
  });
  getList();
};

// ==================== 工具方法 ====================
const num = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const prefix = n > 0 ? '+' : '';
  return prefix + n.toFixed(2);
};

const getAmountClass = (val: number | undefined): string => {
  if (val === undefined || val === null) return '';
  if (val > 0) return 'amount-positive';
  if (val < 0) return 'amount-negative';
  return '';
};

// ==================== 操作：取消（审批/执行由 RuoYi 工作流驱动） ====================
const handleCancel = async (row: any) => {
  try {
    await modal.confirm(`确认取消调整单「${row.adjustNo}」？`);
  } catch {
    return;
  }
  try {
    await performanceApi.cancelAdjust(row.id);
    modal.msgSuccess('已取消');
    getList();
  } catch {
    /* 拦截器已处理 */
  }
};

// ==================== 新增 / 详情弹窗 ====================
const formDialog = reactive({
  visible: false,
  mode: 'create' as 'create' | 'detail',
  title: '新增调整单'
});
const formRef = ref();
const submitLoading = ref(false);
const detailData = ref<PerformanceAdjust | null>(null);

// 关联业绩事实下拉
const factOptions = ref<PerformanceFact[]>([]);
const factLoading = ref(false);
const selectedFact = computed<PerformanceFact | undefined>(() =>
  factOptions.value.find((f) => f.id === formData.factId)
);
const factOptionLabel = (f: PerformanceFact) => {
  const type = f.factType === 'PERF_REAL' ? '实收' : '应收';
  return `${type} · ${f.sourceKey} · ¥${formatAmount(f.originAmount)}`;
};

const defaultFormData = (): AdjustCreateForm & { factId: string } => ({
  factId: '',
  period: '',
  employeeId: '',
  deptId: '',
  adjustType: '',
  deltaAmount: 0,
  targetDeptId: '',
  reason: ''
});

const formData = reactive(defaultFormData());

const formRules = {
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  period: [{ required: true, message: '请选择期间', trigger: 'change' }],
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择门店/组别', trigger: 'change' }],
  factId: [{ required: true, message: '请选择关联业绩事实', trigger: 'change' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  targetDeptId: [{ required: true, message: '请选择目标门店', trigger: 'change' }]
};

// 选完员工：自动带出部门，并尝试加载该员工的业绩事实
const onFormEmployeeChange = async (employeeId: string) => {
  const emp = formEmployeeOptions.value.find((e) => e.employeeId === employeeId);
  if (emp && emp.deptId) {
    formData.deptId = emp.deptId;
  }
  formData.factId = '';
  await loadFactOptions();
};

const loadFactOptions = async () => {
  factOptions.value = [];
  if (!formData.period || !formData.employeeId) return;
  factLoading.value = true;
  try {
    const res = await performanceApi.listFacts({
      period: formData.period,
      employeeId: formData.employeeId,
      factStatus: 'ACTIVE',
      pageSize: 100
    });
    factOptions.value = res.data?.rows ?? [];
  } finally {
    factLoading.value = false;
  }
};

const handleCreate = () => {
  Object.assign(formData, defaultFormData());
  factOptions.value = [];
  detailData.value = null;
  formDialog.mode = 'create';
  formDialog.title = '新增调整单';
  formDialog.visible = true;
};

const handleDetail = async (row: any) => {
  detailData.value = null;
  formDialog.mode = 'detail';
  formDialog.title = '调整单详情';
  formDialog.visible = true;
  try {
    const res = await performanceApi.getAdjust(row.id);
    const d = res.data ?? row;
    detailData.value = d;
    Object.assign(formData, defaultFormData(), {
      factId: d.factId || '',
      period: d.period,
      employeeId: d.employeeId,
      deptId: d.deptId,
      adjustType: d.adjustType,
      deltaAmount: num(d.deltaAmount),
      targetDeptId: d.targetDeptId || '',
      reason: d.reason
    });
  } catch {
    detailData.value = row;
    Object.assign(formData, defaultFormData(), {
      factId: row.factId || '',
      period: row.period,
      employeeId: row.employeeId,
      deptId: row.deptId,
      adjustType: row.adjustType,
      deltaAmount: num(row.deltaAmount),
      targetDeptId: row.targetDeptId || '',
      reason: row.reason
    });
  }
};

const handleSubmit = async () => {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitLoading.value = true;
  try {
    const data: AdjustCreateForm = {
      factId: formData.factId || undefined,
      period: formData.period,
      employeeId: formData.employeeId,
      deptId: formData.deptId,
      adjustType: formData.adjustType,
      deltaAmount: formData.adjustType === 'AMOUNT' ? formData.deltaAmount : undefined,
      targetDeptId: formData.adjustType === 'TRANSFER' ? formData.targetDeptId : undefined,
      reason: formData.reason
    };
    await performanceApi.createAdjust(data);
    modal.msgSuccess('提交成功');
    formDialog.visible = false;
    getList();
  } finally {
    submitLoading.value = false;
  }
};

// 工作流：通过
const handleFlowPass = async () => {
  const ok = await passTask(flowTaskId.value);
  if (ok) {
    formDialog.visible = false;
    getList();
  }
};

// 工作流：驳回
const handleFlowReject = async () => {
  const ok = await rejectTask(flowTaskId.value);
  if (ok) {
    formDialog.visible = false;
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
    const res = await performanceApi.getAdjust(Number(id));
    const d = res.data;
    detailData.value = d;
    Object.assign(formData, defaultFormData(), {
      factId: d.factId || '',
      period: d.period,
      employeeId: d.employeeId,
      deptId: d.deptId,
      adjustType: d.adjustType,
      deltaAmount: num(d.deltaAmount),
      targetDeptId: d.targetDeptId || '',
      reason: d.reason
    });
    formDialog.mode = 'detail';
    formDialog.title = '调整单详情';
    formDialog.visible = true;
  } catch {
    modal.msgError('加载单据失败');
  }
};

onMounted(() => {
  loadDeptTree();
  getList();
  openFromWorkflow();
});
</script>

<style lang="scss" scoped>
.performance-adjust-page {
  padding: 16px;
}

.page-card {
  border-radius: 12px;
}

.page-content {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  gap: 14px;

  .filter-form {
    margin-bottom: 0;
  }

  .toolbar {
    display: flex;
    gap: 8px;
  }

  .data-table {
    width: 100%;
  }

  .amount-positive {
    color: var(--el-color-success);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .amount-negative {
    color: var(--el-color-danger);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .transfer-arrow {
    color: var(--el-color-primary);
  }

  .form-hint {
    font-size: 12px;
    color: var(--el-text-color-secondary);
    line-height: 1.4;
    margin-top: 4px;
  }

  .fact-amount-hint {
    font-size: 12px;
    color: var(--el-color-primary);
    line-height: 1.4;
    margin-top: 4px;
  }

  .empty-wrap {
    padding: 40px 0;
  }

  .pagination-wrap {
    display: flex;
    justify-content: flex-end;
    margin-top: 4px;
  }

  .detail-desc {
    margin-top: 12px;
  }
}
</style>
