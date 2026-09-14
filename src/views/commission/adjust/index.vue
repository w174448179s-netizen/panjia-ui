<template>
  <div class="commission-adjust" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">结佣调整</h3>
        <el-button type="primary" @click="openAdd">+ 发起调整</el-button>
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
        <el-form-item label="申请单ID">
          <el-input
            v-model="queryParams.applicationId"
            placeholder="申请单ID"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleQuery">搜索</el-button>
          <el-button @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 表格 -->
      <el-table v-loading="loading" :data="adjustList" stripe border>
        <el-table-column label="调整单号" prop="adjustNo" min-width="180" show-overflow-tooltip />
        <el-table-column label="申请单ID" prop="applicationId" width="120" />
        <el-table-column label="明细ID" prop="itemId" width="120">
          <template #default="{ row }">{{ row.itemId || '—' }}</template>
        </el-table-column>
        <el-table-column label="期间" prop="period" width="100">
          <template #default="{ row }">{{ row.period || '—' }}</template>
        </el-table-column>
        <el-table-column label="类型" width="90" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.adjustType)" size="small">{{ typeLabel(row.adjustType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="折后/差额" width="130" align="right">
          <template #default="{ row }">
            <span v-if="row.adjustType === 'DISCOUNT'">¥{{ fmt(row.newAmount) }}</span>
            <span v-else-if="row.adjustType === 'DIFF'" :class="amountClass(row.diffAmount)">¥{{ fmt(row.diffAmount) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="目标月" prop="targetPeriod" width="100">
          <template #default="{ row }">{{ row.targetPeriod || '—' }}</template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" align="center" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">详情</el-button>
            <el-button v-if="row.status === 'SUBMITTED'" link type="info" @click="cancel(row)">取消</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无调整单" /></template>
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
    <el-dialog v-model="showAdd" title="发起结佣调整" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="120px">
        <el-form-item label="调整类型" prop="adjustType">
          <el-radio-group v-model="form.adjustType" @change="onTypeChange">
            <el-radio-button value="DISCOUNT">折扣</el-radio-button>
            <el-radio-button value="DIFF">差额补发</el-radio-button>
            <el-radio-button value="VOID">作废</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="申请单ID" prop="applicationId">
          <el-input-number v-model="form.applicationId" :min="1" controls-position="right" style="width:100%" placeholder="调整对象申请单ID" />
        </el-form-item>
        <el-form-item label="结佣明细ID" prop="itemId">
          <el-input-number v-model="form.itemId" :min="1" controls-position="right" style="width:100%" placeholder="调整对象结佣明细ID" />
        </el-form-item>
        <el-form-item v-if="form.adjustType === 'DISCOUNT'" label="折后金额" prop="newAmount">
          <el-input-number v-model="form.newAmount" :min="0" :precision="2" :step="100" controls-position="right" style="width:100%" />
          <div class="form-hint">直接填写折后最终金额（如 8500 表示 85 折后值）</div>
        </el-form-item>
        <el-form-item v-if="form.adjustType === 'DIFF'" label="差额金额" prop="diffAmount">
          <el-input-number v-model="form.diffAmount" :precision="2" :step="100" controls-position="right" style="width:100%" />
          <div class="form-hint">正数补发，负数扣回</div>
        </el-form-item>
        <el-form-item v-if="form.adjustType === 'DIFF'" label="补发目标月" prop="targetPeriod">
          <el-date-picker v-model="form.targetPeriod" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="调整原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入调整原因（如：85折）" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submit">提交</el-button>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="showDetail" title="调整单详情" width="560px">
      <el-descriptions v-if="detailData" :column="2" border size="small">
        <el-descriptions-item label="调整单号">{{ detailData.adjustNo }}</el-descriptions-item>
        <el-descriptions-item label="类型">
          <el-tag :type="typeTagType(detailData.adjustType)" size="small">{{ typeLabel(detailData.adjustType) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="申请单ID">{{ detailData.applicationId }}</el-descriptions-item>
        <el-descriptions-item label="明细ID">{{ detailData.itemId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="期间">{{ detailData.period || '—' }}</el-descriptions-item>
        <el-descriptions-item label="目标月">{{ detailData.targetPeriod || '—' }}</el-descriptions-item>
        <el-descriptions-item v-if="detailData.adjustType === 'DISCOUNT'" label="折后金额">¥{{ fmt(detailData.newAmount) }}</el-descriptions-item>
        <el-descriptions-item v-if="detailData.adjustType === 'DIFF'" label="差额金额">¥{{ fmt(detailData.diffAmount) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="statusTagType(detailData.status)" size="small">{{ statusLabel(detailData.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="发起人ID">{{ detailData.applicantId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="创建时间" :span="2">{{ detailData.createTime }}</el-descriptions-item>
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
import { ElMessage, ElMessageBox } from 'element-plus';
import type { FormInstance } from 'element-plus';
import { commissionApi, type CommissionAdjust } from '@/api/panjia/commission';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

const route = useRoute();
const { taskOperating, passTask, rejectTask } = useWorkflowTask();
const flowType = ref<string>('');
const flowTaskId = ref<string>('');

const loading = ref(false);
const adjustList = ref<CommissionAdjust[]>([]);
const total = ref(0);

const queryParams = reactive({
  pageNum: 1,
  pageSize: 20,
  period: '' as string,
  adjustType: '' as string,
  status: '' as string,
  applicationId: '' as string,
});

const TYPE_MAP: Record<string, string> = {
  DISCOUNT: '折扣', DIFF: '差额补发', VOID: '作废',
};
const typeOptions = Object.entries(TYPE_MAP).map(([value, label]) => ({ value, label }));
const typeLabel = (t: string) => TYPE_MAP[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = { DISCOUNT: 'warning', DIFF: 'primary', VOID: 'danger' };
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

// 列表
const getList = async () => {
  loading.value = true;
  try {
    const res = await commissionApi.listAdjusts({
      period: queryParams.period || undefined,
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      applicationId: queryParams.applicationId ? Number(queryParams.applicationId) : undefined,
      pageNum: queryParams.pageNum,
      pageSize: queryParams.pageSize,
    });
    const data = (res as any).data;
    adjustList.value = data?.rows ?? [];
    total.value = data?.total ?? 0;
  } catch {
    adjustList.value = [];
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
  Object.assign(queryParams, { period: '', adjustType: '', status: '', applicationId: '', pageNum: 1 });
  getList();
};

// 取消
const cancel = async (row: CommissionAdjust) => {
  try {
    await ElMessageBox.confirm(`确认取消调整单「${row.adjustNo}」？取消后不可恢复。`, '提示', { type: 'warning' });
  } catch {
    return;
  }
  try {
    await commissionApi.cancelAdjust(row.id);
    ElMessage.success('已取消');
    getList();
  } catch { /* 拦截器处理 */ }
};

// 新增
const showAdd = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

const form = reactive({
  adjustType: 'DISCOUNT',
  applicationId: null as number | null,
  itemId: null as number | null,
  newAmount: null as number | null,
  diffAmount: null as number | null,
  targetPeriod: '',
  reason: '',
});

const rules = {
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  applicationId: [{ required: true, message: '请输入申请单ID', trigger: 'blur' }],
  itemId: [{ required: true, message: '请输入结佣明细ID', trigger: 'blur' }],
  newAmount: [{ required: true, message: '请输入折后金额', trigger: 'blur' }],
  diffAmount: [{ required: true, message: '请输入差额金额', trigger: 'blur' }],
  targetPeriod: [{ required: true, message: '请选择补发目标月', trigger: 'change' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
};

const onTypeChange = () => {
  // 切换类型时清空不相关字段
  if (form.adjustType !== 'DISCOUNT') form.newAmount = null;
  if (form.adjustType !== 'DIFF') {
    form.diffAmount = null;
    form.targetPeriod = '';
  }
};

const openAdd = () => {
  Object.assign(form, {
    adjustType: 'DISCOUNT', applicationId: null, itemId: null,
    newAmount: null, diffAmount: null, targetPeriod: '', reason: '',
  });
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
    const data: any = {
      applicationId: form.applicationId,
      itemId: form.itemId,
      adjustType: form.adjustType,
      reason: form.reason,
    };
    if (form.adjustType === 'DISCOUNT') data.newAmount = form.newAmount;
    if (form.adjustType === 'DIFF') {
      data.diffAmount = form.diffAmount;
      data.targetPeriod = form.targetPeriod;
    }
    await commissionApi.createAdjust(data);
    ElMessage.success('发起成功');
    showAdd.value = false;
    getList();
  } finally {
    submitting.value = false;
  }
};

// 详情
const showDetail = ref(false);
const detailData = ref<CommissionAdjust | null>(null);

const viewDetail = async (row: CommissionAdjust) => {
  detailData.value = row;
  showDetail.value = true;
  try {
    const res = await commissionApi.getAdjust(row.id);
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
    const res = await commissionApi.getAdjust(Number(id));
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
.form-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
  margin-top: 4px;
}
.text-success { color: var(--el-color-success); font-weight: 600; }
.text-danger { color: var(--el-color-danger); font-weight: 600; }
</style>
