<template>
  <div class="p-2 app-container workflow-task-waiting-page">
    <div class="search-wrap">
      <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
        <template #header>
          <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
            <div><h3>筛选条件</h3></div>
          </div>
        </template>
        <el-form ref="queryFormRef" :model="queryParams" :inline="true" class="query-form">
          <el-form-item>
            <el-badge :value="userSelectCount" :max="10" class="item">
              <el-button type="primary" @click="openUserSelect">选择申请人</el-button>
            </el-badge>
          </el-form-item>
          <el-form-item label="当前环节" prop="nodeName">
            <el-input v-model="queryParams.nodeName" placeholder="如：总监审批" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetQuery">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>
    </div>

    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <h3>待办任务</h3>
            <span class="table-subtitle">共 {{ total }} 条待你处理</span>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="handleQuery"></right-toolbar>
          </div>
        </div>
      </template>

      <!-- 按业务类型快捷切换：一眼看清"我手上都是哪类事" -->
      <div class="type-tabs">
        <el-radio-group v-model="queryParams.flowCode" size="default" @change="handleTypeChange">
          <el-radio-button v-for="t in flowTypeTabs" :key="t.code || 'all'" :value="t.code">
            {{ t.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <el-table
        v-loading="loading"
        border
        class="data-table"
        :data="taskList"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="50" align="center" />
        <el-table-column align="center" type="index" label="序号" width="58"></el-table-column>

        <!-- 核心列：这是什么单、单号是多少 -->
        <el-table-column label="待办事项" min-width="330">
          <template #default="scope">
            <div class="biz-cell">
              <el-tag :type="flowTagType(scope.row.flowCode)" effect="dark" size="small" class="biz-tag">
                {{ bizType(scope.row) }}
              </el-tag>
              <div class="biz-body">
                <div class="biz-detail" :title="bizDetail(scope.row)">{{ bizDetail(scope.row) }}</div>
                <div class="biz-no">单号 {{ scope.row.businessCode || scope.row.businessId }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 核心列：我现在要做什么 -->
        <el-table-column label="当前环节" align="center" width="150">
          <template #default="scope">
            <el-tag type="primary" effect="plain">{{ scope.row.nodeName }}</el-tag>
            <div class="biz-no">{{ scope.row.flowName }}</div>
          </template>
        </el-table-column>

        <!-- 申请人为空 = 系统自动发起（如导入归档自动建单），不留空白 -->
        <el-table-column align="center" label="申请人" width="100">
          <template #default="scope">{{ scope.row.createByName || '系统自动' }}</template>
        </el-table-column>
        <el-table-column align="center" label="待办时间" prop="createTime" width="160"></el-table-column>

        <el-table-column label="操作" align="center" width="130" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" icon="EditPen" @click="handleOpen(scope.row)">去处理</el-button>
          </template>
        </el-table-column>
      </el-table>
      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="handleQuery"
      />
    </el-card>
    <!-- 申请人 -->
    <UserSelect
      ref="userSelectRef"
      :multiple="true"
      :data="selectUserIds"
      @confirm-call-back="userSelectCallBack"
    ></UserSelect>
    <!-- 原地弹窗办理：不跳转业务页，详情 + 通过/驳回都在当前页完成 -->
    <WorkflowHandleDialog ref="workflowHandleRef" @handled="getWaitingList" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UserVO } from '@/api/system/user/types';
import { pageByTaskWait } from '@/api/workflow/task';
import { TaskQuery, FlowTaskVO } from '@/api/workflow/task/types';
import UserSelect from '@/components/UserSelect/index.vue';
import WorkflowHandleDialog from '@/components/WorkflowHandle/index.vue';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';

const userSelectRef = ref<InstanceType<typeof UserSelect>>();
//提交组件
const queryFormRef = ref<ElFormInstance>();
const { loading, withLoading } = useLoading(true);
const { ids, single, multiple, handleSelectionChange } = useTableSelection<any>(item => item.id);
const { showSearch } = useSearchToggle();
// 总条数
const total = ref(0);
// 模型定义表格数据
const taskList = ref([]);

/** 业务类型快捷切换（与 flow_definition.flow_code 一一对应） */
const flowTypeTabs = [
  { label: '全部', code: '' },
  { label: '结佣审批', code: 'commission_apply' },
  { label: '结佣调整', code: 'commission_adjust' },
  { label: '业绩调整', code: 'perf_adjust' },
  { label: '实收审批', code: 'perf_received' },
  { label: '奖金录入', code: 'bonus_apply' },
  { label: '算薪批次', code: 'payroll_batch' },
  { label: '补发单', code: 'payroll_supplement' }
];

/** 流程类型 -> 标签配色 */
const TAG_TYPE_MAP: Record<string, string> = {
  commission_apply: 'primary',
  commission_adjust: 'warning',
  perf_adjust: 'warning',
  perf_received: 'success',
  bonus_apply: 'info',
  payroll_batch: 'danger',
  payroll_supplement: 'danger'
};
const flowTagType = (flowCode: string) => TAG_TYPE_MAP[flowCode] || 'info';

/**
 * 业务扩展标题由后端按「类型｜明细…」格式拼装（见 bizExt.buildBizExt），
 * 这里拆成"类型标签 + 明细"，避免整行糊在一起。
 */
const splitTitle = (row: any): { type: string; detail: string } => {
  const title = row?.businessTitle as string | undefined;
  if (title && title.includes('｜')) {
    const [head, ...rest] = title.split('｜');
    return { type: head.trim(), detail: rest.join(' · ').trim() };
  }
  return { type: '', detail: title ? title.trim() : '' };
};

/** 第一列主标签：业务标题里的类型，缺省回退流程定义名 */
const bizType = (row: any) => splitTitle(row).type || row.flowName || '待办';

/** 第一列副文本：业务标题里的明细，缺省时至少让人看到流程名+业务ID，不留空白 */
const bizDetail = (row: any) => {
  const { detail } = splitTitle(row);
  if (detail) return detail;
  return `${row.flowName || '业务单据'}（业务ID ${row.businessId}）`;
};

/** 切换业务类型时回到第 1 页 */
const handleTypeChange = () => {
  queryParams.value.pageNum = 1;
  getWaitingList();
};

//申请人id
const selectUserIds = ref<Array<number | string>>([]);
//申请人选择数量
const userSelectCount = ref(0);
// 查询参数
const queryParams = ref<TaskQuery>({
  pageNum: 1,
  pageSize: 10,
  nodeName: undefined,
  flowName: undefined,
  flowCode: '',
  createByIds: []
});
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  pageSizeKey: 'pageSize',
  initialPageSize: 10,
  resetExtras: () => {
    queryParams.value.createByIds = [];
    queryParams.value.flowCode = '';
    userSelectCount.value = 0;
    selectUserIds.value = [];
  },
  afterReset: () => {
    handleQuery();
  }
});
onMounted(() => {
  getWaitingList();
});
/** 搜索按钮操作 */
const handleQuery = () => {
  getWaitingList();
};
//分页
const getWaitingList = () => {
  withLoading(async () => {
    const resp = await pageByTaskWait(queryParams.value);
    taskList.value = resp.data?.rows;
    total.value = resp.data?.total;
  });
};
//办理：原地弹出详情弹窗（通过/驳回走工作流任务接口，节点鉴权由引擎负责）
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandleDialog>>();
const handleOpen = (row: Partial<FlowTaskVO>) => {
  workflowHandleRef.value?.open(row);
};
//打开申请人选择
const openUserSelect = () => {
  userSelectRef.value.open();
};
//确认选择申请人
const userSelectCallBack = (data: UserVO[]) => {
  userSelectCount.value = 0;
  selectUserIds.value = [];
  queryParams.value.createByIds = [];

  if (data && data.length > 0) {
    userSelectCount.value = data.length;
    selectUserIds.value = data.map(item => item.userId);
    queryParams.value.createByIds = selectUserIds.value;
  }
};
</script>

<style scoped lang="scss">
.table-heading {
  display: flex;
  align-items: baseline;
  gap: 12px;
}
.table-subtitle {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.type-tabs {
  margin-bottom: 12px;
}
.biz-cell {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 2px 0;
}
.biz-tag {
  flex: 0 0 auto;
  margin-top: 2px;
}
.biz-body {
  min-width: 0;
}
.biz-detail {
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.biz-no {
  margin-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.2;
}
</style>
