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
              @change="handleScopeChange"
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
            <EmployeeSelect
              v-model="queryParams.employeeId"
              :dept-id="queryParams.deptId"
              width="220px"
              @change="handleScopeChange"
            />
          </el-form-item>
          <el-form-item label="门店/组别" prop="deptId">
            <PanjiaDeptSelect
              v-model="queryParams.deptId"
              :placeholder="deptLocked ? '本部门' : '全部门店/组别'"
              :clearable="!deptLocked"
              width="220px"
              @change="handleScopeChange"
            />
          </el-form-item>
          <el-form-item label="类型" prop="bizType">
            <el-select
              v-model="queryParams.bizType"
              placeholder="全部类型"
              clearable
              filterable
              style="width: 160px"
              @change="handleQuery"
            >
              <el-option v-for="t in bizTypeOptions" :key="t" :label="t" :value="t" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键字" prop="keyword">
            <el-input
              v-model.trim="queryParams.keyword"
              placeholder="合同号/订单号/物业地址"
              clearable
              style="width: 260px"
              @keyup.enter="handleQuery"
              @clear="handleQuery"
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
            </template>
          </el-table-column>
          <el-table-column label="调整类型" align="center" width="100">
            <template #default="scope">
              {{ adjustTypeMap[scope.row.adjustType] ?? scope.row.adjustType }}
            </template>
          </el-table-column>
          <el-table-column label="新签业绩" align="right" prop="originalAmount" width="130">
            <template #default="scope">
              <span class="origin-amount">{{ formatOrigin(scope.row.originalAmount) }}</span>
              <div v-if="scope.row.adjustType === 'ADD_MEMBER'" class="cell-sub">合同总额</div>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="130">
            <template #default="scope">
              <span class="amount-ink">{{ formatOrigin(scope.row.convertedOriginalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整后业绩" align="right" width="140">
            <template #default="scope">
              <!-- 增加角色人：targetAmount 即新角色人业绩（新增 +X）；afterTotalAmount≠原总额时为混合金额调整 -->
              <template v-if="scope.row.adjustType === 'ADD_MEMBER'">
                <span class="amount-positive amount-strong">+{{ formatOrigin(scope.row.targetAmount) }}</span>
                <div class="cell-sub">
                  <template v-if="addMemberTotalChanged(scope.row)">
                    新增角色人 · 总额 {{ formatOrigin(scope.row.originalAmount) }} →
                    <span :class="Number(scope.row.afterTotalAmount) > Number(scope.row.originalAmount) ? 'amount-positive' : 'amount-negative'">
                      {{ formatOrigin(scope.row.afterTotalAmount) }}
                    </span>
                  </template>
                  <template v-else>新增角色人 · 总额不变</template>
                </div>
              </template>
              <span v-else class="amount-red">
                {{ formatOrigin(scope.row.targetAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="130">
            <template #default="scope">
              <span class="amount-ink">{{ formatOrigin(scope.row.convertedTargetAmount) }}</span>
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
          <el-table-column label="操作" align="center" width="200" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
              <el-button v-if="scope.row.status === 'SUBMITTED' && checkPermi(['workflow:task:edit'])" link type="success" :loading="approvalLoading" @click="onBizApprove(scope.row.id)">审批</el-button>
              <el-button
                v-if="scope.row.status === 'SUBMITTED' && String(scope.row.applicantId) === String(currentUserId) && checkPermi(['perf:adjust:add'])"
                link
                type="warning"
                @click="handleWithdraw(scope.row)"
              >撤回</el-button>
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
          <EmployeeSelect
            v-model="formData.employeeId"
            :clearable="false"
            @change="onFormEmployeeChange"
          />
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
            @change="onFactChange"
          >
            <el-option
              v-for="f in factOptions"
              :key="f.id"
              :label="factOptionLabel(f)"
              :value="f.id"
            />
          </el-select>
          <div v-if="formData.factId" class="fact-amount-hint">
            当前新签业绩：¥{{ formatNumber(selectedFact?.amount) }}
          </div>
          <el-alert
            v-if="inFlight"
            type="warning"
            show-icon
            :closable="false"
            title="该合同已有审批中的业绩调整单，请待其审批完成或撤回后再发起新调整"
            style="margin-top: 8px"
          />
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'AMOUNT'" label="调整金额" prop="deltaAmount">
          <el-input-number
            v-model="formData.deltaAmount"
            :min="-99999999"
            :max="99999999"
            :precision="2"
            :step="100"
            style="width: 100%"
            @change="onDeltaChange"
          />
          <div class="form-hint">输入本次调整金额（正=调增，负=调减），调整后业绩自动算出</div>
        </el-form-item>
        <el-form-item v-if="formData.adjustType === 'AMOUNT'" label="调整后业绩" prop="targetAmount">
          <el-input-number
            v-model="formData.targetAmount"
            :min="0"
            :max="99999999"
            :precision="2"
            :step="100"
            style="width: 100%"
            @change="onTargetChange"
          />
          <div class="form-hint">也可直接输入调整后的目标总金额，调整金额自动算出</div>
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
          :loading="submitLoading || inFlightChecking"
          :disabled="inFlight"
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
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import type { PerformanceEmployeeOption } from '@/api/panjia/performance';
import modal from '@/plugins/modal';
import { useRoute } from 'vue-router';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';
import { useBizApproval } from '@/hooks/workflow/useBizApproval';
import { checkPermi } from '@/utils/permission';
import { useDeptScope } from '@/hooks/useDeptScope';
import WorkflowHandle from '@/components/WorkflowHandle/index.vue';
import { useUserStore } from '@/store/modules/user';

const route = useRoute();
const userStore = useUserStore();
/** 当前登录人 ID：撤回按钮仅对调整单发起人本人可见（后端二次强校验） */
const currentUserId = computed(() => userStore.userId);

/** 业务明细直接审批：通过 businessId 查当前用户可办理任务，复用 WorkflowHandle 弹窗 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandle>>();
const { loading: approvalLoading, handleBizApproval } = useBizApproval();
const onBizApprove = (businessId: string | number) =>
  handleBizApproval(businessId, (task) => workflowHandleRef.value?.open(task));

/** 发起人撤回审批中的调整单：审批期间明细被其他操作改变无法执行时，撤回后按最新明细重新发起 */
const handleWithdraw = async (row: any) => {
  try {
    await modal.confirm('撤回后审批流程作废、本单置为「已取消」，需按最新合同明细重新发起。确认撤回？');
  } catch {
    return;
  }
  try {
    await performanceApi.withdrawAdjust(row.id);
    modal.msgSuccess('已撤回');
    getList();
  } catch {
    // 全局请求拦截器已弹出后端返回的具体失败原因
  }
};

// ==================== 枚举 ====================
const adjustTypeMap: Record<string, string> = {
  AMOUNT: '金额调整',
  ADD_MEMBER: '增加角色人',
  MANUAL_OFFSET: '业绩冲正',
  RECEIVED_AMOUNT: '实收调整'
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

// ==================== 部门口径（全系统统一：所有用户查本部门及以下） ====================
const { deptLocked, defaultDeptId } = useDeptScope();

// ==================== 筛选 & 分页 ====================
const queryParams = reactive<AdjustQuery & { pageNum: number; pageSize: number }>({
  pageNum: 1,
  pageSize: 20,
  period: undefined,
  adjustType: undefined,
  status: undefined,
  employeeId: undefined,
  deptId: defaultDeptId(),
  bizType: undefined as string | undefined,
  keyword: undefined as string | undefined
});

// ==================== 业务类型下拉（数据范围与列表一致；随期间/部门/员工变化刷新） ====================
const bizTypeOptions = ref<string[]>([]);
const loadBizTypes = async () => {
  try {
    const res = await performanceApi.listSearchBizTypes({
      period: queryParams.period,
      deptId: queryParams.deptId,
      employeeId: queryParams.employeeId
    });
    bizTypeOptions.value = res.data ?? [];
    // 当前选中类型已不在可见范围内时清空，避免带着失效条件查询
    if (queryParams.bizType && !bizTypeOptions.value.includes(queryParams.bizType)) {
      queryParams.bizType = undefined;
    }
  } catch {
    bizTypeOptions.value = [];
  }
};

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
      deptId: queryParams.deptId || undefined,
      bizType: queryParams.bizType || undefined,
      keyword: queryParams.keyword || undefined
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

/** 期间/部门/员工范围变化：先按新范围刷新类型选项（顺带剔除失效选中），再触发查询 */
const handleScopeChange = () => {
  loadBizTypes().then(handleQuery);
};

const resetQuery = () => {
  Object.assign(queryParams, {
    period: undefined,
    adjustType: undefined,
    status: undefined,
    employeeId: undefined,
    deptId: defaultDeptId(),
    bizType: undefined,
    keyword: undefined,
    pageNum: 1
  });
  loadBizTypes().then(getList);
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

/** ADD_MEMBER 单是否同时调整了合同总额（afterTotalAmount 为空视为旧单=总额不变） */
const addMemberTotalChanged = (row: {
  adjustType?: string;
  originalAmount?: number | string | null;
  afterTotalAmount?: number | string | null;
}): boolean => {
  if (row.adjustType !== 'ADD_MEMBER' || row.afterTotalAmount === undefined || row.afterTotalAmount === null) {
    return false;
  }
  const after = Number(row.afterTotalAmount);
  const origin = row.originalAmount === undefined || row.originalAmount === null ? 0 : Number(row.originalAmount);
  return !Number.isNaN(after) && !Number.isNaN(origin) && Math.abs(after - origin) > 0.004;
};

// ==================== 新增 / 详情弹窗 ====================
const formDialog = reactive({
  visible: false,
  mode: 'create' as 'create' | 'detail',
  title: '新增调整单'
});
const formRef = ref();
const submitLoading = ref(false);
/** 所选合同是否存在审批中的业绩调整单（前端预检，true 时禁用提交） */
const inFlight = ref(false);
const inFlightChecking = ref(false);

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

const defaultFormData = (): AdjustCreateForm & { factId: string; deltaAmount?: number } => ({
  factId: '',
  period: '',
  employeeId: '',
  deptId: '',
  adjustType: '',
  targetAmount: undefined as number | undefined,
  deltaAmount: undefined as number | undefined,
  reason: ''
});

const formData = reactive(defaultFormData());

/** 所选事实当前业绩（调整金额 ↔ 调整后业绩联动基准） */
const factBaseAmount = computed(() => Number(selectedFact.value?.amount ?? 0));

/** 录调整金额 → 自动算调整后业绩 */
const onDeltaChange = () => {
  if (formData.deltaAmount != null && !Number.isNaN(Number(formData.deltaAmount))) {
    const next = factBaseAmount.value + Number(formData.deltaAmount);
    formData.targetAmount = Number(next.toFixed(2));
  }
};

/** 录调整后业绩 → 自动算调整金额 */
const onTargetChange = () => {
  if (formData.targetAmount != null && !Number.isNaN(Number(formData.targetAmount))) {
    const next = Number(formData.targetAmount) - factBaseAmount.value;
    formData.deltaAmount = Number(next.toFixed(2));
  }
};

/** 表单内已选员工（EmployeeSelect 选中后缓存，用于自动带出部门/回显部门名） */
const selectedFormEmployee = ref<PerformanceEmployeeOption | null>(null);

/** 门店/组别只读回显：优先取员工主档，其次取所选业绩明细所在部门 */
const selectedEmployeeDept = computed(() => {
  const emp = String(selectedFormEmployee.value?.employeeId ?? '') === String(formData.employeeId)
    ? selectedFormEmployee.value
    : null;
  return emp?.deptName || selectedFact.value?.deptName || '';
});

const formRules = {
  adjustType: [{ required: true, message: '请选择调整类型', trigger: 'change' }],
  period: [{ required: true, message: '请选择期间', trigger: 'change' }],
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择门店/组别', trigger: 'change' }],
  factId: [{ required: true, message: '请选择关联业绩事实', trigger: 'change' }],
  reason: [{ required: true, message: '请输入调整原因', trigger: 'blur' }],
  targetAmount: [{ required: true, message: '请输入调整金额或调整后业绩', trigger: 'blur' }]
};

// 选完员工：自动带出部门，并尝试加载该员工的业绩事实
const onFormEmployeeChange = async (
  _employeeId: string | number | undefined,
  emp: PerformanceEmployeeOption | null,
) => {
  selectedFormEmployee.value = emp;
  if (emp?.deptId) {
    formData.deptId = String(emp.deptId);
  }
  formData.factId = '';
  await loadFactOptions();
};

// 切换关联业绩：联动基准变了，清空已算的调整金额/调整后业绩，并预检该合同在途调整单
const onFactChange = async () => {
  formData.deltaAmount = undefined;
  formData.targetAmount = undefined;
  inFlight.value = false;
  const fact = selectedFact.value;
  const contractNo = fact?.contractNo;
  if (!contractNo || !formData.period) return;
  inFlightChecking.value = true;
  try {
    const res = await performanceApi.checkAdjustInFlight(contractNo, formData.period, fact.factType ?? 'PERF_EXPECT');
    inFlight.value = !!res.data;
  } catch {
    inFlight.value = false;
  } finally {
    inFlightChecking.value = false;
  }
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
  selectedFormEmployee.value = null;
  factOptions.value = [];
  inFlight.value = false;
  inFlightChecking.value = false;
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
  loadBizTypes();
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

  .amount-strong {
    font-size: 15px;
    font-weight: 700;
  }

  .cell-sub {
    margin-top: 2px;
    font-size: 11px;
    line-height: 1.2;
    color: var(--el-text-color-secondary);
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

  .amount-ink {
    color: #303133;
    font-weight: 500;
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
