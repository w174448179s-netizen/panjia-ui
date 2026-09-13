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

    <!-- 待办任务列表 -->
    <el-card shadow="hover" class="task-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">我的待办</span>
        </div>
      </template>

      <el-table v-loading="loading" border :data="taskList" stripe>
        <el-table-column type="index" label="序号" width="60" align="center" />
        <el-table-column prop="businessTitle" label="业务标题" min-width="220" show-overflow-tooltip />
        <el-table-column prop="flowName" label="流程名称" width="140" align="center" show-overflow-tooltip />
        <el-table-column prop="nodeName" label="当前节点" width="120" align="center" />
        <el-table-column prop="createByName" label="申请人" width="110" align="center" />
        <el-table-column prop="createTime" label="创建时间" width="160" align="center" />
        <el-table-column label="操作" width="100" align="center" fixed="right">
          <template #default="scope">
            <el-tooltip content="办理" placement="top">
              <el-button link type="primary" icon="Edit" @click="handleOpen(scope.row)"></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
        <template #empty>
          <el-empty description="暂无待办任务" />
        </template>
      </el-table>

      <div v-show="total > 0" class="pager-bar">
        <el-pagination
          background
          layout="total, prev, pager, next, jumper"
          :total="total"
          :page-sizes="[10, 20, 50]"
          v-model:current-page="queryParams.pageNum"
          v-model:page-size="queryParams.pageSize"
          @current-change="getList"
          @size-change="getList"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup name="Index" lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { pageByTaskWait } from '@/api/workflow/task';
import type { FlowTaskVO, TaskQuery } from '@/api/workflow/task/types';
import workflowCommon from '@/api/workflow/workflowCommon';
import type { RouterJumpVo } from '@/api/workflow/workflowCommon/types';
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

const handleOpen = (row: Partial<FlowTaskVO>) => {
  const routerJumpVo: RouterJumpVo = {
    businessId: row.businessId as string,
    taskId: row.id as string | number,
    type: 'approval',
    formCustom: row.formCustom as string,
    formPath: row.formPath as string
  };
  workflowCommon.routerJump(routerJumpVo);
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
    padding: 0;
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

.pager-bar {
  display: flex;
  justify-content: flex-end;
  padding: 16px 20px;
}
</style>
