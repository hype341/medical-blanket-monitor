<template>
  <div class="staff-page">
    <header class="admin-page-header">
      <div>
        <span>{{ store.hospital.name }} · 管理中心</span>
        <h1>人员权限管理</h1>
        <p>管理登录账号、角色、授权病区和账号启停状态。</p>
      </div>
      <el-button type="primary" @click="openEditor()">新增人员</el-button>
    </header>

    <div class="staff-summary">
      <span>共 {{ store.staff.length }} 个账号</span>
      <span>{{ activeCount }} 个启用</span>
      <span>角色决定操作权限，病区授权决定可查看范围</span>
    </div>

    <div class="staff-table">
      <div class="staff-table__head">
        <span>人员</span>
        <span>登录账号</span>
        <span>角色</span>
        <span>授权病区</span>
        <span>状态</span>
        <span>操作</span>
      </div>
      <div v-for="member in store.staff" :key="member.id" class="staff-row">
        <strong>{{ member.displayName }}</strong>
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
          <el-button text type="primary" @click="openEditor(member.id)">编辑</el-button>
          <el-button
            text
            :type="member.status === 'ACTIVE' ? 'danger' : 'success'"
            @click="toggleStatus(member.id)"
          >
            {{ member.status === "ACTIVE" ? "停用" : "启用" }}
          </el-button>
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
          <el-radio-group v-model="form.role">
            <el-radio-button value="NURSE">护士</el-radio-button>
            <el-radio-button value="HEAD_NURSE">护士长</el-radio-button>
            <el-radio-button value="ADMIN">管理员</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="授权病区">
          <el-select v-model="form.wardIds" multiple class="w-full">
            <el-option
              v-for="ward in store.wards"
              :key="ward.id"
              :label="ward.name"
              :value="ward.id"
            />
          </el-select>
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
          <small class="password-hint">密码由后端使用 BCrypt 哈希保存，页面不会回显原密码。</small>
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
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { ElMessage } from "element-plus";
import { useMonitoringStore } from "../store";
import type { MonitoringRole, StaffInput, StaffStatus } from "../types";

const store = useMonitoringStore();
const editorVisible = ref(false);
const editingStaffId = ref("");
const form = reactive<StaffInput>({
  username: "",
  displayName: "",
  role: "NURSE",
  wardIds: [],
  status: "ACTIVE",
});

const activeCount = computed(
  () => store.staff.filter((member) => member.status === "ACTIVE").length,
);

function openEditor(staffId?: string): void {
  editingStaffId.value = staffId ?? "";
  if (staffId) {
    const member = store.staff.find((item) => item.id === staffId);
    if (!member) return;
    Object.assign(form, {
      username: member.username,
      displayName: member.displayName,
      role: member.role,
      wardIds: [...member.wardIds],
      status: member.status,
      initialPassword: "",
    });
  } else {
    Object.assign(form, {
      username: "",
      displayName: "",
      role: "NURSE" as MonitoringRole,
      wardIds: store.wards[0] ? [store.wards[0].id] : [],
      status: "ACTIVE" as StaffStatus,
      initialPassword: "",
    });
  }
  editorVisible.value = true;
}

function save(): void {
  try {
    if (editingStaffId.value) {
      store.updateStaff(editingStaffId.value, form);
    } else {
      store.addStaff(form);
    }
    form.initialPassword = "";
    editorVisible.value = false;
    ElMessage.success("人员权限已保存");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "人员权限保存失败");
  }
}

function toggleStatus(staffId: string): void {
  const member = store.staff.find((item) => item.id === staffId);
  if (!member) return;
  store.updateStaff(staffId, {
    username: member.username,
    displayName: member.displayName,
    role: member.role,
    wardIds: member.wardIds,
    status: member.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
    initialPassword: "",
  });
  ElMessage.success("账号状态已更新");
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
  font-size: 10px;
  color: #647b74;
  background: #f4f9f7;
  border-left: 3px solid #2f806a;
}

.staff-table {
  margin-top: 14px;
  overflow-x: auto;
  background: #fff;
  border: 1px solid #dbe6e2;
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
    font-size: 9px;
    color: #879590;
  }
}

.password-hint {
  display: block;
  margin-top: 5px;
  font-size: 9px;
  color: #81918c;
}

.staff-table__head {
  height: 42px;
  font-size: 10px;
  font-weight: 650;
  color: #60766f;
  background: #edf4f1;
}

.staff-row {
  min-height: 64px;
  font-size: 11px;
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
}

.staff-editor__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
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
