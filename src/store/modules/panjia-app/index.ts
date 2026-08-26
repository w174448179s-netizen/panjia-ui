import { defineStore } from 'pinia';

interface PanjiaAppState {
  currentStoreId: string;
  currentStoreName: string;
  roleType: string;
  permissionBits: number;
}

export const usePanjiaAppStore = defineStore('panjia-app', {
  state: (): PanjiaAppState => ({
    currentStoreId: '',
    currentStoreName: '',
    roleType: '',
    permissionBits: 0
  }),
  getters: {
    isBroker: (state) => state.roleType === 'broker',
    isManager: (state) => state.roleType === 'manager',
    isDirector: (state) => state.roleType === 'director',
    storeLabel: (state) => state.currentStoreName || '全部门店'
  },
  actions: {
    setStoreInfo(storeId: string, storeName: string) {
      this.currentStoreId = storeId;
      this.currentStoreName = storeName;
    },
    setRoleType(roleType: string) {
      this.roleType = roleType;
    },
    setPermissionBits(bits: number) {
      this.permissionBits = bits;
    },
    reset() {
      this.currentStoreId = '';
      this.currentStoreName = '';
      this.roleType = '';
      this.permissionBits = 0;
    }
  }
});
