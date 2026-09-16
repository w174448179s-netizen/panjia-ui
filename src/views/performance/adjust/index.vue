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
        </div>

        <!-- 数据表格 -->
        <el-table
          v-loading="loading"
          border
          class="data-table"
          :data="adjustList"
          :default-sort="{ prop: 'createTime', order: 'descending' }"
        >
          <el-table-column label="期间" align="center" prop="period" width="100" />
          <el-table-column label="调整范围" align="center" width="100">
            <template #default="scope">
              <el-tag :type="scope.row.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
                {{ scope.row.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="调整对象" align="center" min-width="160" show-overflow-tooltip>
            <template #default="scope">
              <template v-if="scope.row.adjustScope === 'CONTRACT'">
                <el-button link type="primary" class="adjust-object-link" @click="handleDetail(scope.row)">
                  {{ scope.row.contractNo || '—' }}
                </el-button>
              </template>
              <template v-else>
                <el-button link type="primary" class="adjust-object-link" @click="handleDetail(scope.row)">
                  {{ scope.row.employeeName || scope.row.employeeId || '—' }}
                </el-button>
              </template>
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
          <el-table-column label="原始金额" align="right" prop="originalAmount" width="130">
            <template #default="scope">
              <span class="origin-amount">{{ formatOrigin(scope.row.originalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整后金额" align="right" width="140">
            <template #default="scope">
              <span class="amount-red">
                {{ formatOrigin(scope.row.targetAmount) }}
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
          <el-table-column label="操作" align="center" width="140" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
              <el-button v-if="scope.row.status === 'SUBMITTED' && checkPermi(['workflow:task:edit'])" link type="success" :loading="approvalLoading" @click="onBizApprove(scope.row.id)">审批</el-button>
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

    <!-- 新增弹窗 -->
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
            当前原始金额：¥{{ formatNumber(selectedFact?.amount) }}
          </div>
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'AMOUNT'" label="调整后金额" prop="targetAmount">
          <el-input-number
            v-model="formData.targetAmount"
            :min="0"
            :max="99999999"
            :precision="2"
            :step="100"
            style="width: 100%"
          />
          <div class="form-hint">输入调整后的目标总金额</div>
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
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="formDialog.visible = false">关 闭</el-button>
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

    <!-- 详情弹窗：与「我的待办 → 业绩调整审批」共用同一份模板，避免两处口径漂移 -->
    <el-dialog
      v-model="detailDialog.visible"
      title="调整单详情"
      width="1100px"
      top="5vh"
      append-to-body
      destroy-on-close
    >
      <AdjustDetailPanel v-if="detailDialog.visible" :business-id="detailDialog.businessId" />
      <template #footer>
        <el-button @click="detailDialog.visible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- 业务明细直接审批弹窗（与「我的待办」共用同一 WorkflowHandle 组件） -->
    <WorkflowHandle ref="workflowHandleRef" @handled="getList" />
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceAdjust, AdjustQuery, AdjustCreateForm, PerformanceFact } from '@/api/panjia/performance';
import AdjustDetailPanel from './components/AdjustDetailPanel.vue';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode, Employee } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useRoute } from 'vue-router';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { checkPermi } from '@/utils/permission';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';

const route = useRoute();

/** 业务明细直接审批：通过 businessId 查当前用户可办理任务，复用 WorkflowHandle 弹窗 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandle>>();
const { loading: approvalLoading, handleBizApproval } = useBizApproval();
const onBizApprove = (businessId: string | number) =>
  handleBizApproval(businessId, (task) => workflowHandleRef.value?.open(task));

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
/** 普通金额格式化：两位小数，无 ¥ 前缀 */
const formatNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
};

/** 原始金额：绝对值口径，带 ¥ 前缀；缺失显示 — */
const formatOrigin = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

// ==================== 新增 / 详情弹窗 ====================
const formDialog = reactive({
  visible: false,
  mode: 'create' as 'create' | 'detail',
  title: '新增调整单'
});
const formRef = ref();
const submitLoading = ref(false);

/** 详情弹窗：与「我的待办 → 业绩调整审批」共用 AdjustDetailPanel，仅传 businessId */
const detailDialog = reactive({
  visible: false,
  businessId: '' as string | number
});

// 关联业绩事实下拉
const factOptions = ref<PerformanceFact[]>([]);
const factLoading = ref(false);
const selectedFact = computed<PerformanceFact | undefined>(() =>
  factOptions.value.find((f) => f.id === formData.factId)
);
const factOptionLabel = (f: PerformanceFact) => {
  const type = f.factType === 'PERF_REAL' ? '实收' : '应收';
  return `${type} · ${f.sourceKey} · ¥${formatNumber(f.amount)}`;
};

const defaultFormData = (): AdjustCreateForm & { factId: string } => ({
  factId: '',
  period: '',
  employeeId: '',
  deptId: '',
  adjustType: '',
  targetAmount: undefined as number | undefined,
  targetDeptId: '',
  reason: ''
});

const formData = reactive(defaultFormData());

/** 门店/组别只读回显：优先取员工主档，其次取所选业绩明细所在部门 */
const selectedEmployeeDept = computed(() => {
  const emp = formEmployeeOptions.value.find((e) => String(e.employeeId) === String(formData.employeeId));
  return emp?.deptName || selectedFact.value?.deptName || '';
});

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
  formDialog.mode = 'create';
  formDialog.title = '新增调整单';
  formDialog.visible = true;
};

const handleDetail = (row: any) => {
  detailDialog.businessId = row.id;
  detailDialog.visible = true;
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
      targetAmount: formData.adjustType === 'AMOUNT' ? formData.targetAmount : undefined,
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

// 工作流跳转：查看态打开详情（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  // 与「详情」按钮走同一个面板，只是额外带了 type/taskId
  detailDialog.businessId = id;
  detailDialog.visible = true;
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/performance/adjustment', openFromWorkflow);

onMounted(() => {
  loadDeptTree();
  getList();
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

  .origin-amount {
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--el-text-color-primary);
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
