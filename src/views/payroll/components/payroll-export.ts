import * as XLSX from 'xlsx';
import type { PayrollDetail, CommissionTraceItem } from '@/api/panjia/payroll';
import { resolveBizNo } from '@/utils/panjiaBiz';

/**
 * 工资明细多 sheet 导出共享模块。
 * <p>
 * 对齐天街工资表 2026.08.xlsx 七个 sheet 列结构：
 * - 工资表 sheet「工资表」28 列（含经纪人 + 店长）
 * - 新签业绩 sheet「新签业绩」12 列（期间全部新签事实明细）
 * - 结佣业绩 sheet「结佣业绩」12 列（期间全部结佣事实明细）
 * - 店长 sheet「店长工资」15 列
 * - 总监 sheet「总监工资」19 列（一人多行，按门店分行）
 * - 人事数据 sheet「人事数据」18 列（考勤/社保/公积金/积分等）
 * - 绩效和扣款 sheet「绩效和扣款」19 列（积分等级 + 提成扣点）
 * <p>
 * batch 弹窗和 detail 页面共用此模块，确保导出与显示同口径。
 */

export type PayrollRole = 'AGENT' | 'MANAGER' | 'DIRECTOR';

const num = (v: any): string | number =>
  (v == null || v === '') ? '' : Number(v).toFixed(2);

const ratePercent = (v: any): string => {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return `${(n * 100).toFixed(2)}%`;
};

const roleLabel = (r: string) =>
  ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r);

/** 取负数展示（金额列与 Excel 习惯对齐：扣款列展示负号） */
const neg = (v: any): string | number => {
  const n = Number(v) || 0;
  return n === 0 ? '' : (-n).toFixed(2);
};

/** 总监各门店提成明细（后端 DirectorStoreItem JSON） */
export interface DirectorStoreItem {
  deptId: number;
  deptName?: string;
  newSign: number | string;
  social: number | string;
  billable: number | string;
  rate: number | string;
  income: number | string;
}

/** 底薪：经纪人取 baseSalary，店长取 teamIncome + guaranteeFill（保底补足） */
const baseSalaryOf = (r: PayrollDetail): string | number => {
  if (r.employeeRole === 'MANAGER') {
    return num((Number(r.teamIncome) || 0) + (Number(r.guaranteeFill) || 0));
  }
  return num(r.baseSalary);
};

export function parseStoreItems(r: PayrollDetail): DirectorStoreItem[] {
  if (!r.directorStoreItems) return [];
  try {
    return JSON.parse(r.directorStoreItems) as DirectorStoreItem[];
  } catch {
    return [];
  }
}

export interface SheetConfig {
  /** xlsx sheet 名 */
  name: string;
  /** 表头（支持 {period} 占位符替换月份） */
  heads: string[];
  /** 行映射函数：从 PayrollDetail 生成单行 */
  row: (r: PayrollDetail) => (string | number)[];
  /** 多行映射函数（可选，总监按门店分行用）；定义后导出优先使用此函数 */
  rows?: (r: PayrollDetail) => (string | number)[][];
  /** 包含的角色列表（默认仅自身角色；工资表 sheet 含 AGENT + MANAGER） */
  roles?: PayrollRole[];
}

export const SHEET_CONFIGS: Record<PayrollRole, SheetConfig> = {
  // ────────────── 工资表 sheet（28 列，含经纪人 + 店长） ──────────────
  AGENT: {
    name: '工资表',
    roles: ['AGENT', 'MANAGER'],
    heads: [
      '门店', '员工编号', '姓名', '职级', '职位', '当月新签业绩', '当月新签业绩提成比列',
      '绩效提成扣点', '个人提点奖励', '当月最终提成比列', '结佣业绩', '提成比例', '提成金额',
      '招聘奖励', '底薪', '绩效', '考勤扣款', '积分扣款', '应发工资',
      '社保扣款', '公积金扣款', '往月负工资', '商业保险', '宿舍管理费',
      '工资合计', '实发工资', '个税扣除', '最终发放',
    ],
    row: (r) => {
      const gross = Number(r.gross) || 0;
      const deduct = Number(r.deduct) || 0;
      return [
        r.deptName || '',
        r.employeeCode || '',
        r.employeeName || '',
        r.levelCode || '',
        roleLabel(r.employeeRole),
        num(r.newSignPerformance),
        r.newSignRate != null ? ratePercent(r.newSignRate) : '',
        r.totalDeduct != null ? ratePercent(r.totalDeduct) : '',
        num(r.mentorBonus),
        r.finalRate != null ? ratePercent(r.finalRate) : '',
        num(r.commissionPerformance),
        r.finalRate != null ? ratePercent(r.finalRate) : '',
        num(r.commissionIncome),
        num(r.mentorBonus),
        baseSalaryOf(r),
        num(r.bonus),
        neg(r.attendanceFee),
        neg(r.pointsFee),
        num(r.gross),
        neg(r.socialFee),
        neg(r.housingFund),
        neg(Math.abs(Number(r.negativeCarryover) || 0)),
        neg(r.commercialInsurance),
        neg(r.dormitoryFee),
        num(gross - deduct),
        num(r.net),
        neg(r.tax),
        num(r.net),
      ];
    },
  },

  // ────────────── 店长 sheet（15 列） ──────────────
  MANAGER: {
    name: '店长工资',
    heads: [
      '门店', '姓名', '职级', '{period}月新签团队业绩', '社保业绩扣款', '新签与结佣差额',
      '团队计薪业绩', '提成比例', '团队提成金额', '当月个人新签业绩提成',
      '合计', '保底', '补足8000部分', '其他扣款', '店长工资',
    ],
    row: (r) => {
      const newSign = Number(r.deptNewSignTotal) || 0;
      const social = Number(r.deptEmployerSocialTotal) || 0;
      const commission = Number(r.commissionPerformance) || 0;
      const team = Number(r.teamIncome) || 0;
      const personal = Number(r.personalNewsignIncome) || 0;
      return [
        r.deptName || '',
        r.employeeName || '',
        r.levelCode || '',
        num(newSign),
        neg(social),                       // 社保业绩扣款（与 Excel 一致展示负号）
        num(newSign - commission),          // 新签与结佣差额
        num(newSign - social),              // 团队计薪业绩
        r.teamRate != null ? ratePercent(r.teamRate) : '',
        num(team),
        num(personal),
        num(team + personal),               // 合计
        num(r.minSalary),
        num(r.guaranteeFill),
        neg(r.otherDeduct),
        baseSalaryOf(r),                   // 店长工资 = 补足8000部分 + 团队提成金额
      ];
    },
  },

  // ────────────── 总监 sheet（19 列） ──────────────
  DIRECTOR: {
    name: '总监工资',
    heads: [
      '姓名', '组别', '新签业绩', '社保业绩', '合计', '提成比例', '提成金额',
      '底薪', '全勤', '绩效', '结佣业绩', '业绩提成', '招聘提成',
      '社保', '公积金', '商业保险', '应发工资', '个税', '实发工资',
    ],
    row: (r) => {
      const newSign = Number(r.deptNewSignTotal) || 0;
      const social = Number(r.deptEmployerSocialTotal) || 0;
      return [
        r.employeeName || '',
        r.deptName || '',
        num(newSign),
        neg(social),                       // 社保业绩（与 Excel 一致展示负号）
        num(newSign - social),              // 合计 = 新签 - 社保业绩
        r.storeRate != null ? ratePercent(r.storeRate) : '',
        num(r.storeIncome),
        num(r.baseSalary),
        num(r.fullAttendance),
        num(r.bonus),
        num(r.commissionPerformance),
        num(r.commissionIncome),
        num(r.mentorBonus),
        neg(r.socialFee),                  // 社保（员工级扣款，与 Excel 一致展示负号）
        neg(r.housingFund),                // 公积金
        neg(r.commercialInsurance),         // 商业保险
        num(r.gross),
        neg(r.tax),                        // 个税
        num(r.net),
      ];
    },
    // 总监按门店分行（对齐天街工资表总监 sheet：每门店一行提成金额，汇总到第一行发工资）
    rows: (r) => {
      const items = parseStoreItems(r);
      const newSign = Number(r.deptNewSignTotal) || 0;
      const social = Number(r.deptEmployerSocialTotal) || 0;
      if (items.length === 0) {
        return [[
          r.employeeName || '', r.deptName || '', num(newSign), neg(social), num(newSign - social),
          r.storeRate != null ? ratePercent(r.storeRate) : '', num(r.storeIncome),
          num(r.baseSalary), num(r.fullAttendance), num(r.bonus), num(r.commissionPerformance),
          num(r.commissionIncome), num(r.mentorBonus), neg(r.socialFee), neg(r.housingFund),
          neg(r.commercialInsurance), num(r.gross), neg(r.tax), num(r.net),
        ]];
      }
      return items.map((it, idx) => {
        const itNew = Number(it.newSign) || 0;
        const itSocial = Number(it.social) || 0;
        const itBillable = Number(it.billable) || 0;
        const itIncome = Number(it.income) || 0;
        const storeName = it.deptName || r.deptName || '';
        if (idx === 0) {
          // 第一行：姓名 + 门店提成 + 底薪/全勤/绩效/社保等汇总
          return [
            r.employeeName || '', storeName, num(itNew), neg(itSocial), num(itBillable),
            ratePercent(it.rate), num(itIncome),
            num(r.baseSalary), num(r.fullAttendance), num(r.bonus), num(r.commissionPerformance),
            num(r.commissionIncome), num(r.mentorBonus), neg(r.socialFee), neg(r.housingFund),
            neg(r.commercialInsurance), num(r.gross), neg(r.tax), num(r.net),
          ];
        }
        // 后续行：只有门店提成相关列，其余空
        return [
          '', storeName, num(itNew), neg(itSocial), num(itBillable),
          ratePercent(it.rate), num(itIncome),
          '', '', '', '', '', '', '', '', '', '', '', '', '',
        ];
      });
    },
  },
};

// ════════════════════════════════════════════════════════════════════
//  业绩明细 sheet（新签/结佣）：与天街 Excel 同列结构
// ════════════════════════════════════════════════════════════════════

/** 业绩明细行 → Excel 行（新签/结佣共用，12 列，对齐天街工资表） */
function perfFactRow(it: CommissionTraceItem): (string | number)[] {
  return [
    it.signDate || it.businessDate || '',
    resolveBizNo(it.bizType, it.contractNo, it.orderNo) || '',
    it.bizType || '',
    it.propertyAddress || '',
    it.employeeCode || '',
    '',                               // 店组（无字段，留空）
    '',                               // 门店（无字段，留空）
    it.roleType || '',
    it.shareRatio != null ? (Number(it.shareRatio) * 100).toFixed(2) + '%' : '',
    num(it.convertedAmount ?? it.amount), // 85后金额
    it.status === 'APPROVED' ? '是' : '',
    it.approvedMonth || '',
  ];
}

// ════════════════════════════════════════════════════════════════════
//  人事数据 sheet（18 列，对齐天街工资表）
// ════════════════════════════════════════════════════════════════════

const HR_HEADS = [
  '门店名称', '姓名', '职级', '职位', '底薪', '出勤天数', '考勤扣款', '是否全勤',
  '全勤', '考勤详情', '成都社保扣款', '公积金扣款', '宿舍管理费', '积分扣款',
  '新人绩效', '入职未满半年扣除基地训+从业资格证费用', '新人带教', '其他扣款',
];

function hrRow(r: PayrollDetail): (string | number)[] {
  return [
    r.deptName || '',
    r.employeeName || '',
    r.levelCode || '',
    roleLabel(r.employeeRole),
    num(r.baseSalary),
    '',                               // 出勤天数（无字段）
    neg(r.attendanceFee),
    '',                               // 是否全勤（无字段）
    r.employeeRole === 'DIRECTOR' ? num(r.fullAttendance) : '',
    '',                               // 考勤详情（无字段）
    neg(r.socialFee),
    neg(r.housingFund),
    neg(r.dormitoryFee),
    neg(r.pointsFee),
    num(r.bonus),                     // 新人绩效/绩效
    neg(r.negativeCarryover),         // 往月负工资
    num(r.mentorBonus),               // 新人带教
    neg(r.otherDeduct),
  ];
}

// ════════════════════════════════════════════════════════════════════
//  绩效和扣款 sheet（19 列，对齐天街工资表）
// ════════════════════════════════════════════════════════════════════

const PERF_HEADS = [
  '门店', '姓名', '动态考核', '积分考核', '其他扣款', '', '', '', '',
  '姓名', '总积分', '出勤天数', '平均积分', '绩效等级', '绩效提成点',
  '未买社保提成点', '未完成电话考核提成点', '7.1-12.31日何方方提成扣2%', '合计',
];

function perfDeductRow(r: PayrollDetail): (string | number)[] {
  return [
    r.deptName || '',
    r.employeeName || '',
    '',                               // 动态考核（无字段）
    neg(r.pointsFee),                 // 积分考核
    neg(r.otherDeduct),              // 其他扣款
    '', '', '', '',                  // 间隔列
    r.employeeName || '',
    '',                               // 总积分（无字段）
    '',                               // 出勤天数（无字段）
    '',                               // 平均积分（无字段）
    r.perfGrade || '',
    r.perfDeduct != null ? ratePercent(r.perfDeduct) : '',
    '',                               // 未买社保提成点（含在 totalDeduct 里无法拆分）
    '',                               // 未完成电话考核
    '',
    r.totalDeduct != null ? ratePercent(r.totalDeduct) : '',
  ];
}

// ════════════════════════════════════════════════════════════════════
//  导出主函数（七 sheet：工资表 + 新签业绩 + 结佣业绩 + 店长 + 总监 + 人事 + 绩效）
// ════════════════════════════════════════════════════════════════════

export interface ExportExtraData {
  newSignItems?: CommissionTraceItem[];
  commissionItems?: CommissionTraceItem[];
}

/**
 * 多 sheet xlsx 导出。
 * @param details 工资明细列表（按 employeeRole 自动分流到对应工资 sheet）
 * @param period 归属月（YYYY-MM）
 * @param only 仅导出指定角色工资 sheet（不传则导出全部 sheet）
 * @param extra 业绩明细数据（新签/结佣），不传则不导出业绩 sheet
 */
export function exportMultiSheet(
  details: PayrollDetail[],
  period: string,
  only?: PayrollRole,
  extra?: ExportExtraData,
): void {
  const wb = XLSX.utils.book_new();
  const monthLabel = period ? period.split('-')[1] : '';
  const roles: PayrollRole[] = only ? [only] : ['AGENT', 'MANAGER', 'DIRECTOR'];

  // 1) 工资 sheet（工资表/店长/总监）
  for (const role of roles) {
    const cfg = SHEET_CONFIGS[role];
    const sheetRoles = cfg.roles || [role];
    const sheetRows: (string | number)[][] = [];
    for (const r of details.filter((r) => sheetRoles.includes(r.employeeRole as PayrollRole))) {
      if (cfg.rows) sheetRows.push(...cfg.rows(r));
      else sheetRows.push(cfg.row(r));
    }
    const heads = cfg.heads.map((h) => h.replace('{period}', monthLabel));
    const ws = XLSX.utils.aoa_to_sheet([heads, ...sheetRows]);
    XLSX.utils.book_append_sheet(wb, ws, cfg.name);
  }

  // 2) 业绩明细 sheet（仅在导出全部且 extra 有数据时输出）
  if (!only && extra) {
    if (extra.newSignItems?.length) {
      const heads = ['签约/认购日期', '合同号', '类型', '房源地址', '签约人', '店组', '门店', '所属角色', '角色占比', '85后', '是否结算', '结算日期'];
      const rows = extra.newSignItems.map(perfFactRow);
      const ws = XLSX.utils.aoa_to_sheet([heads, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, '新签业绩');
    }
    if (extra.commissionItems?.length) {
      const heads = ['签约/认购日期', '合同号', '类型', '房源地址', '签约人', '店组', '门店', '所属角色', '角色占比', '85后', '是否结算', '结算日期'];
      const rows = extra.commissionItems.map(perfFactRow);
      const ws = XLSX.utils.aoa_to_sheet([heads, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, '结佣业绩');
    }
    // 3) 人事数据 sheet
    {
      const rows = details.map(hrRow);
      const ws = XLSX.utils.aoa_to_sheet([HR_HEADS, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, '人事数据');
    }
    // 4) 绩效和扣款 sheet
    {
      const rows = details.map(perfDeductRow);
      const ws = XLSX.utils.aoa_to_sheet([PERF_HEADS, ...rows]);
      XLSX.utils.book_append_sheet(wb, ws, '绩效和扣款');
    }
  }

  XLSX.writeFile(wb, `工资明细_${period}.xlsx`);
}
