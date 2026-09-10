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
          <el-tree-select
            v-model="queryParams.deptId"
            :data="deptTreeData"
            :props="{ label: 'deptName', children: 'children' } as any"
            value-key="deptId"
            node-key="deptId"
            placeholder="请选择门店/组别"
            clearable
            check-strictly
            style="width: 220px"
          />
        </el-form-item>
        <el-form-item label="职位" prop="postName">
          <el-select v-model="queryParams.postName" placeholder="请选择职位" clearable style="width: 160px">
            <el-option v-for="opt in postOptionsData" :key="opt.postId" :label="opt.postName" :value="opt.postName" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 140px">
            <el-option
              v-for="dict in panjia_employee_status"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            />
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
            <p>共 {{ total }} 名员工。员工事实数据（职级/社保/师傅等）变更全程留痕，离职仅停用不删除。</p>
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
              v-hasPermi="['people:employee:reconcile']"
              type="warning"
              plain
              icon="RefreshRight"
              :loading="reconcileLoading"
              @click="handleReconcile"
            >
              账户对账
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="employeeList">
        <el-table-column label="工号" align="center" prop="employeeCode" width="110" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
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
        <el-table-column label="操作" align="center" width="160" class-name="small-padding fixed-width">
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
              <el-tree-select
                v-model="form.deptId"
                :data="deptTreeData"
                :props="{ label: 'deptName', children: 'children' } as any"
                value-key="deptId"
                node-key="deptId"
                placeholder="请选择门店/组别"
                check-strictly
                style="width: 100%"
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
                  v-for="dict in panjia_employee_status"
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
            <el-form-item label="师傅工号" prop="mentorCode">
              <el-input v-model="form.mentorCode" placeholder="填师傅工号；留空表示无师傅，清空即解除" />
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
          <el-col :span="12" v-if="formDialog.isEdit">
            <el-form-item label="变更生效日" prop="effectiveDate">
              <el-date-picker
                v-model="form.effectiveDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="不填 = 今天"
                style="width: 100%"
              />
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

    <!-- 详情抽屉 -->
    <el-drawer v-model="detailVisible" size="680px" :title="`员工详情 - ${detailData?.employeeName ?? ''}`">
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
          <el-descriptions-item label="报道日期">{{ detailData.reportDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="入职日期">{{ detailData.hireDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="离职日期">{{ detailData.leaveDate || '—' }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <dict-tag :options="panjia_employee_status" :value="detailData.status" />
          </el-descriptions-item>
          <el-descriptions-item label="师傅">
            {{ detailData.mentorName ? `${detailData.mentorName}（${detailData.mentorCode}）` : '无师傅' }}
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
          <el-descriptions-item label="社保">
            <el-tag :type="detailData.socialInsured ? 'success' : 'info'" size="small">
              {{ detailData.socialInsured ? '已缴' : '未缴' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="公积金">
            <el-tag :type="detailData.housingInsured ? 'success' : 'info'" size="small">
              {{ detailData.housingInsured ? '已缴' : '未缴' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="商业保险">
            <el-tag :type="detailData.commercialInsured ? 'success' : 'info'" size="small">
              {{ detailData.commercialInsured ? '已买' : '未买' }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="宿舍">
            <el-tag :type="detailData.dormitory ? 'success' : 'info'" size="small">
              {{ detailData.dormitory ? '住' : '不住' }}
            </el-tag>
          </el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <h4>变更记录</h4>
          <el-table v-loading="historyLoading" border :data="historyData" size="small">
            <el-table-column label="生效日" prop="effectiveDate" width="100" align="center" />
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
    </el-drawer>

    <!-- 对账结果 -->
    <el-dialog v-model="reconcileDialog.visible" title="员工-账户对账结果" width="780px" append-to-body>
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

    <!-- 员工导入 -->
    <el-dialog v-model="importDialog.visible" title="员工导入" width="680px" append-to-body @closed="resetImport">
      <!-- 上传区 -->
      <el-upload
        v-if="!importDialog.batchId"
        ref="importUploadRef"
        :auto-upload="false"
        :limit="1"
        accept=".xlsx,.xls,.csv"
        :on-exceed="() => modal.msgWarning('一次只能上传一个文件')"
        :on-change="handleImportFileChange"
        drag
        class="import-upload"
      >
        <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
        <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        <template #tip>
          <div class="el-upload__tip">
            支持 .xlsx / .xls / .csv 格式；模板字段：大区/门店/小组（按层级拆分）、工号、姓名、职位、职级、入职时间、社保/公积金/商保/宿舍/兼职、师傅工号
          </div>
        </template>
      </el-upload>
      <div v-if="importDialog.file" class="import-file-info">
        <el-icon><Document /></el-icon>
        <span>{{ importDialog.file.name }}</span>
        <el-button link type="danger" icon="Delete" @click="importDialog.file = null">移除</el-button>
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

      <!-- 导入结果 -->
      <div v-if="importDialog.batchId" class="import-result">
        <el-result
          :icon="importDialog.batchStatus === 'SUCCESS' ? 'success' : importDialog.batchStatus === 'FAILED' ? 'error' : 'info'"
          :title="importDialog.batchStatus === 'SUCCESS' ? '导入成功' : importDialog.batchStatus === 'FAILED' ? '导入失败' : '导入完成'"
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

      <template #footer>
        <el-button @click="importDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PeopleEmployee" lang="ts">
import { employeeApi } from '@/api/panjia/employee';
import type {
  DeptNode,
  Employee,
  EmployeeChangeLog,
  EmployeeCreateForm,
  EmployeeQuery,
  EmployeeUpdateForm,
  PageResult,
  PeopleImportBatch,
  PeopleImportIssue,
  PostOption,
  ReconcileResult
} from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { UploadFilled, Document } from '@element-plus/icons-vue';
import type { UploadFile } from 'element-plus';

const { panjia_employee_level, panjia_employee_status } = toRefs<any>(
  useDict('panjia_employee_level', 'panjia_employee_status')
);

// ==================== 列表 ====================
const loading = ref(false);
const employeeList = ref<Employee[]>([]);
const total = ref(0);
const queryFormRef = ref<ElFormInstance>();
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: undefined as string | undefined,
  postName: '',
  status: ''
});

const getList = async () => {
  loading.value = true;
  try {
    const res = await employeeApi.list(queryParams);
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
  handleQuery();
};

// ==================== 选项数据 ====================
const postOptionsData = ref<PostOption[]>([]);
const deptTreeData = ref<DeptNode[]>([]);

const loadOptions = async () => {
  try {
    const posts = await employeeApi.postOptions();
    postOptionsData.value = posts.data ?? [];
  } catch (e) {
    console.error('[people] postOptions 加载失败', e);
  }
  try {
    const tree = await employeeApi.deptTree();
    deptTreeData.value = tree.data ?? [];
  } catch (e) {
    console.error('[people] deptTree 加载失败', e);
  }
};

// ==================== 新增 / 修改 ====================
const formRef = ref<ElFormInstance>();
const submitLoading = ref(false);
const formDialog = reactive({ visible: false, title: '', isEdit: false });
const editingEmployeeId = ref<string | number>('');

const initForm = (): EmployeeCreateForm => ({
  employeeCode: '',
  employeeName: '',
  deptId: '',
  postNames: [],
  levelCode: '',
  phone: '',
  idCard: '',
  reportDate: '',
  hireDate: '',
  status: 'ACTIVE',
  socialInsured: false,
  housingInsured: false,
  commercialInsured: false,
  dormitory: false,
  parttime: false,
  mentorCode: '',
  remark: ''
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
  form.reportDate = detail.reportDate ?? '';
  form.hireDate = detail.hireDate ?? '';
  form.leaveDate = detail.leaveDate ?? undefined;
  form.status = detail.status;
  form.socialInsured = !!detail.socialInsured;
  form.housingInsured = !!detail.housingInsured;
  form.commercialInsured = !!detail.commercialInsured;
  form.dormitory = !!detail.dormitory;
  form.parttime = !!detail.isPartTime;
  form.mentorCode = detail.mentorCode ?? '';
  form.remark = detail.remark ?? '';
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

// ==================== 员工导入 ====================
const importUploadRef = ref();
const importDialog = reactive({
  visible: false,
  loading: false,
  file: null as File | null,
  batchId: '' as string,
  batchNo: '',
  batchStatus: '',
  totalRows: 0,
  successRows: 0,
  failedRows: 0,
  issues: [] as PeopleImportIssue[]
});

const resetImport = () => {
  importDialog.loading = false;
  importDialog.file = null;
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
    const res = await employeeApi.importEmployees(importDialog.file);
    const batchId = res.data;
    importDialog.batchId = batchId;
    // 查批次详情
    const batchRes = await employeeApi.importBatches();
    const batch = (batchRes.data ?? []).find((b: PeopleImportBatch) => b.id === batchId);
    if (batch) {
      importDialog.batchNo = batch.batchNo;
      importDialog.batchStatus = batch.status;
      importDialog.totalRows = batch.totalRows;
      importDialog.successRows = batch.successRows;
      importDialog.failedRows = batch.failedRows;
      // 失败时自动加载问题清单
      if (batch.status === 'FAILED') {
        await showIssues();
      } else if (batch.status === 'SUCCESS') {
        modal.msgSuccess(`导入成功，共 ${batch.successRows} 名员工已落地`);
        await getList();
      }
    }
  } catch (e: any) {
    modal.msgError('导入失败: ' + (e?.message || '未知错误'));
  } finally {
    importDialog.loading = false;
  }
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

/** 问题类型中文映射 */
const issueLabel = (type: string): string =>
  ({
    REQUIRED_MISSING: '必填缺失',
    COLUMN_TYPE_ERR: '格式错误',
    DUPLICATE_CODE: '工号重复',
    DEPT_PATH_INVALID: '部门路径非法',
    LEVEL_INVALID: '职级非法',
    MENTOR_NOT_FOUND: '师傅不存在'
  })[type] ?? type;

const issueTagType = (type: string): 'danger' | 'warning' | 'info' =>
  ({ DUPLICATE_CODE: 'danger', DEPT_PATH_INVALID: 'warning', MENTOR_NOT_FOUND: 'warning' } as Record<string, 'danger' | 'warning' | 'info'>)[type] ?? 'info';

onMounted(() => {
  loadOptions();
  getList();
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
  }

  .reconcile-alert {
    margin-bottom: 14px;
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

  .import-actions {
    margin-top: 16px;
    text-align: center;
  }

  .import-result {
    .issue-list {
      margin-top: 16px;
    }
  }
}
</style>
