<template>
  <div class="p-2 app-container people-attendance-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="工号" prop="employeeCode">
          <el-input
            v-model="queryParams.employeeCode"
            placeholder="请输入工号"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="姓名" prop="employeeName">
          <el-input
            v-model="queryParams.employeeName"
            placeholder="请输入姓名"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/组别" prop="deptId">
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            check-strictly
            style="width: 200px"
            @change="handleQuery"
          />
        </el-form-item>
        <el-form-item label="考勤期间">
          <el-date-picker
            v-model="period"
            type="month"
            value-format="YYYY-MM"
            :clearable="false"
            placeholder="请选择期间"
            style="width: 140px"
            @change="handlePeriodChange"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 考勤汇总列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Attendance Monthly</span>
            <h3>考勤汇总</h3>
            <p>共 {{ total }} 条记录，一员工一月一行；对齐钉钉月度汇总，服务薪酬扣款。</p>
          </div>
          <div class="toolbar-actions">
            <div class="approval-bar">
              <!-- 期间以筛选区「考勤期间」为准，此处只展示该期间的审批状态与动作 -->
              <el-tooltip
                :disabled="approvalInfo.status !== 'REJECTED'"
                :content="approvalInfo.rejectReason"
                placement="top"
              >
                <el-tag :type="approvalTagType">{{ approvalTagLabel }}</el-tag>
              </el-tooltip>
              <!-- 通过/驳回已收敛到「我的待办」（attendance_approval 工作流，总监24h未审自动通过） -->
              <el-button
                v-if="approvalInfo.status !== 'SUBMITTED' && approvalInfo.status !== 'APPROVED'"
                type="warning"
                plain
                icon="Position"
                :loading="approvalLoading"
                @click="handleSubmitApproval"
              >
                提交审批
              </el-button>
              <el-button
                v-if="approvalInfo.status === 'SUBMITTED'"
                link
                type="primary"
                @click="openApprovalDetail"
              >
                查看审批单
              </el-button>
            </div>
            <el-button type="success" plain icon="Upload" @click="importOpen = true">导入考勤</el-button>
            <el-button
              v-hasPermi="['people:attendance:add']"
              type="primary"
              plain
              icon="Plus"
              :disabled="periodLocked"
              @click="handleAdd"
            >
              新增考勤
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="attendanceList">
        <el-table-column label="考勤期间" align="center" prop="attendMonth" width="110">
          <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
        </el-table-column>
        <el-table-column label="工号" align="center" prop="employeeCode" width="100" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
        <el-table-column label="门店/组别" align="center" prop="deptName" min-width="150" show-overflow-tooltip />
        <el-table-column label="出勤(天)" align="center" prop="attendDays" width="80" />
        <el-table-column label="休息(天)" align="center" prop="restDays" width="80" />
        <el-table-column label="迟到次数" align="center" prop="lateCount" width="80" />
        <el-table-column label="迟到(分)" align="center" prop="lateMinutes" width="80" />
        <el-table-column label="缺卡次数" align="center" prop="missingCardCount" width="80" />
        <el-table-column label="旷工(天)" align="center" prop="absentDays" width="80" />
        <el-table-column label="请假(天)" align="center" prop="leaveDays" width="80" />
        <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" align="center" width="120" fixed="right">
          <template #default="scope">
            <!-- 期间已提交审批（SUBMITTED/APPROVED）的行锁定：隐藏修改/删除 -->
            <template v-if="scope.row.locked">
              <el-tooltip content="该期间考勤已提交审批（或已通过），数据锁定" placement="top">
                <span class="lock-cell"><el-icon><Lock /></el-icon>已锁定</span>
              </el-tooltip>
            </template>
            <template v-else>
              <el-tooltip content="修改" placement="top">
                <el-button
                  v-hasPermi="['people:attendance:edit']"
                  link
                  type="primary"
                  icon="Edit"
                  @click="handleEdit(scope.row as AttendanceRecord)"
                >
                </el-button>
              </el-tooltip>
              <el-tooltip content="删除" placement="top">
                <el-button
                  v-hasPermi="['people:attendance:remove']"
                  link
                  type="danger"
                  icon="Delete"
                  @click="handleDelete(scope.row as AttendanceRecord)"
                >
                </el-button>
              </el-tooltip>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        class="pagination-wrap"
        @pagination="getList"
      />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑考勤' : '新增考勤'" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            placeholder="请选择员工"
            filterable
            :disabled="dialog.isEdit"
            style="width: 100%"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeCode || '无工号'}｜${emp.employeeName}${emp.deptName ? '｜' + emp.deptName : ''}`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="考勤期间" prop="attendMonth">
          <el-date-picker
            v-model="form.attendMonth"
            type="month"
            placeholder="请选择月份"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="出勤天数" prop="attendDays">
          <el-input-number v-model="form.attendDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="休息天数" prop="restDays">
          <el-input-number v-model="form.restDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="迟到次数" prop="lateCount">
          <el-input-number v-model="form.lateCount" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="迟到时长(分)" prop="lateMinutes">
          <el-input-number v-model="form.lateMinutes" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="缺卡次数" prop="missingCardCount">
          <el-input-number v-model="form.missingCardCount" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="旷工天数" prop="absentDays">
          <el-input-number v-model="form.absentDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="请假天数" prop="leaveDays">
          <el-input-number v-model="form.leaveDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 审批单详情（提交后可自查异常行；也从「我的待办」跳转进入） -->
    <el-dialog v-model="approvalDetailVisible" title="考勤月度审批详情" width="960px" append-to-body destroy-on-close>
      <AttendanceApprovalDetail v-if="approvalDetailId" :business-id="approvalDetailId" />
    </el-dialog>

    <!-- 考勤导入入口：整体复用导入页组件（自带归属月/上传/批次管理），关闭后刷新汇总列表 -->
    <el-dialog v-model="importOpen" title="考勤数据导入" width="1080px" append-to-body destroy-on-close @closed="getList">
      <ImportAttendancePage />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { attendanceApi } from '@/api/panjia/attendance';
import { employeeApi } from '@/api/panjia/employee';
import type {
  AttendanceApproval,
  AttendanceQuery,
  AttendanceRecord,
  AttendanceSaveForm,
  Employee
} from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { Lock } from '@element-plus/icons-vue';
import AttendanceApprovalDetail from '@/components/WorkflowHandle/details/AttendanceApprovalDetail.vue';
import ImportAttendancePage from '@/views/import/attendance/index.vue';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useDeptScope } from '@/hooks/useDeptScope';

// ==================== 查询 ====================
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);

/** 考勤导入弹窗（内嵌导入页组件） */
const importOpen = ref(false);

// 门店/组别筛选：全系统统一数据权限口径（useDeptScope：默认本部门、树裁剪为子树、不可清空）
const { deptLocked, defaultDeptId, deptTreeData, loadDeptTree } = useDeptScope();

/** 考勤期间（yyyy-MM，单月必选）：列表查询与审批状态共用同一期间 */
const currentPeriod = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const period = ref<string>(currentPeriod());

const queryParams = reactive<AttendanceQuery>({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: defaultDeptId(),
  monthStart: undefined,
  monthEnd: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    // 单月期间：起止都传所选月 1 日
    const monthFirst = `${period.value}-01`;
    const res = await attendanceApi.list({
      ...queryParams,
      monthStart: monthFirst,
      monthEnd: monthFirst
    });
    attendanceList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询考勤汇总失败');
  } finally {
    loading.value = false;
  }
};

/** 切换期间：列表与审批状态联动刷新 */
const handlePeriodChange = () => {
  queryParams.pageNum = 1;
  getList();
  loadApproval();
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  period.value = currentPeriod();
  queryParams.deptId = defaultDeptId();
  handlePeriodChange();
};

// ==================== 员工下拉 ====================
const employeeOptions = ref<Employee[]>([]);

const loadEmployees = async () => {
  try {
    const res = await employeeApi.list({ pageNum: 1, pageSize: 1000 });
    employeeOptions.value = res.data?.rows ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '员工列表加载失败');
  }
};

// ==================== 新增/编辑 ====================
const formRef = ref<FormInstance>();
const dialog = reactive({ visible: false, isEdit: false, saving: false, editId: '' });

const createEmptyForm = (): AttendanceSaveForm => ({
  employeeId: undefined,
  attendMonth: undefined,
  attendDays: undefined,
  restDays: undefined,
  lateCount: 0,
  lateMinutes: 0,
  missingCardCount: 0,
  absentDays: 0,
  leaveDays: 0,
  remark: '',
  version: undefined
});

const form = reactive<AttendanceSaveForm>(createEmptyForm());

const rules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  attendMonth: [{ required: true, message: '请选择考勤期间', trigger: 'change' }]
};

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  formRef.value?.clearValidate();
};

const handleAdd = () => {
  resetForm();
  dialog.editId = '';
  dialog.isEdit = false;
  dialog.visible = true;
};

const handleEdit = (row: AttendanceRecord) => {
  resetForm();
  dialog.editId = row.id;
  dialog.isEdit = true;
  Object.assign(form, {
    employeeId: row.employeeId,
    attendMonth: row.attendMonth,
    attendDays: row.attendDays ?? undefined,
    restDays: row.restDays ?? undefined,
    lateCount: row.lateCount ?? 0,
    lateMinutes: row.lateMinutes ?? 0,
    missingCardCount: row.missingCardCount ?? 0,
    absentDays: row.absentDays ?? 0,
    leaveDays: row.leaveDays ?? 0,
    remark: row.remark || '',
    version: row.version
  });
  dialog.visible = true;
};

const submitForm = async () => {
  await formRef.value?.validate();
  dialog.saving = true;
  try {
    if (dialog.isEdit) {
      await attendanceApi.update(dialog.editId, { ...form });
    } else {
      await attendanceApi.create({ ...form });
    }
    modal.msgSuccess(dialog.isEdit ? '修改成功' : '新增成功');
    dialog.visible = false;
    await getList();
  } catch (e: any) {
    modal.msgError(e?.message || '保存失败');
  } finally {
    dialog.saving = false;
  }
};

const handleDelete = async (row: AttendanceRecord) => {
  await modal.confirm(`确认删除员工「${row.employeeName}」${row.attendMonth?.slice(0, 7)} 的考勤记录？删除后不可恢复。`);
  try {
    await attendanceApi.remove(row.id);
    modal.msgSuccess('删除成功');
    if (attendanceList.value.length === 1 && queryParams.pageNum > 1) {
      queryParams.pageNum -= 1;
    }
    await getList();
  } catch (e: any) {
    modal.msgError(e?.message || '删除失败');
  }
};

// ==================== 考勤审批 ====================
const approvalInfo = ref<AttendanceApproval>({ period: period.value });
const approvalLoading = ref(false);

/** 期间锁定：审批中/已通过的期间禁止手工增删改（后端同步强校验） */
const periodLocked = computed(
  () => approvalInfo.value.status === 'SUBMITTED' || approvalInfo.value.status === 'APPROVED'
);

const APPROVAL_TAG: Record<string, { label: string; type: 'info' | 'warning' | 'success' | 'danger' }> = {
  DRAFT: { label: '待提交', type: 'info' },
  SUBMITTED: { label: '审批中', type: 'warning' },
  APPROVED: { label: '总监已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' }
};

const approvalTagLabel = computed(() => APPROVAL_TAG[approvalInfo.value.status ?? 'DRAFT']?.label ?? '待提交');
const approvalTagType = computed(() => APPROVAL_TAG[approvalInfo.value.status ?? 'DRAFT']?.type ?? 'info');

const loadApproval = async () => {
  try {
    const res = await attendanceApi.getApproval(period.value);
    approvalInfo.value = res.data ?? { period: period.value };
  } catch {
    approvalInfo.value = { period: period.value };
  }
};

const handleSubmitApproval = async () => {
  try {
    await modal.confirm(`确认将 ${period.value} 考勤提交总监审批？提交后该期间考勤将锁定不可修改，总监通过（或 24 小时未审自动通过）后方可进入算薪。`);
  } catch {
    return;
  }
  approvalLoading.value = true;
  try {
    const res = await attendanceApi.submitApproval(period.value);
    modal.msgSuccess(res.msg || '已提交总监审批');
    await loadApproval();
  } catch (e: any) {
    modal.msgError(e?.message || '提交失败');
  } finally {
    approvalLoading.value = false;
  }
};

// ==================== 审批单详情（工作流办理/跳转共用） ====================
const approvalDetailVisible = ref(false);
const approvalDetailId = ref<string | number>('');

const openApprovalDetail = () => {
  if (!approvalInfo.value.id) return;
  approvalDetailId.value = approvalInfo.value.id;
  approvalDetailVisible.value = true;
};

// 「我的待办 → 查看业务表单」跳转到本页时，按 query.id 自动打开审批单详情
const route = useRoute();
const openFromWorkflow = () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  approvalDetailId.value = id;
  approvalDetailVisible.value = true;
};
useWorkflowRouteOpen('/people/attendance', openFromWorkflow);

onMounted(() => {
  getList();
  loadDeptTree();
  loadEmployees();
  loadApproval();
});
</script>

<style lang="scss" scoped>
.people-attendance-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .toolbar-shell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .table-heading {
    h3 {
      margin: 2px 0 4px;
      font-size: 16px;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .panel-kicker {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--el-color-primary);
  }

  .approval-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-right: 12px;
  }

  .lock-cell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
