import { onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';

/**
 * 承接「我的待办 → 去处理」跳转进入业务表单页的场景。
 *
 * 背景：布局层用 `<component :is="Component" :key="route.path">` 配合
 * `<keep-alive :include="cachedViews">` 缓存页签（见 layout/components/AppMain.vue）。
 * keep-alive 的 key 是 `route.path`，因此当目标页签**之前已经打开过**时，
 * 携带新 query 跳转过来会复用同一个组件实例，`onMounted` 不会再次执行，
 * 待审单据弹窗就永远打不开 —— 用户看到的现象正是「点【去处理】没反应」。
 * 所以除首次挂载外，还必须监听 query 变化补一次打开动作。
 *
 * @param path 本页路由路径（精确匹配；注意 /performance/adjust 与 /performance/adjustment 不能互相命中）
 * @param open 读取 route.query 并打开待审单据的回调
 */
export function useWorkflowRouteOpen(path: string, open: () => void | Promise<void>) {
  const route = useRoute();
  const normalize = (p: string) => (p || '').replace(/\/+$/, '');
  const isSelfRoute = () => normalize(route.path) === normalize(path);
  const hasWorkflowQuery = () => !!route.query.id && !!route.query.type;

  // 首次进入（页签未被缓存过）
  onMounted(() => {
    if (isSelfRoute() && hasWorkflowQuery()) {
      open();
    }
  });

  // 页签已被缓存、组件实例被复用时补一次
  watch(
    () => route.fullPath,
    () => {
      if (isSelfRoute() && hasWorkflowQuery()) {
        open();
      }
    }
  );
}
