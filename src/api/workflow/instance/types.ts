import type { FlowTaskVO } from '@/api/workflow/task/types';

export interface FlowInstanceQuery extends PageQuery {
  category?: string | number;
  nodeName?: string;
  flowCode?: string;
  flowName?: string;
  createByIds?: Array<string | number>;
  businessId?: string;
  /** 业务标题关键字（合同号/房源地址/账期/金额等） */
  businessTitle?: string;
}

export interface FlowInstanceVO extends BaseEntity {
  id: string | number;
  definitionId: string;
  flowName: string;
  flowCode: string;
  version: string;
  businessId: string;
  activityStatus: number;
  tenantId: string;
  createTime: string;
  createBy: string;
  flowStatus: string;
  flowStatusName: string;
  flowTaskList: FlowTaskVO[];
  businessCode: string;
  businessTitle: string;
}
