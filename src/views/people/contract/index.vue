<template>
  <div class="p-2 app-container people-contract-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form :model="queryParams" :inline="true">
        <el-form-item label="员工">
          <el-select
            v-model="queryParams.employeeId"
            filterable
            remote
            clearable
            reserve-keyword
            :remote-method="searchEmployeeOptions"
            :loading="employeeSearching"
            placeholder="工号/姓名搜索"
            style="width: 200px"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同类型">
          <el-select v-model="queryParams.contractType" placeholder="请选择合同类型" clearable style="width: 150px">
            <el-option
              v-for="dict in panjia_contract_type"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="签约门店">
          <PanjiaDeptSelect v-model="queryParams.deptId" :scope="false" width="220px" placeholder="全部门店/组别" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 合同列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Contract Dataset</span>
            <h3>合同管理</h3>
            <p>劳动合同 / 兼职合同 / 其他。续签 = 新增一条记录，历史合同保留；到期前 30 天在员工管理页提醒。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['people:contract:edit']" plain icon="OfficeBuilding" @click="openPartyManager">
              甲方配置
            </el-button>
            <el-button v-hasPermi="['people:contract:edit']" plain icon="Setting" @click="openTemplateManager">
              模板管理
            </el-button>
            <el-button v-hasPermi="['people:contract:add']" type="primary" plain icon="Plus" @click="openCreate">
              新增合同
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="contractList">
        <el-table-column label="工号" align="center" prop="employeeCode" width="110" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="100" />
        <el-table-column label="门店/组别" align="center" prop="deptName" min-width="170" show-overflow-tooltip />
        <el-table-column label="合同类型" align="center" prop="contractType" width="110">
          <template #default="scope">
            <dict-tag :options="panjia_contract_type" :value="scope.row.contractType" />
          </template>
        </el-table-column>
        <el-table-column label="开始日期" align="center" prop="startDate" width="110" />
        <el-table-column label="到期日期" align="center" prop="endDate" width="110">
          <template #default="scope">
            <span v-if="scope.row.endDate">{{ scope.row.endDate }}</span>
            <span v-else class="no-limit">无固定期限</span>
          </template>
        </el-table-column>
        <el-table-column label="合同状态" align="center" width="110">
          <template #default="scope">
            <el-tag v-if="!scope.row.endDate" type="info" size="small">无固定期限</el-tag>
            <el-tag v-else-if="isExpired(scope.row.endDate)" type="danger" size="small">已到期</el-tag>
            <el-tag v-else-if="isExpiringSoon(scope.row.endDate)" type="warning" size="small">30天内到期</el-tag>
            <el-tag v-else type="success" size="small">履行中</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="身份证扫描件" align="center" width="140">
          <template #default="scope">
            <template v-if="idCardUrls(scope.row).length">
              <el-image
                v-for="(url, idx) in idCardUrls(scope.row)"
                :key="idx"
                :src="url"
                :preview-src-list="idCardUrls(scope.row)"
                :initial-index="idx"
                preview-teleported
                fit="cover"
                class="id-card-thumb"
              />
            </template>
            <span v-else class="no-file">—</span>
          </template>
        </el-table-column>
        <el-table-column label="合同扫描件" align="center" width="140">
          <template #default="scope">
            <template v-if="contractUrls(scope.row).length">
              <el-image
                v-for="(url, idx) in contractUrls(scope.row)"
                :key="idx"
                :src="url"
                :preview-src-list="contractUrls(scope.row)"
                :initial-index="idx"
                preview-teleported
                fit="cover"
                class="id-card-thumb"
              />
            </template>
            <span v-else class="no-file">—</span>
          </template>
        </el-table-column>
        <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" align="center" width="150" fixed="right">
          <template #default="scope">
            <el-tooltip content="打印合同" placement="top">
              <el-button link type="primary" icon="Printer" @click="handlePrint(scope.row as Contract)" />
            </el-tooltip>
            <el-tooltip content="导入合同扫描件（留底）" placement="top">
              <el-button
                v-hasPermi="['people:contract:edit']"
                link
                type="primary"
                icon="Upload"
                @click="openImport(scope.row as Contract)"
              />
            </el-tooltip>
            <el-tooltip content="修改" placement="top">
              <el-button
                v-hasPermi="['people:contract:edit']"
                link
                type="primary"
                icon="Edit"
                @click="openEdit(scope.row as Contract)"
              />
            </el-tooltip>
            <el-tooltip content="删除（错录修正）" placement="top">
              <el-button
                v-hasPermi="['people:contract:delete']"
                link
                type="danger"
                icon="Delete"
                @click="handleDelete(scope.row as Contract)"
              />
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

    <!-- 导入合同扫描件（留底） -->
    <el-dialog v-model="importVisible" title="导入合同扫描件" width="560px" append-to-body>
      <el-alert
        type="info"
        :closable="false"
        style="margin-bottom: 12px"
        :title="`${importRow?.employeeName ?? ''} 的合同 — 签订完成后上传扫描件留底，可增删，保存即生效`"
      />
      <ImageUpload v-model="importOssIds" :limit="9" :file-size="10" />
      <template #footer>
        <el-button type="primary" :loading="importSaving" @click="submitImport">保 存</el-button>
        <el-button @click="importVisible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- 新增 / 修改合同 -->
    <el-dialog v-model="formVisible" :title="formTitle" width="680px" append-to-body @closed="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="110px">
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            filterable
            remote
            clearable
            reserve-keyword
            :disabled="isEdit"
            :remote-method="searchEmployeeOptions"
            :loading="employeeSearching"
            placeholder="输入工号/姓名搜索员工"
            style="width: 100%"
            @change="handleEmployeeChange"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeName}（${emp.employeeCode}）`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合同类型" prop="contractType">
          <el-select v-model="form.contractType" placeholder="请选择合同类型" style="width: 100%">
            <el-option
              v-for="dict in panjia_contract_type"
              :key="dict.value"
              :label="dict.label"
              :value="dict.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="签约门店" prop="deptId">
          <PanjiaDeptSelect v-model="form.deptId" :scope="false" :clearable="false" placeholder="选择员工后自动带出，可调整" />
        </el-form-item>
        <el-form-item label="开始日期" prop="startDate">
          <el-date-picker
            v-model="form.startDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="合同开始日"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="到期日期" prop="endDate">
          <el-date-picker
            v-model="form.endDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="不选 = 无固定期限"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="身份证扫描件" prop="idCardOssIds">
          <ImageUpload v-model="form.idCardOssIds" :limit="5" :file-size="10" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="500" show-word-limit placeholder="请输入备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="submitting" @click="submitForm">确 定</el-button>
        <el-button @click="formVisible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- 甲方（用人单位）配置 -->
    <el-dialog v-model="partyVisible" title="甲方（用人单位）配置" width="900px" append-to-body>
      <el-alert
        type="info"
        :closable="false"
        class="template-tip"
        title="打印合同时按员工所属部门匹配甲方：部门精确匹配 → 所属门店匹配 → 默认甲方（dept_id=0）。未配置具体映射的部门一律使用默认甲方。"
      />
      <div style="margin-bottom: 12px; text-align: right">
        <el-button v-hasPermi="['people:contract:add']" type="primary" plain icon="Plus" @click="openPartyEdit(null)">
          新增映射
        </el-button>
      </div>
      <el-table v-loading="partyLoading" :data="partyList" border>
        <el-table-column label="部门" prop="deptName" min-width="170" show-overflow-tooltip />
        <el-table-column label="单位（甲方）" prop="companyName" min-width="220" show-overflow-tooltip />
        <el-table-column label="注册地址" prop="regAddress" min-width="200" show-overflow-tooltip />
        <el-table-column label="法定代表人" prop="legalPerson" width="110" align="center" />
        <el-table-column label="操作" align="center" width="140">
          <template #default="scope">
            <el-button v-hasPermi="['people:contract:edit']" type="primary" link size="small" @click="openPartyEdit(scope.row as ContractPartyVO)">
              编辑
            </el-button>
            <el-button
              v-if="scope.row.deptId !== 0"
              v-hasPermi="['people:contract:delete']"
              type="danger"
              link
              size="small"
              @click="handlePartyDelete(scope.row as ContractPartyVO)"
            >删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="partyVisible = false">关 闭</el-button>
      </template>
    </el-dialog>

    <!-- 甲方配置编辑 -->
    <el-dialog v-model="partyFormVisible" :title="partyForm.partyId ? '编辑甲方映射' : '新增甲方映射'" width="560px" append-to-body>
      <el-form :model="partyForm" label-width="110px">
        <el-form-item label="映射部门" required>
          <PanjiaDeptSelect
            v-model="partyForm.deptId"
            :scope="false"
            :clearable="true"
            placeholder="不选 = 默认甲方（全部部门兜底）"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="单位（甲方）" required>
          <el-input v-model="partyForm.companyName" maxlength="200" placeholder="如：成都市人居天街房地产经纪有限公司" />
        </el-form-item>
        <el-form-item label="注册地址">
          <el-input v-model="partyForm.regAddress" maxlength="500" placeholder="请输入注册地址" />
        </el-form-item>
        <el-form-item label="法定代表人">
          <el-input v-model="partyForm.legalPerson" maxlength="50" placeholder="请输入法定代表人" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="partyForm.remark" type="textarea" :rows="2" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button type="primary" :loading="partySaving" @click="submitPartyForm">确 定</el-button>
        <el-button @click="partyFormVisible = false">取 消</el-button>
      </template>
    </el-dialog>

    <!-- 合同模板管理 -->
    <el-dialog v-model="templateVisible" title="合同模板管理" width="780px" append-to-body>
      <el-alert
        type="info"
        :closable="false"
        class="template-tip"
        title="操作流程：先点「下载模板」得到带占位符的 HTML，按需修改后上传保存即可生效；未上传的类型使用系统默认模板。"
      >
        <template #default>
          <span v-pre>可用占位符：{{partyA}} {{employeeName}} {{genderLabel}} {{idCard}} {{employeeCode}} {{phone}}
          {{contractTypeLabel}} {{startDate}} {{endDate}} {{bankName}} {{bankBranch}} {{bankCardNo}}
          {{partyACompany}} {{partyAAddress}} {{partyALegal}} {{printDate}}</span>
        </template>
      </el-alert>
      <el-table :data="templateList" border class="template-table">
        <el-table-column label="合同类型" prop="contractTypeLabel" width="120" />
        <el-table-column label="当前模板" min-width="180">
          <template #default="scope">
            <el-tag v-if="scope.row.useDefault" type="info" size="small">系统默认</el-tag>
            <span v-else>{{ scope.row.originalName }}</span>
          </template>
        </el-table-column>
        <el-table-column label="上传模板" width="220">
          <template #default="scope">
            <FileUpload
              :model-value="templateOssIds[scope.row.contractType]"
              @update:model-value="(v: string) => (templateOssIds[scope.row.contractType] = v)"
              :limit="1"
              :file-size="2"
              :file-type="['html', 'htm']"
              :is-show-tip="false"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" align="center" width="268">
          <template #default="scope">
            <el-button type="primary" link size="small" @click="downloadTemplate(scope.row)">下载模板</el-button>
            <el-button
              type="primary"
              link
              size="small"
              :disabled="!templateOssIds[scope.row.contractType]"
              @click="handleTemplateUploaded(scope.row.contractType)"
            >保存</el-button>
            <el-button type="primary" link size="small" @click="previewTemplate(scope.row)">预览</el-button>
            <el-button
              v-if="!scope.row.useDefault"
              type="danger"
              link
              size="small"
              @click="handleTemplateReset(scope.row.contractType)"
            >恢复默认</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="templateVisible = false">关 闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="PeopleContract" lang="ts">
import { computed, onMounted, reactive, ref, toRefs } from 'vue';
import { contractApi } from '@/api/panjia/contract';
import type { ContractTemplateVO, ContractPartyVO, ContractPartyForm } from '@/api/panjia/contract';
import { employeeApi } from '@/api/panjia/employee';
import type { Contract, Employee } from '@/api/panjia/types';
import PanjiaDeptSelect from '@/components/PanjiaDeptSelect/index.vue';
import ImageUpload from '@/components/ImageUpload/index.vue';
import FileUpload from '@/components/FileUpload/index.vue';
import modal from '@/plugins/modal';
import { useDict } from '@/utils/dict';
import { renderContractHtml, renderCustomContractHtml, downloadContractTemplate } from './contractTemplates';

const { panjia_contract_type } = toRefs<any>(useDict('panjia_contract_type'));

// ==================== 列表 ====================
const loading = ref(false);
const contractList = ref<Contract[]>([]);
const total = ref(0);
const queryParams = reactive({
  pageNum: 1,
  pageSize: 10,
  employeeId: undefined as string | undefined,
  contractType: '',
  deptId: undefined as string | undefined
});

/** 到期判断（与后端口径一致：每员工每类型取最新一条由后端完成，此处仅做展示态渲染） */
const isExpired = (endDate: string) => new Date(endDate) < new Date(new Date().toDateString());
const isExpiringSoon = (endDate: string) => {
  const diff = new Date(endDate).getTime() - new Date(new Date().toDateString()).getTime();
  return diff >= 0 && diff <= 30 * 24 * 3600 * 1000;
};

/** 扫描件有效 URL 列表（过滤元数据已删除的空位；row 为表格 DefaultRow，弱类型取值） */
const idCardUrls = (row: any): string[] => ((row?.idCardUrls ?? []) as (string | null)[]).filter(Boolean) as string[];
/** 合同签署扫描件有效 URL 列表 */
const contractUrls = (row: any): string[] => ((row?.contractUrls ?? []) as (string | null)[]).filter(Boolean) as string[];

const getList = async () => {
  loading.value = true;
  try {
    const res = await contractApi.list(queryParams);
    contractList.value = res.data?.rows ?? [];
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
  queryParams.employeeId = undefined;
  queryParams.contractType = '';
  queryParams.deptId = undefined;
  handleQuery();
};

// ==================== 员工搜索（筛选与表单共用） ====================
const employeeSearching = ref(false);
const employeeOptions = ref<Employee[]>([]);

const searchEmployeeOptions = async (keyword: string) => {
  if (!keyword || !keyword.trim()) {
    employeeOptions.value = [];
    return;
  }
  employeeSearching.value = true;
  try {
    const res = await employeeApi.list({
      pageNum: 1,
      pageSize: 20,
      employeeName: keyword.trim(),
      status: ['ACTIVE', 'PARTTIME', 'PENDING']
    });
    let rows = res.data?.rows ?? [];
    // 关键字可能是工号：按姓名无结果时用工号再试一次
    if (!rows.length) {
      const byCode = await employeeApi.list({
        pageNum: 1,
        pageSize: 20,
        employeeCode: keyword.trim(),
        status: ['ACTIVE', 'PARTTIME', 'PENDING']
      });
      rows = byCode.data?.rows ?? [];
    }
    employeeOptions.value = rows;
  } finally {
    employeeSearching.value = false;
  }
};

// ==================== 新增 / 修改 ====================
const formRef = ref<ElFormInstance>();
const submitting = ref(false);
const formVisible = ref(false);
const isEdit = ref(false);
const editingContractId = ref('');

const initForm = () => ({
  employeeId: '' as string,
  contractType: '',
  deptId: '' as string,
  startDate: '',
  endDate: '' as string | null,
  idCardOssIds: [] as string[],
  remark: ''
});

const form = reactive(initForm());

const rules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  contractType: [{ required: true, message: '请选择合同类型', trigger: 'change' }],
  deptId: [{ required: true, message: '请选择签约门店', trigger: 'change' }],
  startDate: [{ required: true, message: '请选择开始日期', trigger: 'change' }]
};

const formTitle = computed(() => (isEdit.value ? '修改合同' : '新增合同'));

const resetForm = () => {
  Object.assign(form, initForm());
  formRef.value?.clearValidate();
};

const openCreate = () => {
  resetForm();
  isEdit.value = false;
  formVisible.value = true;
};

const openEdit = (row: Contract) => {
  resetForm();
  isEdit.value = true;
  editingContractId.value = row.contractId;
  form.employeeId = row.employeeId;
  form.contractType = row.contractType;
  form.deptId = row.deptId;
  form.startDate = row.startDate;
  form.endDate = row.endDate ?? '';
  form.idCardOssIds = [...(row.idCardOssIds ?? [])];
  form.remark = row.remark ?? '';
  // 编辑态员工下拉回显当前员工
  employeeOptions.value = [
    {
      employeeId: row.employeeId,
      employeeCode: row.employeeCode ?? '',
      employeeName: row.employeeName ?? ''
    } as Employee
  ];
  formVisible.value = true;
};

/** 选中员工后自动带出其归属门店（可改） */
const handleEmployeeChange = (employeeId: string) => {
  const emp = employeeOptions.value.find((e) => String(e.employeeId) === String(employeeId));
  if (emp?.deptId) {
    form.deptId = emp.deptId;
  }
};

const submitForm = () => {
  formRef.value?.validate(async (valid: boolean) => {
    if (!valid) {
      return;
    }
    submitting.value = true;
    try {
      if (isEdit.value) {
        await contractApi.update(editingContractId.value, {
          contractType: form.contractType,
          deptId: form.deptId,
          startDate: form.startDate,
          endDate: form.endDate || null,
          idCardOssIds: form.idCardOssIds,
          remark: form.remark
        });
        modal.msgSuccess('修改成功');
      } else {
        await contractApi.create({
          employeeId: form.employeeId,
          contractType: form.contractType,
          deptId: form.deptId,
          startDate: form.startDate,
          endDate: form.endDate || null,
          idCardOssIds: form.idCardOssIds,
          remark: form.remark
        });
        modal.msgSuccess('新增成功');
      }
      formVisible.value = false;
      await getList();
    } finally {
      submitting.value = false;
    }
  });
};

// ==================== 删除 ====================
const handleDelete = async (row: Contract) => {
  await modal.confirm(
    `确认删除 ${row.employeeName ?? ''} 的${dictLabel(row.contractType)}（${row.startDate} 起）？删除用于错录修正，历史不留痕。`
  );
  await contractApi.remove(row.contractId);
  modal.msgSuccess('删除成功');
  await getList();
};

const dictLabel = (value: string) =>
  panjia_contract_type.value?.find((d: any) => d.value === value)?.label ?? value;

// ==================== 打印 ====================
/** 打印合同：取员工详情填充模板，新窗口写入 HTML 后打印（与系统 UI 隔离） */
const handlePrint = async (row: Contract) => {
  let employee: Employee | null = null;
  try {
    const res = await employeeApi.getById(row.employeeId);
    employee = res.data ?? null;
  } catch {
    // 员工详情获取失败时仍可打印（缺身份证号等以留空呈现）
  }
  const genderDict: Record<string, string> = { MALE: '男', FEMALE: '女' };
  // 甲方三要素：按员工部门映射（部门精确 → 门店锚点 → 默认甲方）
  let partyInfo = { companyName: '', regAddress: '', legalPerson: '' };
  try {
    const partyRes = await contractApi.resolveParty(row.employeeId);
    partyInfo = (partyRes as any).data ?? partyInfo;
  } catch {
    // 甲方配置获取失败时仍可打印（三要素留空）
  }
  const printData = {
    partyA: row.deptName ?? '',
    partyACompany: partyInfo.companyName ?? '',
    partyAAddress: partyInfo.regAddress ?? '',
    partyALegal: partyInfo.legalPerson ?? '',
    employeeName: row.employeeName ?? '',
    genderLabel: employee?.gender ? genderDict[employee.gender] ?? employee.gender : '',
    idCard: employee?.idCard ?? '',
    residence: employee?.residence ?? '',
    currentAddress: employee?.currentAddress ?? '',
    employeeCode: row.employeeCode ?? '',
    phone: employee?.phone ?? '',
    contractTypeLabel: dictLabel(row.contractType),
    startDate: row.startDate,
    endDate: row.endDate ?? null,
    bankName: employee?.bankName ?? '',
    bankBranch: employee?.bankBranch ?? '',
    bankCardNo: employee?.bankCardNo ?? '',
    printDate: new Date().toISOString().slice(0, 10)
  };

  // 优先使用客户自定义模板，未配置则用内置默认模板
  let html: string;
  const tpl = templateList.value.find(t => t.contractType === row.contractType);
  if (tpl && !tpl.useDefault && tpl.url) {
    try {
      const resp = await fetch(tpl.url);
      const customContent = await resp.text();
      html = renderCustomContractHtml(customContent, printData);
    } catch {
      // 自定义模板拉取失败时回退默认模板
      html = renderContractHtml(row.contractType, printData);
    }
  } else {
    html = renderContractHtml(row.contractType, printData);
  }

  const win = window.open('', '_blank');
  if (!win) {
    modal.msgWarning('浏览器拦截了打印窗口，请允许弹出窗口后重试');
    return;
  }
  win.document.write(html);
  win.document.close();
};

onMounted(() => {
  getList();
  loadTemplates();
});

// ==================== 导入合同扫描件（留底） ====================
const importVisible = ref(false);
const importSaving = ref(false);
const importRow = ref<Contract | null>(null);
const importOssIds = ref<string[]>([]);

const openImport = (row: Contract) => {
  importRow.value = row;
  importOssIds.value = [...((row as any).contractOssIds ?? [])];
  importVisible.value = true;
};

const submitImport = async () => {
  if (!importRow.value) return;
  importSaving.value = true;
  try {
    await contractApi.update(importRow.value.contractId, { contractOssIds: importOssIds.value });
    modal.msgSuccess('已保存');
    importVisible.value = false;
    await getList();
  } finally {
    importSaving.value = false;
  }
};

// ==================== 甲方（用人单位）配置 ====================
const partyVisible = ref(false);
const partyFormVisible = ref(false);
const partyLoading = ref(false);
const partySaving = ref(false);
const partyList = ref<ContractPartyVO[]>([]);
const partyForm = reactive<ContractPartyForm>({
  partyId: null,
  deptId: null,
  companyName: '',
  regAddress: '',
  legalPerson: '',
  remark: ''
});

const openPartyManager = async () => {
  partyVisible.value = true;
  partyLoading.value = true;
  try {
    const res = await contractApi.listParty();
    partyList.value = (res as any).data ?? [];
  } finally {
    partyLoading.value = false;
  }
};

const openPartyEdit = (row: ContractPartyVO | null) => {
  partyForm.partyId = row?.partyId ?? null;
  // 默认甲方（deptId=0）在编辑时显示为空（=不选部门）
  partyForm.deptId = row && row.deptId !== 0 ? row.deptId : null;
  partyForm.companyName = row?.companyName ?? '';
  partyForm.regAddress = row?.regAddress ?? '';
  partyForm.legalPerson = row?.legalPerson ?? '';
  partyForm.remark = row?.remark ?? '';
  partyFormVisible.value = true;
};

const submitPartyForm = async () => {
  if (!partyForm.companyName?.trim()) {
    modal.msgWarning('单位（甲方）名称不能为空');
    return;
  }
  partySaving.value = true;
  try {
    const body: ContractPartyForm = {
      ...partyForm,
      deptId: partyForm.deptId ? Number(partyForm.deptId) : 0
    };
    if (partyForm.partyId) {
      await contractApi.updateParty(body);
    } else {
      await contractApi.addParty(body);
    }
    modal.msgSuccess('已保存');
    partyFormVisible.value = false;
    await openPartyManager();
  } finally {
    partySaving.value = false;
  }
};

const handlePartyDelete = async (row: ContractPartyVO) => {
  await modal.confirm(`确认删除「${row.deptName}」的甲方映射（${row.companyName}）？删除后该部门将使用默认甲方。`);
  await contractApi.deleteParty(row.partyId);
  modal.msgSuccess('已删除');
  await openPartyManager();
};

// ==================== 合同模板管理 ====================
const templateVisible = ref(false);
const templateList = ref<ContractTemplateVO[]>([]);
const templateLoading = ref(false);
/** 每种类型当前上传的 ossId（FileUpload 输出） */
const templateOssIds = reactive<Record<string, string>>({});

const loadTemplates = async () => {
  try {
    const res = await contractApi.listTemplates();
    templateList.value = res.data ?? [];
  } catch {
    templateList.value = [];
  }
};

const openTemplateManager = () => {
  templateVisible.value = true;
};

/** 上传后保存模板 */
const handleTemplateUploaded = async (type: string) => {
  const ossId = templateOssIds[type];
  if (!ossId) return;
  templateLoading.value = true;
  try {
    await contractApi.saveTemplate(type, ossId);
    modal.msgSuccess('模板已保存');
    await loadTemplates();
    templateOssIds[type] = '';
  } finally {
    templateLoading.value = false;
  }
};

/** 恢复默认（删除自定义模板） */
const handleTemplateReset = async (type: string) => {
  await modal.confirm('确定恢复为系统默认模板？自定义模板将被删除。');
  try {
    await contractApi.deleteTemplate(type);
    modal.msgSuccess('已恢复默认模板');
    await loadTemplates();
  } catch {
    /* 拦截器处理 */
  }
};

/** 下载该类型的模板源文件，用户改完再上传 */
const downloadTemplate = (row: any) => {
  const tpl = row as ContractTemplateVO;
  downloadContractTemplate(tpl.contractType, `${tpl.contractTypeLabel}模板`);
};

/** 预览模板（用示例数据渲染） */
const previewTemplate = (row: any) => {
  const tpl = row as ContractTemplateVO;
  const sample = {
    partyA: '示例门店（甲方）',
    partyACompany: '成都市人居天街房地产经纪有限公司',
    partyAAddress: '成都市金牛区花照壁中横街88号1层',
    partyALegal: '廖明',
    employeeName: '张三',
    genderLabel: '男',
    idCard: '110101199001011234',
    residence: '四川省成都市',
    currentAddress: '成都市金牛区示例路1号',
    employeeCode: 'EMP001',
    phone: '13800138000',
    contractTypeLabel: tpl.contractTypeLabel,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    bankName: '中国工商银行',
    bankBranch: 'XX支行',
    bankCardNo: '6222021234567890123',
    printDate: new Date().toISOString().slice(0, 10)
  };
  if (!tpl.useDefault && tpl.url) {
    fetch(tpl.url)
      .then(r => r.text())
      .then(content => {
        const html = renderCustomContractHtml(content, sample);
        const win = window.open('', '_blank');
        win?.document.write(html);
        win?.document.close();
      })
      .catch(() => modal.msgError('模板加载失败'));
  } else {
    const html = renderContractHtml(tpl.contractType, sample);
    const win = window.open('', '_blank');
    win?.document.write(html);
    win?.document.close();
  }
};
</script>

<style lang="scss" scoped>
.people-contract-page {
  .template-tip {
    margin-bottom: 16px;
  }

  .template-table {
    :deep(.el-upload) {
      width: 100%;
    }
  }

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

  .no-limit,
  .no-file {
    color: var(--el-text-color-secondary);
  }

  .id-card-thumb {
    width: 40px;
    height: 28px;
    margin: 1px;
    border-radius: 3px;
    cursor: pointer;
  }
}
</style>
