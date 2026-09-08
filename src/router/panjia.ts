import type { RouteRecordRaw } from 'vue-router';
import Layout from '@/layout/index.vue';

const panjiaRoutes: RouteRecordRaw[] = [
  {
    path: '/panjia',
    component: Layout,
    redirect: '/panjia/employee',
    meta: { title: '盘家智管', icon: 'home' },
    children: [
      // 员工管理
      {
        path: 'employee',
        name: 'Employee',
        component: () => import('@/views/panjia/employee/index.vue'),
        meta: { title: '员工档案', roles: ['admin', 'manager', 'director'] }
      },
      {
        path: 'employee/detail/:id',
        name: 'EmployeeDetail',
        component: () => import('@/views/panjia/employee/detail.vue'),
        meta: { title: '员工详情', hidden: true }
      },
      {
        path: 'employee/rank',
        name: 'RankRule',
        component: () => import('@/views/panjia/employee/rank.vue'),
        meta: { title: '职级规则', roles: ['admin', 'manager'] }
      },
      {
        path: 'employee/mentor',
        name: 'Mentor',
        component: () => import('@/views/panjia/employee/mentor.vue'),
        meta: { title: '师徒关系', roles: ['admin', 'manager'] }
      },
      // 佣金管理
      {
        path: 'commission',
        name: 'Commission',
        component: () => import('@/views/panjia/commission/index.vue'),
        meta: { title: '贝壳数据导入', roles: ['admin', 'manager', 'salary'] }
      },
      {
        path: 'commission/approval',
        name: 'CommissionApproval',
        component: () => import('@/views/panjia/commission/approval.vue'),
        meta: { title: '结佣审批', roles: ['admin', 'director'] }
      },
      {
        path: 'commission/adjustment',
        name: 'Adjustment',
        component: () => import('@/views/panjia/commission/adjustment.vue'),
        meta: { title: '业绩调整', roles: ['admin', 'manager', 'director'] }
      },
      // 考勤积分
      {
        path: 'attendance',
        name: 'Attendance',
        component: () => import('@/views/panjia/attendance/index.vue'),
        meta: { title: '考勤导入', roles: ['admin', 'hr'] }
      },
      {
        path: 'attendance/score',
        name: 'Score',
        component: () => import('@/views/panjia/attendance/score.vue'),
        meta: { title: '积分导入', roles: ['admin', 'hr'] }
      },
      // 工资管理
      {
        path: 'salary',
        name: 'Salary',
        component: () => import('@/views/panjia/salary/index.vue'),
        meta: { title: '工资计算', roles: ['admin', 'manager', 'salary'] }
      },
      {
        path: 'salary/batch/:id',
        name: 'SalaryBatch',
        component: () => import('@/views/panjia/salary/batch.vue'),
        meta: { title: '工资批次', hidden: true }
      },
      {
        path: 'salary/detail/:employeeId',
        name: 'SalaryDetail',
        component: () => import('@/views/panjia/salary/detail.vue'),
        meta: { title: '工资明细', hidden: true }
      },
      {
        path: 'salary/bonus',
        name: 'Bonus',
        component: () => import('@/views/panjia/salary/bonus.vue'),
        meta: { title: '奖金审批', roles: ['admin', 'manager', 'director'] }
      },
      {
        path: 'salary/other-finance',
        name: 'OtherFinance',
        component: () => import('@/views/panjia/salary/otherFinance.vue'),
        meta: { title: '其他收支', roles: ['admin', 'salary'] }
      },
      // 分析报表
      {
        path: 'analysis',
        name: 'DeptLedger',
        component: () => import('@/views/panjia/analysis/index.vue'),
        meta: { title: '部门收支分析', roles: ['admin', 'director'] }
      }
    ]
  }
];

export default panjiaRoutes;
