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
            :props="{ value: 'deptId', label: 'deptName', children: 'children' } as any"
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
              <el-button link type="primary" icon="View" @click="handleDetail(scope.row)"></el-button>
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['people:employee:edit']"
                link
                type="primary"
                icon="Edit"
                @click="handleUpdate(scope.row)"
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
                :props="{ value: 'deptId', label: 'deptName', children: 'children' } as any"
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
  </div>
</template>

<script setup name="PeopleEmployee" lang="ts">
import { employeeApi } from '@/api/panjia/employee';
import type {
  DeptNode,
  Employee,
  EmployeeChangeLog,
  EmployeeCreateForm,
  EmployeeUpdateForm,
  PostOption,
  ReconcileResult
} from '@/api/panjia/types';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';

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
  const [posts, tree] = await Promise.all([employeeApi.postOptions(), employeeApi.deptTree()]);
  postOptionsData.value = posts.data ?? [];
  deptTreeData.value = tree.data ?? [];
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

const fieldTagType = (field: string) =>
  ({ dept: 'primary', posts: 'warning', status: 'danger' })[field] ?? 'info';

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
}
</style>
