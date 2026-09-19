<template>
  <el-dialog
    v-model="visible"
    :title="dialogTitle"
    width="1100px"
    top="5vh"
    append-to-body
    destroy-on-close
    class="workflow-handle-dialog"
  >
    <!-- 任务上下文条：让审批人不离开列表即可看清"这是谁的什么单、卡在哪个环节" -->
    <div v-if="task" class="task-context">
      <el-tag type="primary" effect="dark" size="small" class="ctx-tag">{{ bizTypeLabel }}</el-tag>
      <span class="ctx-node">{{ task.nodeName }}</span>
      <span class="ctx-sep">|</span>
      <span class="ctx-item">申请人：{{ task.createByName || '系统自动' }}</span>
      <span class="ctx-sep">|</span>
      <span class="ctx-item">待办时间：{{ task.createTime || '—' }}</span>
      <span class="ctx-sep">|</span>
      <span class="ctx-item">单号 {{ task.businessCode || task.businessId }}</span>
    </div>

    <!-- 按流程类型装载对应业务详情体 -->
    <component v-if="bodyComponent" :is="bodyComponent" :business-id="task?.businessId" />
    <!-- 未接入弹窗明细的流程：展示任务自带信息，仍可直接办理（鉴权由工作流引擎负责） -->
    <div v-else class="unsupported">
      <el-alert
        type="info"
        :closable="false"
        show-icon
        :title="`该流程类型（${task?.flowCode || '未知'}）暂未接入明细弹窗，可核对以下任务信息后直接办理`"
      />
      <el-descriptions class="fallback-desc" :column="2" border size="small">
        <el-descriptions-item label="流程">{{ task?.flowName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="当前环节">{{ task?.nodeName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="业务编码">{{ task?.businessCode || task?.businessId || '—' }}</el-descriptions-item>
        <el-descriptions-item label="申请人">{{ task?.createByName || '系统自动' }}</el-descriptions-item>
        <el-descriptions-item label="业务标题" :span="2">{{ task?.businessTitle || '—' }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <template #footer>
      <el-button @click="visible = false">{{ readOnly ? '关 闭' : '取 消' }}</el-button>
      <template v-if="!readOnly">
        <el-button type="danger" :loading="taskOperating" @click="onReject">驳 回</el-button>
        <el-button type="success" :loading="taskOperating" @click="onPass">通 过</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent } from 'vue';
import type { Component } from 'vue';
import { useWorkflowTask } from '@/hooks/workflow/useWorkflowTask';

/**
 * 「我的待办」原地弹窗办理组件。
 *
 * 设计约定（与越权修复口径一致）：
 * - 这里只负责「展示明细 + 调用 passTask/rejectTask 完成任务」，
 *   是否有权办理该节点由工作流引擎按 flow_user 名单判权，前端不做本地判断；
 * - 不调用任何业务模块的 approve/reject 接口（业务直批 = 越权入口）；
 * - 业务详情体按 flowCode 从注册表懒加载，新增流程只需在 details/ 下补一个组件并登记。
 */
const emit = defineEmits<{
  /** 任务办理完成（通过或驳回），父组件应刷新待办列表 */
  (e: 'handled'): void;
}>();

const { taskOperating, passTask, rejectTask } = useWorkflowTask();

/** flowCode → 详情组件（与 flow_definition.flow_code 一一对应） */
const DETAIL_LOADERS: Record<string, () => Promise<any>> = {
  perf_received: () => import('./details/ReceivedDetail.vue'),
  commission_apply: () => import('./details/CommissionApplyDetail.vue'),
  commission_adjust: () => import('./details/CommissionAdjustDetail.vue'),
  perf_adjust: () => import('./details/PerfAdjustDetail.vue'),
  bonus_apply: () => import('./details/BonusDetail.vue'),
  payroll_batch: () => import('./details/PayrollBatchDetail.vue'),
  payroll_supplement: () => import('./details/PayrollSupplementDetail.vue'),
  attendance_approval: () => import('./details/AttendanceApprovalDetail.vue'),
  score_approval: () => import('./details/ScoreApprovalDetail.vue'),
};

const visible = ref(false);
const readOnly = ref(false);
const task = ref<any>(null);
const bodyComponent = ref<Component | null>(null);

/** 业务扩展标题由后端按「类型｜明细…」格式拼装，这里取类型做标题 */
const bizTypeLabel = computed(() => {
  const title = String(task.value?.businessTitle ?? '');
  if (title.includes('｜')) return title.split('｜')[0].trim();
  return task.value?.flowName || '待办';
});

const dialogTitle = computed(() => readOnly.value ? `查看：${bizTypeLabel.value}` : `办理：${bizTypeLabel.value}`);

/** 打开弹窗办理一条待办 */
const open = (row: any) => {
  readOnly.value = false;
  task.value = row;
  const loader = DETAIL_LOADERS[row?.flowCode as string];
  bodyComponent.value = loader ? defineAsyncComponent(loader) : null;
  visible.value = true;
};

/** 打开弹窗只读查看一条流程（已办/我发起的"查看"按钮共用，不显示通过/驳回按钮） */
const openView = (row: any) => {
  readOnly.value = true;
  task.value = row;
  const loader = DETAIL_LOADERS[row?.flowCode as string];
  bodyComponent.value = loader ? defineAsyncComponent(loader) : null;
  visible.value = true;
};

const onPass = async () => {
  const ok = await passTask(task.value?.id);
  if (ok) {
    visible.value = false;
    emit('handled');
  }
};

const onReject = async () => {
  const ok = await rejectTask(task.value?.id);
  if (ok) {
    visible.value = false;
    emit('handled');
  }
};

defineExpose({ open, openView });
</script>

<style lang="scss" scoped>
.task-context {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 14px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
  color: var(--el-text-color-regular);

  .ctx-tag {
    flex: 0 0 auto;
  }

  .ctx-node {
    font-weight: 600;
    color: var(--el-color-primary);
  }

  .ctx-sep {
    color: var(--el-text-color-placeholder);
  }
}

.unsupported {
  .fallback-desc {
    margin-top: 14px;
  }
}
</style>
