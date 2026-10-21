<template>
  <div class="p-2 app-container people-employee-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="工号" prop="employeeCode">
          <el-input
            v-model="queryParams.employeeCode"
            placeholder="请输入工号"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="姓名" prop="employeeName">
          <el-input
            v-model="queryParams.employeeName"
            placeholder="请输入姓名"
            clearable
            style="width: 160px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="门店/组别" prop="deptId">
          <PanjiaDeptSelect
            v-model="queryParams.deptId"
            :scope="false"
            width="220px"
            placeholder="请选择门店/组别"
          />
        </el-form-item>
        <el-form-item label="职位" prop="postName">
          <el-select v-model="queryParams.postName" placeholder="请选择职位" clearable style="width: 160px">
            <el-option v-for="opt in postOptionsData" :key="opt.postId" :label="opt.postName" :value="opt.postName" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select
            v-model="queryParams.status"
            placeholder="请选择状态"
            multiple
            collapse-tags
            collapse-tags-tooltip
            clearable
            style="width: 180px"
          >
            <el-option
              v-for="dict in panjia_employee_status"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-select v-model="queryParams.gender" placeholder="请选择性别" clearable style="width: 120px">
            <el-option
              v-for="dict in panjia_employee_gender"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="入职时间" prop="hireDateRange">
          <el-date-picker
            v-model="queryParams.hireDateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="-"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            style="width: 240px"
          />
        </el-form-item>
        <el-form-item label="排序" prop="sortSel">
          <el-select v-model="sortSel" placeholder="默认排序" clearable style="width: 170px" @change="handleQuery">
            <el-option label="入职时间 从早到晚" value="hireDate_asc" />
            <el-option label="入职时间 从晚到早" value="hireDate_desc" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 员工列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Employee Dataset</span>
            <h3>员工管理</h3>
            <p>共 {{ total }} 名员工。员工事实数据（职级/社保/伯乐等）变更全程留痕，离职仅停用不删除。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['people:employee:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新增员工
            </el-button>
            <el-button
              v-hasPermi="['people:employee:import']"
              type="success"
              plain
              icon="Upload"
              @click="handleImport"
            >
              导入员工
            </el-button>
            <el-button
              v-hasPermi="['people:employee:list']"
              type="primary"
              plain
              icon="Download"
              @click="handleExport"
            >
              导出
            </el-button>
            <el-button
              v-hasPermi="['people:employee:reconcile']"
              type="warning"
              plain
              icon="RefreshRight"
              :loading="reconcileLoading"
              @click="handleReconcile"
            >
              账户对齐
            </el-button>
            <el-button v-hasPermi="['people:employee:add']" type="info" plain icon="User" @click="handleVirtualOpen">
              店组虚拟人
            </el-button>
          </div>
        </div>
      </template>

      <!-- 合同到期提醒条：已到期未重签（error）+ 30 天内到期（warning） -->
      <template v-if="expiringList.length">
        <el-alert
          type="error"
          show-icon
          :closable="true"
          class="contract-alert"
        >
          <template #title>
            <b>{{ expiredCount }} 名员工合同已到期未重签</b>
          </template>
          <div v-for="item in expiredRows" :key="`e-${item.employeeId}-${item.contractType}`" class="contract-alert-row">
            {{ item.employeeName }}（{{ item.employeeCode }}）· {{ item.deptName || '—' }} ·
            {{ contractTypeLabel(item.contractType) }} · 到期日 {{ item.endDate }}
          </div>
        </el-alert>
        <el-alert type="warning" show-icon :closable="true" class="contract-alert">
          <template #title>
            <b>{{ expiringCount }} 名员工合同 30 天内到期，请及时安排续签</b>
          </template>
          <div v-for="item in expiringRows" :key="`w-${item.employeeId}-${item.contractType}`" class="contract-alert-row">
            {{ item.employeeName }}（{{ item.employeeCode }}）· {{ item.deptName || '—' }} ·
            {{ contractTypeLabel(item.contractType) }} · 到期日 {{ item.endDate }}
          </div>
        </el-alert>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="employeeList">
        <el-table-column label="工号" align="center" prop="employeeCode" width="110" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
        <el-table-column label="性别" align="center" prop="gender" width="70">
          <template #default="scope">
            <dict-tag :options="panjia_employee_gender" :value="scope.row.gender" />
          </template>
        </el-table-column>
        <el-table-column label="门店/组别" align="center" prop="deptName" min-width="160" show-overflow-tooltip />
        <el-table-column label="职位" align="center" min-width="140">
          <template #default="scope">
            <el-tag
              v-for="name in scope.row.postNames || []"
              :key="name"
              size="small"
              class="post-tag"
            >
              {{ name }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="职级" align="center" prop="levelCode" width="80">
          <template #default="scope">
            <dict-tag :options="panjia_employee_level" :value="scope.row.levelCode" />
          </template>
        </el-table-column>
        <el-table-column label="社保" align="center" prop="socialInsured" width="70">
          <template #default="scope">
            <el-tag :type="scope.row.socialInsured ? 'success' : 'info'" size="small">
              {{ scope.row.socialInsured ? '✓' : '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="公积金" align="center" prop="housingInsured" width="80">
          <template #default="scope">
            <el-tag :type="scope.row.housingInsured ? 'success' : 'info'" size="small">
              {{ scope.row.housingInsured ? '✓' : '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="商保" align="center" prop="commercialInsured" width="70">
          <template #default="scope">
            <el-tag :type="scope.row.commercialInsured ? 'success' : 'info'" size="small">
              {{ scope.row.commercialInsured ? '✓' : '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="宿舍" align="center" prop="dormitory" width="70">
          <template #default="scope">
            <el-tag :type="scope.row.dormitory ? 'success' : 'info'" size="small">
              {{ scope.row.dormitory ? '✓' : '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="兼职" align="center" prop="isPartTime" width="70">
          <template #default="scope">
            <el-tag :type="scope.row.isPartTime ? 'warning' : 'info'" size="small">
              {{ scope.row.isPartTime ? '✓' : '—' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" align="center" prop="status" width="90">
          <template #default="scope">
            <dict-tag :options="panjia_employee_status" :value="scope.row.status" />
          </template>
        </el-table-column>
        <el-table-column label="入职日期" align="center" prop="hireDate" width="110" />
        <el-table-column label="操作" align="center" width="160" fixed="right" class-name="small-padding fixed-width">
          <template #default="scope">
            <el-tooltip content="详情/变更记录" placement="top">
              <el-button link type="primary" icon="View" @click="handleDetail(scope.row as Employee)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['people:employee:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row as Employee)"
              ></el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>

      <pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        @pagination="getList"
      />
    </el-card>

    <!-- 新增 / 修改员工 -->
    <el-dialog v-model="formDialog.visible" :title="formDialog.title" width="760px" append-to-body @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-divider content-position="left">基本信息</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="工号" prop="employeeCode">
              <el-input
                v-model="form.employeeCode"
                placeholder="工号 = 系统登录账号"
                :disabled="formDialog.isEdit"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="姓名" prop="employeeName">
              <el-input v-model="form.employeeName" placeholder="请输入姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="门店/组别" prop="deptId">
              <PanjiaDeptSelect
                v-model="form.deptId"
                :scope="false"
                :clearable="false"
                placeholder="请选择门店/组别"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="职位" prop="postNames">
              <el-select
                v-model="form.postNames"
                multiple
                collapse-tags
                collapse-tags-tooltip
                placeholder="可多选，多岗位 1:1 绑定同名角色"
                style="width: 100%"
              >
                <el-option v-for="opt in postOptionsData" :key="opt.postId" :label="opt.postName" :value="opt.postName" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="手机号" prop="phone">
              <el-input v-model="form.phone" placeholder="请输入手机号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="身份证号" prop="idCard">
              <el-input v-model="form.idCard" placeholder="请输入身份证号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="户口所在地" prop="residence">
              <el-input v-model="form.residence" placeholder="请输入户口所在地" maxlength="200" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="现住地址" prop="currentAddress">
              <el-input v-model="form.currentAddress" placeholder="请输入现住地址" maxlength="200" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="性别" prop="gender">
              <el-radio-group v-model="form.gender">
                <el-radio v-for="dict in panjia_employee_gender" :key="dict.value" :value="dict.value">
                  {{ dict.label }}
                </el-radio>
              </el-radio-group>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开户银行" prop="bankName">
              <el-input v-model="form.bankName" placeholder="工资卡开户银行" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="开户支行" prop="bankBranch">
              <el-input v-model="form.bankBranch" placeholder="工资卡开户支行" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工资卡号" prop="bankCardNo">
              <el-input v-model="form.bankCardNo" placeholder="本人银行卡号" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="报道日期" prop="reportDate">
              <el-date-picker
                v-model="form.reportDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择报道日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="入职日期" prop="hireDate">
              <el-date-picker
                v-model="form.hireDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择入职日期（算薪事实生效日）"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" prop="status">
              <el-select v-model="form.status" placeholder="请选择状态" style="width: 100%">
                <el-option
                  v-for="dict in editableStatusOptions"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="form.status === 'LEFT'">
            <el-form-item label="离职日期" prop="leaveDate">
              <el-date-picker
                v-model="form.leaveDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="选择离职日期"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="24">
            <el-form-item label="备注" prop="remark">
              <el-input v-model="form.remark" type="textarea" placeholder="请输入备注" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider content-position="left">算薪配置（事实数据，变更留痕）</el-divider>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="职级" prop="levelCode">
              <el-select v-model="form.levelCode" placeholder="请选择职级" style="width: 100%">
                <el-option
                  v-for="dict in panjia_employee_level"
                  :key="dict.value"
                  :label="dict.label"
                  :value="dict.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="伯乐工号" prop="mentorCode">
              <el-input v-model="form.mentorCode" placeholder="填伯乐工号；留空表示无伯乐，清空即解除" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="缴社保" prop="socialInsured">
              <el-switch v-model="form.socialInsured" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="缴公积金" prop="housingInsured">
              <el-switch v-model="form.housingInsured" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="商业保险" prop="commercialInsured">
              <el-switch v-model="form.commercialInsured" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="住宿舍" prop="dormitory">
              <el-switch v-model="form.dormitory" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="兼职" prop="parttime">
              <el-switch v-model="form.parttime" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <!-- 只影响所在组店长的团队提成与其社保计缴人数；总监跳点用原始口径不受影响；不影响本人提成 -->
            <el-form-item label="不计入店长团队" prop="excludeTeam">
              <el-switch v-model="form.excludeTeam" />
            </el-form-item>
          </el-col>
          <el-col :span="8" v-if="formDialog.isEdit">
            <el-form-item label="绩效方案" prop="perfSchemeCode">
              <!-- 按适用岗位过滤（店长专用方案仅店长可见）；空=默认积分绩效 -->
              <el-select v-model="form.perfSchemeCode" clearable placeholder="默认（积分绩效）" style="width:100%">
                <el-option
                  v-for="s in schemeOptionsForForm"
                  :key="s.code"
                  :label="`${s.name}（${schemeTypeLabel(s.schemeType)}）`"
                  :value="s.code"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="form.socialInsured">
            <el-form-item label="社保金额">
              <el-input-number v-model="form.socialFee" :min="0" :precision="2" :controls="false" style="width:100%" />
              <span class="form-tip" style="margin-left:8px">元/月，不填用全局默认</span>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="form.commercialInsured">
            <el-form-item label="商业保险金额">
              <el-input-number v-model="form.commercialFee" :min="0" :precision="2" :controls="false" style="width:100%" />
              <span class="form-tip" style="margin-left:8px">元/月，不填用全局默认</span>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="form.housingInsured">
            <el-form-item label="公积金金额">
              <el-input-number v-model="form.housingFund" :min="0" :precision="2" :controls="false" style="width:100%" />
              <span class="form-tip" style="margin-left:8px">元/月，不填用全局默认</span>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="form.dormitory">
            <el-form-item label="宿舍费金额">
              <el-input-number v-model="form.dormitoryFee" :min="0" :precision="2" :controls="false" style="width:100%" />
              <span class="form-tip" style="margin-left:8px">元/月，不填用全局默认</span>
            </el-form-item>
          </el-col>
          <el-col :span="12" v-if="formDialog.isEdit">
            <el-form-item label="变更生效月" prop="effectiveDate">
              <!-- 生效粒度 = 月（算薪按月）：月选择器，落库为当月 1 日 -->
              <el-date-picker
                v-model="form.effectiveDate"
                type="month"
                format="YYYY-MM"
                value-format="YYYY-MM-DD"
                placeholder="改算薪配置必填；仅改基本信息请留空"
                style="width: 100%"
              />
              <span class="form-tip" style="margin-left:8px">留空则仅保存基本信息，算薪配置不变</span>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" :loading="submitLoading" @click="submitForm">确 定</el-button>
          <el-button @click="formDialog.visible = false">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" :title="`员工详情 - ${detailData?.employeeName ?? ''}`" width="780px" append-to-body>
      <template v-if="detailData">
        <el-descriptions title="基本信息" :column="2" border>
          <el-descriptions-item label="工号">{{ detailData.employeeCode }}</el-descriptions-item>
          <el-descriptions-item label="姓名">{{ detailData.employeeName }}</el-descriptions-item>
          <el-descriptions-item label="门店/组别" :span="2">{{ detailData.deptName }}</el-descriptions-item>
          <el-descriptions-item label="职位" :span="2">
            <el-tag v-for="name in detailData.postNames || []" :key="name" size="small" class="post-tag">
              {{ name }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="手机号">{{ detailData.phone || '—' }}</el-descriptions-item>
          <el-descriptions-item label="身份证号">{{ detailData.idCard || '—' }}</el-descriptions-item>
          <el-descriptions-item label="户口所在地">{{ detailData.residence || '—' }}</el-descriptions-item>
          <el-descriptions-item label="现住地址">{{ detailData.currentAddress || '—' }}</el-descriptions-item>
          <el-descriptions-item label="性别">
            <dict-tag :options="panjia_employee_gender" :value="detailData.gender" />
          </el-descriptions-item>
          <el-descriptions-item label="开户银行">{{ detailData.bankName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="开户支行">{{ detailData.bankBranch || '—' }}</el-descriptions-item>
          <el-descriptions-item label="工资卡号">{{ detailData.bankCardNo || '—' }}</el-descriptions-item>
          <el-descriptions-item label="报道日期">{{ detailData.reportDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="入职日期">{{ detailData.hireDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="离职日期">{{ detailData.leaveDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <dict-tag :options="panjia_employee_status" :value="detailData.status" />
          </el-descriptions-item>
          <el-descriptions-item label="伯乐">
            {{ detailData.mentorName ? `${detailData.mentorName}（${detailData.mentorCode}）` : '无伯乐' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注" :span="2">{{ detailData.remark || '—' }}</el-descriptions-item>
        </el-descriptions>

        <el-descriptions title="算薪配置（当前态）" :column="2" border class="detail-section">
          <el-descriptions-item label="职级">
            <dict-tag :options="panjia_employee_level" :value="detailData.levelCode" />
          </el-descriptions-item>
          <el-descriptions-item label="兼职">
            <el-tag :type="detailData.isPartTime ? 'warning' : 'info'" size="small">
              {{ detailData.isPartTime ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="不计入店长团队">
            <el-tag :type="detailData.excludeTeam ? 'danger' : 'info'" size="small">
              {{ detailData.excludeTeam ? '是' : '否' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="绩效方案">
            <span v-if="detailData.perfSchemeCode">
              {{ perfSchemeOptions.find((s) => s.code === detailData.perfSchemeCode)?.name ?? detailData.perfSchemeCode }}
            </span>
            <el-tag v-else type="info" size="small">默认（积分绩效）</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="社保">
            <el-tag :type="detailData.socialInsured ? 'success' : 'info'" size="small">
              {{ detailData.socialInsured ? '已缴' : '未缴' }}
            </el-tag>
            <span v-if="detailData.socialInsured && detailData.socialFee" class="detail-amount">
              {{ detailData.socialFee }} 元/月
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="公积金">
            <el-tag :type="detailData.housingInsured ? 'success' : 'info'" size="small">
              {{ detailData.housingInsured ? '已缴' : '未缴' }}
            </el-tag>
            <span v-if="detailData.housingInsured && detailData.housingFund" class="detail-amount">
              {{ detailData.housingFund }} 元/月
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="商业保险">
            <el-tag :type="detailData.commercialInsured ? 'success' : 'info'" size="small">
              {{ detailData.commercialInsured ? '已买' : '未买' }}
            </el-tag>
            <span v-if="detailData.commercialInsured && detailData.commercialFee" class="detail-amount">
              {{ detailData.commercialFee }} 元/月
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="宿舍">
            <el-tag :type="detailData.dormitory ? 'success' : 'info'" size="small">
              {{ detailData.dormitory ? '住' : '不住' }}
            </el-tag>
            <span v-if="detailData.dormitory && detailData.dormitoryFee" class="detail-amount">
              {{ detailData.dormitoryFee }} 元/月
            </span>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <h4 class="history-header">
            <span>变更记录</span>
            <!-- 调整生效月：值不变，仅平移所选变更项当前生效记录的生效月（更正录入时选错月份） -->
            <el-button size="small" type="primary" plain @click="openAdjust">调整生效月</el-button>
          </h4>
          <el-table v-loading="historyLoading" border :data="historyData" size="small">
            <el-table-column label="生效月" prop="effectiveDate" width="100" align="center">
              <template #default="scope">{{ (scope.row.effectiveDate || '').slice(0, 7) }}</template>
            </el-table-column>
            <el-table-column label="变更项" prop="changeFieldName" width="90" align="center" />
            <el-table-column label="变更前" prop="beforeValue" min-width="100" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.beforeValue || '—' }}</template>
            </el-table-column>
            <el-table-column label="变更后" prop="afterValue" min-width="100" show-overflow-tooltip>
              <template #default="scope">{{ scope.row.afterValue || '—' }}</template>
            </el-table-column>
            <el-table-column label="操作人" prop="operatorName" width="90" align="center">
              <template #default="scope">{{ scope.row.operatorName || '系统' }}</template>
            </el-table-column>
          </el-table>
        </div>
      </template>
      <template #footer>
        <el-button @click="detailVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- 调整生效月（值不变，仅平移生效月；用于更正录入时选错生效月的场景） -->
    <el-dialog v-model="adjustVisible" title="调整生效月" width="520px" append-to-body>
      <el-alert
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 14px"
        title="不修改变更项的值，仅把其当前生效中的记录平移到新生效月；算薪批次为快照，调整后需重算对应批次才生效"
      />
      <el-form label-width="90px">
        <el-form-item label="变更项">
          <el-select
            v-model="adjustForm.factTypes"
            multiple
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择要调整的变更项（可多选）"
            style="width: 100%"
          >
            <el-option label="全部项" value="ALL" />
            <el-option v-for="t in FACT_TYPE_OPTIONS" :key="t.code" :label="t.desc" :value="t.code" />
          </el-select>
        </el-form-item>
        <el-form-item label="新生效月">
          <!-- 生效粒度 = 月：月选择器，提交当月 1 日 -->
          <el-date-picker
            v-model="adjustForm.newDate"
            type="month"
            format="YYYY-MM"
            value-format="YYYY-MM-DD"
            placeholder="选择新的生效月份"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="adjustVisible = false">取 消</el-button>
        <el-button type="primary" :loading="adjusting" @click="submitAdjust">确 定</el-button>
      </template>
    </el-dialog>

    <!-- 对账结果 -->
    <el-dialog v-model="reconcileDialog.visible" title="员工-账户对齐结果" width="780px" append-to-body>
      <el-alert
        v-if="reconcileResult"
        :title="`共扫描 ${reconcileResult.totalEmployees} 名员工账户，自动修复 ${reconcileResult.fixedCount} 处差异`"
        :type="reconcileResult.fixedCount > 0 ? 'warning' : 'success'"
        :closable="false"
        show-icon
        class="reconcile-alert"
      />
      <el-table v-if="reconcileResult" border :data="reconcileResult.items" size="small" max-height="420">
        <el-table-column label="工号" prop="employeeCode" width="110" align="center" />
        <el-table-column label="姓名" prop="employeeName" width="90" align="center" />
        <el-table-column label="差异项" prop="field" width="110" align="center">
          <template #default="scope">
            <el-tag size="small" :type="fieldTagType(scope.row.field)">{{ fieldLabel(scope.row.field) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="修复前" prop="beforeValue" min-width="120" show-overflow-tooltip />
        <el-table-column label="修复后" prop="afterValue" min-width="120" show-overflow-tooltip />
      </el-table>
      <template #footer>
        <el-button type="primary" @click="reconcileDialog.visible = false">知道了</el-button>
      </template>
    </el-dialog>

    <!-- 店组虚拟人一键新建 -->
    <el-dialog v-model="virtualDialog.visible" title="店组虚拟人初始化" width="860px" append-to-body>
      <el-alert type="info" :closable="false" show-icon class="virtual-tip">
        <template #title>
          贝壳新签经纪人为空时按店组编码挂靠虚拟人。勾选店组并填写编码（如 CD_15_1696157），
          一键写入编码并补建虚拟人（工号 = 编码，姓名 = 部门名，不建登录账户）。已存在的自动跳过。
        </template>
      </el-alert>
      <el-table
        ref="virtualTableRef"
        v-loading="virtualDialog.loading"
        border
        :data="virtualDialog.rows"
        size="small"
        max-height="440"
        @selection-change="handleVirtualSelectionChange"
      >
        <el-table-column type="selection" width="45" align="center" :selectable="(row: VirtualEmployeeCandidate) => !row.hasVirtual" />
        <el-table-column label="门店/组别" prop="deptFullName" min-width="200" show-overflow-tooltip />
        <el-table-column label="店组编码" min-width="180">
          <template #default="scope">
            <el-input
              v-model="scope.row.deptCategory"
              :disabled="scope.row.hasVirtual"
              placeholder="如 CD_15_1696157"
              size="small"
              clearable
            />
          </template>
        </el-table-column>
        <el-table-column label="虚拟人" width="90" align="center">
          <template #default="scope">
            <el-tag v-if="scope.row.hasVirtual" type="success" size="small">已有</el-tag>
            <el-tag v-else-if="scope.row.deptCategory" type="warning" size="small">待建</el-tag>
            <el-tag v-else type="info" size="small">未配编码</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="virtualDialog.visible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="virtualDialog.submitting"
          :disabled="virtualSelections.length === 0"
          @click="handleVirtualSubmit"
        >
          一键新建（{{ virtualSelections.length }}）
        </el-button>
      </template>
    </el-dialog>

    <!-- 员工导入 -->
    <el-dialog v-model="importDialog.visible" title="员工导入" width="680px" append-to-body @closed="resetImport">
      <div v-loading="importDialog.loading" element-loading-text="正在上传文件，请稍候..." class="import-dialog-body">
      <!-- 上传区 -->
      <el-upload
        v-if="!importDialog.batchId"
        ref="importUploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-exceed="() => modal.msgWarning('一次只能上传一个文件')"
        :on-change="handleImportFileChange"
        :disabled="importDialog.loading"
        drag
        class="import-upload"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx / .xls / .csv 格式；模板字段：大区/门店/小组（按层级拆分）、工号、姓名、职位、职级、入职时间、社保/公积金/商保/宿舍/兼职、伯乐工号
          </div>
        </template>
      </el-upload>
      <div v-if="importDialog.file" class="import-file-info">
        <el-icon><Document /></el-icon>
        <span>{{ importDialog.file.name }}</span>
        <el-button link type="danger" icon="Delete" @click="importDialog.file = null">移除</el-button>
      </div>
      <!-- 生效时间：已有工号覆盖导入时算薪数据切换基准，新员工不受影响 -->
      <div v-if="!importDialog.batchId" class="import-effective">
        <span class="label">生效时间：</span>
        <el-date-picker
          v-model="importDialog.effectiveDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="不选默认当前时间"
          clearable
          :disabled="importDialog.loading"
          style="width: 180px"
        />
        <span class="tip">已有工号覆盖导入时算薪数据的切换基准，新员工不受影响</span>
      </div>
      <div v-if="!importDialog.batchId" class="import-actions">
        <el-button
          type="primary"
          icon="Upload"
          :loading="importDialog.loading"
          :disabled="!importDialog.file"
          @click="doImportUpload"
        >
          开始导入
        </el-button>
        <el-button icon="Download" @click="downloadTemplate">
          下载模板
        </el-button>
      </div>

      <!-- 导入进度（PARSING/VALIDATING/IMPORTING） -->
      <div v-if="importDialog.batchId && needPolling(importDialog.batchStatus)" class="import-progress">
        <el-result
          icon="info"
          :title="importStatusText(importDialog.batchStatus)"
          :sub-title="`批次号: ${importDialog.batchNo} | 总行数: ${importDialog.totalRows}`"
        />
        <div class="progress-bar-wrap">
          <el-progress
            :percentage="importDialog.totalRows ? Math.round(importDialog.successRows / importDialog.totalRows * 100) : 0"
            :stroke-width="10"
            :indeterminate="importDialog.successRows === 0"
          />
          <p class="progress-text">已处理 {{ importDialog.successRows }} / {{ importDialog.totalRows }} 行</p>
        </div>
      </div>

      <!-- 导入结果（SUCCESS/FAILED） -->
      <div v-if="importDialog.batchId && (importDialog.batchStatus === 'SUCCESS' || importDialog.batchStatus === 'FAILED')" class="import-result">
        <el-result
          :icon="importDialog.batchStatus === 'SUCCESS' ? 'success' : 'error'"
          :title="importDialog.batchStatus === 'SUCCESS' ? '导入成功' : '导入失败'"
          :sub-title="`批次号: ${importDialog.batchNo} | 总行数: ${importDialog.totalRows} | 成功: ${importDialog.successRows} | 失败: ${importDialog.failedRows}`"
        />
        <div v-if="importDialog.batchStatus === 'FAILED' && importDialog.issues.length" class="issue-list">
          <el-table border :data="importDialog.issues" size="small" max-height="280">
            <el-table-column label="行号" prop="rowNo" width="60" align="center" />
            <el-table-column label="问题类型" prop="issueType" width="160" align="center">
              <template #default="scope">
                <el-tag size="small" :type="issueTagType(scope.row.issueType)">{{ issueLabel(scope.row.issueType) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="字段" prop="fieldName" width="120" show-overflow-tooltip />
            <el-table-column label="原始值" prop="rawValue" width="120" show-overflow-tooltip />
            <el-table-column label="说明" prop="message" min-width="200" show-overflow-tooltip />
          </el-table>
        </div>
      </div>
      </div>

      <template #footer>
        <el-button @click="importDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PeopleEmployee" lang="ts">
import { computed, onMounted, onUnmounted, nextTick, ref } from 'vue';
import { employeeApi } from '@/api/panjia/employee';
import { contractApi } from '@/api/panjia/contract';
import type { PerfScheme } from '@/api/panjia/payroll';
import type {
  ContractExpiring,
  Employee,
  EmployeeChangeLog,
  EmployeeCreateForm,
  EmployeeQuery,
  EmployeeUpdateForm,
  PageResult,
  PeopleImportBatch,
  PeopleImportIssue,
  PostOption,
  ReconcileResult,
  VirtualEmployeeCandidate
} from '@/api/panjia/types';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { UploadFilled, Document } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';

const { panjia_employee_level, panjia_employee_status, panjia_employee_gender } = toRefs<any>(
  useDict('panjia_employee_level', 'panjia_employee_status', 'panjia_employee_gender')
);

/** 编辑表单可选状态（排除「虚拟」，虚拟员工只能通过店组虚拟人功能创建） */
const editableStatusOptions = computed(() =>
  (panjia_employee_status.value ?? []).filter((d: any) => d.value !== 'VIRTUAL')
);

/** 合同类型中文（到期提醒条展示用，与字典 panjia_contract_type 对应） */
const CONTRACT_TYPE_LABELS: Record<string, string> = {
  LABOR: '劳动合同',
  PARTTIME: '兼职合同',
  OTHER: '其他'
};
const contractTypeLabel = (type: string) => CONTRACT_TYPE_LABELS[type] ?? type;

// ==================== 列表 ====================
/** 默认展示状态：离职默认不显示，需主动勾选「离职」才可见 */
const DEFAULT_STATUS = ['ACTIVE', 'PARTTIME', 'PENDING'];
const loading = ref(false);
const employeeList = ref<Employee[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();
const sortSel = ref('');
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: undefined as string | undefined,
  postName: '',
  status: [...DEFAULT_STATUS] as string[],
  gender: '',
  hireDateRange: [] as string[]
});

const getList = async () => {
  loading.value = true;
  try {
    const { hireDateRange, ...rest } = queryParams;
    const [hireDateBegin, hireDateEnd] = hireDateRange || [];
    const [sortField, sortOrder] = (sortSel.value || '').split('_');
    const res = await employeeApi.list({
      ...rest,
      hireDateBegin: hireDateBegin || undefined,
      hireDateEnd: hireDateEnd || undefined,
      sortField: sortField || undefined,
      sortOrder: sortOrder || undefined
    });
    employeeList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } finally {
    loading.value = false;
  }
};

const handleQuery = () => {
  queryParams.pageNum = 1;
  getList();
};

const resetQuery = () => {
  queryFormRef.value?.resetFields();
  queryParams.deptId = undefined;
  queryParams.postName = '';
  queryParams.status = [...DEFAULT_STATUS];
  queryParams.gender = '';
  queryParams.hireDateRange = [];
  sortSel.value = '';
  handleQuery();
};

// ==================== 合同到期提醒（提前 30 天） ====================
const expiringList = ref<ContractExpiring[]>([]);
/** 已到期未重签 */
const expiredRows = computed(() => expiringList.value.filter((i) => i.expired));
/** 30 天内到期 */
const expiringRows = computed(() => expiringList.value.filter((i) => !i.expired));
const expiredCount = computed(() => expiredRows.value.length);
const expiringCount = computed(() => expiringRows.value.length);

const loadExpiring = async () => {
  try {
    const res = await contractApi.expiring();
    expiringList.value = res.data ?? [];
  } catch (e) {
    // 无 people:contract:list 权限（如店长）时静默忽略，提醒条不展示
    expiringList.value = [];
  }
};

// ==================== 选项数据 ====================
const postOptionsData = ref<PostOption[]>([]);

const loadOptions = async () => {
  try {
    const posts = await employeeApi.postOptions();
    postOptionsData.value = posts.data ?? [];
  } catch (e) {
    console.error('[people] postOptions 加载失败', e);
  }
};

// ==================== 新增 / 修改 ====================
const formRef = ref<ElFormInstance>();
const submitLoading = ref(false);
const formDialog = reactive({ visible: false, title: '', isEdit: false });
const editingEmployeeId = ref<string | number>('');

const initForm = (): EmployeeCreateForm & EmployeeUpdateForm => ({
  employeeCode: '',
  employeeName: '',
  deptId: '',
  postNames: [],
  levelCode: '',
  phone: '',
  idCard: '',
  residence: '',
  currentAddress: '',
  gender: '',
  bankName: '',
  bankBranch: '',
  bankCardNo: '',
  reportDate: '',
  hireDate: '',
  status: 'ACTIVE',
  socialInsured: false,
  housingInsured: false,
  commercialInsured: false,
  dormitory: false,
  parttime: false,
  excludeTeam: false,
  perfSchemeCode: '',
  mentorCode: '',
  remark: '',
  socialFee: undefined,
  commercialFee: undefined,
  housingFund: undefined,
  dormitoryFee: undefined,
  effectiveDate: undefined
});

const form = reactive<EmployeeCreateForm & EmployeeUpdateForm>({ ...initForm() });

const rules = {
  employeeCode: [{ required: true, message: '工号不能为空', trigger: 'blur' }],
  employeeName: [{ required: true, message: '姓名不能为空', trigger: 'blur' }],
  deptId: [{ required: true, message: '请选择门店/组别', trigger: 'change' }],
  postNames: [{ required: true, message: '请至少选择一个职位', trigger: 'change' }],
  levelCode: [{ required: true, message: '请选择职级', trigger: 'change' }],
  hireDate: [{ required: true, message: '请选择入职日期', trigger: 'change' }]
};

const resetForm = () => {
  Object.assign(form, initForm());
  form.effectiveDate = undefined;
  form.leaveDate = undefined;
  formRef.value?.clearValidate();
};

const handleAdd = () => {
  resetForm();
  editingEmployeeId.value = '';
  formDialog.isEdit = false;
  formDialog.title = '新增员工';
  formDialog.visible = true;
};

const handleUpdate = async (row: Employee) => {
  resetForm();
  const res = await employeeApi.getById(row.employeeId);
  const detail = res.data;
  if (!detail) {
    return;
  }
  editingEmployeeId.value = detail.employeeId;
  form.employeeCode = detail.employeeCode;
  form.employeeName = detail.employeeName;
  form.deptId = detail.deptId;
  form.postNames = detail.postNames ?? [];
  form.levelCode = detail.levelCode ?? '';
  form.phone = detail.phone ?? '';
  form.idCard = detail.idCard ?? '';
  form.residence = detail.residence ?? '';
  form.currentAddress = detail.currentAddress ?? '';
  form.gender = detail.gender ?? '';
  form.bankName = detail.bankName ?? '';
  form.bankBranch = detail.bankBranch ?? '';
  form.bankCardNo = detail.bankCardNo ?? '';
  form.reportDate = detail.reportDate ?? '';
  form.hireDate = detail.hireDate ?? '';
  form.leaveDate = detail.leaveDate ?? undefined;
  form.status = detail.status;
  form.socialInsured = !!detail.socialInsured;
  form.housingInsured = !!detail.housingInsured;
  form.commercialInsured = !!detail.commercialInsured;
  form.dormitory = !!detail.dormitory;
  form.parttime = !!detail.isPartTime;
  form.excludeTeam = !!detail.excludeTeam;
  form.perfSchemeCode = detail.perfSchemeCode ?? '';
  form.mentorCode = detail.mentorCode ?? '';
  form.remark = detail.remark ?? '';
  form.socialFee = detail.socialFee ?? undefined;
  form.commercialFee = detail.commercialFee ?? undefined;
  form.housingFund = detail.housingFund ?? undefined;
  form.dormitoryFee = detail.dormitoryFee ?? undefined;
  formDialog.isEdit = true;
  formDialog.title = '修改员工';
  formDialog.visible = true;
};

const submitForm = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    submitLoading.value = true;
    try {
      if (formDialog.isEdit) {
        await employeeApi.update(editingEmployeeId.value, { ...form });
      } else {
        await employeeApi.create({ ...form });
      }
      modal.msgSuccess(formDialog.isEdit ? '修改成功' : '新增成功');
      formDialog.visible = false;
      await getList();
    } finally {
      submitLoading.value = false;
    }
  });
};

// ==================== 详情 / 变更记录 ====================
const detailVisible = ref(false);
const detailData = ref<Employee | null>(null);
const historyLoading = ref(false);
const historyData = ref<EmployeeChangeLog[]>([]);

const handleDetail = async (row: Employee) => {
  detailData.value = null;
  historyData.value = [];
  detailVisible.value = true;
  const [detailRes, historyRes] = await Promise.all([
    employeeApi.getById(row.employeeId),
    employeeApi.history(row.employeeId)
  ]);
  detailData.value = detailRes.data ?? null;
  historyLoading.value = false;
  historyData.value = historyRes.data ?? [];
};

// ==================== 调整生效日期 ====================
/** 算薪事实类型选项（与后端 FactType 码值一致） */
const FACT_TYPE_OPTIONS = [
  { code: 'LEVEL', desc: '职级' },
  { code: 'STATUS', desc: '状态' },
  { code: 'SOCIAL', desc: '社保' },
  { code: 'SOCIAL_FEE', desc: '社保金额' },
  { code: 'HOUSING', desc: '公积金' },
  { code: 'HOUSING_FUND', desc: '公积金金额' },
  { code: 'COMMERCIAL', desc: '商业保险' },
  { code: 'COMMERCIAL_FEE', desc: '商业保险金额' },
  { code: 'DORMITORY', desc: '宿舍' },
  { code: 'DORMITORY_FEE', desc: '宿舍费金额' },
  { code: 'PARTTIME', desc: '兼职' },
  { code: 'MENTOR', desc: '伯乐' },
  { code: 'EXCLUDE_TEAM', desc: '不计入店长团队' },
  { code: 'PERF_SCHEME', desc: '绩效方案' },
];
const adjustVisible = ref(false);
const adjusting = ref(false);
const adjustForm = ref<{ factTypes: string[]; newDate: string | null }>({ factTypes: [], newDate: null });

// ==================== 绩效方案（指派下拉数据源） ====================
const perfSchemeOptions = ref<PerfScheme[]>([]);
const SCHEME_TYPE_LABELS: Record<string, string> = {
  NONE: '无绩效',
  GRADE_RATE: '积分',
  RATE_TIER: '业绩A·扣点',
  AMOUNT_TIER: '业绩B·扣款',
  GRADE_AMOUNT: '店长积分'
};
const schemeTypeLabel = (t: string) => SCHEME_TYPE_LABELS[t] ?? t;

/** 按适用岗位过滤：店长岗位可见 MANAGER/ALL 方案，其余岗位可见 AGENT/ALL 方案 */
const schemeOptionsForForm = computed(() =>
  perfSchemeOptions.value.filter((s) => {
    const isManager = (form.postNames ?? []).includes('店长');
    if (!s.applicableRole || s.applicableRole === 'ALL') return true;
    if (s.applicableRole === 'MANAGER') return isManager;
    return !isManager; // AGENT：仅非店长（经纪人/总监等）
  })
);


const openAdjust = () => {
  adjustForm.value = { factTypes: [], newDate: null };
  adjustVisible.value = true;
};

const refreshHistory = async () => {
  if (!detailData.value) return;
  const historyRes = await employeeApi.history(detailData.value.employeeId);
  historyData.value = historyRes.data ?? [];
};

const submitAdjust = async () => {
  if (!detailData.value) return;
  if (!adjustForm.value.factTypes.length || !adjustForm.value.newDate) {
    ElMessage.warning('请选择变更项和新生效月');
    return;
  }
  adjusting.value = true;
  try {
    const res = await employeeApi.adjustFactDate(
      detailData.value.employeeId,
      adjustForm.value.factTypes,
      adjustForm.value.newDate,
    );
    ElMessage.success(`已调整 ${(res as any).data ?? 0} 项生效日期`);
    adjustVisible.value = false;
    await refreshHistory();
  } catch {
    /* 拦截器处理 */
  } finally {
    adjusting.value = false;
  }
};

// ==================== 对账 ====================
const reconcileLoading = ref(false);
const reconcileDialog = reactive({ visible: false });
const reconcileResult = ref<ReconcileResult | null>(null);

const handleReconcile = async () => {
  await modal.confirm('将以员工主数据为准，自动修复系统账户的部门、岗位/角色、离职状态差异，是否继续？');
  reconcileLoading.value = true;
  try {
    const res = await employeeApi.reconcile();
    reconcileResult.value = res.data ?? null;
    reconcileDialog.visible = true;
    getList();
  } finally {
    reconcileLoading.value = false;
  }
};

const fieldLabel = (field: string) =>
  ({ dept: '归属部门', posts: '岗位/角色', status: '账户状态' })[field] ?? field;

const fieldTagType = (field: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' =>
  ({ dept: 'primary', posts: 'warning', status: 'danger' } as Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'>)[field] ?? 'info';

// ==================== 店组虚拟人 ====================
const virtualTableRef = ref();
const virtualDialog = reactive({
  visible: false,
  loading: false,
  submitting: false,
  rows: [] as VirtualEmployeeCandidate[]
});
const virtualSelections = ref<VirtualEmployeeCandidate[]>([]);

const loadVirtualCandidates = async () => {
  virtualDialog.loading = true;
  try {
    const res = await employeeApi.virtualCandidates();
    virtualDialog.rows = res.data ?? [];
    // 默认勾选「已配编码但缺虚拟人」的行
    await nextTick();
    virtualDialog.rows.forEach((row) => {
      if (!row.hasVirtual && row.deptCategory) {
        virtualTableRef.value?.toggleRowSelection(row, true);
      }
    });
  } finally {
    virtualDialog.loading = false;
  }
};

const handleVirtualOpen = () => {
  virtualDialog.visible = true;
  loadVirtualCandidates();
};

const handleVirtualSelectionChange = (rows: VirtualEmployeeCandidate[]) => {
  virtualSelections.value = rows;
};

const handleVirtualSubmit = async () => {
  const items = virtualSelections.value
    .filter((r) => !r.hasVirtual)
    .map((r) => ({ deptId: r.deptId, deptCategory: (r.deptCategory ?? '').trim() }));
  if (items.some((i) => !i.deptCategory)) {
    modal.msgWarning('勾选行存在未填写的店组编码，请补全或取消勾选');
    return;
  }
  await modal.confirm(`将为 ${items.length} 个店组写入编码并补建虚拟人，是否继续？`);
  virtualDialog.submitting = true;
  try {
    const res = await employeeApi.initVirtualEmployees(items);
    const r = res.data;
    const parts: string[] = [];
    if (r?.createdCodes?.length) parts.push(`新建 ${r.createdCodes.length} 个`);
    if (r?.skippedCodes?.length) parts.push(`已存在跳过 ${r.skippedCodes.length} 个`);
    if (r?.conflictedCodes?.length) parts.push(`编码冲突 ${r.conflictedCodes.length} 个（${r.conflictedCodes.join('、')}）`);
    modal.msgSuccess(parts.length ? parts.join('，') : '无变更');
    if (r?.conflictedCodes?.length) {
      // 有冲突：刷新候选留在弹窗让用户修正
      loadVirtualCandidates();
    } else {
      virtualDialog.visible = false;
    }
    getList();
  } finally {
    virtualDialog.submitting = false;
  }
};

// ==================== 员工导入 ====================
const importUploadRef = ref();
const importDialog = reactive({
  visible: false,
  loading: false,
  file: null as File | null,
  effectiveDate: '' as string,
  batchId: '' as string,
  batchNo: '',
  batchStatus: '',
  totalRows: 0,
  successRows: 0,
  failedRows: 0,
  issues: [] as PeopleImportIssue[]
});
const importPollingTimer = ref<ReturnType<typeof setInterval> | null>(null);

const stopImportPolling = () => {
  if (importPollingTimer.value) {
    clearInterval(importPollingTimer.value);
    importPollingTimer.value = null;
  }
};

onUnmounted(() => stopImportPolling());

const resetImport = () => {
  stopImportPolling();
  importDialog.loading = false;
  importDialog.file = null;
  importDialog.effectiveDate = '';
  importDialog.batchId = '';
  importDialog.batchNo = '';
  importDialog.batchStatus = '';
  importDialog.totalRows = 0;
  importDialog.successRows = 0;
  importDialog.failedRows = 0;
  importDialog.issues = [];
  importUploadRef.value?.clearFiles();
};

const handleImport = () => {
  resetImport();
  importDialog.visible = true;
};

const handleImportFileChange = (file: UploadFile) => {
  importDialog.file = file.raw || null;
};

const doImportUpload = async () => {
  if (!importDialog.file) {
    modal.msgWarning('请先选择文件');
    return;
  }
  importDialog.loading = true;
  try {
    const res = await employeeApi.importEmployees(importDialog.file, importDialog.effectiveDate || undefined);
    const batchId = res.data;
    importDialog.batchId = batchId;
    importDialog.loading = false;
    await pollImportStatus(batchId);
    if (needPolling(importDialog.batchStatus)) {
      startImportPolling(batchId);
    }
  } catch (e: any) {
    modal.msgError('导入失败: ' + (e?.message || '未知错误'));
    importDialog.loading = false;
  }
};

const needPolling = (status: string) =>
  status === 'PARSING' || status === 'VALIDATING' || status === 'IMPORTING';

const importStatusText = (status: string) => {
  switch (status) {
    case 'PARSING': return '正在解析文件...';
    case 'VALIDATING': return '正在校验数据...';
    case 'IMPORTING': return '正在导入员工...';
    default: return '正在处理...';
  }
};

const pollImportStatus = async (batchId: string) => {
  const res = await employeeApi.importBatch(batchId);
  const batch = res.data;
  if (!batch) return;
  importDialog.batchNo = batch.batchNo;
  importDialog.batchStatus = batch.status;
  importDialog.totalRows = batch.totalRows;
  importDialog.successRows = batch.successRows;
  importDialog.failedRows = batch.failedRows;
  if (batch.status === 'FAILED') {
    stopImportPolling();
    await showIssues();
  } else if (batch.status === 'SUCCESS') {
    stopImportPolling();
    modal.msgSuccess(`导入成功，共 ${batch.successRows} 名员工已落地`);
    await getList();
  }
};

const startImportPolling = (batchId: string) => {
  stopImportPolling();
  importPollingTimer.value = setInterval(async () => {
    try {
      await pollImportStatus(batchId);
    } catch (e) {
      stopImportPolling();
      modal.msgError('轮询导入状态失败');
    }
  }, 2000);
};

const showIssues = async () => {
  if (!importDialog.batchId) return;
  const res = await employeeApi.importIssues(importDialog.batchId);
  importDialog.issues = res.data ?? [];
};

const downloadTemplate = async () => {
  try {
    await employeeApi.downloadImportTemplate();
    modal.msgSuccess('模板下载成功');
  } catch (e: any) {
    modal.msgError('模板下载失败: ' + (e?.message || ''));
  }
};

/** 导出当前筛选条件下的员工名单 */
const handleExport = async () => {
  try {
    const { hireDateRange, ...rest } = queryParams;
    const [hireDateBegin, hireDateEnd] = hireDateRange || [];
    await employeeApi.exportEmployees({
      ...rest,
      hireDateBegin: hireDateBegin || undefined,
      hireDateEnd: hireDateEnd || undefined
    });
    modal.msgSuccess('导出成功');
  } catch (e: any) {
    modal.msgError('导出失败: ' + (e?.message || ''));
  }
};

/** 问题类型中文映射 */
const issueLabel = (type: string): string =>
  ({
    REQUIRED_MISSING: '必填缺失',
    COLUMN_TYPE_ERR: '格式错误',
    DUPLICATE_CODE: '工号重复',
    DEPT_PATH_INVALID: '部门路径非法',
    LEVEL_INVALID: '职级非法',
    MENTOR_NOT_FOUND: '伯乐不存在'
  })[type] ?? type;

const issueTagType = (type: string): 'danger' | 'warning' | 'info' =>
  ({ DUPLICATE_CODE: 'danger', DEPT_PATH_INVALID: 'warning', MENTOR_NOT_FOUND: 'warning' } as Record<string, 'danger' | 'warning' | 'info'>)[type] ?? 'info';

onMounted(() => {
  loadOptions();
  getList();
  loadExpiring();
  // 绩效方案清单（指派下拉数据源；拦截器返回 R 包装对象取 .data；加载失败不阻塞页面，下拉为空时仍可默认考核）
  employeeApi
    .perfSchemes()
    .then((res) => (perfSchemeOptions.value = res.data ?? []))
    .catch(() => (perfSchemeOptions.value = []));
});
</script>

<style lang="scss" scoped>
.people-employee-page {
  .search-panel {
    margin-bottom: 12px;
  }

  .toolbar-shell {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
  }

  .table-heading {
    h3 {
      margin: 2px 0;
      font-size: 16px;
    }

    p {
      margin: 4px 0 0;
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .panel-kicker {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--el-color-primary);
  }

  .post-tag {
    margin: 2px;
  }

  .detail-section {
    margin-top: 20px;

    h4 {
      margin: 0 0 10px;
    }

    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
  }

  .detail-amount {
    margin-left: 8px;
    color: #f56c6c;
    font-weight: 600;
  }

  .reconcile-alert {
    margin-bottom: 14px;
  }

  .contract-alert {
    margin-bottom: 10px;

    .contract-alert-row {
      line-height: 1.8;
    }
  }

  .import-upload {
    width: 100%;

    :deep(.el-upload-dragger) {
      width: 100%;
    }
  }

  .import-file-info {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    font-size: 13px;

    .el-icon {
      color: var(--el-color-primary);
    }
  }

  .import-effective {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    padding: 8px 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    font-size: 13px;

    .label {
      color: var(--el-text-color-regular);
    }

    .tip {
      color: var(--el-text-color-secondary);
    }
  }

  .import-actions {
    margin-top: 16px;
    text-align: center;
  }

  .import-progress {
    .progress-bar-wrap {
      margin-top: 16px;

      .progress-text {
        margin-top: 8px;
        text-align: center;
        font-size: 13px;
        color: var(--el-text-color-secondary);
      }
    }
  }

  .import-result {
    .issue-list {
      margin-top: 16px;
    }
  }
}
</style>
