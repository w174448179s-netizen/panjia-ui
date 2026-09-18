/**
 * 门店/组别筛选的部门数据权限（全系统统一口径）。
 *
 * 所有登录用户（经纪人/店长/总监/财务/超管等）都只能查询自己部门（含下级）的数据：
 * - 首屏默认选中本部门，部门树裁剪为本部门子树，不可清空，重置回默认；
 * - 用户本人 deptId 为空（如未挂部门的系统账号）时降级为不限制，避免空树；
 * - admin/superadmin 的 deptId 通常是组织根节点，「自己及以下」即全量，天然不受影响。
 *
 * 配套后端在各列表接口做同样的强制校验（未传部门强制本部门、越权传他部门直接拒绝）。
 */
import { computed, ref } from 'vue';
import type { DeptNode } from '@/api/panjia/types';
import { employeeApi } from '@/api/panjia/employee';
import { useUserStore } from '@/store/modules/user';
import { findDeptSubtree } from '@/utils/panjiaBiz';

export function useDeptScope() {
  const userStore = useUserStore();

  /** 是否锁定部门范围：登录用户有归属部门即锁定（只能在本部门子树内查询） */
  const deptLocked = computed(() => userStore.deptId !== '');

  /** 部门筛选默认值：本部门 ID；无归属部门时不预填 */
  const defaultDeptId = (): string | undefined =>
    userStore.deptId !== '' ? String(userStore.deptId) : undefined;

  const deptTreeRaw = ref<DeptNode[]>([]);
  /** 查询筛选用部门树：锁定时裁剪为本部门子树，否则全量 */
  const deptTreeData = computed<DeptNode[]>(() =>
    deptLocked.value ? findDeptSubtree(deptTreeRaw.value, userStore.deptId) : deptTreeRaw.value
  );

  const loadDeptTree = async () => {
    try {
      const res: any = await employeeApi.deptTree();
      deptTreeRaw.value = res.data ?? [];
    } catch (e) {
      console.error('[useDeptScope] 部门树加载失败', e);
    }
  };

  return { deptLocked, defaultDeptId, deptTreeRaw, deptTreeData, loadDeptTree };
}
