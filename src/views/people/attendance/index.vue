<template>
  <div class="p-2 app-container people-attendance-page">
    <!-- 筛选条件 -->
    <el-card shadow="hover" class="search-panel">
      <el-form ref="queryFormRef" :model="queryParams" :inline="true">
        <el-form-item label="工号" prop="employeeCode">
          <el-input
            v-model="queryParams.employeeCode"
            placeholder="请输入工号"
            clearable
            style="width: 150px"
            @keyup.enter="handleQuery"
          />
        </el-form-item>
        <el-form-item label="姓名" prop="employeeName">
          <el-input
            v-model="queryParams.employeeName"
            placeholder="请输入姓名"
            clearable
            style="width: 150px"
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
            style="width: 200px"
          />
        </el-form-item>
        <el-form-item label="考勤月份">
          <el-date-picker
            v-model="monthRange"
            type="monthrange"
            range-separator="至"
            start-placeholder="开始月份"
            end-placeholder="结束月份"
            value-format="YYYY-MM-DD"
            style="width: 260px"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
          <el-button icon="Refresh" @click="resetQuery">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 考勤汇总列表 -->
    <el-card shadow="hover" class="table-panel">
      <template #header>
        <div class="toolbar-shell">
          <div class="table-heading">
            <span class="panel-kicker">Attendance Monthly</span>
            <h3>考勤汇总</h3>
            <p>共 {{ total }} 条记录，一员工一月一行；对齐钉钉月度汇总，服务薪酬扣款。</p>
          </div>
          <div class="toolbar-actions">
            <el-button v-hasPermi="['people:attendance:add']" type="primary" plain icon="Plus" @click="handleAdd">
              新增考勤
            </el-button>
          </div>
        </div>
      </template>

      <el-table v-loading="loading" border class="data-table" :data="attendanceList">
        <el-table-column label="考勤月份" align="center" prop="attendMonth" width="110" />
        <el-table-column label="工号" align="center" prop="employeeCode" width="100" />
        <el-table-column label="姓名" align="center" prop="employeeName" width="90" />
        <el-table-column label="门店/组别" align="center" prop="deptName" min-width="150" show-overflow-tooltip />
        <el-table-column label="出勤(天)" align="center" prop="attendDays" width="80" />
        <el-table-column label="休息(天)" align="center" prop="restDays" width="80" />
        <el-table-column label="迟到次数" align="center" prop="lateCount" width="80" />
        <el-table-column label="迟到(分)" align="center" prop="lateMinutes" width="80" />
        <el-table-column label="缺卡次数" align="center" prop="missingCardCount" width="80" />
        <el-table-column label="旷工(天)" align="center" prop="absentDays" width="80" />
        <el-table-column label="请假(天)" align="center" prop="leaveDays" width="80" />
        <el-table-column label="备注" align="center" prop="remark" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" align="center" width="120" fixed="right">
          <template #default="scope">
            <el-button
              v-hasPermi="['people:attendance:edit']"
              link
              type="primary"
              icon="Edit"
              @click="handleEdit(scope.row as AttendanceRecord)"
            >
              修改
            </el-button>
            <el-button
              v-hasPermi="['people:attendance:remove']"
              link
              type="danger"
              icon="Delete"
              @click="handleDelete(scope.row as AttendanceRecord)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-show="total > 0"
        v-model:page="queryParams.pageNum"
        v-model:limit="queryParams.pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        class="pagination-wrap"
        layout="total, sizes, prev, pager, next, jumper"
        @pagination="getList"
      />
    </el-card>

    <!-- 新增/编辑弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑考勤' : '新增考勤'" width="560px" append-to-body>
      <el-form ref="formRef" :model="form" :rules="rules" label-width="92px">
        <el-form-item label="员工" prop="employeeId">
          <el-select
            v-model="form.employeeId"
            placeholder="请选择员工"
            filterable
            :disabled="dialog.isEdit"
            style="width: 100%"
          >
            <el-option
              v-for="emp in employeeOptions"
              :key="emp.employeeId"
              :label="`${emp.employeeCode || '无工号'}｜${emp.employeeName}${emp.deptName ? '｜' + emp.deptName : ''}`"
              :value="emp.employeeId"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="考勤月份" prop="attendMonth">
          <el-date-picker
            v-model="form.attendMonth"
            type="month"
            placeholder="请选择月份"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="出勤天数" prop="attendDays">
          <el-input-number v-model="form.attendDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="休息天数" prop="restDays">
          <el-input-number v-model="form.restDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="迟到次数" prop="lateCount">
          <el-input-number v-model="form.lateCount" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="迟到时长(分)" prop="lateMinutes">
          <el-input-number v-model="form.lateMinutes" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="缺卡次数" prop="missingCardCount">
          <el-input-number v-model="form.missingCardCount" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="旷工天数" prop="absentDays">
          <el-input-number v-model="form.absentDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="请假天数" prop="leaveDays">
          <el-input-number v-model="form.leaveDays" :min="0" :step="0.5" style="width: 100%" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" maxlength="512" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.saving" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import { attendanceApi } from '@/api/panjia/attendance';
import { employeeApi } from '@/api/panjia/employee';
import type { AttendanceQuery, AttendanceRecord, AttendanceSaveForm, DeptNode, Employee } from '@/api/panjia/types';
import modal from '@/plugins/modal';

// ==================== 查询 ====================
const queryFormRef = ref<FormInstance>();
const loading = ref(false);
const attendanceList = ref<AttendanceRecord[]>([]);
const total = ref(0);
const deptTreeData = ref<DeptNode[]>([]);
const monthRange = ref<[string, string] | []>([]);

const queryParams = reactive<AttendanceQuery>({
  pageNum: 1,
  pageSize: 10,
  employeeCode: '',
  employeeName: '',
  deptId: undefined,
  monthStart: undefined,
  monthEnd: undefined
});

const getList = async () => {
  loading.value = true;
  try {
    const [monthStart, monthEnd] = monthRange.value || [];
    const res = await attendanceApi.list({
      ...queryParams,
      monthStart: monthStart || undefined,
      monthEnd: monthEnd || undefined
    });
    attendanceList.value = res.data?.rows ?? [];
    total.value = res.data?.total ?? 0;
  } catch (e: any) {
    modal.msgError(e?.message || '查询考勤汇总失败');
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
  monthRange.value = [];
  queryParams.pageNum = 1;
  getList();
};

const loadDeptTree = async () => {
  try {
    deptTreeData.value = await employeeApi.deptTree();
  } catch (e: any) {
    modal.msgError(e?.message || '部门树加载失败');
  }
};

// ==================== 员工下拉 ====================
const employeeOptions = ref<Employee[]>([]);

const loadEmployees = async () => {
  try {
    const res = await employeeApi.list({ pageNum: 1, pageSize: 1000 });
    employeeOptions.value = res.data?.rows ?? [];
  } catch (e: any) {
    modal.msgError(e?.message || '员工列表加载失败');
  }
};

// ==================== 新增/编辑 ====================
const formRef = ref<FormInstance>();
const dialog = reactive({ visible: false, isEdit: false, saving: false, editId: '' });

const createEmptyForm = (): AttendanceSaveForm => ({
  employeeId: undefined,
  attendMonth: undefined,
  attendDays: undefined,
  restDays: undefined,
  lateCount: 0,
  lateMinutes: 0,
  missingCardCount: 0,
  absentDays: 0,
  leaveDays: 0,
  remark: '',
  version: undefined
});

const form = reactive<AttendanceSaveForm>(createEmptyForm());

const rules: FormRules = {
  employeeId: [{ required: true, message: '请选择员工', trigger: 'change' }],
  attendMonth: [{ required: true, message: '请选择考勤月份', trigger: 'change' }]
};

const resetForm = () => {
  Object.assign(form, createEmptyForm());
  formRef.value?.clearValidate();
};

const handleAdd = () => {
  resetForm();
  dialog.editId = '';
  dialog.isEdit = false;
  dialog.visible = true;
};

const handleEdit = (row: AttendanceRecord) => {
  resetForm();
  dialog.editId = row.id;
  dialog.isEdit = true;
  Object.assign(form, {
    employeeId: row.employeeId,
    attendMonth: row.attendMonth,
    attendDays: row.attendDays ?? undefined,
    restDays: row.restDays ?? undefined,
    lateCount: row.lateCount ?? 0,
    lateMinutes: row.lateMinutes ?? 0,
    missingCardCount: row.missingCardCount ?? 0,
    absentDays: row.absentDays ?? 0,
    leaveDays: row.leaveDays ?? 0,
    remark: row.remark || '',
    version: row.version
  });
  dialog.visible = true;
};

const submitForm = async () => {
  await formRef.value?.validate();
  dialog.saving = true;
  try {
    if (dialog.isEdit) {
      await attendanceApi.update(dialog.editId, { ...form });
    } else {
      await attendanceApi.create({ ...form });
    }
    modal.msgSuccess(dialog.isEdit ? '修改成功' : '新增成功');
    dialog.visible = false;
    await getList();
  } catch (e: any) {
    modal.msgError(e?.message || '保存失败');
  } finally {
    dialog.saving = false;
  }
};

const handleDelete = async (row: AttendanceRecord) => {
  await modal.confirm(`确认删除员工「${row.employeeName}」${row.attendMonth} 的考勤记录？删除后不可恢复。`);
  try {
    await attendanceApi.remove(row.id);
    modal.msgSuccess('删除成功');
    if (attendanceList.value.length === 1 && queryParams.pageNum > 1) {
      queryParams.pageNum -= 1;
    }
    await getList();
  } catch (e: any) {
    modal.msgError(e?.message || '删除失败');
  }
};

onMounted(() => {
  getList();
  loadDeptTree();
  loadEmployees();
});
</script>

<style lang="scss" scoped>
.people-attendance-page {
  .search-panel {
    margin-bottom: 10px;
  }

  .toolbar-shell {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }

  .table-heading {
    h3 {
      margin: 2px 0 4px;
      font-size: 16px;
    }

    p {
      margin: 0;
      font-size: 12px;
      color: var(--el-text-color-secondary);
    }
  }

  .panel-kicker {
    font-size: 11px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: var(--el-color-primary);
  }

  .pagination-wrap {
    margin-top: 12px;
    justify-content: flex-end;
  }
}
</style>
