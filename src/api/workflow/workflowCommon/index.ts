import type { RouterJumpVo } from '@/api/workflow/workflowCommon/types';
import tab from '@/plugins/tab';
import router from '@/router';
import modal from '@/plugins/modal';

/** 兜底路由（router/index.ts 中注册的 404 catch-all），命中它说明目标页面未注册 */
const CATCH_ALL_PATH = '/:pathMatch(.*)*';

export default {
  /**
   * 跳转到业务表单页处理流程任务。
   * <p>
   * 原实现直接 router.push，formPath 为空或目标路由未注册时会「静默无反应」，
   * 用户表现为「点【审批】没反应」。此处显式校验并给出可见提示。
   */
  async routerJump(routerJumpVo: RouterJumpVo) {
    const { formPath, businessId, taskId, type } = routerJumpVo;

    if (!formPath || !String(formPath).trim()) {
      modal.msgError('该流程未配置业务表单路径（flow_definition.form_path 为空），无法跳转');
      return;
    }

    const target = router.resolve({
      path: formPath,
      query: { id: businessId, type, taskId }
    });
    const registered = target.matched.length > 0 && !target.matched.some((m) => m.path === CATCH_ALL_PATH);
    if (!registered) {
      modal.msgError(`未找到业务页面「${formPath}」，请确认当前角色已分配对应菜单`);
      return;
    }

    // 关闭当前页签（例如「我的待办」），避免办理完回来看到过期列表
    tab.closePage(router.currentRoute.value);
    try {
      await router.push({
        path: formPath,
        query: {
          id: businessId,
          type,
          taskId
        }
      });
    } catch (e: any) {
      // 已停留在目标页面时的重复导航属正常情况，不打扰用户
      const msg = String(e?.message ?? e ?? '');
      if (e?.name === 'NavigationDuplicated' || msg.includes('duplicated')) {
        return;
      }
      modal.msgError(`页面跳转失败：${msg}`);
    }
  }
};
