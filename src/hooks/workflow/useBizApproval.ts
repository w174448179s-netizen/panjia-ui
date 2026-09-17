import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { getInfo } from '@/api/workflow/instance';
import { pageByTaskWait } from '@/api/workflow/task';
import type { FlowTaskVO } from '@/api/workflow/task/types';

/**
 * 业务明细直接审批 composable（双入口之「推」模式）。
 *
 * 设计依据：审批集成设计说明 §3.2
 *   businessId → getInstanceId → pageByTaskWait(instanceId) → 当前用户可办理任务
 *
 * 与「我的待办」共用同一 completeTask/backProcess API，结果与留痕完全一致。
 * 服务端鉴权：pageByTaskWait 按 flow_user.processedBy 过滤当前登录用户，
 * 非审批人查不到任务 → 前端不弹窗 → 不存在越权入口。
 *
 * 默认通过 getInfo（workflow:instance:query 权限）获取实例 ID；
 * 业务域可传 fetchInstanceId 回调，用业务自身权限的轻量端点获取实例 ID，绕过 workflow:instance:query。
 */
export function useBizApproval(fetchInstanceId?: (businessId: string | number) => Promise<string | number | null>) {
  const loading = ref(false);

  /**
   * 通过业务单据 ID 查询当前用户可办理的审批任务。
   * @param businessId 业务单据 ID（实收审批单 ID / 结佣申请单 ID / 业绩调整单 ID）
   * @returns 当前用户可办理的任务，无权或无任务时返回 null
   */
  const getMyTaskByBusinessId = async (businessId: string | number): Promise<FlowTaskVO | null> => {
    loading.value = true;
    try {
      let instanceId: string | number | null = null;
      if (fetchInstanceId) {
        instanceId = await fetchInstanceId(businessId);
      } else {
        const instanceRes: any = await getInfo(businessId);
        instanceId = instanceRes.data?.id ?? null;
      }
      if (!instanceId) return null;

      const taskRes: any = await pageByTaskWait({
        instanceId,
        pageNum: 1,
        pageSize: 1,
      });
      const tasks: FlowTaskVO[] = taskRes.data?.rows ?? [];
      return tasks.length > 0 ? tasks[0] : null;
    } catch {
      return null;
    } finally {
      loading.value = false;
    }
  };

  /**
   * 业务明细入口审批：查任务 → 打开 WorkflowHandle 弹窗。
   * @param businessId 业务单据 ID
   * @param open WorkflowHandle 组件暴露的 open 方法
   * @param onHandled 任务办理完成后的回调（通常是刷新列表）
   */
  const handleBizApproval = async (
    businessId: string | number,
    open: (task: FlowTaskVO) => void,
    onHandled?: () => void,
  ) => {
    const task = await getMyTaskByBusinessId(businessId);
    if (!task) {
      ElMessage.info('该单据当前不在您的审批范围内');
      return;
    }
    open(task);
    onHandled?.();
  };

  return { loading, getMyTaskByBusinessId, handleBizApproval };
}
