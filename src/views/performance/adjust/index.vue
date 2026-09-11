<template>
  <div class="performance-adjust-page">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <span>业绩调整单</span>
        </div>
      </template>
      <div class="page-content">
        <!-- 筛选条件 -->
        <el-form class="filter-form" :inline="true" :model="queryParams">
          <el-form-item label="期间" prop="period">
            <el-date-picker
              v-model="queryParams.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="选择月份"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="调整类型" prop="adjustType">
            <el-select
              v-model="queryParams.adjustType"
              placeholder="全部类型"
              clearable
              style="width: 160px"
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
              style="width: 140px"
            >
              <el-option
                v-for="opt in statusOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="员工" prop="employeeName">
            <el-input
              v-model="queryParams.employeeName"
              placeholder="员工姓名"
              clearable
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="部门" prop="deptName">
            <el-input
              v-model="queryParams.deptName"
              placeholder="部门名称"
              clearable
              style="width: 160px"
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
          <el-table-column label="员工" align="center" prop="employeeName" width="100" show-overflow-tooltip />
          <el-table-column label="部门" align="center" prop="deptName" min-width="140" show-overflow-tooltip />
          <el-table-column label="调整类型" align="center" width="110">
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
          <el-table-column label="申请人" align="center" prop="applicantName" width="100" show-overflow-tooltip />
          <el-table-column label="申请时间" align="center" prop="createTime" width="170" sortable />
          <el-table-column label="操作" align="center" width="260" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
              <template v-if="scope.row.status === 'SUBMITTED'">
                <el-button link type="success" @click="handleApprove(scope.row)">通过</el-button>
                <el-button link type="danger" @click="handleReject(scope.row)">拒绝</el-button>
                <el-button link type="info" @click="handleCancel(scope.row)">取消</el-button>
              </template>
              <template v-else-if="scope.row.status === 'APPROVED'">
                <el-button link type="warning" @click="handleExecute(scope.row)">执行</el-button>
                <el-button link type="info" @click="handleCancel(scope.row)">取消</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <div v-if="!loading && adjustList.length === 0" class="empty-wrap">
          <el-empty description="暂无数据" />
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
            @size-change="getList"
            @current-change="getList"
          />
        </div>
      </div>
    </el-card>

    <!-- 新增/详情弹窗 -->
    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.title"
      width="600px"
      append-to-body
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
          />
        </el-form-item>
        <el-form-item label="员工" prop="employeeId">
          <el-input v-model="formData.employeeId" placeholder="员工ID" />
        </el-form-item>
        <el-form-item label="部门" prop="deptId">
          <el-input v-model="formData.deptId" placeholder="部门ID" />
        </el-form-item>
        <el-form-item label="关联事实ID" prop="factId">
          <el-input v-model="formData.factId" placeholder="可选，关联原业绩事实ID" clearable />
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
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'TRANSFER'" label="目标部门" prop="targetDeptId">
          <el-input v-model="formData.targetDeptId" placeholder="目标部门ID" />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
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
          <el-descriptions-item label="申请人">{{ detailData.applicantName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="审批人">{{ detailData.approverName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="审批时间">{{ detailData.approveTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="执行时间">{{ detailData.executeTime || '—' }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ detailData.createTime }}</el-descriptions-item>
        </el-descriptions>
      </template>
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
  </div>
</template>

<script setup lang="ts">
import { performanceApi } from '@/api/panjia/performance';
import type { PerformanceAdjust, AdjustQuery, AdjustCreateForm } from '@/api/panjia/performance';
import modal from '@/plugins/modal';

// 调整类型映射
const adjustTypeMap: Record<string, string> = {
  AMOUNT: '金额调整',
  VOID: '作废调整',
  TRANSFER: '部门转移'
};
const adjustTypeOptions = Object.entries(adjustTypeMap).map(([value, label]) => ({ value, label }));

// 状态映射
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

// ==================== 筛选 & 分页 ====================
const queryParams = reactive<AdjustQuery & { employeeName?: string; deptName?: string }>({
  pageNum: 1,
  pageSize: 20,
  period: '',
  adjustType: '',
  status: '',
  employeeId: '',
  employeeName: '',
  deptId: '',
  deptName: ''
});

// ==================== 列表 ====================
const loading = ref(false);
const total = ref(0);
const adjustList = ref<PerformanceAdjust[]>([]);

const getList = async () => {
  loading.value = true;
  try {
    const params: AdjustQuery = {
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
      period: queryParams.period || undefined,
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      employeeId: queryParams.employeeId || undefined,
      deptId: queryParams.deptId || undefined
    };
    const res = await performanceApi.listAdjusts(params);
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
  queryParams.period = '';
  queryParams.adjustType = '';
  queryParams.status = '';
  queryParams.employeeId = '';
  queryParams.employeeName = '';
  queryParams.deptId = '';
  queryParams.deptName = '';
  queryParams.pageNum = 1;
  getList();
};

// ==================== 工具方法 ====================
// 后端 Jackson 把 BigDecimal 序列化成字符串，Number() 归一后再格式化（字符串直接 toFixed 会 TypeError 炸整表）
const formatAmount = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  const prefix = num > 0 ? '+' : '';
  return prefix + num.toFixed(2);
};

const getAmountClass = (val: number | undefined): string => {
  if (val === undefined || val === null) return '';
  if (val > 0) return 'amount-positive';
  if (val < 0) return 'amount-negative';
  return '';
};

// ==================== 操作：审批 / 拒绝 / 执行 / 取消 ====================
const handleApprove = async (row: PerformanceAdjust) => {
  try {
    await modal.confirm(`确认通过调整单「${row.adjustNo}」？`);
  } catch {
    return;
  }
  try {
    await performanceApi.approveAdjust(row.id);
    modal.msgSuccess('审批通过');
    getList();
  } catch {
    // 错误已在拦截器处理
  }
};

const handleReject = async (row: PerformanceAdjust) => {
  try {
    const { value } = await modal.prompt('请输入拒绝原因');
    if (!value?.trim()) {
      modal.msgWarning('请输入拒绝原因');
      return;
    }
    await performanceApi.rejectAdjust(row.id, value.trim());
    modal.msgSuccess('已拒绝');
    getList();
  } catch {
    // 用户取消或错误已处理
  }
};

const handleExecute = async (row: PerformanceAdjust) => {
  try {
    await modal.confirm(`确认执行调整单「${row.adjustNo}」？执行后将生成实际业绩变动。`);
  } catch {
    return;
  }
  try {
    await performanceApi.executeAdjust(row.id);
    modal.msgSuccess('执行成功');
    getList();
  } catch {
    // 错误已在拦截器处理
  }
};

const handleCancel = async (row: PerformanceAdjust) => {
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
    // 错误已在拦截器处理
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

const defaultFormData = (): AdjustCreateForm => ({
  factId: '',
  period: '',
  employeeId: '',
  deptId: '',
  adjustType: '',
  deltaAmount: 0,
  targetDeptId: '',
  reason: ''
});

const formData = reactive<AdjustCreateForm>(defaultFormData());

const formRules = {
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  period: [{ required: true, message: '请选择期间', trigger: 'change' }],
  employeeId: [{ required: true, message: '请输入员工ID', trigger: 'blur' }],
  deptId: [{ required: true, message: '请输入部门ID', trigger: 'blur' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }]
};

const handleCreate = () => {
  Object.assign(formData, defaultFormData());
  detailData.value = null;
  formDialog.mode = 'create';
  formDialog.title = '新增调整单';
  formDialog.visible = true;
};

const handleDetail = async (row: PerformanceAdjust) => {
  detailData.value = null;
  formDialog.mode = 'detail';
  formDialog.title = '调整单详情';
  formDialog.visible = true;
  try {
    const res = await performanceApi.getAdjust(row.id);
    detailData.value = res.data ?? row;
    if (res.data) {
      formData.factId = res.data.factId || '';
      formData.period = res.data.period;
      formData.employeeId = res.data.employeeId;
      formData.deptId = res.data.deptId;
      formData.adjustType = res.data.adjustType;
      formData.deltaAmount = res.data.deltaAmount;
      formData.targetDeptId = res.data.targetDeptId || '';
      formData.reason = res.data.reason;
    }
  } catch {
    detailData.value = row;
    formData.factId = row.factId || '';
    formData.period = row.period;
    formData.employeeId = row.employeeId;
    formData.deptId = row.deptId;
    formData.adjustType = row.adjustType;
    formData.deltaAmount = row.deltaAmount;
    formData.targetDeptId = row.targetDeptId || '';
    formData.reason = row.reason;
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

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.performance-adjust-page {
  padding: 16px;
}

.page-card {
  border-radius: 16px;
}

.card-header {
  font-weight: 600;
  font-size: 16px;
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
