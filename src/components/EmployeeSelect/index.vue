<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    :remote-method="handleSearch"
    :loading="loading"
    :clearable="clearable"
    :disabled="disabled"
    :size="size"
    :placeholder="placeholder"
    :no-data-text="noDataText"
    :style="{ width }"
    @update:model-value="handleUpdate"
    @change="handleChange"
    @clear="handleClear"
    @visible-change="handleVisible"
  >
    <el-option
      v-for="emp in options"
      :key="String(emp.employeeId)"
      :label="optionLabel(emp)"
      :value="emp.employeeId"
    >
      <span>{{ emp.employeeName }}</span>
      <span v-if="emp.employeeCode" class="emp-code">（{{ emp.employeeCode }}）</span>
      <span class="emp-dept">
        <span v-if="emp.status === 'LEFT'" class="emp-left">离职</span>
        <span v-if="emp.deptName">{{ emp.deptName }}</span>
      </span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { performanceApi, type PerformanceEmployeeOption } from '@/api/panjia/performance';

/**
 * 员工公共选择器（全系统统一）。
 * <p>
 * 统一交互：输入「姓名」或「工号」远程搜索（后端按登录用户部门数据权限过滤），
 * 下拉展示「姓名（工号） 部门」，选中值为 employeeId。所有录入/筛选员工的位置一律使用本组件，
 * 不再各页面自行拼装 el-select + remote-method。
 * <p>
 * 回显：远程搜索模式下初始只有 employeeId 无法反查姓名，编辑/回显场景请传入
 * {@link #initialOption}（含 employeeId/employeeName/employeeCode 的已知选项）；
 * 未传时组件不主动请求，避免拿雪花 ID 当关键字搜不到。
 */
const props = withDefaults(
  defineProps<{
    /** 选中员工 ID */
    modelValue?: string | number | null;
    /** 联动过滤的部门 ID（响应式：如门店/组别筛选值；undefined 表示不按部门过滤） */
    deptId?: string | number | null;
    placeholder?: string;
    clearable?: boolean;
    disabled?: boolean;
    size?: 'large' | 'default' | 'small';
    /** 控件宽度（CSS width，表单内传 100%，筛选栏传固定 px） */
    width?: string;
    /** 初始回显选项（编辑已有单据时由外部提供已知员工信息） */
    initialOption?: PerformanceEmployeeOption | null;
  }>(),
  {
    modelValue: null,
    deptId: null,
    placeholder: '输入姓名/工号搜索',
    clearable: true,
    disabled: false,
    size: 'default',
    width: '100%',
    initialOption: null,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string | number | undefined): void;
  /** 选中返回完整选项，清空返回 null（便于页面缓存姓名/工号展示） */
  (e: 'change', value: string | number | undefined, option: PerformanceEmployeeOption | null): void;
}>();

const options = ref<PerformanceEmployeeOption[]>([]);
const loading = ref(false);
const searched = ref(false);
/** 当前已选选项：远程刷新结果后合并保留，避免选中态只显示 ID */
const selected = ref<PerformanceEmployeeOption | null>(props.initialOption ?? null);

const noDataText = computed(() => (searched.value ? '无匹配员工' : '输入姓名/工号搜索'));

/** 统一选项展示文本（与 el-select 选中后的输入框文本一致） */
const optionLabel = (emp: PerformanceEmployeeOption) =>
  `${emp.employeeName}${emp.employeeCode ? `（${emp.employeeCode}）` : ''}`;

const mergeSelected = (rows: PerformanceEmployeeOption[]): PerformanceEmployeeOption[] => {
  const cur = selected.value;
  const id = props.modelValue;
  if (cur && id != null && id !== '' && !rows.some((r) => String(r.employeeId) === String(id))) {
    return [cur, ...rows];
  }
  return rows;
};

const handleSearch = async (query: string) => {
  const keyword = (query ?? '').trim();
  if (!keyword) {
    options.value = selected.value ? [selected.value] : [];
    searched.value = false;
    return;
  }
  loading.value = true;
  try {
    const res: any = await performanceApi.searchEmployeeOptions({
      keyword,
      deptId: props.deptId != null && props.deptId !== '' ? String(props.deptId) : undefined,
    });
    options.value = mergeSelected(res.data ?? []);
    searched.value = true;
  } catch (e) {
    console.error('[EmployeeSelect] 员工搜索失败', e);
    options.value = selected.value ? [selected.value] : [];
  } finally {
    loading.value = false;
  }
};

const handleUpdate = (value: string | number | undefined) => {
  emit('update:modelValue', value);
};

const handleChange = (value: string | number | undefined) => {
  const opt = options.value.find((o) => String(o.employeeId) === String(value)) ?? null;
  selected.value = opt;
  emit('change', value, opt);
};

const handleClear = () => {
  selected.value = null;
  options.value = [];
  searched.value = false;
  emit('change', undefined, null);
};

/** 首次展开且当前有选中值时，确保选项里有选中项以正确回显姓名 */
const handleVisible = (visible: boolean) => {
  if (visible && props.modelValue != null && props.modelValue !== '' && options.value.length === 0
    && selected.value && String(selected.value.employeeId) === String(props.modelValue)) {
    options.value = [selected.value];
  }
};
</script>

<style scoped>
.emp-code {
  color: var(--el-text-color-regular);
}
.emp-dept {
  float: right;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.emp-left {
  margin-right: 6px;
  color: var(--el-text-color-placeholder);
}
</style>
