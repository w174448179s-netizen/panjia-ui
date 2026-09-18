/**
 * 盘家智管 业务键（合同号/订单号）统一口径。
 *
 * 规则（与后端 PerformanceFactMapper 中业务键 CASE 表达式一致，改动须两侧同步）：
 * - 一手房、房产金融、家装荐客 这三种业务类型：以「订单号」为准，订单号为空时回退合同号；
 * - 其它业务类型：以「合同号」为准，合同号为空时回退订单号。
 *
 * 出处：《盘家智管_业绩域详细设计_V1.3》§1.2 聚合键规则（订单号：一手房（新盘）、房产金融、家装荐客；合同号：其余）。
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
  const dfs = (nodes: DeptNode[]): DeptNode | undefined => {
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

/** 以订单号为聚合键的业务类型（其余类型以合同号为聚合键） */
export const ORDER_KEYED_BIZ_TYPES: readonly string[] = ['一手房', '房产金融', '家装荐客'];

const isOrderKeyed = (bizType?: string | null): boolean =>
  !!bizType && ORDER_KEYED_BIZ_TYPES.includes(bizType);

/**
 * 解析业务键：判断展示/钻取时以合同号还是订单号为准。
 *
 * @param bizType    业务类型（如 二手买卖 / 一手房 / 房产金融 / 家装荐客）
 * @param contractNo 合同号（可空）
 * @param orderNo    订单号（可空）
 * @returns 业务键（合同号或订单号）；两者均空时返回 undefined
 */
export const resolveBizNo = (
  bizType?: string | null,
  contractNo?: string | null,
  orderNo?: string | null
): string | undefined => {
  if (isOrderKeyed(bizType)) {
    return orderNo || contractNo || undefined;
  }
  return contractNo || orderNo || undefined;
};
