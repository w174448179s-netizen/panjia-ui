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
          <el-table-column label="调整单号" align="center" prop="adjustNo" min-width="180" show-overflow-tooltip />
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
                <span class="contract-no">{{ scope.row.contractNo || '—' }}</span>
              </template>
              <template v-else>
                {{ scope.row.employeeName || scope.row.employeeId || '—' }}
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
          <el-table-column label="操作" align="center" width="100" class-name="small-padding fixed-width">
            <template #default="scope">
              <el-button link type="primary" @click="handleDetail(scope.row)">详情</el-button>
              <!-- 审批走 RuoYi 工作流（perf_adjust），不在本页直接通过/拒绝；提交后仅可取消 -->
              <el-button v-if="scope.row.status === 'SUBMITTED'" link type="info" @click="handleCancel(scope.row)">取消</el-button>
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

      <template v-if="formDialog.mode === 'detail'">
        <div v-loading="detailLoading" class="adjust-detail-content">
          <el-alert v-if="detailLoadError" type="error" :title="detailLoadError" :closable="false" show-icon />

          <template v-if="detailFull">
            <!-- 调整单基础信息 -->
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="调整单号">{{ detailFull.adjustNo || '—' }}</el-descriptions-item>
              <el-descriptions-item label="状态">
                <el-tag :type="statusTagType(detailFull.status)" size="small">
                  {{ statusMap[detailFull.status] ?? detailFull.status }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="调整类型">{{ adjustTypeMap[detailFull.adjustType] ?? detailFull.adjustType }}</el-descriptions-item>
              <el-descriptions-item label="调整范围">
                <el-tag :type="detailFull.adjustScope === 'CONTRACT' ? 'warning' : 'info'" size="small" effect="plain">
                  {{ detailFull.adjustScope === 'CONTRACT' ? '合同级' : '明细级' }}
                </el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="期间">{{ detailFull.period || '—' }}</el-descriptions-item>
              <el-descriptions-item v-if="detailFull.adjustScope !== 'CONTRACT'" label="员工">
                {{ detailFull.employeeName || '—' }}
              </el-descriptions-item>
              <el-descriptions-item label="门店/组别">
                <span>{{ detailFull.deptName || '—' }}</span>
                <span v-if="detailFull.adjustType === 'TRANSFER' && detailFull.targetDeptName" class="transfer-arrow">
                  → {{ detailFull.targetDeptName }}
                </span>
              </el-descriptions-item>
              <el-descriptions-item label="原始金额">{{ formatOrigin(detailFull.originalAmount) }}</el-descriptions-item>
              <el-descriptions-item label="调整后金额">
                <span class="amount-red">{{ formatOrigin(detailFull.targetAmount) }}</span>
              </el-descriptions-item>
              <el-descriptions-item label="申请人">{{ detailFull.applicantName || '—' }}</el-descriptions-item>
              <el-descriptions-item label="创建时间">{{ detailFull.createTime || '—' }}</el-descriptions-item>
              <el-descriptions-item label="调整原因" :span="2">{{ detailFull.reason || '—' }}</el-descriptions-item>
            </el-descriptions>

            <!-- 合同信息 -->
            <div v-if="detailFull.contractNo" class="contract-block">
              <div class="block-title">合同信息</div>
              <el-descriptions :column="2" border size="small">
                <el-descriptions-item label="合同号">{{ detailFull.contractNo }}</el-descriptions-item>
                <el-descriptions-item label="订单号">{{ detailFull.orderNo || '—' }}</el-descriptions-item>
                <el-descriptions-item label="签约时间">{{ detailFull.businessDate || '—' }}</el-descriptions-item>
                <el-descriptions-item label="明细条数">{{ detailFull.detailCount ?? 0 }} 条</el-descriptions-item>
                <el-descriptions-item label="应收合计">
                  <span class="amount amount-expected">¥{{ formatNumber(detailFull.expectedTotal) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="实收合计">
                  <span class="amount amount-real">¥{{ formatNumber(detailFull.receivedTotal) }}</span>
                </el-descriptions-item>
                <el-descriptions-item label="房源地址" :span="2">{{ detailFull.propertyAddress || '—' }}</el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- 受影响明细 -->
            <div v-if="detailFull.details && detailFull.details.length > 0" class="fact-block">
              <div class="block-title">受影响明细</div>
              <span class="block-subtitle">
                （{{ detailFull.adjustScope === 'CONTRACT' ? '合同级调整：调整金额按各明细占比分摊' : '明细级调整：仅调整单条明细' }}）
              </span>
              <el-table :data="detailFull.details" border size="small" stripe>
                <el-table-column label="序号" type="index" width="55" align="center" />
                <el-table-column label="门店/组别" min-width="140" show-overflow-tooltip>
                  <template #default="scope">
                    {{ scope.row.deptPath || '—' }}
                  </template>
                </el-table-column>
                <el-table-column label="工号" width="100">
                  <template #default="scope">{{ scope.row.employeeCode || '—' }}</template>
                </el-table-column>
                <el-table-column label="姓名" width="90">
                  <template #default="scope">{{ scope.row.employeeName || '—' }}</template>
                </el-table-column>
                <el-table-column label="所属角色" width="100">
                  <template #default="scope">{{ scope.row.roleName || '—' }}</template>
                </el-table-column>
                <el-table-column label="角色占比" width="100" align="right">
                  <template #default="scope">
                    {{ formatRatio(scope.row.shareRatio) }}
                  </template>
                </el-table-column>
                <el-table-column label="应收金额" width="120" align="right">
                  <template #default="scope">
                    <span class="amount amount-expected">{{ formatNumber(scope.row.amount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="变动" width="110" align="right">
                  <template #default="scope">
                    <span :class="getAmountClass(scope.row.deltaAmount)">{{ formatDelta(scope.row.deltaAmount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="调整后" width="120" align="right">
                  <template #default="scope">
                    <span class="amount" :class="getAmountClass(scope.row.deltaAmount)">{{ formatNumber(scope.row.afterAmount) }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="状态" width="80" align="center">
                  <template #default="scope">
                    <el-tag v-if="scope.row.target" type="danger" size="small" effect="dark">调整行</el-tag>
                    <el-tag v-else type="info" size="small" effect="plain">参考行</el-tag>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </template>
        </div>
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
import type { PerformanceAdjust, AdjustQuery, AdjustCreateForm, PerformanceFact, AdjustDetailVO } from '@/api/panjia/performance';
import { employeeApi } from '@/api/panjia/employee';
import type { DeptNode, Employee } from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useRoute } from 'vue-router';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

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

/** 原始金额：绝对值口径，带 ¥ 前缀；缺失显示 — */
const formatOrigin = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  return `¥${n.toFixed(2)}`;
};

/** 普通金额格式化：两位小数，无 ¥ 前缀 */
const formatNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
};

/** 安全金额相加：避免浮点精度问题，返回两位小数的数字 */
const addAmounts = (a: number | string | undefined | null, b: number | string | undefined | null): number => {
  const na = Number(a ?? 0) || 0;
  const nb = Number(b ?? 0) || 0;
  return Math.round((na + nb) * 100) / 100;
};

/** 比例格式化：0.45 → 45.00%，空值显示 — */
const formatRatio = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '—';
  const n = Number(val);
  if (Number.isNaN(n)) return '—';
  return `${(n * 100).toFixed(2)}%`;
};

/** 变动金额格式化：带 +/- 前缀 */
const formatDelta = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '0.00';
  const n = Number(val);
  if (Number.isNaN(n)) return String(val);
  const prefix = n > 0 ? '+' : '';
  return prefix + n.toFixed(2);
};

/** 变动金额颜色类 */
const getAmountClass = (val: number | undefined | null): string => {
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
const detailFull = ref<AdjustDetailVO | null>(null);
const detailLoading = ref(false);
const detailLoadError = ref('');

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
  detailFull.value = null;
  detailLoadError.value = '';
  detailLoading.value = true;
  formDialog.mode = 'detail';
  formDialog.title = '调整单详情';
  formDialog.visible = true;
  try {
    const res = await performanceApi.getAdjustDetail(row.id);
    detailFull.value = res.data;
  } catch (e: any) {
    detailLoadError.value = e?.message || '加载详情失败';
  } finally {
    detailLoading.value = false;
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
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
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
      targetAmount: num(d.targetAmount),
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

  .adjust-detail-content {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .contract-block, .fact-block {
      .block-title {
        font-size: 15px;
        font-weight: 600;
        margin-bottom: 8px;
        color: var(--el-text-color-primary);
      }
      .block-subtitle {
        font-size: 12px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }
    }

    .amount {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .amount-expected {
      color: var(--el-text-color-secondary);
    }
    .amount-real {
      color: var(--el-color-danger);
    }
    .amount-red {
      color: var(--el-color-danger);
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
  }
}
</style>
