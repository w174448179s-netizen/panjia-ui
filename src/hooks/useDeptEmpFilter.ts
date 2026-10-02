import type { DeptNode } from '@/api/panjia/types';
import { useDeptScope } from '@/hooks/useDeptScope';

/**
 * 门店树（含子部门收集）统一过滤工具。
 * <p>
 * 供算薪批次弹窗 / 工资明细页等「数据全量在内存、前端过滤 + 分页」场景共用，
 * 保证门店过滤口径一致；员工录入/筛选统一用 EmployeeSelect 公共组件。
 */
export function useDeptEmpFilter() {
  const { deptTreeData, loadDeptTree } = useDeptScope();

  /** 收集选中部门及其子孙 deptId 集合（树加载后结构不变，结果缓存） */
  const cache = new Map<string, Set<string>>();
  const collectDeptIds = (deptId: any): Set<string> => {
    const key = String(deptId);
    const cached = cache.get(key);
    if (cached) return cached;
    const ids = new Set<string>();
    const collectSub = (node: DeptNode) => {
      ids.add(String(node.deptId));
      node.children?.forEach(collectSub);
    };
    const dfs = (nodes: DeptNode[]): boolean => {
      for (const n of nodes) {
        if (String(n.deptId) === key) {
          collectSub(n);
          return true;
        }
        if (n.children?.length && dfs(n.children)) return true;
      }
      return false;
    };
    dfs(deptTreeData.value);
    cache.set(key, ids);
    return ids;
  };

  return { deptTreeData, loadDeptTree, collectDeptIds };
}
