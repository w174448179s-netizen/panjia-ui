import { ref } from 'vue';
import { employeeApi } from '@/api/panjia/employee';

/**
 * 弹窗办理场景的员工姓名解析。
 * 多个流程详情组件共用：业务角色没有 system:user:query 权限，
 * 员工姓名一律走员工档案表（employeeApi），不查系统用户表。
 *
 * 缓存为模块级单例：员工全量（9999 条）整个会话只拉一次，
 * 多个详情组件、多次打开弹窗共享；请求失败不置已加载，下次可重试。
 */
let sharedPromise: Promise<void> | null = null;
// 员工 ID 为 19 位雪花：后端以字符串下发，超出 JS 安全整数。
// 统一用 String 做 key，禁止 Number()（丢精度后不同员工可能舍入到同一 key，姓名错乱）
const employeeMap = ref(new Map<string, string>());

const doLoad = async () => {
  try {
    const res: any = await employeeApi.list({ pageNum: 1, pageSize: 9999 });
    const map = new Map<string, string>();
    for (const e of res.data?.rows ?? []) {
      if (e.employeeId != null) map.set(String(e.employeeId), e.employeeName || `员工#${e.employeeId}`);
    }
    employeeMap.value = map;
  } catch {
    /* 拦截器已提示，弹窗内各字段自行兜底；失败不缓存，下次重试 */
    sharedPromise = null;
  }
};

export function useEmployeeMap() {
  /** 加载员工全量（模块级共享，进行中的请求复用同一个 Promise） */
  const load = (): Promise<void> => (sharedPromise ??= doLoad());

  /** 取员工姓名；未知 ID 回退为「员工#ID」，空值显示 — */
  const name = (empId: number | string | null | undefined): string => {
    if (empId === null || empId === undefined || String(empId).trim() === '') return '—';
    return employeeMap.value.get(String(empId)) ?? `员工#${empId}`;
  };

  return { load, name };
}
