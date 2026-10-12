<template>
  <el-dialog v-model="visible" title="新签补录" width="900px" @close="reset" destroy-on-close>
    <el-form label-width="100px" v-loading="loading">
      <!-- 只读信息 -->
      <el-form-item label="订单号/合同号">
        <span class="readonly-text">{{ form.orderNo || '—' }}</span>
        <span v-if="form.contractNo" class="readonly-sep"> / {{ form.contractNo }}</span>
      </el-form-item>
      <el-form-item label="实收期间">
        <span class="readonly-text">{{ form.receivedPeriod }}</span>
      </el-form-item>
      <el-form-item label="业务类型">
        <span class="readonly-text">{{ form.bizType || '—' }}</span>
      </el-form-item>
      <el-form-item label="房源地址">
        <span class="readonly-text">{{ form.propertyAddress || '—' }}</span>
      </el-form-item>

      <!-- 新签结算月 + 签约日期 -->
      <el-form-item label="新签结算月" required>
        <el-date-picker
          v-model="form.period"
          type="month"
          value-format="YYYY-MM"
          placeholder="选择新签结算月"
          style="width: 200px"
        />
      </el-form-item>
      <el-form-item label="签约日期" required>
        <el-date-picker
          v-model="form.businessDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择签约日期"
          style="width: 200px"
        />
      </el-form-item>

      <!-- 总额录入（与明细联动） -->
      <el-form-item label="新签总额">
        <el-input-number
          v-model="totalInput"
          :precision="2"
          :step="100"
          :controls="false"
          :min="0"
          placeholder="录入总额自动分摊"
          style="width: 200px"
          @update:model-value="handleTotalInput"
        />
        <span class="batch-hint">录入总额后自动按各角色人分摊比例分配；修改明细金额后总额自动更新</span>
      </el-form-item>

      <!-- 角色人表格 -->
      <el-form-item label="新签明细">
        <el-table :data="form.items" border style="width: 100%">
          <el-table-column label="员工" min-width="180">
            <template #default="{ row, $index }">
              <template v-if="row.isNew">
                <EmployeeSelect
                  v-model="row.employeeId"
                  width="160px"
                  placeholder="姓名/工号搜索"
                  @change="(val: any) => onEmployeeChange($index, val)"
                />
              </template>
              <template v-else>
                <span>{{ row.employeeName || row.roleName || '—' }}</span>
                <span v-if="row.employeeExternalCode" class="readonly-sep"> ({{ row.employeeExternalCode }})</span>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="角色类型" width="140">
            <template #default="{ row }">
              <el-input
                v-if="row.isNew"
                v-model="row.roleType"
                placeholder="如：合作人"
                size="small"
              />
              <span v-else>{{ row.roleType || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="角色人姓名" width="120">
            <template #default="{ row }">
              <el-input
                v-if="row.isNew"
                v-model="row.roleName"
                placeholder="姓名"
                size="small"
              />
              <span v-else>{{ row.roleName || '—' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="分摊比例" width="100" align="center">
            <template #default="{ row }">
              {{ row.shareRatio != null ? (Number(row.shareRatio) * 100).toFixed(2) + '%' : '—' }}
            </template>
          </el-table-column>
          <el-table-column label="实收金额" width="120" align="right">
            <template #default="{ row }">
              <span class="amount-received">¥{{ formatAmount(row.receivedAmount) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="新签金额" width="160" align="right">
            <template #default="{ row }">
              <el-input-number
                v-model="row.amount"
                :precision="2"
                :controls="false"
                :min="0"
                size="small"
                style="width: 130px"
                placeholder="录入"
                @update:model-value="(v: number | null) => handleRowAmount(row as SupplementRow, v)"
              />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" align="center">
            <template #default="{ $index }">
              <el-button v-if="form.items[$index].isNew" link type="danger" size="small" @click="removeRow($index)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <div style="margin-top: 8px">
          <el-button type="primary" plain size="small" @click="addRow">+ 增加角色人</el-button>
          <span class="total-amount">新签合计：¥{{ formatAmount(totalExpectAmount) }}</span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submit">提交补录</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { receivedApi, type ReceivedApply, type ReceivedFact } from '@/api/panjia/received';
import { supplementExpect, type ExpectSupplementBo, type ExpectSupplementItem } from '@/api/panjia/performance';
import EmployeeSelect from '@/components/EmployeeSelect/index.vue';

const emit = defineEmits<{ submitted: [] }>();

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
/** 总额输入框值（与行金额联动） */
const totalInput = ref<number | null>(null);

interface SupplementRow {
  employeeId: number | string;
  employeeExternalCode?: string;
  employeeName?: string;
  roleType: string;
  roleName?: string;
  shareRatio?: number;
  receivedAmount: number;
  amount?: number | null;
  deptId?: number | string;
  isNew?: boolean;
}

const form = reactive({
  period: '',               // 新签结算月（用户可编辑）
  receivedPeriod: '',       // 实收月（只读，查 DRAFT 单用）
  contractNo: '',
  orderNo: '',
  bizType: '',
  propertyAddress: '',
  deptId: undefined as number | undefined,
  feeItem: '',
  businessDate: '',
  applyId: '' as string | number,
  items: [] as SupplementRow[],
});

const num = (v: number | string | null | undefined): number => {
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
};

const round2 = (v: number) => Math.round(v * 100) / 100;

const formatAmount = (n: number | string | null | undefined) =>
  n == null ? '0.00' : num(n).toFixed(2);

/** 行金额合计（只读 computed） */
const totalExpectAmount = computed(() =>
  round2(form.items.reduce((sum, r) => sum + num(r.amount), 0)),
);

/** 打开弹窗 */
const open = async (row: ReceivedApply) => {
  reset();
  visible.value = true;
  form.receivedPeriod = row.period;
  form.period = row.period; // 默认新签结算月=实收月
  form.contractNo = row.contractNo || '';
  form.orderNo = row.orderNo || '';
  form.bizType = row.bizType || '';
  form.propertyAddress = row.propertyAddress || '';
  form.applyId = row.id;
  // 加载实收明细获取角色人列表
  loading.value = true;
  try {
    const res: any = await receivedApi.getDetail(row.id);
    const facts: ReceivedFact[] = res?.data?.facts ?? [];
    form.items = facts.map((f) => ({
      employeeId: f.employeeId || '',
      employeeExternalCode: f.employeeCode || '',
      employeeName: f.employeeName || '',
      roleType: f.roleType || '',
      roleName: f.roleName || '',
      shareRatio: f.shareRatio,
      receivedAmount: num(f.amount),
      amount: null,
      deptId: undefined,
      isNew: false,
    }));
    if (form.items.length === 0) {
      addRow();
    }
  } catch {
    ElMessage.error('加载实收明细失败');
    addRow();
  } finally {
    loading.value = false;
  }
};

/** 增加角色人行 */
const addRow = () => {
  form.items.push({
    employeeId: '',
    roleType: '合作人',
    roleName: '',
    shareRatio: undefined,
    receivedAmount: 0,
    amount: null,
    isNew: true,
  });
};

/** 删除新增行 */
const removeRow = (idx: number) => {
  form.items.splice(idx, 1);
  totalInput.value = totalExpectAmount.value;
};

/** 员工选择回调 */
const onEmployeeChange = (idx: number, emp: any) => {
  if (!emp) return;
  const row = form.items[idx];
  if (emp.employeeName) row.roleName = emp.employeeName;
  if (emp.deptId) row.deptId = emp.deptId;
};

/**
 * 总额录入 → 按各行 shareRatio 分摊（参考 ContractAdjustDialog.handleTotalInput）
 * 无 shareRatio 时等分，尾差补到最后一行
 */
function handleTotalInput(v: number | null) {
  const target = v == null ? 0 : round2(v);
  const rows = form.items;
  if (!rows.length) {
    totalInput.value = target;
    return;
  }
  const ratioSum = rows.reduce((s, r) => s + num(r.shareRatio), 0);
  if (ratioSum > 0) {
    let allocated = 0;
    rows.forEach((r, i) => {
      if (i < rows.length - 1) {
        const amt = round2(target * num(r.shareRatio) / ratioSum);
        r.amount = amt;
        allocated += amt;
      } else {
        // 尾差补到最后一行
        r.amount = round2(target - allocated);
      }
    });
  } else {
    // 无比例：等分
    const per = target / rows.length;
    rows.forEach((r, i) => {
      if (i < rows.length - 1) {
        r.amount = round2(per);
      } else {
        r.amount = round2(target - round2(per) * (rows.length - 1));
      }
    });
  }
  totalInput.value = totalExpectAmount.value;
}

/**
 * 行金额录入 → 自动更新总额（参考 ContractAdjustDialog.handleRowAmount）
 */
function handleRowAmount(row: SupplementRow, v: number | null) {
  row.amount = v == null ? null : round2(v);
  totalInput.value = totalExpectAmount.value;
}

/** 提交 */
const submit = async () => {
  if (!form.period) {
    ElMessage.warning('请选择新签结算月');
    return;
  }
  if (!form.businessDate) {
    ElMessage.warning('请选择签约日期');
    return;
  }
  const validItems = form.items.filter((r) => r.amount != null && num(r.amount) > 0);
  if (validItems.length === 0) {
    ElMessage.warning('请至少录入一条新签金额');
    return;
  }
  for (const r of validItems) {
    if (r.isNew && (!r.employeeId || !r.roleType)) {
      ElMessage.warning('新增角色人需选择员工并填写角色类型');
      return;
    }
  }
  const items: ExpectSupplementItem[] = validItems.map((r) => ({
    employeeId: Number(r.employeeId),
    employeeExternalCode: r.employeeExternalCode || undefined,
    roleType: r.roleType,
    roleName: r.roleName || undefined,
    deptId: r.deptId ? Number(r.deptId) : form.deptId,
    shareRatio: r.shareRatio ?? undefined,
    amount: num(r.amount),
  }));
  const bo: ExpectSupplementBo = {
    period: form.period,
    receivedPeriod: form.receivedPeriod,
    contractNo: form.contractNo || undefined,
    orderNo: form.orderNo,
    businessDate: form.businessDate,
    bizType: form.bizType || undefined,
    propertyAddress: form.propertyAddress || undefined,
    deptId: form.deptId,
    feeItem: form.feeItem || undefined,
    items,
  };
  submitting.value = true;
  try {
    const res: any = await supplementExpect(bo);
    ElMessage.success(`已补录 ${res?.data ?? items.length} 条新签业绩`);
    visible.value = false;
    emit('submitted');
  } catch {
    /* 拦截器处理 */
  } finally {
    submitting.value = false;
  }
};

const reset = () => {
  form.period = '';
  form.receivedPeriod = '';
  form.contractNo = '';
  form.orderNo = '';
  form.bizType = '';
  form.propertyAddress = '';
  form.deptId = undefined;
  form.feeItem = '';
  form.businessDate = '';
  form.applyId = '';
  form.items = [];
  totalInput.value = null;
};

defineExpose({ open });
</script>

<style scoped>
.readonly-text { font-weight: 500; }
.readonly-sep { color: #909399; margin-left: 4px; }
.batch-hint { color: #909399; font-size: 12px; margin-left: 8px; }
.amount-received { color: #e6a23c; }
.total-amount { margin-left: 16px; font-weight: bold; color: #409eff; }
</style>
