import { reactive, ref } from 'vue';
import type { DeptNode } from '@/api/panjia/types';
import { performanceApi } from '@/api/panjia/performance';
import { useDeptScope } from '@/hooks/useDeptScope';

/**
 * 门店树（含子部门收集）+ 员工远程搜索的统一过滤工具。
 * <p>
 * 供算薪批次弹窗 / 工资明细页等「数据全量在内存、前端过滤 + 分页」场景共用，
 * 保证查询组件与业务口径一致（与业绩查询页同款组件）。
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

/**
 * 统一员工远程搜索（业绩查询同款 searchEmployeeOptions 接口，姓名/工号均可搜）。
 * 每个表格独立实例（互不干扰回显），已选中员工不在新结果中时置顶保留。
 */
export function useEmployeeSearch(getSelectedId: () => any, getDeptId: () => any) {
  const options = ref<any[]>([]);
  const loading = ref(false);
  let lastSelected: any = null;
  const remoteMethod = async (query: string) => {
    const keyword = (query ?? '').trim();
    if (!keyword) {
      options.value = lastSelected ? [lastSelected] : [];
      return;
    }
    loading.value = true;
    try {
      const res: any = await performanceApi.searchEmployeeOptions({
        keyword,
        deptId: getDeptId() || undefined,
      });
      const rows = res.data ?? [];
      const selId = getSelectedId();
      options.value = lastSelected && selId != null && selId !== ''
        && !rows.some((r: any) => String(r.employeeId) === String(selId))
        ? [lastSelected, ...rows]
        : rows;
    } catch (e) {
      console.error('[员工搜索] 选项加载失败', e);
      options.value = lastSelected ? [lastSelected] : [];
    } finally {
      loading.value = false;
    }
  };
  const onSelect = (id: any) => {
    if (id == null || id === '') {
      lastSelected = null;
      return;
    }
    lastSelected = options.value.find((r: any) => String(r.employeeId) === String(id)) || lastSelected;
  };
  return reactive({ options, loading, remoteMethod, onSelect });
}
