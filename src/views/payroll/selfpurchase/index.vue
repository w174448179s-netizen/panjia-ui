<template>
  <div class="payroll-selfpurchase" style="padding: 12px;">
    <el-card>
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">自购单提成</h3>
        <el-button
          v-hasPermi="['payroll:selfpurchase:add']"
          type="primary"
          icon="Plus"
          @click="openAdd"
        >
          登记自购单
        </el-button>
      </div>

      <el-alert
        type="info"
        :closable="false"
        show-icon
        class="mb-4"
        title="员工福利：登记「合同号 + 经纪人」并经总监审批通过后，算薪时该经纪人在该合同号上的结佣提点额外加成；该合同其他参与经纪人、该员工其他合同的提点均不受影响（仅经纪人角色适用）"
      />

      <!-- 筛选 -->
      <el-form :inline="true" :model="queryParams" @submit.prevent>
        <el-form-item label="合同号">
          <el-input
            v-model="queryParams.contractNo"
            placeholder="输入合同号"
            clearable
            style="width: 200px"
            @keyup.enter="handleQuery"
            @clear="handleQuery"
          />
        </el-form-item>
        <el-form-item label="经纪人">
          <EmployeeSelect v-model="queryParams.employeeId" width="220px" @change="handleQuery" />
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

      <!-- 列表（后端非分页接口，一次返回全量） -->
      <el-table v-loading="loading" :data="dataList" stripe border>
        <el-table-column label="合同号" prop="contractNo" min-width="160" show-overflow-tooltip />
        <el-table-column label="经纪人" min-width="110" align="center">
          <template #default="{ row }">{{ row.employeeName || row.employeeId }}</template>
        </el-table-column>
        <el-table-column label="提点加成" width="110" align="center">
          <template #default="{ row }">
            <span class="rate-add">+{{ ratePercent(row.bonusRate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="180" show-overflow-tooltip />
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
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'DRAFT' || row.status === 'REJECTED'">
              <el-button v-hasPermi="['payroll:selfpurchase:add']" link type="primary" @click="openEdit(row)">修改</el-button>
              <el-button v-hasPermi="['payroll:selfpurchase:add']" link type="danger" @click="handleDelete(row)">删除</el-button>
              <el-button v-hasPermi="['payroll:selfpurchase:add']" link type="warning" @click="handleSubmit(row)">提交</el-button>
            </template>
            <el-button
              v-if="row.status === 'SUBMITTED' || row.status === 'APPROVED'"
              v-hasPermi="['payroll:selfpurchase:cancel']"
              link
              :type="row.status === 'APPROVED' ? 'danger' : 'warning'"
              @click="handleCancel(row)"
            >
              {{ row.status === 'APPROVED' ? '作废' : '撤销' }}
            </el-button>
            <el-button v-if="row.processInstanceId" link type="primary" @click="openApprovalDetail(row)">查看审批单</el-button>
          </template>
        </el-table-column>
        <template #empty><el-empty description="暂无自购单记录" /></template>
      </el-table>
    </el-card>

    <!-- 登记/修改弹窗（保存后为待提交，需在列表中提交审批） -->
    <el-dialog v-model="showForm" :title="form.id ? '修改自购单' : '登记自购单'" width="560px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="合同号" prop="contractNo">
          <el-input v-model="form.contractNo" placeholder="请输入合同号" maxlength="100" clearable />
          <div class="form-tip">命中该合同号下该经纪人的业绩分成，仅该笔享受加成</div>
        </el-form-item>
        <el-form-item label="经纪人" prop="employeeId">
          <EmployeeSelect v-model="form.employeeId" :initial-option="editInitialOption" />
          <div class="form-tip">仅经纪人角色适用，店长/总监不可登记</div>
        </el-form-item>
        <el-form-item label="提点加成" prop="bonusPercent">
          <el-input-number
            v-model="form.bonusPercent"
            :precision="2"
            :step="1"
            :min="0.01"
            :max="50"
            controls-position="right"
            style="width: 100%"
          />
          <div class="form-tip">百分比，默认 10 即当月提点额外 +10 个百分点（不改动该单其他参与人）</div>
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" placeholder="自购说明/内部福利审批依据" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">保存</el-button>
      </template>
    </el-dialog>

    <!-- 审批单详情（提交后可自查；也从「我的待办」办理弹窗共用同一详情组件） -->
    <el-dialog v-model="approvalDetailVisible" title="自购单提成审批详情" width="860px" append-to-body destroy-on-close>
      <SelfPurchaseDetail v-if="approvalDetailId" :business-id="approvalDetailId" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import type { FormInstance } from 'element-plus';
import { selfPurchaseApi, type SelfPurchase } from '@/api/panjia/selfpurchase';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import type { PerformanceEmployeeOption } from '@/api/panjia/performance';
import modal from '@/plugins/modal';
import SelfPurchaseDetail from '@/components/WorkflowHandle/details/SelfPurchaseDetail.vue';

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

/** 加成点数 → 百分比文案（0.10 → 10.00%） */
const ratePercent = (v: number | string | null | undefined) => `${Number((Number(v) * 100).toFixed(2))}%`;

// ==================== 查询 ====================
const loading = ref(false);
const dataList = ref<SelfPurchase[]>([]);

const queryParams = reactive({
  contractNo: '' as string,
  employeeId: '' as string,
  status: '' as string
});

const getList = async () => {
  loading.value = true;
  try {
    const res = await selfPurchaseApi.list({
      contractNo: queryParams.contractNo || undefined,
      employeeId: queryParams.employeeId || undefined,
      status: queryParams.status || undefined
    });
    dataList.value = res.data ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '查询自购单失败');
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  getList();
};

const resetQuery = () => {
  Object.assign(queryParams, { contractNo: '', employeeId: '', status: '' });
  getList();
};

// ==================== 登记 / 修改 ====================
/** 编辑弹窗打开时，用列表行自带的员工信息构造回显选项 */
const editInitialOption = ref<PerformanceEmployeeOption | null>(null);
const showForm = ref(false);
const submitting = ref(false);
const formRef = ref<FormInstance>();

/** 表单模型（bonusPercent 以百分比展示，提交时换算为 0.10 口径） */
interface SelfPurchaseForm {
  id?: string | number;
  contractNo: string;
  employeeId: string;
  bonusPercent: number;
  remark: string;
}

const form = reactive<SelfPurchaseForm>({
  id: undefined,
  contractNo: '',
  employeeId: '',
  bonusPercent: 10,
  remark: ''
});

const rules = {
  contractNo: [{ required: true, message: '请输入合同号', trigger: 'blur' }],
  employeeId: [{ required: true, message: '请选择经纪人', trigger: 'change' }],
  bonusPercent: [{ required: true, message: '请输入提点加成', trigger: 'blur' }]
};

const openAdd = () => {
  Object.assign(form, {
    id: undefined,
    contractNo: '',
    employeeId: '',
    bonusPercent: 10,
    remark: ''
  });
  editInitialOption.value = null;
  showForm.value = true;
};

const openEdit = (row: any) => {
  Object.assign(form, {
    id: row.id,
    contractNo: row.contractNo,
    employeeId: String(row.employeeId ?? ''),
    bonusPercent: Number((Number(row.bonusRate) * 100).toFixed(2)),
    remark: row.remark || ''
  });
  editInitialOption.value = row.employeeName
    ? {
        employeeId: String(row.employeeId),
        employeeName: row.employeeName,
        employeeCode: row.employeeCode ?? '',
        deptName: row.deptName ?? ''
      }
    : null;
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
    const payload: Partial<SelfPurchase> = {
      id: form.id,
      contractNo: form.contractNo,
      employeeId: form.employeeId,
      bonusRate: Number((form.bonusPercent / 100).toFixed(4)),
      remark: form.remark || undefined
    };
    if (form.id) {
      await selfPurchaseApi.update(payload);
      modal.msgSuccess('修改成功');
    } else {
      await selfPurchaseApi.create(payload);
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
    await modal.confirm(`确认删除合同号「${row.contractNo}」的自购单记录？`);
  } catch {
    return;
  }
  try {
    await selfPurchaseApi.remove(row.id!);
    modal.msgSuccess('删除成功');
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '删除失败');
  }
};

const handleSubmit = async (row: any) => {
  try {
    await modal.confirm(`确认提交「${row.contractNo} / ${row.employeeName || row.employeeId}」的自购单至总监审批？`);
  } catch {
    return;
  }
  try {
    await selfPurchaseApi.submit(row.id!);
    modal.msgSuccess('已提交总监审批');
    getList();
  } catch (e: any) {
    modal.msgError(e?.message || '提交失败');
  }
};

const handleCancel = async (row: any) => {
  const tip =
    row.status === 'APPROVED'
      ? '作废后该自购单立即失效，已算薪月份不受影响。确认作废？'
      : '确认撤回该自购单的审批流程？撤回后单据回到待提交状态。';
  try {
    await modal.confirm(tip);
  } catch {
    return;
  }
  try {
    await selfPurchaseApi.cancel(row.id!);
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
.rate-add {
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
