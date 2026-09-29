/**
 * 盘家智管 业务键（合同号/订单号）统一口径。
 *
 * 规则（与后端 PerformanceFactMapper 中业务键 CASE 表达式一致，改动须两侧同步）：
 * - 全部业务类型统一以「订单号」为准，订单号为空时回退合同号。
 * - 合同号存在为空的情况，故不再按业务类型分派（原一手房/房产金融/家装荐客与其余分流规则已废弃）。
 * - UI 列标题仍叫「合同号」（习惯性称呼），仅逻辑锚点改为订单号优先。
 */

import type { DeptNode } from '@/api/panjia/types';

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
 * 解析业务键：统一以订单号为准，合同号兜底。
 *
 * @param bizType    业务类型（不再影响锚点选择，保留签名兼容调用方）
 * @param contractNo 合同号（可空）
 * @param orderNo    订单号（可空）
 * @returns 业务键（订单号优先，合同号兜底）；两者均空时返回 undefined
 */
export const resolveBizNo = (
  bizType?: string | null,
  contractNo?: string | null,
  orderNo?: string | null
): string | undefined => {
  return orderNo || contractNo || undefined;
};
