<template>
  <div class="p-2 app-container workflow-task-finish-page">
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
          <el-form-item label="任务名称" prop="nodeName">
            <el-input v-model="queryParams.nodeName" placeholder="请输入任务名称" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="流程定义名称" label-width="100" prop="flowName">
            <el-input v-model="queryParams.flowName" placeholder="请输入流程定义名称" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="流程定义编码" label-width="100" prop="flowCode">
            <el-input v-model="queryParams.flowCode" placeholder="请输入流程定义编码" @keyup.enter="handleQuery" />
          </el-form-item>
          <el-form-item label="业务关键字" prop="businessTitle">
            <el-input
              v-model="queryParams.businessTitle"
              placeholder="合同号/房源/账期/金额"
              clearable
              @keyup.enter="handleQuery"
              @clear="handleQuery"
            />
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
            <h3>已办任务</h3>
          </div>
          <div class="toolbar-actions">
            <right-toolbar v-model:show-search="showSearch" :search="false" @query-table="handleQuery"></right-toolbar>
          </div>
        </div>
      </template>

      <!-- 按业务类型快捷切换 -->
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
        <el-table-column type="selection" width="55" align="center" />
        <el-table-column align="center" type="index" label="序号" width="60"></el-table-column>

        <!-- 核心列：这是什么单、单号是多少 -->
        <el-table-column label="已办事项" min-width="330">
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

        <!-- 核心列：当时做了什么 -->
        <el-table-column label="办理环节" align="center" width="150">
          <template #default="scope">
            <el-tag type="primary" effect="plain">{{ scope.row.nodeName }}</el-tag>
            <div class="biz-no">{{ scope.row.flowName }}</div>
          </template>
        </el-table-column>

        <el-table-column align="center" label="申请人" width="100">
          <template #default="scope">{{ scope.row.createByName || '系统自动' }}</template>
        </el-table-column>
        <el-table-column align="center" prop="approverName" label="办理人" min-width="180">
          <template #default="scope">
            <UserNameDisplay :content="scope.row.approverName" />
          </template>
        </el-table-column>
        <el-table-column align="center" label="流程状态" prop="flowStatus" min-width="80">
          <template #default="scope">
            <dict-tag :options="wf_business_status" :value="scope.row.flowStatus"></dict-tag>
          </template>
        </el-table-column>
        <el-table-column align="center" label="任务状态" prop="flowTaskStatus" min-width="80">
          <template #default="scope">
            <dict-tag :options="wf_task_status" :value="scope.row.flowTaskStatus"></dict-tag>
          </template>
        </el-table-column>
        <el-table-column
          align="center"
          prop="createTime"
          label="创建时间"
          :show-overflow-tooltip="true"
          width="150"
        ></el-table-column>
        <el-table-column label="操作" align="center" width="200">
          <template #default="scope">
            <el-button type="primary" size="small" icon="View" @click="handleView(scope.row)">查看</el-button>
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
    <!-- 原地弹窗查看：不跳转业务页，只读模式展示详情 -->
    <WorkflowHandleDialog ref="workflowHandleRef" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { UserVO } from '@/api/system/user/types';
import { pageByTaskFinish } from '@/api/workflow/task';
import { TaskQuery, FlowTaskVO } from '@/api/workflow/task/types';
import UserNameDisplay from '@/components/Process/UserNameDisplay.vue';
import UserSelect from '@/components/UserSelect/index.vue';
import WorkflowHandleDialog from '@/components/WorkflowHandle/index.vue';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import { useDict } from '@/utils/dict';
import {
  FLOW_TYPE_TABS as flowTypeTabs,
  flowTagType,
  bizType,
  bizDetail
} from '@/hooks/workflow/useWorkflowBizCell';

const { wf_business_status } = toRefs<any>(useDict('wf_business_status'));
const { wf_task_status } = toRefs<any>(useDict('wf_task_status'));

const queryFormRef = ref<ElFormInstance>();

const userSelectRef = ref<InstanceType<typeof UserSelect>>();
const { loading, withLoading } = useLoading(true);
const { ids, single, multiple, handleSelectionChange } = useTableSelection<any>(item => item.id);
const { showSearch } = useSearchToggle();
// 总条数
const total = ref(0);
// 模型定义表格数据
const taskList = ref([]);
// 查询参数
const queryParams = ref<TaskQuery>({
  pageNum: 1,
  pageSize: 10,
  nodeName: undefined,
  flowName: undefined,
  flowCode: '',
  createByIds: [],
  businessTitle: undefined
});
//申请人id
const selectUserIds = ref<Array<number | string>>([]);
//申请人选择数量
const userSelectCount = ref(0);
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
/** 搜索按钮操作 */
const handleQuery = () => {
  getFinishList();
};
/** 切换业务类型时回到第 1 页 */
const handleTypeChange = () => {
  queryParams.value.pageNum = 1;
  getFinishList();
};
const getFinishList = () => {
  withLoading(async () => {
    const resp = await pageByTaskFinish(queryParams.value);
    taskList.value = resp.data?.rows;
    total.value = resp.data?.total;
  });
};
/** 查看按钮操作：原地弹窗只读查看 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandleDialog>>();
const handleView = (row: Partial<FlowTaskVO>) => {
  workflowHandleRef.value?.openView(row);
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
onMounted(() => {
  getFinishList();
});
</script>

<style scoped>
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
