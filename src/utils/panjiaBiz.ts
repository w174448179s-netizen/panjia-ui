/**
 * 盘家智管 业务键（合同号/订单号）统一口径。
 *
 * 规则（界面显示与详情/调整等传参共用，传参侧后端均按 contract_no/order_no 双匹配兜底）：
 * - 一手房、房产金融：以「订单号」为准，订单号为空时回退合同号；
 * - 其它业务类型：以「合同号」为准，合同号为空时回退订单号。
 * - UI 列标题仍叫「合同号/订单号」，按上述口径取其一展示。
 */

import type { DeptNode } from '@/api/panjia/types';

/** 以订单号为业务键的业务类型；其余类型以合同号为准 */
const ORDER_FIRST_BIZ_TYPES = new Set(['一手房', '房产金融']);

/**
 * 截取部门树中以指定部门为根的子树（部门数据权限前端裁剪用）。
 *
 * 受限角色（店长/总监/经纪人）只能看到并选择本部门及其下级节点；
 * deptId 为空或未命中时原样返回整树（不改变财务/超管的全量视图）。
 *
 * @param tree   全量部门树
 * @param deptId 当前用户归属部门 ID
 * @returns 裁剪后的部门树（命中时仅含以该部门为根的子树）
 */
export const findDeptSubtree = (tree: DeptNode[], deptId?: string | number | null): DeptNode[] => {
  if (deptId === undefined || deptId === null || deptId === '') return tree;
  const target = String(deptId);
  const dfs = (nodes: DeptNode[]): DeptNode[] | undefined => {
    for (const node of nodes) {
      if (String(node.deptId) === target) return node;
      if (node.children?.length) {
        const hit = dfs(node.children);
        if (hit) return hit;
      }
    }
    return undefined;
  };
  const hit = dfs(tree);
  return hit ? [hit] : tree;
};

/**
 * 解析业务键：一手房/房产金融以订单号为准，其余类型以合同号为准。
 *
 * @param bizType    业务类型（一手房/房产金融时订单号优先，其它合同号优先）
 * @param contractNo 合同号（可空）
 * @param orderNo    订单号（可空）
 * @returns 业务键；两者均空时返回 undefined
 */
export const resolveBizNo = (
  bizType?: string | null,
  contractNo?: string | null,
  orderNo?: string | null
): string | undefined => {
  if (bizType && ORDER_FIRST_BIZ_TYPES.has(bizType)) {
    return orderNo || contractNo || undefined;
  }
  return contractNo || orderNo || undefined;
};
