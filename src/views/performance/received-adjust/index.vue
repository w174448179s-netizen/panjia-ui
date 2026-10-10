<template>
  <div class="received-adjust-page">
    <el-card class="page-card" shadow="never">
      <div class="page-content">
        <!-- 筛选条件（调整类型固定为实收调整，不提供切换） -->
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
          <el-table-column label="调整对象" align="center" min-width="160" show-overflow-tooltip>
            <template #default="scope">
              <el-button link type="primary" class="adjust-object-link" @click="handleDetail(scope.row)">
                {{ scope.row.contractNo || '—' }}
              </el-button>
            </template>
          </el-table-column>
          <el-table-column label="门店/组别" align="center" min-width="150" show-overflow-tooltip>
            <template #default="scope">
              <span>{{ scope.row.deptName || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整前实收" align="right" prop="originalAmount" width="130">
            <template #default="scope">
              <span class="origin-amount">{{ formatOrigin(scope.row.originalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="折算后" align="right" width="130">
            <template #default="scope">
              <span class="amount-ink">{{ formatOrigin(scope.row.convertedOriginalAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="调整后实收" align="right" width="140">
            <template #default="scope">
              <span class="amount-red">{{ formatOrigin(scope.row.targetAmount) }}</span>
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
          <el-empty description="暂无实收调整单" />
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

    <!-- 详情弹窗：与新签调整共用同一详情面板（面板内已按实收口径展示标签） -->
    <el-dialog
      v-model="detailDialog.visible"
      title="实收调整单详情"
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
import type { PerformanceAdjust, AdjustQuery } from '@/api/panjia/performance';
import AdjustDetailPanel from '../adjust/components/AdjustDetailPanel.vue';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
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

// ==================== 筛选 & 分页（调整类型固定实收调整） ====================
const queryParams = reactive<AdjustQuery & { pageNum: number; pageSize: number }>({
  pageNum: 1,
  pageSize: 20,
  period: undefined,
  adjustType: 'RECEIVED_AMOUNT' as string | undefined,
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
    // 下拉失败不阻塞列表
  }
};

watch(
  () => [queryParams.period, queryParams.deptId, queryParams.employeeId],
  () => loadBizTypes(),
  { immediate: true }
);

// ==================== 列表 ====================
const adjustList = ref<PerformanceAdjust[]>([]);
const total = ref(0);
const loading = ref(false);

const getList = async () => {
  loading.value = true;
  try {
    const res = await performanceApi.listAdjusts({ ...queryParams });
    adjustList.value = res.rows ?? [];
    total.value = Number(res.total ?? 0);
  } catch {
    // 拦截器处理
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

/** 期间/员工/部门变化：从第一页重新查询（员工选项联动由组件内部处理） */
const handleScopeChange = () => {
  handleQuery();
};

const resetQuery = () => {
  queryParams.period = undefined;
  queryParams.status = undefined;
  queryParams.employeeId = undefined;
  queryParams.deptId = defaultDeptId();
  queryParams.bizType = undefined;
  queryParams.keyword = undefined;
  handleQuery();
};

// 金额格式化（千分位，两位小数）
const formatOrigin = (val: string | number | null | undefined): string => {
  if (val == null || val === '') return '0.00';
  const num = Number(val);
  if (Number.isNaN(num)) return String(val);
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ==================== 详情 ====================
const detailDialog = reactive<{ visible: boolean; businessId: string | number | null }>({
  visible: false,
  businessId: null
});
const handleDetail = (row: PerformanceAdjust) => {
  detailDialog.businessId = row.id;
  detailDialog.visible = true;
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
useWorkflowRouteOpen('/performance/received-adjust', openFromWorkflow);

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.received-adjust-page {
  padding: 8px;

  .page-card {
    .page-content {
      .filter-form {
        margin-bottom: 4px;
      }

      .toolbar {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 10px;
      }

      .data-table {
        width: 100%;
      }

      .empty-wrap {
        padding: 24px 0;
      }

      .pagination-wrap {
        display: flex;
        justify-content: flex-end;
        margin-top: 12px;
      }

      .origin-amount {
        color: var(--el-text-color-primary);
      }

      .amount-ink {
        color: var(--el-text-color-regular);
      }

      .amount-red {
        color: var(--el-color-danger);
        font-weight: 600;
      }
    }
  }
}
</style>
