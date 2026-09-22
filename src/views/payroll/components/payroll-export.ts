import * as XLSX from 'xlsx';
import type { PayrollDetail } from '@/api/panjia/payroll';

/**
 * 工资明细多 sheet 导出共享模块。
 * <p>
 * 对齐天街工资表 2026.08.xlsx 三个 sheet 列结构：
 * - 工资表 sheet「工资表」28 列（含员工编号，含经纪人 + 店长，比 Excel 多一列）
 * - 店长 sheet「店长工资」15 列（底薪计算与补齐依据）
 * - 总监 sheet「总监工资」19 列（一人多行，按门店分行）
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
        r.perfDeduct != null ? ratePercent(r.perfDeduct) : '',
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
        num(r.gross),
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

/**
 * 多 sheet xlsx 导出。
 * @param details 工资明细列表（按 employeeRole 自动分流到对应 sheet）
 * @param period 归属月（YYYY-MM）
 * @param only 仅导出指定角色 sheet（不传则导出全部三 sheet）
 */
export function exportMultiSheet(
  details: PayrollDetail[],
  period: string,
  only?: PayrollRole
): void {
  const wb = XLSX.utils.book_new();
  const roles: PayrollRole[] = only ? [only] : ['AGENT', 'MANAGER', 'DIRECTOR'];
  const monthLabel = period ? period.split('-')[1] : '';

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

  XLSX.writeFile(wb, `工资明细_${period}.xlsx`);
}
