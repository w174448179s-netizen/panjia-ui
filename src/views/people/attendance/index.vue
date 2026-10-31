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
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
            :clearable="!deptLocked"
            width="200px"
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
              v-hasPermi="['dingtalk:sync:attendance']"
              type="primary"
              plain
              icon="Calendar"
              @click="syncOpen = true"
            >
              钉钉同步
            </el-button>
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

      <el-tabs v-model="activeTab">
        <el-tab-pane label="考勤汇总" name="summary">
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
        <el-table-column label="事假(天)" align="center" prop="personalLeaveDays" width="80" />
        <el-table-column label="病假诊所(天)" align="center" prop="sickClinicDays" width="100" />
        <el-table-column label="病假二甲(天)" align="center" prop="sickHospitalDays" width="100" />
        <el-table-column label="请假合计(天)" align="center" prop="leaveDays" width="100" />
        <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" align="center" width="200" fixed="right">
          <template #default="scope">
           <el-tooltip content="详情" placement="top">
            <el-button type="primary" link icon="View" @click="openDetail(scope.row as AttendanceRecord)"></el-button>
           </el-tooltip>
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
        </el-tab-pane>

        <!-- 修改记录：人事审计视角，考勤期间与上方筛选卡联动 -->
        <el-tab-pane label="修改记录" name="rectify">
          <el-form :inline="true" class="rectify-filter">
            <el-form-item label="姓名">
              <el-input
                v-model="rectifyQuery.employeeName"
                placeholder="请输入姓名"
                clearable
                style="width: 140px"
                @keyup.enter="handleRectifyQuery"
              />
            </el-form-item>
            <el-form-item label="状态">
              <el-select v-model="rectifyQuery.status" placeholder="全部" clearable style="width: 130px">
                <el-option label="待审批" value="SUBMITTED" />
                <el-option label="已通过" value="APPROVED" />
                <el-option label="已驳回" value="REJECTED" />
                <el-option label="已取消" value="CANCELED" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" icon="Search" @click="handleRectifyQuery">搜索</el-button>
              <el-button icon="Refresh" @click="resetRectifyQuery">重置</el-button>
            </el-form-item>
          </el-form>

          <el-table v-loading="rectifyLoading" border class="data-table" :data="rectifyList">
            <el-table-column label="考勤期间" align="center" width="100">
              <template #default="{ row }">{{ row.attendMonth?.slice(0, 7) ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="工号" align="center" prop="employeeCode" width="100" />
            <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
            <el-table-column label="状态" align="center" width="90">
              <template #default="{ row }">
                <el-tag :type="rectifyStatusTag(row.status)" size="small">{{ rectifyStatusLabel(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="修改项" align="left" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ rectifyChangeSummary(row) }}</template>
            </el-table-column>
            <el-table-column label="修改说明" align="center" prop="reason" min-width="130" show-overflow-tooltip />
            <el-table-column label="提交时间" align="center" prop="submitTime" width="160" />
            <el-table-column label="审批时间" align="center" width="160">
              <template #default="{ row }">{{ row.approveTime || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作" align="center" width="90" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" link icon="View" @click="openRectifyDetail(row)">详情</el-button>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="该期间暂无修改申请记录" />
            </template>
          </el-table>

          <pagination
            v-show="rectifyTotal > 0"
            v-model:page="rectifyQuery.pageNum"
            v-model:limit="rectifyQuery.pageSize"
            :total="rectifyTotal"
            class="pagination-wrap"
            @pagination="getRectifyList"
          />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑考勤' : '新增考勤'" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="员工" prop="employeeId">
          <EmployeeSelect
            v-model="form.employeeId"
            :disabled="dialog.isEdit"
            :initial-option="editInitialOption"
            placeholder="请选择员工"
          />
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
        <el-form-item label="事假天数" prop="personalLeaveDays">
          <el-input-number v-model="form.personalLeaveDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="病假天数（诊所类证明）" prop="sickClinicDays">
          <el-input-number v-model="form.sickClinicDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="病假天数（二甲医院以上）" prop="sickHospitalDays">
          <el-input-number v-model="form.sickHospitalDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="请假合计天数">
          <el-input-number :model-value="leaveTotal" disabled style="width: 100%" />
          <div class="form-tip">合计 = 事假 + 病假诊所 + 病假二甲，自动计算；旧数据未分类差额默认计入事假，请按实际调整</div>
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

    <!-- 考勤每日明细（按员工查询，与「考勤查询→详情」共用组件） -->
    <AttendanceDetailDialog
      v-model="detailVisible"
      mode="manage"
      :employee-id="detailEmployeeId"
      :employee-name="detailEmployeeName"
      :attend-month="detailMonth"
    />

    <!-- 修改申请详情（复用工作流审批详情组件，含修改明细/说明/截图预览） -->
    <el-dialog v-model="rectifyDetailVisible" title="考勤修改申请详情" width="860px" append-to-body destroy-on-close>
      <AttendanceRectifyDetail v-if="rectifyDetailId" :business-id="rectifyDetailId" />
    </el-dialog>

    <!-- 考勤导入入口：整体复用导入页组件（自带归属月/上传/批次管理），关闭后刷新汇总列表 -->
    <el-dialog v-model="importOpen" title="考勤数据导入" width="1080px" append-to-body destroy-on-close @closed="getList">
      <ImportAttendancePage />
    </el-dialog>

    <!-- 钉钉同步入口：默认同步当前筛选的考勤期间 -->
    <el-dialog v-model="syncOpen" title="钉钉考勤同步" width="1080px" append-to-body destroy-on-close>
      <DingTalkSyncPanel type="ATTENDANCE" :default-period="period" embedded @finished="handleSynced" />
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { FormInstance, FormRules } from 'element-plus';
import { attendanceApi } from '@/api/panjia/attendance';
import type {
  AttendanceApproval,
  AttendanceQuery,
  AttendanceRecord,
  AttendanceRectify,
  AttendanceRectifyQuery,
  AttendanceRectifyStatus,
  AttendanceSaveForm,
} from '@/api/panjia/types';
import type { PerformanceEmployeeOption } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import AttendanceDetailDialog from '@/components/AttendanceDetailDialog/index.vue';
import modal from '@/plugins/modal';
import { Lock } from '@element-plus/icons-vue';
import AttendanceApprovalDetail from '@/components/WorkflowHandle/details/AttendanceApprovalDetail.vue';
import AttendanceRectifyDetail from '@/components/WorkflowHandle/details/AttendanceRectifyDetail.vue';
import ImportAttendancePage from '@/views/import/attendance/index.vue';
import DingTalkSyncPanel from '@/views/people/dingtalk/components/DingTalkSyncPanel.vue';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useDeptScope } from '@/hooks/useDeptScope';

// ==================== 查询 ====================
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);

/** 考勤导入弹窗（内嵌导入页组件） */
const importOpen = ref(false);

/** 钉钉同步弹窗（默认同步当前筛选期间） */
const syncOpen = ref(false);

// 门店/组别筛选：全系统统一数据权限口径（useDeptScope：默认本部门、树裁剪为子树、不可清空）
const { deptLocked, defaultDeptId } = useDeptScope();

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

/** 切换期间：列表与审批状态联动刷新（修改记录 Tab 同期间联动） */
const handlePeriodChange = () => {
  queryParams.pageNum = 1;
  getList();
  loadApproval();
  rectifyQuery.pageNum = 1;
  getRectifyList();
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

// ==================== 新增/编辑 ====================
/** 编辑弹窗员工回显选项（列表行自带姓名/工号/部门） */
const editInitialOption = ref<PerformanceEmployeeOption | null>(null);
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
  personalLeaveDays: 0,
  sickClinicDays: 0,
  sickHospitalDays: 0,
  remark: '',
  version: undefined
});

const form = reactive<AttendanceSaveForm>(createEmptyForm());

/** 后端 BigDecimal 经 Jackson 序列化为字符串，参与运算前统一转数值，避免字符串拼接导致 .toFixed 报错 */
const toNum = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** 请假合计（只读）= 事假 + 病假诊所 + 病假二甲，与后端 buildRecord 口径一致 */
const leaveTotal = computed(() =>
  Number((toNum(form.personalLeaveDays) + toNum(form.sickClinicDays) + toNum(form.sickHospitalDays)).toFixed(2)));

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
  editInitialOption.value = null;
  dialog.editId = '';
  dialog.isEdit = false;
  dialog.visible = true;
};

const handleEdit = (row: AttendanceRecord) => {
  resetForm();
  dialog.editId = row.id;
  dialog.isEdit = true;
  // 旧数据可能只有合计 leaveDays、分项为 0：未分类差额默认计入事假，保证合计不丢失
  const splitSum = toNum(row.personalLeaveDays) + toNum(row.sickClinicDays) + toNum(row.sickHospitalDays);
  const residual = Math.max(0, toNum(row.leaveDays) - splitSum);
  Object.assign(form, {
    employeeId: row.employeeId,
    attendMonth: row.attendMonth,
    attendDays: row.attendDays == null ? undefined : toNum(row.attendDays),
    restDays: row.restDays == null ? undefined : toNum(row.restDays),
    lateCount: toNum(row.lateCount),
    lateMinutes: toNum(row.lateMinutes),
    missingCardCount: toNum(row.missingCardCount),
    absentDays: toNum(row.absentDays),
    personalLeaveDays: Number((toNum(row.personalLeaveDays) + residual).toFixed(2)),
    sickClinicDays: toNum(row.sickClinicDays),
    sickHospitalDays: toNum(row.sickHospitalDays),
    remark: row.remark || '',
    version: row.version
  });
  editInitialOption.value = {
    employeeId: String(row.employeeId),
    employeeName: row.employeeName ?? '',
    employeeCode: row.employeeCode ?? '',
    deptId: row.deptId ? String(row.deptId) : undefined,
    deptName: row.deptName ?? '',
  };
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

// ==================== 考勤每日明细（复用共享弹窗） ====================
const detailVisible = ref(false);
const detailMonth = ref('');
const detailEmployeeId = ref<string | number>('');
const detailEmployeeName = ref('');

const openDetail = (row: AttendanceRecord) => {
  detailMonth.value = row.attendMonth || '';
  detailEmployeeId.value = row.employeeId ?? '';
  detailEmployeeName.value = row.employeeName ?? '';
  detailVisible.value = true;
};

/** 钉钉同步完成后刷新当前期间的汇总与审批状态 */
const handleSynced = () => {
  getList();
  loadApproval();
};

// ==================== 修改记录（人事审计视角） ====================
/** 当前 Tab：summary 考勤汇总 / rectify 修改记录 */
const activeTab = ref('summary');
const rectifyLoading = ref(false);
const rectifyList = ref<AttendanceRectify[]>([]);
const rectifyTotal = ref(0);
const rectifyQuery = reactive<AttendanceRectifyQuery>({ pageNum: 1, pageSize: 10, employeeName: '', status: undefined });

const getRectifyList = async () => {
  rectifyLoading.value = true;
  try {
    // 与汇总共用筛选卡的单月期间
    const monthFirst = `${period.value}-01`;
    const res = await attendanceApi.rectifyPage({
      pageNum: rectifyQuery.pageNum,
      pageSize: rectifyQuery.pageSize,
      monthStart: monthFirst,
      monthEnd: monthFirst,
      employeeName: rectifyQuery.employeeName?.trim() || undefined,
      status: rectifyQuery.status || undefined
    });
    rectifyList.value = res.data?.rows ?? [];
    rectifyTotal.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询修改记录失败');
  } finally {
    rectifyLoading.value = false;
  }
};

const handleRectifyQuery = () => {
  rectifyQuery.pageNum = 1;
  getRectifyList();
};

const resetRectifyQuery = () => {
  rectifyQuery.employeeName = '';
  rectifyQuery.status = undefined;
  handleRectifyQuery();
};

const RECTIFY_STATUS_LABEL: Record<string, string> = {
  SUBMITTED: '待审批',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELED: '已取消'
};
const RECTIFY_STATUS_TAG: Record<string, 'warning' | 'success' | 'danger' | 'info'> = {
  SUBMITTED: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
  CANCELED: 'info'
};
const rectifyStatusLabel = (s?: AttendanceRectifyStatus | string) => RECTIFY_STATUS_LABEL[s || ''] || s || '—';
const rectifyStatusTag = (s?: AttendanceRectifyStatus | string) => RECTIFY_STATUS_TAG[s || ''] || 'info';

/** 修改项摘要：字段 原值→新值；...（与 my.vue 同口径） */
const rectifyChangeSummary = (row: AttendanceRectify) => {
  const items = row.changes || [];
  if (!items.length) return '—';
  return items.map((c) => `${c.fieldName} ${c.oldValue === '' || c.oldValue == null ? '—' : c.oldValue}→${c.newValue === '' ? '（清空）' : c.newValue}`).join('；');
};

// 详情弹窗（复用工作流审批详情组件）
const rectifyDetailVisible = ref(false);
const rectifyDetailId = ref<string>('');
const openRectifyDetail = (row: AttendanceRectify) => {
  rectifyDetailId.value = row.id;
  rectifyDetailVisible.value = true;
};

onMounted(() => {
  getList();
  loadApproval();
  getRectifyList();
});
</script>

<style lang="scss" scoped>
.people-attendance-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .form-tip {
    margin-top: 4px;
    font-size: 12px;
    line-height: 1.4;
    color: var(--el-text-color-secondary);
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

  .rectify-filter {
    margin-bottom: 4px;

    :deep(.el-form-item) {
      margin-bottom: 10px;
    }
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
