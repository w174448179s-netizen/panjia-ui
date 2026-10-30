import { ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { completeTask, backProcess } from '@/api/workflow/task';

/**
 * 工作流任务办理 composable
 * 用于业务页面从「我的待办/我发起的/我的已办」跳转过来时，
 * 通过 query 参数（id, type, taskId）直接办理任务。
 */
export function useWorkflowTask() {
  const taskOperating = ref(false);

  /**
   * 通过任务
   * @param taskId 任务 ID
   * @param message 审批意见
   */
  const passTask = async (taskId: string | number, message = ''): Promise<boolean> => {
    if (!taskId) {
      ElMessage.warning('缺少任务 ID');
      return false;
    }
    try {
      await ElMessageBox.confirm('确认通过该审批？', '提示', { type: 'success' });
    } catch {
      return false;
    }
    taskOperating.value = true;
    try {
      await completeTask({ taskId, message, messageType: ['1'], variables: {} });
      ElMessage.success('已通过');
      return true;
    } catch {
      return false;
    } finally {
      taskOperating.value = false;
    }
  };

  /**
   * 驳回任务（弹出意见输入框，可留空；意见记入审批历史）
   * @param taskId 任务 ID
   * @param message 驳回意见（显式传入时跳过输入框，供程序化调用）
   */
  const rejectTask = async (taskId: string | number, message?: string): Promise<boolean> => {
    if (!taskId) {
      ElMessage.warning('缺少任务 ID');
      return false;
    }
    let comment = message ?? '';
    if (message === undefined) {
      try {
        const { value } = await ElMessageBox.prompt('请填写驳回意见（可留空）', '确认驳回该审批？', {
          confirmButtonText: '确认驳回',
          cancelButtonText: '取消',
          type: 'warning',
          inputType: 'textarea',
          inputPlaceholder: '驳回原因将记入审批历史',
          inputValidator: () => true
        });
        comment = value?.trim() ?? '';
      } catch {
        return false;
      }
    }
    taskOperating.value = true;
    try {
      await backProcess({ taskId, message: comment, messageType: ['1'], variables: {} });
      ElMessage.success('已驳回');
      return true;
    } catch {
      return false;
    } finally {
      taskOperating.value = false;
    }
  };

  return { taskOperating, passTask, rejectTask };
}
