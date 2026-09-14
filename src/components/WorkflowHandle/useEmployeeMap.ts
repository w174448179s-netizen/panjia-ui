import { ref } from 'vue';
import { employeeApi } from '@/api/panjia/employee';

/**
 * 弹窗办理场景的员工姓名解析。
 * 多个流程详情组件共用：业务角色没有 system:user:query 权限，
 * 员工姓名一律走员工档案表（employeeApi），不查系统用户表。
 *
 * 缓存策略：Map 与加载状态放在模块级，所有组件实例、多次弹窗共享一份，
 * 员工全量只拉一次（pageSize 9999），重复打开弹窗不重复请求。
 */
const employeeMap = ref(new Map<number, string>());
let loaded = false;
let pending: Promise<void> | null = null;

const doLoad = async () => {
  try {
    const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
    const map = new Map<number, string>();
    for (const e of res.data?.rows ?? []) {
      if (e.employeeId != null) map.set(Number(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
    }
    employeeMap.value = map;
    loaded = true;
  } catch {
    /* 拦截器已提示，弹窗内各字段自行兜底 */
    pending = null; // 失败后允许下次重试
  }
};

export function useEmployeeMap() {
  /** 幂等加载：并发调用共享同一 Promise，已加载直接返回 */
  const load = (): Promise<void> => {
    if (loaded) return Promise.resolve();
    if (!pending) pending = doLoad();
    return pending;
  };

  /** 取员工姓名；未知 ID 回退为「员工#ID」，空值显示 — */
  const name = (empId: number | string | null | undefined): string => {
    if (empId === null || empId === undefined || String(empId).trim() === '') return '—';
    return employeeMap.value.get(Number(empId)) ?? `员工#${empId}`;
  };

  return { load, name };
}
