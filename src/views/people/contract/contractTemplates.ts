/**
 * 员工合同内置打印模板（劳动合同 / 兼职合同 / 其他）。
 *
 * 每个模板输出一份完整 HTML 文档字符串（含打印样式），
 * 打印实现：window.open 写入文档后调用 print，与系统 UI 完全隔离。
 */

export interface ContractPrintData {
  /** 甲方（签约门店名） */
  partyA: string;
  employeeName: string;
  /** 性别中文（男/女，可为空） */
  genderLabel?: string;
  idCard?: string;
  employeeCode: string;
  phone?: string;
  /** 合同类型中文（劳动合同/兼职合同/其他） */
  contractTypeLabel: string;
  startDate: string;
  /** 合同结束日（null=无固定期限） */
  endDate?: string | null;
  /** 工资卡信息（劳动/兼职合同薪资条款用） */
  bankName?: string;
  bankBranch?: string;
  bankCardNo?: string;
  /** 打印日期 */
  printDate: string;
}

const DOC_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "SimSun", "宋体", serif; color: #000; font-size: 14px; line-height: 1.9; }
  .contract { width: 190mm; min-height: 260mm; margin: 0 auto; padding: 18mm 16mm; }
  h1 { text-align: center; font-size: 22px; letter-spacing: 6px; margin-bottom: 6px; }
  .contract-no { text-align: right; font-size: 12px; color: #444; margin-bottom: 18px; }
  .meta { margin-bottom: 14px; }
  .meta p { margin: 2px 0; }
  h2 { font-size: 15px; margin: 14px 0 6px; letter-spacing: 2px; }
  p.clause { text-indent: 2em; margin: 4px 0; }
  .blank { display: inline-block; min-width: 120px; border-bottom: 1px solid #000; text-align: center; }
  .sign { margin-top: 36px; display: flex; justify-content: space-between; }
  .sign div { width: 45%; }
  .sign .line { margin-top: 46px; border-bottom: 1px solid #000; height: 1px; }
  .footer-note { margin-top: 24px; font-size: 12px; color: #555; text-align: center; }
  @media print {
    body { -webkit-print-color-adjust: exact; }
    .no-print { display: none; }
    .contract { padding: 0; }
  }
  .print-bar { position: fixed; top: 12px; right: 16px; }
  .print-bar button { padding: 8px 22px; font-size: 15px; cursor: pointer; }
`;

const wrapDoc = (title: string, body: string, printDate: string) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<title>${title}</title>
<style>${DOC_CSS}</style>
</head>
<body>
  <div class="print-bar no-print"><button onclick="window.print()">打 印</button></div>
  <div class="contract">${body}
    <p class="footer-note">打印日期：${printDate}</p>
  </div>
</body>
</html>`;

/** 甲方信息块（三个模板共用） */
const partyABlock = (d: ContractPrintData) => `
  <div class="meta">
    <p>甲方（用人单位）：${d.partyA}</p>
    <p>乙方（劳动者）：${d.employeeName}
      ${d.genderLabel ? `　性别：${d.genderLabel}` : ''}
      ${d.idCard ? `　身份证号：${d.idCard}` : ''}</p>
    <p>员工工号：${d.employeeCode}${d.phone ? `　联系电话：${d.phone}` : ''}</p>
  </div>`;

/** 合同期限条款（三个模板共用） */
const termClause = (d: ContractPrintData) =>
  d.endDate
    ? `<p class="clause">本合同期限自 ${d.startDate} 起至 ${d.endDate} 止。</p>`
    : `<p class="clause">本合同自 ${d.startDate} 起生效，为无固定期限合同。</p>`;

/** 劳动合同 */
export function renderLaborContractHtml(d: ContractPrintData): string {
  const body = `
    <h1>劳动合同书</h1>
    <p class="contract-no">合同编号：LD-${d.employeeCode}-${d.startDate}</p>
    ${partyABlock(d)}
    <p class="clause">根据《中华人民共和国劳动法》《中华人民共和国劳动合同法》及有关法律法规，甲乙双方遵循合法、公平、平等自愿、协商一致、诚实信用的原则，订立本合同。</p>
    <h2>一、合同期限</h2>
    ${termClause(d)}
    <h2>二、工作内容与工作地点</h2>
    <p class="clause">乙方同意根据甲方工作需要，在甲方安排的岗位从事相关工作；工作地点为甲方经营场所（${d.partyA}）。甲方可根据经营需要及乙方工作能力，与乙方协商调整工作岗位。</p>
    <h2>三、工作时间与休息休假</h2>
    <p class="clause">甲方安排乙方执行国家规定的工时制度，保障乙方依法享受法定节假日及带薪年休假等休息休假权利。</p>
    <h2>四、劳动报酬</h2>
    <p class="clause">甲方以货币形式按月支付乙方劳动报酬，发薪日为次月，遇节假日顺延。乙方工资卡信息：${[d.bankName, d.bankBranch].filter(Boolean).join(' ') || '以双方书面确认为准'}${d.bankCardNo ? `，卡号 ${d.bankCardNo}` : ''}。</p>
    <h2>五、社会保险</h2>
    <p class="clause">甲方依法为乙方缴纳社会保险费，个人缴纳部分由甲方从乙方工资中代扣代缴。</p>
    <h2>六、劳动保护与劳动条件</h2>
    <p class="clause">甲方为乙方提供符合国家规定的劳动安全卫生条件和必要的劳动防护用品，对乙方进行安全生产教育和培训。</p>
    <h2>七、合同的变更、解除与终止</h2>
    <p class="clause">本合同的变更、解除、终止及经济补偿，按照《中华人民共和国劳动合同法》及双方约定执行。合同期满，经双方协商一致可以续订。</p>
    <h2>八、其他</h2>
    <p class="clause">本合同未尽事宜，按国家、省、市有关规定执行；本合同一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。</p>
    <div class="sign">
      <div>甲方（盖章）：<div class="line"></div>签订日期：<div class="line"></div></div>
      <div>乙方（签字）：<div class="line"></div>签订日期：<div class="line"></div></div>
    </div>`;
  return wrapDoc('劳动合同书', body, d.printDate);
}

/** 兼职合同（非全日制用工协议） */
export function renderParttimeContractHtml(d: ContractPrintData): string {
  const body = `
    <h1>兼职（非全日制用工）协议</h1>
    <p class="contract-no">协议编号：JZ-${d.employeeCode}-${d.startDate}</p>
    ${partyABlock(d)}
    <p class="clause">根据《中华人民共和国劳动法》《中华人民共和国劳动合同法》关于非全日制用工的有关规定，甲乙双方经协商一致，订立本协议。</p>
    <h2>一、协议期限</h2>
    ${termClause(d)}
    <h2>二、工作内容</h2>
    <p class="clause">乙方在甲方（${d.partyA}）从事兼职工作，具体工作内容以甲方安排为准。乙方可以与其他用人单位订立劳动合同，但不得影响本协议的履行。</p>
    <h2>三、工作时间</h2>
    <p class="clause">乙方平均每日工作时间不超过四小时，每周工作时间累计不超过二十四小时，具体班次由甲方与乙方协商安排。</p>
    <h2>四、劳务报酬</h2>
    <p class="clause">甲方以货币形式按双方约定周期结算乙方报酬；乙方收款账户：${[d.bankName, d.bankBranch].filter(Boolean).join(' ') || '以双方书面确认为准'}${d.bankCardNo ? `，卡号 ${d.bankCardNo}` : ''}。</p>
    <h2>五、保险与保障</h2>
    <p class="clause">甲方依法为乙方缴纳工伤保险；甲方可为乙方购买商业保险作为补充保障，具体以甲方投保方案为准。</p>
    <h2>六、协议的变更与终止</h2>
    <p class="clause">双方任何一方均可提前三日通知对方终止本协议；协议终止时，甲方依法结清乙方报酬。</p>
    <h2>七、其他</h2>
    <p class="clause">本协议未尽事宜，双方协商解决；本协议一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。</p>
    <div class="sign">
      <div>甲方（盖章）：<div class="line"></div>签订日期：<div class="line"></div></div>
      <div>乙方（签字）：<div class="line"></div>签订日期：<div class="line"></div></div>
    </div>`;
  return wrapDoc('兼职（非全日制用工）协议', body, d.printDate);
}

/** 其他协议（通用） */
export function renderOtherContractHtml(d: ContractPrintData): string {
  const body = `
    <h1>协议书</h1>
    <p class="contract-no">编号：QT-${d.employeeCode}-${d.startDate}</p>
    ${partyABlock(d)}
    <p class="clause">甲乙双方本着平等自愿、协商一致的原则，就合作事项达成如下协议：</p>
    <h2>一、协议期限</h2>
    ${termClause(d)}
    <h2>二、协议内容</h2>
    <p class="clause">乙方在甲方（${d.partyA}）从事双方约定的工作或合作事项，具体内容、标准与要求由双方另行书面确认。</p>
    <h2>三、费用与结算</h2>
    <p class="clause">相关费用与结算方式以双方书面约定为准${d.bankCardNo ? `；乙方收款账户：${[d.bankName, d.bankBranch].filter(Boolean).join(' ') || '以双方书面确认为准'}，卡号 ${d.bankCardNo}` : ''}。</p>
    <h2>四、保密与合规</h2>
    <p class="clause">乙方在履行本协议期间知悉的甲方经营信息、客户信息等，未经甲方书面同意不得对外披露；双方均应遵守国家法律法规及甲方依法制定的规章制度。</p>
    <h2>五、协议的变更与解除</h2>
    <p class="clause">本协议经双方协商一致可以变更或解除；任何一方要求解除本协议，应提前通知对方并办理相关交接手续。</p>
    <h2>六、其他</h2>
    <p class="clause">本协议一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。</p>
    <div class="sign">
      <div>甲方（盖章）：<div class="line"></div>签订日期：<div class="line"></div></div>
      <div>乙方（签字）：<div class="line"></div>签订日期：<div class="line"></div></div>
    </div>`;
  return wrapDoc('协议书', body, d.printDate);
}

/** 按合同类型取模板渲染函数 */
export function renderContractHtml(contractType: string, data: ContractPrintData): string {
  switch (contractType) {
    case 'LABOR':
      return renderLaborContractHtml(data);
    case 'PARTTIME':
      return renderParttimeContractHtml(data);
    default:
      return renderOtherContractHtml(data);
  }
}

/**
 * 渲染客户自定义模板：HTML 片段（合同正文）+ {{占位符}} 替换，再用统一文档结构包装。
 * 占位符与 ContractPrintData 字段一一对应。
 */
export function renderCustomContractHtml(htmlContent: string, data: ContractPrintData): string {
  const placeholders: Record<string, string> = {
    partyA: data.partyA ?? '',
    employeeName: data.employeeName ?? '',
    genderLabel: data.genderLabel ?? '',
    idCard: data.idCard ?? '',
    employeeCode: data.employeeCode ?? '',
    phone: data.phone ?? '',
    contractTypeLabel: data.contractTypeLabel ?? '',
    startDate: data.startDate ?? '',
    endDate: data.endDate ?? '',
    bankName: data.bankName ?? '',
    bankBranch: data.bankBranch ?? '',
    bankCardNo: data.bankCardNo ?? '',
    printDate: data.printDate ?? ''
  };
  let body = htmlContent.replace(/\{\{(\w+)\}\}/g, (_, key) => placeholders[key] ?? '');
  return wrapDoc(data.contractTypeLabel || '合同', body, data.printDate);
}
