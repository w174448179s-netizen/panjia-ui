<template>
  <div class="home">
    <!-- 欢迎栏 -->
    <el-card shadow="hover" class="welcome-card">
      <div class="welcome-inner">
        <div class="welcome-left">
          <h2>你好，{{ nickname }}，欢迎回来 👋</h2>
          <p class="welcome-sub">
            你当前有
            <b class="count-badge">{{ total }}</b>
            条待办任务，请及时处理
          </p>
        </div>
        <div class="welcome-right">
          <el-button type="primary" icon="List" @click="goTaskList">查看全部待办</el-button>
          <el-button icon="Refresh" @click="getList">刷新</el-button>
        </div>
      </div>
    </el-card>

    <!-- 待办任务列表：与「我的待办」(taskWaiting.vue) 同构呈现 -->
    <el-card shadow="hover" class="task-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">我的待办</span>
        </div>
      </template>

      <el-table v-loading="loading" border :data="taskList" class="home-task-table">
        <el-table-column align="center" type="index" label="序号" width="58" />

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
        <el-table-column align="center" label="待办时间" prop="createTime" width="160" />

        <el-table-column label="操作" align="center" width="130" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" icon="EditPen" @click="handleOpen(scope.row)">去处理</el-button>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无待办任务" />
        </template>
      </el-table>

      <div v-show="total > 0" class="pager-bar">
        <el-pagination
          background
          layout="total, prev, pager, next"
          :total="total"
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          @current-change="getList"
          @size-change="getList"
        />
      </div>
    </el-card>

    <!-- 原地弹窗办理：不跳转业务页，详情 + 通过/驳回都在当前页完成 -->
    <WorkflowHandleDialog ref="workflowHandleRef" @handled="getList" />
  </div>
</template>

<script setup name="Index" lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { pageByTaskWait } from '@/api/workflow/task';
import type { FlowTaskVO, TaskQuery } from '@/api/workflow/task/types';
import WorkflowHandleDialog from '@/components/WorkflowHandle/index.vue';
import { useUserStore } from '@/store/modules/user';

const router = useRouter();
const userStore = useUserStore();
const nickname = computed(() => userStore.nickname || userStore.name || '');

const loading = ref(false);
const total = ref(0);
const taskList = ref<FlowTaskVO[]>([]);

const queryParams = ref<TaskQuery>({
  pageNum: 1,
  pageSize: 10
});

const getList = () => {
  loading.value = true;
  pageByTaskWait(queryParams.value)
    .then(resp => {
      taskList.value = resp.data?.rows || [];
      total.value = resp.data?.total || 0;
    })
    .finally(() => {
      loading.value = false;
    });
};

/** 以下展示逻辑与 taskWaiting.vue 保持一致（两处表现同步维护） */

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

//办理：原地弹出详情弹窗（通过/驳回走工作流任务接口，节点鉴权由引擎负责）
const workflowHandleRef = ref<InstanceType<typeof WorkflowHandleDialog>>();
const handleOpen = (row: Partial<FlowTaskVO>) => {
  workflowHandleRef.value?.open(row);
};

const goTaskList = () => {
  router.push('/task/taskWaiting');
};

onMounted(() => {
  getList();
});
</script>

<style lang="scss" scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.welcome-card {
  border-radius: 12px;

  :deep(.el-card__body) {
    padding: 20px 24px;
  }
}

.welcome-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.welcome-left {
  h2 {
    margin: 0;
    font-size: 20px;
    color: var(--el-text-color-primary);
  }
}

.welcome-sub {
  margin: 8px 0 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.count-badge {
  display: inline-block;
  min-width: 24px;
  padding: 0 8px;
  margin: 0 4px;
  line-height: 20px;
  text-align: center;
  border-radius: 10px;
  background: var(--el-color-danger);
  color: #fff;
  font-size: 13px;
}

.welcome-right {
  display: flex;
  gap: 10px;
}

.task-card {
  border-radius: 12px;

  :deep(.el-card__header) {
    padding: 14px 20px;
  }

  :deep(.el-card__body) {
    padding: 12px 16px 0;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

/* 待办表格单元格样式：与 taskWaiting.vue 一致 */
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

.pager-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 0 2px;
}
</style>
