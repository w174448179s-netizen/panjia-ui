<template>
  <div class="payroll-batch">
    <el-card class="mb-4">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold">工资批次管理</h3>
        <div class="flex items-center gap-3">
          <el-date-picker
            v-model="filterPeriod"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择归属月"
            clearable
            @change="loadBatches"
          />
          <el-button type="primary" @click="showCreate = true">+ 创建批次</el-button>
        </div>
      </div>

      <el-table :data="batches" stripe border>
        <el-table-column label="归属月" prop="period" width="110" />
        <el-table-column label="范围" prop="deptScope" width="90" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="statusTag(row.status)">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="人数" prop="employeeCount" width="70" align="center" />
        <el-table-column label="应发合计" prop="grossTotal" width="130" align="right">
          <template #default="{ row }">{{ fmt(row.grossTotal) }}</template>
        </el-table-column>
        <el-table-column label="实发合计" prop="netTotal" width="130" align="right">
          <template #default="{ row }">{{ fmt(row.netTotal) }}</template>
        </el-table-column>
        <el-table-column label="算薪次数" prop="attempt" width="80" align="center" />
        <el-table-column label="创建时间" prop="createTime" width="170" />
        <el-table-column label="操作" width="210" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button link type="primary" @click="viewDetail(row as PayrollBatch)">明细</el-button>
              <!-- 审批通过/驳回/锁定已收敛到「我的待办」（payroll_batch 工作流节点办理），
                   业务页仅保留算薪/提交/发放动作，按状态平铺 -->
              <el-button v-if="canCalc(row.status)" link type="primary" @click="doAction(row as PayrollBatch, 'calculate')">算薪</el-button>
              <el-button v-if="row.status === 'CALCULATED'" link type="success" @click="doAction(row as PayrollBatch, 'submit')">提交审批</el-button>
              <el-button v-if="row.status === 'LOCKED'" link type="warning" @click="doAction(row as PayrollBatch, 'pay')">标记发放</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 工资明细弹窗（七 sheet 页：工资表 / 新签业绩 / 结佣业绩 / 店长工资 / 总监工资 / 人事数据 / 绩效和扣款） -->
    <el-dialog
      v-model="detailVisible"
      :title="`工资明细 — ${currentBatch?.period || ''}（${currentBatch ? statusLabel(currentBatch.status) : ''}）`"
      width="96%"
      top="3vh"
      destroy-on-close
      @closed="closeDetail"
    >
      <div v-if="currentBatch" class="detail-toolbar">
        <el-button :disabled="!details.length" @click="exportExcel">
          <el-icon><Download /></el-icon>&nbsp;导出（七 sheet）
        </el-button>
      </div>
      <el-tabs v-model="detailTab" class="detail-tabs">
        <!-- ══════════ 工资表 sheet（28 列，含经纪人 + 店长） ══════════ -->
        <el-tab-pane label="工资表" name="AGENT" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="ag.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="ag.filter.employeeId" filterable remote clearable :remote-method="agEmp.remoteMethod"
              :loading="agEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="员工姓名/工号搜索" style="width: 210px"
              @change="agEmp.onSelect">
              <el-option v-for="emp in agEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table :data="ag.paged" stripe border max-height="600" :summary-method="summaryMethod" show-summary>
            <el-table-column label="门店" prop="deptName" width="110" fixed="left" />
            <el-table-column label="员工编号" prop="employeeCode" width="90" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="职级" prop="levelCode" width="60" />
            <el-table-column label="职位" width="70">
              <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
            </el-table-column>
            <el-table-column label="当月新签业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.newSignPerformance) }}</template>
            </el-table-column>
            <el-table-column label="新签业绩提成比例" width="130" align="right">
              <template #default="{ row }">{{ row.newSignRate != null ? ratePercent(row.newSignRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="绩效提成扣点" width="110" align="right">
              <template #default="{ row }">{{ row.totalDeduct != null ? ratePercent(row.totalDeduct) : '' }}</template>
            </el-table-column>
            <el-table-column label="个人提点奖励" width="110" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="最终提成比例" width="110" align="right">
              <template #default="{ row }">{{ row.finalRate != null ? ratePercent(row.finalRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="结佣业绩" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionPerformance) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.finalRate != null ? ratePercent(row.finalRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="提成金额" prop="commissionIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionIncome) }}</template>
            </el-table-column>
            <el-table-column label="招聘奖励" prop="mentorBonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="底薪" width="90" align="right">
              <template #default="{ row }">{{ num(baseSalaryOf(row)) }}</template>
            </el-table-column>
            <el-table-column label="绩效" prop="bonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.bonus) }}</template>
            </el-table-column>
            <el-table-column label="考勤扣款" width="90" align="right">
              <template #default="{ row }">{{ neg(row.attendanceFee) }}</template>
            </el-table-column>
            <el-table-column label="积分扣款" prop="pointsFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.pointsFee) }}</template>
            </el-table-column>
            <el-table-column label="应发工资" prop="gross" width="110" align="right">
              <template #default="{ row }"><b>{{ num(row.gross) }}</b></template>
            </el-table-column>
            <el-table-column label="社保扣款" prop="socialFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.socialFee) }}</template>
            </el-table-column>
            <el-table-column label="公积金扣款" prop="housingFund" width="100" align="right">
              <template #default="{ row }">{{ neg(row.housingFund) }}</template>
            </el-table-column>
            <el-table-column label="往月负工资" width="100" align="right">
              <template #default="{ row }">{{ neg(Math.abs(Number(row.negativeCarryover) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="商业保险" prop="commercialInsurance" width="90" align="right">
              <template #default="{ row }">{{ neg(row.commercialInsurance) }}</template>
            </el-table-column>
            <el-table-column label="宿舍管理费" prop="dormitoryFee" width="100" align="right">
              <template #default="{ row }">{{ neg(row.dormitoryFee) }}</template>
            </el-table-column>
            <el-table-column label="工资合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.gross) || 0) - (Number(row.deduct) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="实发工资" prop="net" width="110" align="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
            <el-table-column label="个税扣除" prop="tax" width="90" align="right">
              <template #default="{ row }">{{ neg(row.tax) }}</template>
            </el-table-column>
            <el-table-column label="最终发放" prop="net" width="120" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="ag.page" v-model:page-size="ag.pageSize"
            :total="ag.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 店长工资 sheet（15 列，底薪计算与补齐依据，对齐天街工资表 店长工资 sheet） ══════════ -->
        <el-tab-pane label="店长" name="MANAGER" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="mf.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="mf.filter.employeeId" filterable remote clearable :remote-method="mfEmp.remoteMethod"
              :loading="mfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="员工姓名/工号搜索" style="width: 210px"
              @change="mfEmp.onSelect">
              <el-option v-for="emp in mfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table :data="mf.paged" stripe border max-height="600" :summary-method="managerSummary" show-summary>
            <el-table-column label="门店" prop="deptName" width="110" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="职级" prop="levelCode" width="60" />
            <el-table-column label="新签团队业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.deptNewSignTotal) }}</template>
            </el-table-column>
            <el-table-column label="社保业绩扣款" width="120" align="right">
              <template #default="{ row }">{{ neg(row.deptEmployerSocialTotal) }}</template>
            </el-table-column>
            <el-table-column label="新签与结佣差额" width="130" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.commissionPerformance) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="团队计薪业绩" width="120" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.deptEmployerSocialTotal) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.teamRate != null ? ratePercent(row.teamRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="团队提成金额" prop="teamIncome" width="120" align="right">
              <template #default="{ row }">{{ num(row.teamIncome) }}</template>
            </el-table-column>
            <el-table-column label="当月个人新签业绩提成" prop="personalNewsignIncome" width="160" align="right">
              <template #default="{ row }">{{ num(row.personalNewsignIncome) }}</template>
            </el-table-column>
            <el-table-column label="合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.teamIncome) || 0) + (Number(row.personalNewsignIncome) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="保底" prop="minSalary" width="90" align="right">
              <template #default="{ row }">{{ num(row.minSalary) }}</template>
            </el-table-column>
            <el-table-column label="补足8000部分" prop="guaranteeFill" width="120" align="right">
              <template #default="{ row }">{{ num(row.guaranteeFill) }}</template>
            </el-table-column>
            <el-table-column label="其他扣款" prop="otherDeduct" width="100" align="right">
              <template #default="{ row }">{{ neg(row.otherDeduct) }}</template>
            </el-table-column>
            <el-table-column label="店长工资" prop="gross" width="110" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(baseSalaryOf(row)) }}</b></template>
            </el-table-column>
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="mf.page" v-model:page-size="mf.pageSize"
            :total="mf.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 总监工资 sheet（19 列，树形可展开：汇总行+门店明细子行，对齐天街工资表 总监工资 sheet） ══════════ -->
        <el-tab-pane label="总监" name="DIRECTOR" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="df.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="df.filter.employeeId" filterable remote clearable :remote-method="dfEmp.remoteMethod"
              :loading="dfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="姓名/工号搜索" style="width: 210px"
              @change="dfEmp.onSelect">
              <el-option v-for="emp in dfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table :data="df.paged" border max-height="600" :summary-method="directorSummary" show-summary
            row-key="_id" :tree-props="{ children: 'children' }" default-expand-all>
            <el-table-column label="姓名" prop="employeeName" width="90" fixed="left" />
            <el-table-column label="组别" prop="deptName" width="120" fixed="left" />
            <el-table-column label="新签业绩" width="120" align="right">
              <template #default="{ row }">{{ num(row.deptNewSignTotal) }}</template>
            </el-table-column>
            <el-table-column label="社保业绩" width="110" align="right">
              <template #default="{ row }">{{ neg(row.deptEmployerSocialTotal) }}</template>
            </el-table-column>
            <el-table-column label="合计" width="110" align="right">
              <template #default="{ row }">{{ num((Number(row.deptNewSignTotal) || 0) - (Number(row.deptEmployerSocialTotal) || 0)) }}</template>
            </el-table-column>
            <el-table-column label="提成比例" width="100" align="right">
              <template #default="{ row }">{{ row.storeRate != null ? ratePercent(row.storeRate) : '' }}</template>
            </el-table-column>
            <el-table-column label="提成金额" prop="storeIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.storeIncome) }}</template>
            </el-table-column>
            <el-table-column label="底薪" prop="baseSalary" width="90" align="right">
              <template #default="{ row }">{{ num(row.baseSalary) }}</template>
            </el-table-column>
            <el-table-column label="全勤" prop="fullAttendance" width="90" align="right">
              <template #default="{ row }">{{ num(row.fullAttendance) }}</template>
            </el-table-column>
            <el-table-column label="绩效" prop="bonus" width="90" align="right">
              <template #default="{ row }">{{ num(row.bonus) }}</template>
            </el-table-column>
            <el-table-column label="结佣业绩" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionPerformance) }}</template>
            </el-table-column>
            <el-table-column label="业绩提成" prop="commissionIncome" width="110" align="right">
              <template #default="{ row }">{{ num(row.commissionIncome) }}</template>
            </el-table-column>
            <el-table-column label="招聘提成" prop="mentorBonus" width="100" align="right">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="社保" prop="socialFee" width="90" align="right">
              <template #default="{ row }">{{ neg(row.socialFee) }}</template>
            </el-table-column>
            <el-table-column label="公积金" prop="housingFund" width="90" align="right">
              <template #default="{ row }">{{ neg(row.housingFund) }}</template>
            </el-table-column>
            <el-table-column label="商业保险" prop="commercialInsurance" width="100" align="right">
              <template #default="{ row }">{{ neg(row.commercialInsurance) }}</template>
            </el-table-column>
            <el-table-column label="应发工资" prop="gross" width="110" align="right">
              <template #default="{ row }"><b>{{ num(row.gross) }}</b></template>
            </el-table-column>
            <el-table-column label="个税" prop="tax" width="90" align="right">
              <template #default="{ row }">{{ neg(row.tax) }}</template>
            </el-table-column>
            <el-table-column label="实发工资" prop="net" width="110" align="right" fixed="right">
              <template #default="{ row }"><b class="text-primary">{{ num(row.net) }}</b></template>
            </el-table-column>
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="df.page" v-model:page-size="df.pageSize"
            :total="df.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 新签业绩 sheet（12 列） ══════════ -->
        <el-tab-pane label="新签业绩" name="NEWSIGN" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="nsf.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="nsf.filter.employeeId" filterable remote clearable :remote-method="nsfEmp.remoteMethod"
              :loading="nsfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="签约人姓名/工号搜索" style="width: 210px"
              @change="nsfEmp.onSelect">
              <el-option v-for="emp in nsfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table v-loading="perfLoading.newSign" element-loading-text="业绩明细加载中…" :data="nsf.paged" stripe border max-height="600" size="small" show-summary :summary-method="nsfSummary">
            <el-table-column label="签约/认购日期" width="170" align="center">
              <template #default="{ row }">{{ row.signDate || row.businessDate || '—' }}</template>
            </el-table-column>
            <el-table-column label="合同号/订单号" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ resolveBizNo(row.bizType, row.contractNo, row.orderNo) || '—' }}</template>
            </el-table-column>
            <el-table-column label="类型" prop="bizType" width="100" show-overflow-tooltip />
            <el-table-column label="房源地址" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
            </el-table-column>
            <el-table-column label="门店" prop="deptName" width="110" show-overflow-tooltip />
            <el-table-column label="签约人" prop="employeeName" width="80" align="center" />
            <el-table-column label="签约人工号" prop="employeeCode" width="100" align="center" />
            <el-table-column label="所属角色" prop="roleType" width="100" align="center" />
            <el-table-column label="角色占比" width="90" align="center">
              <template #default="{ row }">{{ row.shareRatio != null ? (Number(row.shareRatio) * 100).toFixed(2) + '%' : '—' }}</template>
            </el-table-column>
            <el-table-column label="85后" prop="convertedAmount" align="right" width="130">
              <template #default="{ row }">¥{{ Number(row.convertedAmount ?? row.amount).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="是否结算" width="80" align="center">
              <template #default="{ row }">{{ row.status === 'APPROVED' ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column label="结算日期" prop="approvedMonth" width="110" align="center" />
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="nsf.page" v-model:page-size="nsf.pageSize"
            :total="nsf.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 结佣业绩 sheet（12 列） ══════════ -->
        <el-tab-pane label="结佣业绩" name="COMMISSION" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="cf.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="cf.filter.employeeId" filterable remote clearable :remote-method="cfEmp.remoteMethod"
              :loading="cfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="签约人姓名/工号搜索" style="width: 210px"
              @change="cfEmp.onSelect">
              <el-option v-for="emp in cfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table v-loading="perfLoading.commission" element-loading-text="业绩明细加载中…" :data="cf.paged" stripe border max-height="600" size="small" show-summary :summary-method="cfSummary">
            <el-table-column label="签约/认购日期" width="170" align="center">
              <template #default="{ row }">{{ row.signDate || row.businessDate || '—' }}</template>
            </el-table-column>
            <el-table-column label="合同号/订单号" min-width="180" show-overflow-tooltip>
              <template #default="{ row }">{{ resolveBizNo(row.bizType, row.contractNo, row.orderNo) || '—' }}</template>
            </el-table-column>
            <el-table-column label="类型" prop="bizType" width="100" show-overflow-tooltip />
            <el-table-column label="房源地址" min-width="200" show-overflow-tooltip>
              <template #default="{ row }">{{ row.propertyAddress || '—' }}</template>
            </el-table-column>
            <el-table-column label="门店" prop="deptName" width="110" show-overflow-tooltip />
            <el-table-column label="签约人" prop="employeeName" width="80" align="center" />
            <el-table-column label="签约人工号" prop="employeeCode" width="100" align="center" />
            <el-table-column label="所属角色" prop="roleType" width="100" align="center" />
            <el-table-column label="角色占比" width="90" align="center">
              <template #default="{ row }">{{ row.shareRatio != null ? (Number(row.shareRatio) * 100).toFixed(2) + '%' : '—' }}</template>
            </el-table-column>
            <el-table-column label="85后" prop="convertedAmount" align="right" width="130">
              <template #default="{ row }">¥{{ Number(row.convertedAmount ?? row.amount).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="是否结算" width="80" align="center">
              <template #default="{ row }">{{ row.status === 'APPROVED' ? '是' : '' }}</template>
            </el-table-column>
            <el-table-column label="结算日期" prop="approvedMonth" width="110" align="center" />
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="cf.page" v-model:page-size="cf.pageSize"
            :total="cf.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 人事数据 sheet（18 列） ══════════ -->
        <el-tab-pane label="人事数据" name="HR" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="hf.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="hf.filter.employeeId" filterable remote clearable :remote-method="hfEmp.remoteMethod"
              :loading="hfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="员工姓名/工号搜索" style="width: 210px"
              @change="hfEmp.onSelect">
              <el-option v-for="emp in hfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table :data="hf.paged" stripe border max-height="600" size="small">
            <el-table-column label="门店名称" prop="deptName" width="120" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="职级" prop="levelCode" width="60" />
            <el-table-column label="职位" width="70">
              <template #default="{ row }">{{ roleLabel(row.employeeRole) }}</template>
            </el-table-column>
            <el-table-column label="底薪" align="right" width="90">
              <template #default="{ row }">{{ num(row.baseSalary) }}</template>
            </el-table-column>
            <el-table-column label="考勤扣款" align="right" width="100">
              <template #default="{ row }">{{ neg(row.attendanceFee) }}</template>
            </el-table-column>
            <el-table-column label="社保扣款" align="right" width="100">
              <template #default="{ row }">{{ neg(row.socialFee) }}</template>
            </el-table-column>
            <el-table-column label="公积金扣款" align="right" width="100">
              <template #default="{ row }">{{ neg(row.housingFund) }}</template>
            </el-table-column>
            <el-table-column label="宿舍管理费" align="right" width="100">
              <template #default="{ row }">{{ neg(row.dormitoryFee) }}</template>
            </el-table-column>
            <el-table-column label="积分扣款" align="right" width="90">
              <template #default="{ row }">{{ neg(row.pointsFee) }}</template>
            </el-table-column>
            <el-table-column label="新人绩效" align="right" width="90">
              <template #default="{ row }">{{ num(row.bonus) }}</template>
            </el-table-column>
            <el-table-column label="往月负工资" align="right" width="100">
              <template #default="{ row }">{{ neg(row.negativeCarryover) }}</template>
            </el-table-column>
            <el-table-column label="新人带教" align="right" width="90">
              <template #default="{ row }">{{ num(row.mentorBonus) }}</template>
            </el-table-column>
            <el-table-column label="其他扣款" align="right" width="90">
              <template #default="{ row }">{{ neg(row.otherDeduct) }}</template>
            </el-table-column>
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="hf.page" v-model:page-size="hf.pageSize"
            :total="hf.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>

        <!-- ══════════ 绩效和扣款 sheet（19 列） ══════════ -->
        <el-tab-pane label="绩效和扣款" name="PERF" lazy>
          <div class="tab-toolbar">
            <el-tree-select v-model="pf.filter.deptId" :data="deptTreeData"
              :props="{ label: 'deptName', children: 'children' } as any" node-key="deptId" value-key="deptId"
              placeholder="全部门店/组别" clearable check-strictly style="width: 200px" />
            <el-select v-model="pf.filter.employeeId" filterable remote clearable :remote-method="pfEmp.remoteMethod"
              :loading="pfEmp.loading" no-data-text="输入姓名/工号搜索" placeholder="员工姓名/工号搜索" style="width: 210px"
              @change="pfEmp.onSelect">
              <el-option v-for="emp in pfEmp.options" :key="emp.employeeId"
                :label="`${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`" :value="emp.employeeId" />
            </el-select>
          </div>
          <el-table :data="pf.paged" stripe border max-height="600" size="small">
            <el-table-column label="门店" prop="deptName" width="120" fixed="left" />
            <el-table-column label="姓名" prop="employeeName" width="80" fixed="left" />
            <el-table-column label="积分扣款" align="right" width="90">
              <template #default="{ row }">{{ neg(row.pointsFee) }}</template>
            </el-table-column>
            <el-table-column label="其他扣款" align="right" width="90">
              <template #default="{ row }">{{ neg(row.otherDeduct) }}</template>
            </el-table-column>
            <el-table-column label="绩效等级" prop="perfGrade" width="80" align="center" />
            <el-table-column label="绩效提成点" width="100" align="center">
              <template #default="{ row }">{{ row.perfDeduct != null ? (Number(row.perfDeduct) * 100).toFixed(2) + '%' : '' }}</template>
            </el-table-column>
            <el-table-column label="所有扣点合计" width="110" align="center">
              <template #default="{ row }">{{ row.totalDeduct != null ? (Number(row.totalDeduct) * 100).toFixed(2) + '%' : '' }}</template>
            </el-table-column>
          </el-table>
          <el-pagination class="tab-pagination" v-model:current-page="pf.page" v-model:page-size="pf.pageSize"
            :total="pf.filtered.length" :page-sizes="[50, 100, 200]" layout="total, sizes, prev, pager, next" size="small" />
        </el-tab-pane>
      </el-tabs>
    </el-dialog>

    <!-- 创建批次弹窗 -->
    <el-dialog v-model="showCreate" title="创建工资批次" width="420px">
      <el-form label-width="80px">
        <el-form-item label="归属月">
          <el-date-picker v-model="createForm.period" type="month" value-format="YYYY-MM" placeholder="选择月份" style="width:100%" />
        </el-form-item>
        <el-form-item label="范围">
          <span class="scope-text">全部门店</span>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="createBatch">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download } from '@element-plus/icons-vue';
import { payrollApi, orgCommissionTraceApi, type PayrollBatch, type PayrollDetail, type CommissionTraceItem } from '@/api/panjia/payroll';
import { useDeptEmpFilter, useEmployeeSearch } from '@/hooks/useDeptEmpFilter';
import { attendanceApi } from '@/api/panjia/attendance';
import { scoreApi } from '@/api/panjia/score';
import { exportMultiSheet, parseStoreItems, type ExportExtraData } from '../components/payroll-export';
import { resolveBizNo } from '@/utils/panjiaBiz';
import { useWorkflowRouteOpen } from '@/hooks/workflow/useWorkflowRouteOpen';

const route = useRoute();

const batches = ref<PayrollBatch[]>([]);
const details = ref<PayrollDetail[]>([]);
const currentBatch = ref<PayrollBatch | null>(null);
const detailVisible = ref(false);
const detailTab = ref<'AGENT' | 'MANAGER' | 'DIRECTOR' | 'NEWSIGN' | 'COMMISSION' | 'HR' | 'PERF'>('AGENT');
const filterPeriod = ref('');
// 业绩明细数据（新签/结佣，导出和 tab 展示共用）
const newSignItems = ref<CommissionTraceItem[]>([]);
const commissionItems = ref<CommissionTraceItem[]>([]);
const showCreate = ref(false);
const creating = ref(false);
const createForm = ref({ period: '', deptScope: 'ALL' });

const STATUS_LABEL: Record<string, string> = {
  DRAFT: '草稿', CALCULATING: '计算中', CALCULATED: '已计算', FAILED: '失败',
  REVIEWING: '待审核', APPROVED: '已确认', LOCKED: '已锁定', PAID: '已发放',
};
type TagType = 'primary' | 'success' | 'info' | 'warning' | 'danger';
const STATUS_TAG: Record<string, TagType> = {
  DRAFT: 'info', CALCULATING: 'warning', CALCULATED: 'primary', FAILED: 'danger',
  REVIEWING: 'warning', APPROVED: 'success', LOCKED: 'success', PAID: 'success',
};

const statusLabel = (s: string) => STATUS_LABEL[s] || s;
const statusTag = (s: string): TagType => STATUS_TAG[s] || 'info';
const canCalc = (s: string) => ['DRAFT', 'CALCULATED', 'FAILED', 'REVIEWING'].includes(s);
const roleLabel = (r: string) => ({ AGENT: '经纪人', MANAGER: '店长', DIRECTOR: '总监' }[r] || r);
const fmt = (n: number | null) => (n == null ? '0.00' : Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const num = (v: any) => (v == null || v === '' ? '' : Number(v).toFixed(2));
const neg = (v: any) => {
  const n = Number(v) || 0;
  return n === 0 ? '' : (-n).toFixed(2);
};
const ratePercent = (v: any) => {
  if (v == null || v === '') return '';
  const n = Number(v);
  if (Number.isNaN(n)) return '';
  return `${(n * 100).toFixed(2)}%`;
};

/** 底薪：经纪人取 baseSalary，店长取 teamIncome + guaranteeFill（保底补足） */
const baseSalaryOf = (row: any): number => {
  if (row.employeeRole === 'MANAGER') {
    return (Number(row.teamIncome) || 0) + (Number(row.guaranteeFill) || 0);
  }
  return Number(row.baseSalary) || 0;
};

// 按角色分流到三 sheet（工资表含经纪人 + 店长，店长工资 sheet 仅用于底薪计算补齐）
const salaryDetails = computed(() => details.value.filter((r) => r.employeeRole === 'AGENT' || r.employeeRole === 'MANAGER'));
const managerDetails = computed(() => details.value.filter((r) => r.employeeRole === 'MANAGER'));
const directorDetails = computed(() => details.value.filter((r) => r.employeeRole === 'DIRECTOR'));

// 总监树形数据：汇总行 + 门店明细子行（可展开收起）
interface DirectorTreeNode extends PayrollDetail {
  children?: PayrollDetail[];
  _id: string;
  _isSummary?: boolean;
}
const directorTreeData = computed<DirectorTreeNode[]>(() => {
  return directorDetails.value.map((dir) => {
    const items = parseStoreItems(dir);
    const children = items.map((it) => ({
      ...dir,
      _id: `${dir.employeeId}-${it.deptId}`,
      employeeName: '',
      deptName: it.deptName || dir.deptName || '',
      deptNewSignTotal: Number(it.newSign) || 0,
      deptEmployerSocialTotal: Number(it.social) || 0,
      storeRate: Number(it.rate) || 0,
      storeIncome: Number(it.income) || 0,
      baseSalary: undefined,
      fullAttendance: undefined,
      bonus: undefined,
      commissionPerformance: undefined,
      commissionIncome: undefined,
      mentorBonus: undefined,
      socialFee: undefined,
      housingFund: undefined,
      commercialInsurance: undefined,
      gross: undefined,
      tax: undefined,
      net: undefined,
    } as DirectorTreeNode));
    return {
      ...dir,
      _id: `${dir.employeeId}`,
      _isSummary: true,
      deptName: items.length > 0 ? '汇总' : (dir.deptName || ''),
      children: children.length > 0 ? children : undefined,
    } as DirectorTreeNode;
  });
});

const loadBatches = async () => {
  const res = await payrollApi.listBatches(filterPeriod.value || undefined);
  batches.value = (res as any).data ?? [];
};

/* ───────────── tab 通用：统一门店/员工组件过滤 + 前端分页 ─────────────
 * 门店：统一 el-tree-select + 部门树（含子部门）；员工：统一 el-select 远程搜索；
 * 数据已全量在内存，过滤分页纯前端，避免全量渲染卡顿。
 */
const { deptTreeData, loadDeptTree, collectDeptIds } = useDeptEmpFilter();

/** 统一过滤匹配：门店（含子部门）+ 员工（employeeId 精确），全部 tab 共用 */
const matchByDeptEmp = (r: any, f: Record<string, any>) => {
  if (f.deptId && !collectDeptIds(f.deptId).has(String(r.deptId ?? ''))) return false;
  if (f.employeeId != null && f.employeeId !== '' && String(r.employeeId ?? '') !== String(f.employeeId)) return false;
  return true;
};

function pagedTable<T extends Record<string, any>>(source: () => T[]) {
  const filter = ref<Record<string, any>>({ deptId: '', employeeId: '' });
  const page = ref(1);
  const pageSize = ref(50);
  const filtered = computed(() => {
    const f = filter.value;
    const hasFilter = (f.deptId !== '' && f.deptId != null) || (f.employeeId !== '' && f.employeeId != null);
    return hasFilter ? source().filter((r) => matchByDeptEmp(r, f)) : source();
  });
  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value;
    return filtered.value.slice(start, start + pageSize.value);
  });
  // 过滤条件或数据源变化时回到第一页（关闭弹窗清空数据后自动复位）
  watch([filter, () => source().length], () => { page.value = 1; }, { deep: true });
  return reactive({
    filter, page, pageSize, filtered, paged,
    reset: () => { filter.value.deptId = ''; filter.value.employeeId = ''; page.value = 1; },
  });
}

const ag = pagedTable(() => salaryDetails.value);
const agEmp = useEmployeeSearch(() => ag.filter.employeeId, () => ag.filter.deptId);
const mf = pagedTable(() => managerDetails.value);
const mfEmp = useEmployeeSearch(() => mf.filter.employeeId, () => mf.filter.deptId);
const df = pagedTable(() => directorTreeData.value);
const dfEmp = useEmployeeSearch(() => df.filter.employeeId, () => df.filter.deptId);
const nsf = pagedTable(() => newSignItems.value);
const nsfEmp = useEmployeeSearch(() => nsf.filter.employeeId, () => nsf.filter.deptId);
const cf = pagedTable(() => commissionItems.value);
const cfEmp = useEmployeeSearch(() => cf.filter.employeeId, () => cf.filter.deptId);
const hf = pagedTable(() => details.value);
const hfEmp = useEmployeeSearch(() => hf.filter.employeeId, () => hf.filter.deptId);
const pf = pagedTable(() => details.value);
const pfEmp = useEmployeeSearch(() => pf.filter.employeeId, () => pf.filter.deptId);

/* ───────────── 业绩明细汇总行（新签/结佣 tab 共用工厂，合计 = 当前筛选视图全量） ───────────── */
const fmtMoney = (v: number) => '¥' + v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mkPerfSummary = (source: () => any[]) => ({ columns }: any) => {
  const sums: string[] = [];
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) { sums[idx] = '合计'; return; }
    if (col.property === 'convertedAmount') {
      const total = source().reduce((s: number, r: any) => s + (Number(r.convertedAmount ?? r.amount) || 0), 0);
      sums[idx] = fmtMoney(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};
const nsfSummary = mkPerfSummary(() => nsf.filtered);
const cfSummary = mkPerfSummary(() => cf.filtered);

const createBatch = async () => {
  if (!createForm.value.period) {
    ElMessage.warning('请选择归属月');
    return;
  }
  creating.value = true;
  try {
    // 无考勤/无积分确认：该月无记录时对应扣款/扣点按默认值（考勤扣款 0、积分默认 A 不扣点），
    // 防人事漏导考勤或积分日报导致算薪口径失真
    const approvalRes: any = await attendanceApi.getApproval(createForm.value.period);
    if (approvalRes.data?.dataExists === false) {
      const confirmed = await ElMessageBox.confirm(
        `${createForm.value.period} 无考勤数据，考勤扣款将为 0。可能是人事漏导考勤，确认继续创建批次？`,
        '无考勤确认',
        { type: 'warning', confirmButtonText: '继续创建', cancelButtonText: '取消' }
      ).then(() => true).catch(() => false);
      if (!confirmed) return;
    }
    const scoreRes: any = await scoreApi.getApproval(createForm.value.period);
    if (scoreRes.data?.dataExists === false) {
      const confirmed = await ElMessageBox.confirm(
        `${createForm.value.period} 无积分数据，绩效等级将默认 A（不扣点）。可能是人事漏导积分日报，确认继续创建批次？`,
        '无积分确认',
        { type: 'warning', confirmButtonText: '继续创建', cancelButtonText: '取消' }
      ).then(() => true).catch(() => false);
      if (!confirmed) return;
    }
    await payrollApi.createBatch(createForm.value);
    showCreate.value = false;
    createForm.value = { period: '', deptScope: 'ALL' };
    ElMessage.success('批次已创建');
    loadBatches();
  } finally {
    creating.value = false;
  }
};

const doAction = async (row: PayrollBatch, action: string) => {
  const labelMap: Record<string, string> = { calculate: '算薪', submit: '提交审核', pay: '标记发放' };
  const label = labelMap[action];
  if (action === 'pay') {
    try {
      await ElMessageBox.confirm(`确认${label}批次「${row.period}」？`, '提示', { type: 'warning' });
    } catch {
      return;
    }
  }
  try {
    await (payrollApi as any)[action](row.id);
    ElMessage.success(`${label}成功`);
    loadBatches();
    if (currentBatch.value?.id === row.id && detailVisible.value) viewDetail(row);
  } catch (e) {
    /* 拦截器处理 */
  }
};

/* 业绩明细按需加载：打开弹窗只拉工资明细（快），首次切到业绩 tab 才拉全期业绩明细（几千条） */
const perfLoading = ref({ newSign: false, commission: false });
const loadedPerfPeriod = ref<{ newSign: string; commission: string }>({ newSign: '', commission: '' });

const ensureNewSignLoaded = async () => {
  const period = currentBatch.value?.period;
  if (!period || loadedPerfPeriod.value.newSign === period) return;
  perfLoading.value.newSign = true;
  try {
    const res = await orgCommissionTraceApi.allNewSign(period).catch(() => ({ data: [] }));
    newSignItems.value = (res as any).data ?? [];
    loadedPerfPeriod.value.newSign = period;
  } finally {
    perfLoading.value.newSign = false;
  }
};
const ensureCommissionLoaded = async () => {
  const period = currentBatch.value?.period;
  if (!period || loadedPerfPeriod.value.commission === period) return;
  perfLoading.value.commission = true;
  try {
    const res = await orgCommissionTraceApi.allCommission(period).catch(() => ({ data: [] }));
    commissionItems.value = (res as any).data ?? [];
    loadedPerfPeriod.value.commission = period;
  } finally {
    perfLoading.value.commission = false;
  }
};

// 首次切到业绩 tab 时触发对应接口（同批次幂等，不重复拉取）
watch(detailTab, (name) => {
  if (name === 'NEWSIGN') ensureNewSignLoaded();
  if (name === 'COMMISSION') ensureCommissionLoaded();
});

const viewDetail = async (row: PayrollBatch) => {
  currentBatch.value = row;
  detailVisible.value = true;
  loadedPerfPeriod.value = { newSign: '', commission: '' };
  const res = await payrollApi.getDetails(row.id);
  details.value = (res as any).data ?? [];
  // 打开前已停在业绩 tab 时（页签缓存复用/工作流跳转场景）立即补拉
  if (detailTab.value === 'NEWSIGN') ensureNewSignLoaded();
  if (detailTab.value === 'COMMISSION') ensureCommissionLoaded();
};

const closeDetail = () => {
  detailVisible.value = false;
  currentBatch.value = null;
  details.value = [];
  newSignItems.value = [];
  commissionItems.value = [];
  loadedPerfPeriod.value = { newSign: '', commission: '' };
  [ag, mf, df, nsf, cf, hf, pf].forEach((t) => t.reset());
};

// 工作流跳转：查看态加载批次与明细（审批办理已改为「我的待办」原地弹窗）
const openFromWorkflow = async () => {
  const id = route.query.id as string;
  const type = route.query.type as string;
  if (!id || !type) return;
  try {
    const res: any = await payrollApi.getBatch(Number(id));
    currentBatch.value = res.data;
    const detRes = await payrollApi.getDetails(Number(id));
    details.value = (detRes as any).data ?? [];
    detailVisible.value = true;
  } catch {
    ElMessage.error('加载批次失败');
  }
};

const summaryMethod = ({ columns }: any) => {
  const sums: string[] = [];
  // 工资表 sheet：与导出一致，仅对有 prop 的金额列求和
  // 底薪列无 prop（经纪人取 baseSalary，店长取 teamIncome + guaranteeFill），单独处理
  // 合计 = 当前筛选视图全量口径（分页后 data 只是当前页），跨页一致
  const data = ag.filtered;
  const moneyProps = ['commissionIncome', 'mentorBonus', 'bonus', 'pointsFee', 'gross', 'socialFee', 'housingFund', 'commercialInsurance', 'dormitoryFee', 'net', 'tax'];
  const deductProps = new Set(['pointsFee', 'socialFee', 'housingFund', 'commercialInsurance', 'dormitoryFee', 'tax']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop && moneyProps.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else if (col.label === '底薪') {
      const total = data.reduce((s: number, r: any) => s + baseSalaryOf(r), 0);
      sums[idx] = fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

const managerSummary = ({ columns }: any) => {
  const sums: string[] = [];
  // 店长 sheet 金额列（不含 gross：店长工资 = teamIncome + guaranteeFill，不含结佣提成和个人新签递延）
  // 合计 = 当前筛选视图全量口径（分页后 data 只是当前页）
  const data = mf.filtered;
  const moneyProps = ['deptNewSignTotal', 'deptEmployerSocialTotal', 'teamIncome', 'personalNewsignIncome', 'minSalary', 'guaranteeFill', 'otherDeduct'];
  const deductProps = new Set(['deptEmployerSocialTotal', 'otherDeduct']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop === 'gross') {
      // 店长工资 = teamIncome + guaranteeFill（保底补足），不含结佣提成和个人新签递延
      const total = data.reduce((s: number, r: any) => s + (Number(r.teamIncome) || 0) + (Number(r.guaranteeFill) || 0), 0);
      sums[idx] = fmt(total);
    } else if (prop && moneyProps.includes(prop)) {
      const total = data.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

const directorSummary = ({ columns }: any) => {
  const sums: string[] = [];
  // 只汇总顶层汇总行（_isSummary），避免子行 double-count
  // 合计 = 当前筛选视图全量口径（分页后 data 只是当前页顶层行）
  const topRows = df.filtered;
  const moneyProps = ['deptNewSignTotal', 'deptEmployerSocialTotal', 'storeIncome', 'baseSalary', 'fullAttendance', 'bonus', 'commissionPerformance', 'commissionIncome', 'mentorBonus', 'socialFee', 'housingFund', 'commercialInsurance', 'gross', 'tax', 'net'];
  const deductProps = new Set(['deptEmployerSocialTotal', 'socialFee', 'housingFund', 'commercialInsurance', 'tax']);
  columns.forEach((col: any, idx: number) => {
    if (idx === 0) {
      sums[idx] = '合计';
      return;
    }
    const prop = col.property;
    if (prop && moneyProps.includes(prop)) {
      const total = topRows.reduce((s: number, r: any) => s + (Number(r[prop]) || 0), 0);
      sums[idx] = deductProps.has(prop) ? neg(total) : fmt(total);
    } else {
      sums[idx] = '';
    }
  });
  return sums;
};

/* ───────────── 导出（xlsx 七 sheet：工资表/新签业绩/结佣业绩/店长/总监/人事/绩效） ───────────── */
const exportExcel = async () => {
  if (!details.value.length) return;
  // 兜底补拉业绩明细（若未打开过对应 tab），保证 7 sheet 导出完整
  await Promise.all([ensureNewSignLoaded(), ensureCommissionLoaded()]);
  const extra: ExportExtraData = {
    newSignItems: newSignItems.value,
    commissionItems: commissionItems.value,
  };
  exportMultiSheet(details.value, currentBatch.value?.period || '', undefined, extra);
  ElMessage.success('导出成功');
};

// 页签缓存复用场景下补开单据（详见 useWorkflowRouteOpen 注释）
useWorkflowRouteOpen('/payroll/batch', openFromWorkflow);

onMounted(() => {
  loadBatches();
  loadDeptTree();
});
</script>

<style scoped>
.payroll-batch { padding: 12px; }

.table-actions {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.scope-text {
  color: var(--el-text-color-regular);
}

.detail-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 12px;
}

.tab-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.tab-pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.text-primary {
  color: var(--el-color-primary);
}
</style>
