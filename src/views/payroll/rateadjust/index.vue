<template>
  <div class="payroll-rateadjust" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">提成点调整</h3>
        <el-button
          v-hasPermi="['payroll:rateadjust:add']"
          type="primary"
          icon="Plus"
          @click="openAdd"
        >
          登记调整
        </el-button>
      </div>

      <!-- 筛选 -->
      <el-form :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="调整类型">
          <el-select v-model="queryParams.adjustType" placeholder="全部类型" clearable style="width: 160px" @change="handleQuery">
            <el-option v-for="opt in rate_adjust_type" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="queryParams.status" placeholder="全部状态" clearable style="width: 130px" @change="handleQuery">
            <el-option v-for="opt in statusOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="生效月">
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
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>

      <!-- 列表（后端非分页接口，一次返回全量） -->
      <el-table v-loading="loading" :data="adjustList" stripe border>
        <el-table-column label="员工姓名" prop="employeeName" min-width="100" align="center">
          <template #default="{ row }">{{ row.employeeName || row.employeeId }}</template>
        </el-table-column>
        <el-table-column label="调整类型" width="130" align="center">
          <template #default="{ row }">
            <el-tag :type="typeTagType(row.adjustType)" size="small">{{ typeLabel(row.adjustType) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="调整点数" width="100" align="center">
          <template #default="{ row }">
            <span v-if="row.adjustRate != null" class="rate-deduct">{{ ratePercent(row.adjustRate) }}</span>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="生效区间" width="200" align="center">
          <template #default="{ row }">{{ rangeText(row) }}</template>
        </el-table-column>
        <el-table-column label="原因" prop="reason" min-width="200" show-overflow-tooltip />
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="驳回原因" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">{{ row.rejectReason || '—' }}</template>
        </el-table-column>
        <el-table-column label="提交时间" prop="applyTime" width="165" />
        <el-table-column label="审批时间" prop="approveTime" width="165" />
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'DRAFT' || row.status === 'REJECTED'">
              <el-button v-hasPermi="['payroll:rateadjust:add']" link type="primary" @click="openEdit(row)">修改</el-button>
              <el-button v-hasPermi="['payroll:rateadjust:add']" link type="danger" @click="handleDelete(row)">删除</el-button>
              <el-button v-hasPermi="['payroll:rateadjust:add']" link type="warning" @click="handleSubmit(row)">提交</el-button>
            </template>
            <el-button
              v-if="row.status === 'SUBMITTED'"
              v-hasPermi="['payroll:rateadjust:cancel']"
              link
              type="warning"
              @click="handleCancel(row)"
            >
              撤销
            </el-button>
            <el-button
              v-if="row.status === 'APPROVED'"
              v-hasPermi="['payroll:rateadjust:cancel']"
              link
              type="danger"
              @click="handleCancel(row)"
            >
              撤销
            </el-button>
            <el-button v-if="row.processInstanceId" link type="primary" @click="openApprovalDetail(row)">查看审批单</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无提成点调整记录" /></template>
      </el-table>
    </el-card>

    <!-- 登记/修改弹窗（登记后为待提交，需在列表中提交审批） -->
    <el-dialog v-model="showForm" :title="form.id ? '修改提成点调整' : '登记提成点调整'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            placeholder="搜索员工姓名/工号"
            filterable
            remote
            :remote-method="searchEmployeeForForm"
            :loading="empLoading"
            style="width: 100%"
          >
            <el-option
              v-for="emp in formEmpOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="调整类型" prop="adjustType">
          <el-select v-model="form.adjustType" placeholder="请选择类型" style="width: 100%">
            <!-- 未买社保扣点由档案参保状态自动判断，不在登记表单中提供 -->
            <el-option v-for="opt in formTypeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="调整点数" prop="adjustRate">
          <el-input-number
            v-model="form.adjustRate"
            :precision="2"
            :step="0.01"
            :min="-0.5"
            :max="-0.01"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-tip">负数=扣点，-0.02 即扣 2 个点</div>
        </el-form-item>
        <el-form-item label="生效起始月" prop="startMonth">
          <el-date-picker v-model="form.startMonth" type="month" value-format="YYYY-MM" placeholder="选择起始月" style="width: 100%" />
        </el-form-item>
        <el-form-item label="生效结束月" prop="endMonth">
          <el-date-picker v-model="form.endMonth" type="month" value-format="YYYY-MM" placeholder="留空 = 长期有效至撤销" style="width: 100%" />
        </el-form-item>
        <el-form-item label="原因" prop="reason">
          <el-input v-model="form.reason" type="textarea" :rows="3" placeholder="请输入调整原因" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 审批单详情（提交后可自查；也从「我的待办」办理弹窗共用同一详情组件） -->
    <el-dialog v-model="approvalDetailVisible" title="提成点调整审批详情" width="860px" append-to-body destroy-on-close>
      <RateAdjustApprovalDetail v-if="approvalDetailId" :business-id="approvalDetailId" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, toRefs, onMounted } from 'vue';
import type { FormInstance } from 'element-plus';
import { rateAdjustApi, type RateAdjust } from '@/api/panjia/rateadjust';
import { employeeApi } from '@/api/panjia/employee';
import type { Employee } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import RateAdjustApprovalDetail from '@/components/WorkflowHandle/details/RateAdjustApprovalDetail.vue';

// 调整类型字典（配置驱动；含 NO_SOCIAL，登记表单中过滤掉）
const { rate_adjust_type } = toRefs<any>(useDict('rate_adjust_type'));
const TYPE_FALLBACK: Record<string, string> = {
  NO_SOCIAL: '未买社保扣点',
  PHONE_CHECK: '电话考核扣点',
  PERSONAL: '个人调整扣点'
};
const typeLabel = (t: string) => rate_adjust_type.value?.find((o: any) => o.value === t)?.label || TYPE_FALLBACK[t] || t || '—';
const typeTagType = (t: string) => {
  const map: Record<string, string> = { NO_SOCIAL: 'warning', PHONE_CHECK: 'primary', PERSONAL: 'danger' };
  return (map as any)[t] || 'info';
};

const STATUS_MAP: Record<string, string> = {
  DRAFT: '待提交', SUBMITTED: '审批中', APPROVED: '已通过', REJECTED: '已驳回', CANCELLED: '已撤销'
};
const statusOptions = Object.entries(STATUS_MAP).map(([value, label]) => ({ value, label }));
const statusLabel = (s: string) => STATUS_MAP[s] || s || '—';
const statusTagType = (s: string) => {
  const map: Record<string, string> = {
    DRAFT: 'info', SUBMITTED: 'warning', APPROVED: 'success', REJECTED: 'danger', CANCELLED: 'info'
  };
  return (map as any)[s] || 'info';
};

/** 调整点数 → 百分比文案（-0.02 → -2%），负数红色 */
const ratePercent = (v: number | string | null | undefined) => `${Number((Number(v) * 100).toFixed(2))}%`;

// 表格插槽 row 由 Element Plus 推断为 DefaultRow，行级处理器入参放宽为 any
const rangeText = (row: any) => {
  if (!row?.startMonth) return '—';
  return row.endMonth ? `${row.startMonth} ~ ${row.endMonth}` : `${row.startMonth} ~ 长期`;
};

// ==================== 查询 ====================
const loading = ref(false);
const adjustList = ref<RateAdjust[]>([]);

const queryParams = reactive({
  adjustType: '' as string,
  status: '' as string,
  period: '' as string,
  employeeId: '' as string
});

const getList = async () => {
  loading.value = true;
  try {
    // 非分页接口：res.data 直接是数组
    const res = await rateAdjustApi.list({
      adjustType: queryParams.adjustType || undefined,
      status: queryParams.status || undefined,
      period: queryParams.period || undefined,
      employeeId: queryParams.employeeId || undefined
    });
    adjustList.value = res.data ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '查询提成点调整失败');
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  Object.assign(queryParams, { adjustType: '', status: '', period: '', employeeId: '' });
  getList();
};

// ==================== 员工搜索（筛选与表单共用同源接口，分页数据在 res.data.rows） ====================
const empOptions = ref<Employee[]>([]);
const formEmpOptions = ref<Employee[]>([]);
const empLoading = ref(false);
let empTimer: ReturnType<typeof setTimeout> | null = null;

const doSearch = async (keyword: string, target: 'filter' | 'form') => {
  empLoading.value = true;
  try {
    const res = await employeeApi.list({ employeeName: keyword || undefined, pageSize: 20 });
    const rows = res.data?.rows ?? [];
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

// ==================== 登记 / 修改 ====================
const showForm = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

/** 表单模型（adjustRate 收敛为 number 供 el-input-number 绑定；endMonth 空串=长期） */
interface RateAdjustForm {
  id?: string | number;
  employeeId: string;
  adjustType: string;
  adjustRate: number;
  startMonth: string;
  endMonth: string;
  reason: string;
}

const form = reactive<RateAdjustForm>({
  id: undefined,
  employeeId: '',
  adjustType: 'PHONE_CHECK',
  adjustRate: -0.02,
  startMonth: '',
  endMonth: '',
  reason: ''
});

const rules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  adjustRate: [{ required: true, message: '请输入调整点数', trigger: 'blur' }],
  startMonth: [{ required: true, message: '请选择生效起始月', trigger: 'change' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }]
};

/** 登记表单类型选项：仅电话考核/个人调整（NO_SOCIAL 自动判断，不开放登记） */
const formTypeOptions = computed(() => (rate_adjust_type.value ?? []).filter((o: any) => o.value !== 'NO_SOCIAL'));

const openAdd = () => {
  Object.assign(form, {
    id: undefined,
    employeeId: '',
    adjustType: 'PHONE_CHECK',
    adjustRate: -0.02,
    startMonth: '',
    endMonth: '',
    reason: ''
  });
  formEmpOptions.value = [];
  showForm.value = true;
};

const openEdit = (row: any) => {
  Object.assign(form, {
    id: row.id,
    employeeId: String(row.employeeId ?? ''),
    adjustType: row.adjustType,
    adjustRate: Number(row.adjustRate),
    startMonth: row.startMonth,
    endMonth: row.endMonth || '',
    reason: row.reason
  });
  formEmpOptions.value = row.employeeName
    ? [{ employeeId: String(row.employeeId), employeeName: row.employeeName, employeeCode: '' } as Employee]
    : [];
  showForm.value = true;
};

const submitForm = async () => {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    return;
  }
  submitting.value = true;
  try {
    const payload: Partial<RateAdjust> = {
      id: form.id,
      employeeId: form.employeeId,
      adjustType: form.adjustType,
      adjustRate: form.adjustRate,
      startMonth: form.startMonth,
      endMonth: form.endMonth || undefined,
      reason: form.reason
    };
    if (form.id) {
      await rateAdjustApi.update(payload);
      modal.msgSuccess('修改成功');
    } else {
      await rateAdjustApi.create(payload);
      modal.msgSuccess('登记成功，单据为待提交状态，请在列表中提交审批');
    }
    showForm.value = false;
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '保存失败');
  } finally {
    submitting.value = false;
  }
};

// ==================== 行操作 ====================
const handleDelete = async (row: any) => {
  try {
    await modal.confirm(`确认删除员工「${row.employeeName || row.employeeId}」的这条调整记录？`);
  } catch {
    return;
  }
  try {
    await rateAdjustApi.remove(row.id!);
    modal.msgSuccess('删除成功');
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '删除失败');
  }
};

const handleSubmit = async (row: any) => {
  try {
    await modal.confirm(`确认提交员工「${row.employeeName || row.employeeId}」的调整至总监审批？`);
  } catch {
    return;
  }
  try {
    await rateAdjustApi.submit(row.id!);
    modal.msgSuccess('已提交总监审批');
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '提交失败');
  }
};

const handleCancel = async (row: any) => {
  const tip =
    row.status === 'APPROVED'
      ? '作废后该调整立即失效，已算薪月份不受影响。确认作废？'
      : '确认撤回该调整的审批流程？撤回后单据回到待提交状态。';
  try {
    await modal.confirm(tip);
  } catch {
    return;
  }
  try {
    await rateAdjustApi.cancel(row.id!);
    modal.msgSuccess(row.status === 'APPROVED' ? '已作废' : '已撤回');
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '撤销失败');
  }
};

// ==================== 审批单详情 ====================
const approvalDetailVisible = ref(false);
const approvalDetailId = ref<string | number>('');

const openApprovalDetail = (row: any) => {
  if (!row?.id) return;
  approvalDetailId.value = row.id;
  approvalDetailVisible.value = true;
};

onMounted(getList);
</script>

<style scoped>
.rate-deduct {
  color: var(--el-color-danger);
  font-weight: 600;
}
.form-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  margin-top: 4px;
  line-height: 1.4;
}
</style>
