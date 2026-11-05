<template>
  <div class="staff-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 管理中心</span>
        <h1>人员权限管理</h1>
        <p>管理登录账号、角色、角色标签、授权病区和账号状态，仅可操作低于自身级别的账号。</p>
      </div>
      <el-button type="primary" @click="openEditor()">新增人员</el-button>
    </header>

    <div class="staff-summary">
      <span>共 {{ visibleStaff.length }} 个账号</span>
      <span>{{ activeCount }} 个启用</span>
      <span>可管理 {{ manageableStaffCount }} 个下级账号</span>
      <span>只能授予自己拥有的模块和病区权限</span>
    </div>

    <section class="staff-tag-manager" aria-label="角色标签管理">
      <div>
        <span>角色标签</span>
        <small>用于标注责任分工、班次或岗位属性，不改变系统权限</small>
      </div>
      <div class="staff-tag-manager__items">
        <el-tag v-for="tag in store.staffTags" :key="tag" effect="plain" round>{{ tag }}</el-tag>
        <el-button
          class="staff-tag-manager__add"
          circle
          aria-label="新增角色标签"
          title="新增角色标签"
          @click="tagEditorVisible = true"
        >
          +
        </el-button>
      </div>
    </section>

    <div class="staff-table">
      <div class="staff-table__head">
        <span>人员</span>
        <span>登录账号</span>
        <span>角色</span>
        <span>授权病区</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <div v-for="member in visibleStaff" :key="member.id" class="staff-row">
        <div class="staff-name-cell">
          <strong>{{ member.displayName }}</strong>
          <div v-if="member.tags?.length" class="staff-name-cell__tags">
            <el-tag v-for="tag in member.tags" :key="tag" size="small" effect="plain">
              {{ tag }}
            </el-tag>
          </div>
        </div>
        <div class="account-cell">
          <span>{{ member.username }}</span>
          <small>{{ member.passwordUpdatedAt ? "密码已设置" : "密码未设置" }}</small>
        </div>
        <span class="role-tag" :data-role="member.role">{{ roleLabel(member.role) }}</span>
        <span>{{ wardNames(member.wardIds) }}</span>
        <span class="account-status" :data-status="member.status">
          {{ member.status === "ACTIVE" ? "启用" : "停用" }}
        </span>
        <div class="staff-row__actions">
          <template v-if="store.canManageMember(member.id)">
            <el-button text type="primary" @click="openEditor(member.id)">编辑</el-button>
            <el-button
              text
              :type="member.status === 'ACTIVE' ? 'danger' : 'success'"
              @click="toggleStatus(member.id)"
            >
              {{ member.status === "ACTIVE" ? "停用" : "启用" }}
            </el-button>
          </template>
          <span v-else class="staff-row__locked" title="不能管理同级或更高级账号">
            不可管理
          </span>
        </div>
      </div>
    </div>

    <el-dialog
      v-model="editorVisible"
      :title="editingStaffId ? '编辑人员权限' : '新增人员'"
      width="560px"
      destroy-on-close
    >
      <el-form label-position="top">
        <div class="staff-editor__row">
          <el-form-item label="登录账号">
            <el-input v-model.trim="form.username" placeholder="登录账号" maxlength="40" />
          </el-form-item>
          <el-form-item label="人员姓名">
            <el-input v-model.trim="form.displayName" placeholder="人员姓名" maxlength="30" />
          </el-form-item>
        </div>
        <el-form-item label="角色">
          <el-radio-group v-model="form.role" @change="applyRoleDefaults(form.role)">
            <el-radio-button
              v-for="role in selectableRoles"
              :key="role.value"
              :value="role.value"
            >
              {{ role.label }}
            </el-radio-button>
          </el-radio-group>
          <small class="permission-hint">同级和更高级角色不会出现在这里。</small>
        </el-form-item>
        <el-form-item label="授权病区">
          <el-select v-model="form.wardIds" multiple class="w-full">
            <el-option
              v-for="ward in store.currentWards"
              :key="ward.id"
              :label="ward.name"
              :value="ward.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="角色标签">
          <el-select
            v-model="form.tags"
            multiple
            filterable
            allow-create
            default-first-option
            class="staff-tag-select w-full"
            aria-label="角色标签"
            placeholder="选择或输入标签"
          >
            <el-option v-for="tag in store.staffTags" :key="tag" :label="tag" :value="tag" />
          </el-select>
        </el-form-item>
        <el-form-item label="开放模块">
          <el-checkbox-group v-model="form.modulePermissions" class="module-grid">
            <el-checkbox
              v-for="module in selectableModules"
              :key="module.value"
              :value="module.value"
            >
              {{ module.label }}
            </el-checkbox>
          </el-checkbox-group>
          <small class="permission-hint">
            仅显示当前账号已拥有的模块，保存时还会再次校验。
          </small>
        </el-form-item>
        <el-form-item :label="editingStaffId ? '重置密码（可选）' : '登录密码'">
          <el-input
            v-model="form.initialPassword"
            type="password"
            show-password
            autocomplete="new-password"
            :placeholder="editingStaffId ? '新密码（留空则不修改）' : '登录密码'"
            maxlength="64"
          />
          <small class="password-hint">
            密码使用加盐摘要保存，页面不会回显原密码；正式联网部署应由后端再次校验并限制登录频率。
          </small>
        </el-form-item>
        <el-form-item label="账号状态">
          <el-radio-group v-model="form.status">
            <el-radio-button value="ACTIVE">启用</el-radio-button>
            <el-radio-button value="DISABLED">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">取消</el-button>
        <el-button
          type="primary"
          :disabled="
            !form.username ||
            !form.displayName ||
            !form.wardIds.length ||
            (!editingStaffId && !form.initialPassword)
          "
          @click="save"
        >
          保存人员权限
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="tagEditorVisible" title="新建角色标签" width="420px">
      <el-form label-position="top">
        <el-form-item label="标签名称">
          <el-input
            v-model.trim="newTagName"
            aria-label="角色标签名称"
            maxlength="20"
            placeholder="例如：责任护士、夜班、实习"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tagEditorVisible = false">取消</el-button>
        <el-button type="primary" :disabled="!newTagName.trim()" @click="addTag">
          确认添加标签
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { defaultModulesForRole, moduleOptions, roleRank } from "../permissions";
import { useMonitoringStore } from "../store";
import type { MonitoringRole, StaffInput, StaffStatus } from "../types";
import { saveStaffPassword } from "../staff-credentials";

const store = useMonitoringStore();
const editorVisible = ref(false);
const tagEditorVisible = ref(false);
const newTagName = ref("");
const editingStaffId = ref("");
const form = reactive<StaffInput>({
  username: "",
  displayName: "",
  role: "NURSE",
  wardIds: [],
  status: "ACTIVE",
  modulePermissions: defaultModulesForRole("NURSE"),
  tags: [],
});

const activeCount = computed(
  () => visibleStaff.value.filter((member) => member.status === "ACTIVE").length,
);
const visibleStaff = computed(() =>
  store.activeRole === "DEVELOPER"
    ? store.staff
    : store.staff.filter((member) => member.role !== "DEVELOPER"),
);
const selectableModules = computed(() =>
  moduleOptions.filter((module) => store.activeModulePermissions.includes(module.value)),
);
const selectableRoles = computed(() => {
  const labels: Record<MonitoringRole, string> = {
    NURSE: "护士",
    HEAD_NURSE: "护士长",
    ADMIN: "管理员",
    DEVELOPER: "开发者",
  };
  return (Object.keys(roleRank) as MonitoringRole[])
    .filter((role) => roleRank[role] < roleRank[store.activeRole])
    .map((role) => ({ value: role, label: labels[role] }));
});
const manageableStaffCount = computed(
  () => visibleStaff.value.filter((member) => store.canManageMember(member.id)).length,
);

function openEditor(staffId?: string): void {
  editingStaffId.value = staffId ?? "";
  if (staffId) {
    const member = visibleStaff.value.find((item) => item.id === staffId);
    if (!member) return;
    if (!store.canManageMember(member.id)) {
      ElMessage.warning("只能管理级别低于自己的账号");
      return;
    }
    Object.assign(form, {
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      wardIds: [...member.wardIds],
      status: member.status,
      modulePermissions: [...(member.modulePermissions ?? [])],
      tags: [...(member.tags ?? [])],
      initialPassword: "",
    });
  } else {
    Object.assign(form, {
      username: "",
      displayName: "",
      role: "NURSE" as MonitoringRole,
      wardIds: store.wards[0] ? [store.wards[0].id] : [],
      status: "ACTIVE" as StaffStatus,
      modulePermissions: defaultModulesForRole("NURSE"),
      tags: [],
      initialPassword: "",
    });
  }
  editorVisible.value = true;
}

function save(): void {
  try {
    let staffId = editingStaffId.value;
    if (editingStaffId.value) {
      store.updateStaff(editingStaffId.value, form);
    } else {
      staffId = store.addStaff(form);
    }
    if (staffId && form.initialPassword) {
      saveStaffPassword(staffId, form.initialPassword);
    }
    form.initialPassword = "";
    editorVisible.value = false;
    ElMessage.success("人员权限已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "人员权限保存失败");
  }
}

function toggleStatus(staffId: string): void {
  const member = visibleStaff.value.find((item) => item.id === staffId);
  if (!member) return;
  try {
    store.updateStaff(staffId, {
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      wardIds: member.wardIds,
      status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      modulePermissions: [...(member.modulePermissions ?? [])],
      tags: [...(member.tags ?? [])],
      initialPassword: "",
    });
    ElMessage.success("账号状态已更新");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "账号状态更新失败");
  }
}

function addTag(): void {
  try {
    store.addStaffTag(newTagName.value);
    newTagName.value = "";
    tagEditorVisible.value = false;
    ElMessage.success("角色标签已添加");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "角色标签添加失败");
  }
}

function roleLabel(role: MonitoringRole): string {
  return {
    NURSE: "护士",
    HEAD_NURSE: "护士长",
    ADMIN: "管理员",
    DEVELOPER: "开发者",
  }[role];
}

function wardNames(wardIds: string[]): string {
  const names = store.wards
    .filter((ward) => wardIds.includes(ward.id))
    .map((ward) => ward.name.replace(` · ${ward.name.split(" · ")[1]}`, ""));
  return names.length ? names.join("、") : "未授权";
}

function applyRoleDefaults(role: MonitoringRole): void {
  form.modulePermissions = defaultModulesForRole(role).filter((module) =>
    store.activeModulePermissions.includes(module),
  );
}
</script>

<style scoped lang="scss">
.staff-page {
  color: #173c3a;
}

.admin-page-header {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  justify-content: space-between;
  padding: 6px 2px 20px;
  border-bottom: 1px solid #dbe6e2;

  span {
    font-size: 11px;
    font-weight: 650;
    color: #4b766c;
    letter-spacing: 0.06em;
  }

  h1 {
    margin: 5px 0 4px;
    font-family: "Avenir Next", "Noto Sans SC", sans-serif;
    font-size: clamp(28px, 3vw, 40px);
    font-weight: 650;
    letter-spacing: -0.04em;
  }

  p {
    margin: 0;
    font-size: 13px;
    color: #6e817c;
  }
}

.staff-summary {
  display: flex;
  gap: 18px;
  padding: 12px 14px;
  margin-top: 16px;
  font-size: 12px;
  color: #647b74;
  background: #f4f9f7;
  border-left: 3px solid #2f806a;
}

.staff-tag-manager {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: space-between;
  padding: 11px 14px;
  margin-top: 10px;
  background: #fbfcfb;
  border: 1px solid #e0e8e5;

  > div:first-child {
    display: grid;
    gap: 3px;

    span {
      font-size: 12px;
      font-weight: 650;
      color: #315f55;
    }

    small {
      font-size: 11px;
      color: #7e8e89;
    }
  }
}

.staff-tag-manager__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.staff-tag-manager__add {
  width: 26px;
  height: 26px;
  color: #2f806a;
  background: #edf7f2;
  border-color: #bdd6ce;
}

.staff-table {
  margin-top: 14px;
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dbe6e2;
}

.staff-name-cell {
  display: grid;
  gap: 5px;
  min-width: 0;

  strong {
    color: #315f55;
  }
}

.staff-name-cell__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;

  :deep(.el-tag) {
    height: 18px;
    padding: 0 5px;
    font-size: 10px;
    color: #5d6f69;
    background: #f3f6f5;
    border-color: #dfe6e3;
  }
}

.staff-table__head,
.staff-row {
  display: grid;
  grid-template-columns: 1.1fr 1fr 0.8fr 1.6fr 0.6fr 120px;
  gap: 12px;
  align-items: center;
  min-width: 860px;
  padding: 0 16px;
}

.account-cell {
  display: grid;
  gap: 3px;

  span {
    color: #526b64;
  }

  small {
    font-size: 11px;
    color: #879590;
  }
}

.password-hint {
  display: block;
  margin-top: 5px;
  font-size: 11px;
  color: #81918c;
}

.staff-table__head {
  height: 42px;
  font-size: 11px;
  font-weight: 650;
  color: #60766f;
  background: #edf4f1;
}

.staff-row {
  min-height: 72px;
  font-size: 12px;
  border-top: 1px solid #e5ece9;

  > span {
    overflow: hidden;
    text-overflow: ellipsis;
    color: #667b75;
    white-space: nowrap;
  }

  > strong {
    font-size: 12px;
  }
}

.role-tag,
.account-status {
  justify-self: start;
  padding: 3px 6px;
  color: #2f6b5e;
  background: #edf7f2;
  border: 1px solid #c5dbd4;
}

.role-tag[data-role="ADMIN"] {
  color: #8f3c33;
  background: #fff0ee;
  border-color: #e4b2ac;
}

.account-status[data-status="DISABLED"] {
  color: #707d79;
  background: #f3f5f4;
  border-color: #d7dfdc;
}

.staff-row__actions {
  display: flex;
  align-items: center;
}

.staff-row__locked {
  font-size: 11px;
  color: #8a9793;
}

.staff-editor__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.module-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px 14px;
  width: 100%;
  padding: 12px;
  background: #f6faf8;
  border: 1px solid #e1e9e6;
}

.permission-readonly {
  padding: 10px 12px;
  margin-bottom: 18px;
  font-size: 11px;
  color: #7a625d;
  background: #fff6f3;
  border-left: 3px solid #b96b5f;
}

.permission-hint {
  display: block;
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.55;
  color: #788a84;
}

@media (width <= 620px) {
  .admin-page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .staff-editor__row {
    grid-template-columns: 1fr;
  }
}
</style>
