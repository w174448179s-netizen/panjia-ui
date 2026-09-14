import { ref } from 'vue';
import { employeeApi } from '@/api/panjia/employee';

/**
 * 弹窗办理场景的员工姓名解析。
 * 多个流程详情组件共用：业务角色没有 system:user:query 权限，
 * 员工姓名一律走员工档案表（employeeApi），不查系统用户表。
 */
export function useEmployeeMap() {
  const employeeMap = ref(new Map<number, string>());
  const loaded = ref(false);

  /** 加载员工全量（仅一次），失败时下次弹窗可重试 */
  const load = async () => {
    if (loaded.value) return;
    try {
      const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
      const map = new Map<number, string>();
      for (const e of res.data?.rows ?? []) {
        if (e.employeeId != null) map.set(Number(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
      }
      employeeMap.value = map;
      loaded.value = true;
    } catch {
      /* 拦截器已提示，弹窗内各字段自行兜底 */
    }
  };

  /** 取员工姓名；未知 ID 回退为「员工#ID」，空值显示 — */
  const name = (empId: number | string | null | undefined): string => {
    if (empId === null || empId === undefined || String(empId).trim() === '') return '—';
    return employeeMap.value.get(Number(empId)) ?? `员工#${empId}`;
  };

  return { load, name };
}
