<template>
  <div class="p-2 app-container workflow-my-document-page">
    <div class="content-main">
      <div class="search-wrap">
        <el-card shadow="hover" class="search-panel" :class="{ 'is-collapsed': !showSearch }">
          <template #header>
            <div class="panel-heading search-panel-toggle" @click.stop="showSearch = !showSearch">
              <div><h3>筛选条件</h3></div>
            </div>
          </template>
          <el-form ref="queryFormRef" :model="queryParams" :inline="true" label-width="120px" class="query-form">
            <el-form-item label="流程定义编码" prop="flowCode">
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
              <h3>我的单据</h3>
            </div>
            <div class="toolbar-actions">
              <right-toolbar
                v-model:show-search="showSearch"
                :search="false"
                @query-table="handleQuery"
              ></right-toolbar>
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
          :data="processInstanceList"
          @selection-change="handleSelectionChange"
        >
          <el-table-column type="selection" width="55" align="center" />
          <el-table-column align="center" type="index" label="序号" width="60"></el-table-column>

          <!-- 核心列：这是什么单、单号是多少 -->
          <el-table-column label="我发起的事项" min-width="330">
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

          <el-table-column v-if="tab === 'running'" align="center" prop="isSuspended" label="状态" min-width="70">
            <template #default="scope">
              <el-tag v-if="!scope.row.isSuspended" type="success">激活</el-tag>
              <el-tag v-else type="danger">挂起</el-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" label="流程状态" min-width="70">
            <template #default="scope">
              <dict-tag :options="wf_business_status" :value="scope.row.flowStatus"></dict-tag>
            </template>
          </el-table-column>
          <el-table-column align="center" prop="createTime" label="启动时间" width="160"></el-table-column>
          <el-table-column label="操作" align="center" width="240">
            <template #default="scope">
              <div class="action-stack">
                <!-- 可见按钮 ≤ 3 个：水平一行展示 -->
                <template v-if="getRowActions(scope.row).filter(a => a.show).length <= 3">
                  <el-button
                    v-for="a in getRowActions(scope.row).filter(act => act.show)"
                    :key="a.key"
                    type="primary"
                    size="small"
                    :icon="a.icon"
                    @click="a.onClick"
                  >
                    {{ a.label }}
                  </el-button>
                </template>
                <!-- 可见按钮 > 3 个：前 2 个直接展示，剩余收进"更多"下拉 -->
                <template v-else>
                  <el-button
                    v-for="a in getRowActions(scope.row).filter(act => act.show).slice(0, 2)"
                    :key="a.key"
                    type="primary"
                    size="small"
                    :icon="a.icon"
                    @click="a.onClick"
                  >
                    {{ a.label }}
                  </el-button>
                  <el-dropdown trigger="click" @command="(cmd) => {
                    const act = getRowActions(scope.row).find(a => a.key === cmd);
                    act?.onClick();
                  }">
                    <el-button type="primary" size="small">更多<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <el-dropdown-item
                          v-for="a in getRowActions(scope.row).filter(act => act.show).slice(2)"
                          :key="a.key"
                          :command="a.key"
                          :icon="a.icon"
                        >
                          {{ a.label }}
                        </el-dropdown-item>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </template>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <pagination
          v-show="total > 0"
          v-model:page="queryParams.pageNum"
          v-model:limit="queryParams.pageSize"
          :total="total"
          @pagination="getList"
        />
      </el-card>
    </div>
    <!-- 提交组件 -->
    <submitVerify ref="submitVerifyRef" @submit-callback="getList" />
    <!-- 原地弹窗查看：不跳转业务页，只读模式展示详情 -->
    <WorkflowHandleDialog ref="workflowHandleRef" @handled="getList" />
  </div>
</template>

<script setup lang="ts">
import { pageByCurrent, deleteByInstanceIds, cancelProcessApply } from '@/api/workflow/instance';
import { FlowInstanceQuery, FlowInstanceVO } from '@/api/workflow/instance/types';
import { ArrowDown } from '@element-plus/icons-vue';
import WorkflowHandleDialog from '@/components/WorkflowHandle/index.vue';
import { useLoading } from '@/hooks/async/useLoading';
import { useSearchReset } from '@/hooks/form/useSearchReset';
import { useSearchToggle } from '@/hooks/form/useSearchToggle';
import { useTableSelection } from '@/hooks/table/useTableSelection';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import {
  FLOW_TYPE_TABS as flowTypeTabs,
  flowTagType,
  bizType,
  bizDetail
} from '@/hooks/workflow/useWorkflowBizCell';

const { wf_business_status } = toRefs<any>(useDict('wf_business_status'));
const queryFormRef = ref<ElFormInstance>();

const { loading, setLoading, withLoading } = useLoading(true);
const {
  ids: instanceIds,
  single,
  multiple,
  handleSelectionChange
} = useTableSelection<FlowInstanceVO>(item => item.id);
const { showSearch } = useSearchToggle();
// 总条数
const total = ref(0);
// 模型定义表格数据
const processInstanceList = ref<FlowInstanceVO[]>([]);

const tab = ref('running');
// 查询参数
const queryParams = ref<FlowInstanceQuery>({
  pageNum: 1,
  pageSize: 10,
  flowCode: '',
  category: undefined,
  businessTitle: undefined
});

onMounted(() => {
  getList();
});

/** 搜索按钮操作 */
const handleQuery = () => {
  getList();
};

/**
 * 计算当前行可见的操作按钮列表。
 * 草稿/已作废/已驳回 → 删除；已提交（waiting）→ 撤销；所有状态 → 查看。
 * 查看改为原地弹窗只读查看，编辑跳转因角色未分配菜单会报错，已移除。
 */
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandleDialog>>();
const getRowActions = (row: any): Array<{
  key: string;
  label: string;
  icon: string;
  show: boolean;
  onClick: () => void;
}> => {
  const editable = row.flowStatus === 'draft' || row.flowStatus === 'cancel' || row.flowStatus === 'back';
  return [
    { key: 'delete', label: '删除', icon: 'Delete', show: editable, onClick: () => handleDelete(row) },
    { key: 'view', label: '查看', icon: 'View', show: true, onClick: () => workflowHandleRef.value?.openView(row) },
    {
      key: 'cancel',
      label: '撤销',
      icon: 'Notification',
      show: row.flowStatus === 'waiting',
      onClick: () => handleCancelProcessApply(row.businessId)
    }
  ];
};
/** 切换业务类型时回到第 1 页 */
const handleTypeChange = () => {
  queryParams.value.pageNum = 1;
  getList();
};
const { resetQuery } = useSearchReset({
  queryFormRef,
  queryParams,
  pageNumKey: 'pageNum',
  pageSizeKey: 'pageSize',
  initialPageSize: 10,
  resetExtras: () => {
    queryParams.value.category = '';
    queryParams.value.flowCode = '';
  },
  afterReset: () => {
    handleQuery();
  }
});
//分页
const getList = () => {
  withLoading(async () => {
    const resp = await pageByCurrent(queryParams.value);
    processInstanceList.value = resp.data?.rows;
    total.value = resp.data?.total;
  });
};

/** 删除按钮操作 */
const handleDelete = async (row: Partial<FlowInstanceVO>) => {
  const instanceIdList = row.id || instanceIds.value;
  await modal.confirm('是否确认删除？');
  setLoading(true);
  if ('running' === tab.value) {
    await deleteByInstanceIds(instanceIdList).finally(() => setLoading(false));
    getList();
  }
  modal.msgSuccess('删除成功');
};

/** 撤销按钮操作 */
const handleCancelProcessApply = async (businessId: string) => {
  await modal.confirm('是否确认撤销当前单据？');
  setLoading(true);
  if ('running' === tab.value) {
    const data = {
      businessId: businessId,
      message: '申请人撤销流程！'
    };
    await cancelProcessApply(data).finally(() => setLoading(false));
    getList();
  }
  modal.msgSuccess('撤销成功');
};
</script>

<style lang="scss" scoped>
.content-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.action-stack {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  gap: 4px 6px;
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
