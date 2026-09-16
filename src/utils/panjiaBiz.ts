/**
 * 盘家智管 业务键（合同号/订单号）统一口径。
 *
 * 规则（与后端 PerformanceFactMapper 中业务键 CASE 表达式一致，改动须两侧同步）：
 * - 一手房、房产金融、家装荐客 这三种业务类型：以「订单号」为准，订单号为空时回退合同号；
 * - 其它业务类型：以「合同号」为准，合同号为空时回退订单号。
 *
 * 出处：《盘家智管_业绩域详细设计_V1.3》§1.2 聚合键规则（订单号：一手房（新盘）、房产金融、家装荐客；合同号：其余）。
 */

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
