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
  /** 户口所在地 */
  residence?: string;
  /** 现住地址 */
  currentAddress?: string;
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
  .page-break { page-break-before: always; }
  .company-line { text-align: center; font-size: 16px; letter-spacing: 2px; margin-bottom: 2px; }
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

/** 劳动合同：客户提供的三合一模板（劳动合同 + 诚信声明 + 业务管理告知 + 保密协议），模板源见 LABOR_TEMPLATE */
export function renderLaborContractHtml(d: ContractPrintData): string {
  // 固定期限合同；无结束日期时留空下划线供手写
  const endDate = d.endDate || '＿＿＿＿年＿＿月＿＿日';
  return renderCustomContractHtml(LABOR_TEMPLATE, { ...d, endDate });
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
    residence: data.residence ?? '',
    currentAddress: data.currentAddress ?? '',
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

// ==================== 可下载的模板源文件 ====================

/** 模板文件头部的占位符说明（随模板一起下载，用户照着改） */
const PLACEHOLDER_DOC = `可用占位符（打印时自动替换，请勿改动花括号写法）：
  {{partyA}} 甲方门店        {{employeeName}} 员工姓名     {{genderLabel}} 性别
  {{idCard}} 身份证号        {{residence}} 户口所在地    {{currentAddress}} 现住地址
  {{employeeCode}} 工号      {{phone}} 联系电话
  {{contractTypeLabel}} 合同类型  {{startDate}} 开始日      {{endDate}} 结束日（留空=无固定期限）
  {{bankName}} 开户银行      {{bankBranch}} 开户支行       {{bankCardNo}} 工资卡号
  {{printDate}} 打印日期`;

const tpl = (title: string, body: string) => `<!--
  ${title}（可编辑模板）
  ${PLACEHOLDER_DOC}
  提示：本文件仅为合同正文，保存后上传即可；页面打印时会自动套用统一版式。
-->
${body.trim()}`;

/** 劳动合同模板源文件（客户提供：三合一，含劳动合同+诚信声明+业务管理告知+保密协议） */
const LABOR_TEMPLATE = tpl(
  '劳动合同（三合一）',
  `
<p class="company-line">成都市人居天街房地产经纪有限公司</p>
<h1>劳 动 合 同</h1>
<p class="contract-no">合同编号：TJ-{{employeeCode}}-{{startDate}}</p>
<div class="meta">
  <p>单位（甲方）：成都市人居天街房地产经纪有限公司</p>
  <p>注 册 地 址：成都市金牛区花照壁中横街88号1层</p>
  <p>法定代表人：廖明</p>
  <p>员工（乙方）：{{employeeName}}</p>
  <p>身份证号码：{{idCard}}</p>
  <p>户口所在地：{{residence}}</p>
  <p>联 系 电 话：{{phone}}</p>
</div>
<p class="clause">根据《中华人民共和国劳动合同法》及相关法律法规的规定，甲、乙双方协商一致，同意签订本合同，并达成如下协议条款，供双方共同遵守执行：</p>
<h2>一、合同类型与期限</h2>
<p class="clause">第一条 经乙方申请，甲、乙双方选择以固定期限形式签订本合同。合同期限：自 {{startDate}} 起至 {{endDate}} 止。实习期为：<span class="blank" style="min-width:60px;"></span> 个月。</p>
<h2>二、工作内容和工作地点</h2>
<p class="clause">第二条 甲方安排乙方在 {{partyA}} 部门从事 <span class="blank" style="min-width:100px;"></span> 工作，具体的岗位职责、工作要求按甲方的有关规定执行，甲方可以根据本企业依法制定的规章制度对乙方工作岗位进行调整。乙方工作地点为：成都市行政区划内，甲方可以根据本企业依法制定的规章制度变更乙方工作地点。</p>
<p class="clause">第三条 乙方已对甲方劳动纪律和规章制度充分了解，乙方同意并承诺认真履行岗位职责，完成工作任务，遵守甲方的劳动纪律和规章制度，维护甲方的正当权益，服从甲方的管理。乙方违反甲方劳动纪律和规章制度的，愿意接受相应的处罚。</p>
<h2>三、工作时间和休息休假</h2>
<p class="clause">第四条 乙方应遵守甲方依法制定的考勤管理制度规定的工作时间，甲方可根据本企业需要依法对考勤管理制度进行调整。乙方应予以配合、服从。签订本合同即视为明确知晓并认同本企业考勤管理制度。</p>
<p class="clause">第五条 乙方享有在法定假期和企业规定的假期休息的权利。如甲方因工作需要安排乙方临时加班的，乙方应当理解和服从。甲方安排乙方加班，应符合法律法规的规定，并给予相应的报酬或安排补休，具体按照国家规定和甲方依法制定的相关规章制度执行。</p>
<h2>四、劳动报酬与社会保险</h2>
<p class="clause">第六条 甲方按照本企业依法制定的薪酬管理制度，按月及时以货币形式（人民币）足额支付乙方工资，工作期间甲方支付给乙方的入职目标薪酬为：底薪 <span class="blank" style="min-width:80px;"></span> 元/月。加班工资、提成、奖金另计。经纪人级别产生升降变化后，薪酬应与变化后级别对应的薪酬标准一致。甲方可根据本企业需要对薪酬管理制度依法进行调整。乙方应予以配合、服从。签订本合同即视为明确知晓并认同本企业薪酬管理制度。</p>
<p class="clause">第七条 甲方支付乙方的劳动报酬为税前收入，个人所得税由乙方承担，甲方负责代扣代缴。</p>
<p class="clause">第八条 乙方在合同期内，由于休息休假、患病或负伤、患职业病或因工负伤、生育、死亡等情形所涉及的待遇，以及医疗期、孕期、产期、哺乳期的期限及待遇，均按国家规定和甲方依法制定的规章制度执行。</p>
<p class="clause">第九条 甲、乙双方必须按照国家和地方有关社会保险方面的规定，参加社会保险，缴纳各项社会保险费。乙方应缴纳的部分，由甲方代扣代缴。</p>
<p class="clause">第十条 甲方按照企业薪酬福利制度为乙方提供福利待遇。</p>
<h2>五、劳动保护、劳动条件和职业危害防护</h2>
<p class="clause">第十一条 甲方根据国家的法律法规，建立、健全工作规范，制定操作规程和劳动安全卫生、职业危害防护制度；为乙方提供符合国家安全卫生标准的工作场所和完成工作任务所必须的条件，并不断改善。</p>
<p class="clause">第十二条 甲方负责对乙方进行职业道德、劳动纪律、业务技能、劳动安全卫生、职业危害防护等方面基本知识教育和培训。</p>
<p class="clause">第十三条 乙方必须按照甲方规定在本合同签订后30日内取得"成都市房地产销售服务人员"合格证书，严格遵守安全操作规程，并有权拒绝违章指挥。</p>
<h2>六、劳动纪律</h2>
<p class="clause">第十四条 乙方应自觉遵守国家及当地政府的法律法规和甲方依法制定的各项规章制度，甲方有权依照国家有关规定及本企业依法制定的规章制度给予乙方奖励或惩处。</p>
<p class="clause">第十五条 在本合同履行过程中，甲方可以依法根据国家和甲方管理的需要制定新的规章制度，也可以对公司制定的规章制度依法进行修改。</p>
<h2>七、保密及竞业限制责任</h2>
<p class="clause">第十六条 乙方承诺严格遵守甲方依法制定的有关保守企业秘密的各项规章制度；严格保守甲方各类经营、交易、管理、技术等秘密；在合同期内及终止或解除合同后，未经甲方同意，均不得以任何方式披露、使用或者允许他人使用甲方商业技术秘密，亦不得自营或为他人经营以及协助他人经营与甲方同类行业及产品的各项业务。竞业限制的期限为解除合同或者合同终止后两年，自解除或者终止合同之日起。</p>
<p class="clause">第十七条 乙方所在岗位涉及甲方商业秘密的，需签订涉密人员保守公司商业秘密协议书，并作为本合同附件。</p>
<h2>八、双方约定的事项</h2>
<p class="clause">第十八条 乙方同意在合同期内，不能在其他单位从事、参与、兼职工作。</p>
<p class="clause">第十九条 劳动合同的变更、解除和终止及相应法律责任按国家有关法律法规和甲方依法制定的规章制度执行。</p>
<p class="clause">第二十条 乙方参加甲方出资的专业技能培训，应与甲方签订培训协议，并作为本合同附件。乙方应遵守有关服务期的规定，如乙方违反服务期约定的，应当按照约定向甲方支付违约金。</p>
<p class="clause">第二十一条 甲、乙双方在解除或终止劳动合同时，乙方同意按照甲方的有关规定办理工作交接手续；按照法律规定，如甲方应向乙方支付经济补偿金的，甲方在乙方办清工作交接手续后依法支付。</p>
<p class="clause">第二十二条 其他约定：</p>
<p class="clause">1.乙方如要解除劳动合同而未提前30天通知甲方的，或者自动离职的，以乙方日工资为标准，以合同到期日计算，每提前1天应支付甲方1天的工资作为损失赔偿。若给甲方造成其他损失的，乙方还应当承担其他赔偿责任。</p>
<p class="clause">2.乙方保证与甲方签订本合同时，已与其他用人单位解除或终止了劳动关系，否则，甲方有权解除本合同。由于乙方的过错，导致甲方被乙方原工作单位追诉的，乙方应赔偿甲方因此受到的全部损失。</p>
<p class="clause">3.乙方若未按照甲方要求在本合同约定期限内取得"成都市房地产销售服务人员"合格证书，甲方对其培训或者调整工作岗位，经培训和调整工作岗位后，乙方仍然不能胜任其工作的，甲方有权解除合同。</p>
<h2>九、其他事项</h2>
<p class="clause">第二十三条 甲、乙双方经协商签订的有关协议书，可以约定为本合同的附件，并与本合同具有同等法律效力。</p>
<p class="clause">第二十四条 本合同未尽事宜，均按照国家有关规定执行，国家没有规定的，通过甲、乙双方协商解决。不愿协商或协商不成的，当事人可以向当地劳动争议仲裁委员会申请仲裁。对裁决不服的，可以向当地人民法院提起诉讼。</p>
<p class="clause">第二十五条 本合同一式两份，甲、乙双方各执一份。每份均具有同等法律效力，本合同的附件作为本合同不可分割的一部分，同样具有法律效力。合同附件包括但不限于：保密协议书、竞业限制协议、技术培训协议、服务承诺书等。</p>
<p class="clause">第二十六条 本劳动合同不得代签或涂改，经甲、乙双方签字（盖章）后生效。</p>
<div class="sign">
  <div>甲方：成都市人居天街房地产经纪有限公司（公章）<div class="line"></div>签约人：<div class="line"></div>签约时间：<div class="line"></div></div>
  <div>乙方：<div class="line"></div>身份证号：<div class="line"></div>签约时间：<div class="line"></div></div>
</div>

<div class="page-break"></div>
<h1>诚 信 声 明</h1>
<p class="clause">本人声明：在与成都市人居天街房地产经纪有限公司（以下简称公司）合作期间，自觉遵守职业道德和公司制度，杜绝以下10种不诚信行为，否则视为本人违反职业操守，违反合作协议行为。本人愿意接受公司的相应处罚，包括但不限于被解除合作协议，被扣工资、奖金及提成等收入、被行业通报，并愿意赔偿由此给公司或他人所造成的经济损失。</p>
<p class="clause">一、私自收受好处；指：私自收受合作单位或个人给予的好处。好处包括但不限于：收礼、借款、小费、返点、回扣、红包、好处费、感谢费、帮忙等；合作单位或个人包括但不限于：与公司有业务往来的各个银行、担保公司、政府机构、供应商、开发商、合作方，或房屋买卖及租赁的双方客户、公司同事等。主动将因不便回绝而收受的礼物等上交公司的除外；</p>
<p class="clause">二、做私单；指：私自协助买卖或租赁双方达成交易（包括但不限于私自将双方或单方客户介绍到其他公司或个人处成交等）；或私自协助客户办理结按、过户、贷款等事项（或将客户介绍到其他公司或个人处办理）；或私自将房客源联系电话等信息透露给公司以外的任何人；</p>
<p class="clause">三、干私活；指：私自在其它单位担任职务，包括股东、合伙人、雇员、临时工（兼职）顾问、培训师等；</p>
<p class="clause">四、泄露公司机密；指：将合作中所接触到的公司商业机密（包括但不限于保密资料、房客源信息、其他员工个人信息、未公开的财务数据和绩效薪酬制度、交易统计数据、工作密码等）泄露给他人或利用该机密进行个人营利活动；</p>
<p class="clause">五、盗窃、侵占、挪用公司及他人财产（包括但不限于现金、财物、商业机密）；</p>
<p class="clause">六、冒充他人签名，考试作弊，虚假报账；</p>
<p class="clause">七、透露自己或他人薪资等保密敏感信息（薪资保密仅针对职能部门员工）；</p>
<p class="clause">八、主动挑起事端导致打架斗殴（包括与同事、客户、同行等任何人）或故意及过失造成他人人身伤害或财产损害，造成恶劣影响；</p>
<p class="clause">九、做其它侵害他人及公司利益的或违背诚信原则的事情，包括但不限于：用虚假承诺来欺骗客户；利用客户身份证、产权证等资料谋取私利；将客户的个人信息泄漏给他人造成客户投诉；在内网中新增虚假或无效的房客源，虚假跟进；虚假报盘；虚假升报业绩；恶性竞争；利用职务之便为自己或他人谋取私利；</p>
<p class="clause">十、唆使、纵容或包庇他人违反以上职业操守的行为；</p>
<p class="clause">（匿名举报邮箱：353517343@qq.com）举报经公司核查属实，奖励举报人现金1000元。</p>
<p style="margin-top:28px;">声明人：<span class="blank" style="min-width:160px;"></span>　　日期：＿＿＿＿年＿＿月＿＿日</p>

<div class="page-break"></div>
<h1>业务管理告知</h1>
<div class="meta">
  <p>单位（甲方）：成都市人居天街房地产经纪有限公司</p>
  <p>注 册 地 址：成都市金牛区花照壁中横街88号1层</p>
  <p>员工（乙方）：{{employeeName}}</p>
  <p>身份证号码：{{idCard}}</p>
</div>
<p class="clause">一、公司管理制度，在钉钉系统里查阅。（途径：工作台—全员—公司制度一览表）</p>
<p class="clause">二、公司会在每月初在各岗位业务群里公布当月的最新业务考核内容。（二手业务群，租赁业务群）</p>
<p class="clause">三、每日工作积分日报：考核积分绩效出勤日平均积分8分以上，6-8分当月提点降2%，平均6分以上当月提点降4%，每日需在19点-23点提交积分日报，晚提交或未提交处罚5元/次。</p>
<p class="clause">四、其他考核：以每月初公布的考核/奖励为准。</p>
<p class="clause">五、公司禁止事项：</p>
<p class="clause">1.禁止下班后将自己的电瓶车门店放在门店，以及充电，若造成被盗，因充电发生的火灾由该电瓶车车主本人承担相应的财产损失和赔偿。</p>
<p class="clause">2.上班包括团建活动期间，禁止酗酒，若造成的相关出行安全事故，由本人全部承担。</p>
<p class="clause">3.上下班和工作期间，禁止为了完成工作相关的事务去高速或超速骑电动车或开汽车，禁止闯红灯。</p>
<p class="clause">六、商业保险：公司给每一名经纪人额外购买一份商业保险（工伤意外险种），每人承担21元/月。</p>
<p class="clause">七、入职贝壳平台必须参加贝壳平台的岗前培训——融合训，贝壳收取500元的培训费用。公司报名时全额垫付，若该参训经纪人入职3个月内离职，则本人承担该笔费用，从工资扣除500元。入职3个月后扣除500元业绩。</p>
<p class="clause">八、成都市房地产经纪协会相关规定，从事房地产经纪活动，必须参加"成都市房地产经纪资格证"考试，考试费用200元。公司报名时全额垫付，若该参训经纪人入职3个月内离职，则本人承担该笔费用，从工资扣除200元。入职3个月后扣除200元业绩。</p>
<div class="sign">
  <div>甲方：成都市人居天街房地产经纪有限公司<div class="line"></div>签约时间：<div class="line"></div></div>
  <div>乙方：<div class="line"></div>签约时间：<div class="line"></div></div>
</div>

<div class="page-break"></div>
<p class="company-line">成都市人居天街房地产经纪有限公司</p>
<h1>保 密 协 议</h1>
<div class="meta">
  <p>单位（甲方）：成都市人居天街房地产经纪有限公司</p>
  <p>注 册 地 址：成都市金牛区花照壁中横街88号1层</p>
  <p>员工（乙方）：{{employeeName}}</p>
  <p>身份证号码：{{idCard}}</p>
  <p>现 住 地 址：{{currentAddress}}</p>
</div>
<p class="clause">因为甲方聘用乙方工作性质的特殊性，双方共识并自愿达成以下协议：</p>
<h2>一、关于违反同业竞争禁止性规定的认定和处理</h2>
<p class="clause">1、乙方在甲方任职期间不得以或明或暗的形式到其他与甲方经营同类业务或有竞争关系的用人单位任职，不得违反《劳动法合同法》、《公司法》、《反不正当竞争法》、本行业各项法律法规及甲方各项管理规章制度，关于同类竞争的禁止性规定和保守甲方商业秘密的规定，不得将甲方各种商业秘密及商业信息泄露或提供给其他单位和个人，从而损害甲方利益。</p>
<p class="clause">2、乙方在甲方任职期间不得自营或者为他人经营提供任何甲方的营业范围信息或者从事损害甲方利益的活动。从事上述营业活动的，所有收入应当归甲方所有。</p>
<p class="clause">3、乙方应为业主和客户严守秘密，不得私下将业主资料告知第三方（即"飞盘"、"飞客"），不得以任何第三方（包括乙方本人）名义与业主、客户交易；乙方不得利用甲方的资料及资源促成交易而将利益据为己有（即"做私盘"）。</p>
<p class="clause">4、乙方不得以任何理由私藏或在获得最新情况时隐瞒楼盘信息。</p>
<p class="clause">5、乙方明知或者应知其他员工有前款所列违法行为而一起采用非法手段获取、使用或者披露甲方商业秘密或者与他人合谋共同侵犯甲方商业秘密的，即为共同侵犯甲方商业秘密的行为，应当承担连带责任。</p>
<p class="clause">6、乙方若获悉其他员工有同业竞争的行为，应当主动向甲方汇报有关部门情况，甲方应当为乙方的举报行为保密。</p>
<p class="clause">7、甲方可以扣留乙方以不正当竞争手段获取的载有商业秘密的图纸、软件及其他资料，乙方应当无条件返还。</p>
<p class="clause">8、对乙方违法披露、使用、允许他人使用商业秘密将给甲方造成不可挽回损失的，甲方有权请求工商行政管理部门采取强制措施。对乙方拒不履行义务，继续实施侵犯甲方商业秘密的视为新的违法行为，应当由工商行政部门从重予以处罚，直至追究乙方的刑事责任，将乙方移交公安司法机关处理。</p>
<p class="clause">乙方有上述违反同业竞争禁止性规定或侵犯商业秘密的任何行为，甲方有权立即解雇，不需给予任何补偿，由此造成甲方的损失由乙方承担，乙方应当向甲方支付赔偿金，赔偿金按照乙方造成甲方的实际损失计算2至5倍（因工作的特殊性，双方将实际损失定为2万元，甲方不必对其实际损失进行举证）。乙方有违反以上规定的，甲方有权向乙方索取相应损失2至5倍的赔偿金，且甲方有权扣发违规事件之后乙方所有工资、奖金、提成、佣金等。</p>
<h2>二、双方或单方终止或解除聘用关系规定的认定和处理</h2>
<p class="clause">1、双方或单方终止或解除聘用关系时，乙方依其忠实义务的要求，立即结束其正在进行的事务；紧急事务必须由乙方作应急处理的，乙方应报告甲方后，依法依约并按甲方书面指示作紧急处理。</p>
<p class="clause">2、双方或单方终止或解除聘用关系时，乙方必须按甲方离职规定办理事务移交手续，将所有甲方的物品、资料于离职当天归还甲方。乙方必须将本职位正在跟进的事务情况向甲方如实详细交待清楚，并立即停止以甲方或甲方工作人员的名义从事任何工作。如果乙方仍以甲方或甲方工作人员的名义对外从事任何活动，即视为违反本协议，甲方有权起诉或要求乙方赔偿损失人民币伍万元整（小写￥50000.00元）。同时停止以乙方个人名义从事经纪业务，如果乙方以个人名义继续跟进在甲方工作期间未完成经纪业务，即视为违反本协议，甲方有权起诉或要求乙方赔偿损失人民币伍万元整（小写￥50000.00元）。</p>
<p class="clause">3、乙方离职后，甲方有权处理乙方离职前尚未完成的中介事务和离职后所收到的佣金，该部分佣金归入甲方所有。</p>
<p class="clause">4、在双方或单方终止或解除聘用关系后的三个月内，禁止乙方到与甲方经营同类业务或有竞争关系的其他用人单位任职（该种单位限于乙方在成都市区域内），禁止乙方本人在原甲方任职机构所在的同一区域内经营同类业务或其他损害甲方利益的行为。禁止与甲方的其他人员同时到另一机构从事相关或同类似于甲方业务的工作。乙方若违反上述约定，甲方有权起诉或要求乙方赔偿相关损失人民币伍万元整（小写￥50000.00元）。</p>
<p class="clause">5、当双方或单方提出终止或解除聘用关系时，甲方有权在报纸、电视或互联网等媒体上声明乙方原在甲方的身份关系和合同中止、解除情况；若乙方有严重违约行为的，甲方可以在各大媒体进行披露，并要求乙方不得以甲方名义从事任何事务。</p>
<p class="clause">6、甲方可以将乙方进行同业竞争、侵犯商业秘密的行为登入房地产企业及执（从）业人员信用档案系统，并在中国住宅与房地产信息网等互联网或其他媒体上就乙方进行同业竞争、侵犯商业秘密的行为发布公告。</p>
<p class="clause">以上乙方的赔偿金、赔偿责任等，甲方有权以扣发乙方工资、奖金、提成、佣金等形式予以实现，或采取其他有效措施。</p>
<h2>三、争议管辖</h2>
<p class="clause">乙方违反同业竞争禁止性规定或者侵犯商业秘密的任何行为，甲方有权直接以民事侵犯诉讼或违约诉讼向人民法院起诉，可以不需事先经过劳动争议仲裁；甲方也有权在提起劳动争议仲裁时一并要求乙方承担上述责任。如提起诉讼，由工作所在地人民法院管辖。</p>
<h2>四、其他</h2>
<p class="clause">本协议一式两份，甲、乙双方各执一份，并于双方签署之日起生效。</p>
<h2>附注</h2>
<p class="clause">本协议所称的商业秘密，是指不为公众所知悉，能为甲方带来经济利益、具有实用性并经甲方采取保密措施的技术信息和经营信息，包括房源信息、客源信息、各种合同、文书、管理文件、流程设计、交易程序、管理诀窍、各种策略、招投标中的标底和标书内容、董事会会议内容和决议、经理会议内容和决议等信息。具体的保密范围包括：</p>
<p class="clause">1、甲方的内部文件（包括会议内容、决议和记录、办公记要、各项规章制度、各类业务或工作表格等）；</p>
<p class="clause">2、甲方的人事档案、员工状况、人员安排及人事调动情况；</p>
<p class="clause">3、甲方的经济指标、销售计划、竞争策略、营销策划及公关方案等；</p>
<p class="clause">4、甲方的业主、客户信息及联系方式等；</p>
<p class="clause">5、其他保密事宜。</p>
<p class="clause" style="margin-top:16px;">乙方承诺书：本人 <span class="blank" style="min-width:120px;">{{employeeName}}</span> 已认真阅读上述保密协定，并充分理解和支持公司的规定，本人承诺遵守与公司保密协定内容中之约定，若本人违反保密协定内容之约定，本人愿意承担一切后果及违约赔偿责任；在此本人慎重承诺，不做私单，不做有损公司利益和形象的事情。</p>
<div class="sign">
  <div>甲方：成都市人居天街房地产经纪有限公司<div class="line"></div>签约时间：<div class="line"></div></div>
  <div>乙方：<div class="line"></div>签约时间：<div class="line"></div></div>
</div>`
);

/** 兼职合同模板源文件 */
const PARTTIME_TEMPLATE = tpl(
  '兼职（非全日制用工）协议',
  `
<h1>兼职（非全日制用工）协议</h1>
<p class="contract-no">协议编号：JZ-{{employeeCode}}-{{startDate}}</p>
<div class="meta">
  <p>甲方（用人单位）：{{partyA}}</p>
  <p>乙方（劳动者）：{{employeeName}}　性别：{{genderLabel}}　身份证号：{{idCard}}</p>
  <p>员工工号：{{employeeCode}}　联系电话：{{phone}}</p>
</div>
<p class="clause">根据《中华人民共和国劳动法》《中华人民共和国劳动合同法》关于非全日制用工的有关规定，甲乙双方经协商一致，订立本协议。</p>
<h2>一、协议期限</h2>
<p class="clause">本协议期限自 {{startDate}} 起至 {{endDate}} 止。</p>
<h2>二、工作内容</h2>
<p class="clause">乙方在甲方（{{partyA}}）从事兼职工作，具体工作内容以甲方安排为准。乙方可以与其他用人单位订立劳动合同，但不得影响本协议的履行。</p>
<h2>三、工作时间</h2>
<p class="clause">乙方平均每日工作时间不超过四小时，每周工作时间累计不超过二十四小时，具体班次由甲方与乙方协商安排。</p>
<h2>四、劳务报酬</h2>
<p class="clause">甲方以货币形式按双方约定周期结算乙方报酬；乙方收款账户：{{bankName}} {{bankBranch}}，卡号 {{bankCardNo}}。</p>
<h2>五、保险与保障</h2>
<p class="clause">甲方依法为乙方缴纳工伤保险；甲方可为乙方购买商业保险作为补充保障，具体以甲方投保方案为准。</p>
<h2>六、协议的变更与终止</h2>
<p class="clause">双方任何一方均可提前三日通知对方终止本协议；协议终止时，甲方依法结清乙方报酬。</p>
<h2>七、其他</h2>
<p class="clause">本协议未尽事宜，双方协商解决；本协议一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。</p>
<div class="sign">
  <div>甲方（盖章）：<div class="line"></div>签订日期：<div class="line"></div></div>
  <div>乙方（签字）：<div class="line"></div>签订日期：<div class="line"></div></div>
</div>`
);

/** 其他协议模板源文件 */
const OTHER_TEMPLATE = tpl(
  '协议书',
  `
<h1>协议书</h1>
<p class="contract-no">编号：QT-{{employeeCode}}-{{startDate}}</p>
<div class="meta">
  <p>甲方（用人单位）：{{partyA}}</p>
  <p>乙方（劳动者）：{{employeeName}}　性别：{{genderLabel}}　身份证号：{{idCard}}</p>
  <p>员工工号：{{employeeCode}}　联系电话：{{phone}}</p>
</div>
<p class="clause">甲乙双方本着平等自愿、协商一致的原则，就合作事项达成如下协议：</p>
<h2>一、协议期限</h2>
<p class="clause">本协议期限自 {{startDate}} 起至 {{endDate}} 止。</p>
<h2>二、协议内容</h2>
<p class="clause">乙方在甲方（{{partyA}}）从事双方约定的工作或合作事项，具体内容、标准与要求由双方另行书面确认。</p>
<h2>三、费用与结算</h2>
<p class="clause">相关费用与结算方式以双方书面约定为准；乙方收款账户：{{bankName}} {{bankBranch}}，卡号 {{bankCardNo}}。</p>
<h2>四、保密与合规</h2>
<p class="clause">乙方在履行本协议期间知悉的甲方经营信息、客户信息等，未经甲方书面同意不得对外披露；双方均应遵守国家法律法规及甲方依法制定的规章制度。</p>
<h2>五、协议的变更与解除</h2>
<p class="clause">本协议经双方协商一致可以变更或解除；任何一方要求解除本协议，应提前通知对方并办理相关交接手续。</p>
<h2>六、其他</h2>
<p class="clause">本协议一式两份，甲乙双方各执一份，自双方签字（盖章）之日起生效。</p>
<div class="sign">
  <div>甲方（盖章）：<div class="line"></div>签订日期：<div class="line"></div></div>
  <div>乙方（签字）：<div class="line"></div>签订日期：<div class="line"></div></div>
</div>`
);

/** 按合同类型取可下载的模板源文件 */
export const CONTRACT_TEMPLATE_SOURCES: Record<string, string> = {
  LABOR: LABOR_TEMPLATE,
  PARTTIME: PARTTIME_TEMPLATE,
  OTHER: OTHER_TEMPLATE
};

/** 下载指定合同类型的模板源文件（用户改完再上传） */
export function downloadContractTemplate(contractType: string, fileName: string) {
  const content = CONTRACT_TEMPLATE_SOURCES[contractType] ?? OTHER_TEMPLATE;
  // 加 UTF-8 BOM，避免 Windows 下编辑器按 GBK 解析导致中文乱码
  const blob = new Blob(['﻿' + content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.html`;
  link.click();
  URL.revokeObjectURL(url);
}
