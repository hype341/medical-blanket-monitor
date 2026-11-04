import { Storage } from "./storage";
import { STORAGE_KEYS } from "@/constants";
import { readonly, shallowRef } from "vue";

export interface DemoIdentity {
  username: string;
  role: "ADMIN" | "NURSE" | "HEAD_NURSE" | "DEVELOPER";
}

const sessionRevision = shallowRef(0);
// 标识登录会话变化，正常续期不递增，供异步回调判断是否仍属当前账号。
export const authSessionRevision = readonly(sessionRevision);
/**
 * 校验持久化值是否为字符串。
 */
const isString = (value: unknown): value is string => typeof value === "string";
/**
 * 校验持久化值是否为布尔值。
 */
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isDemoIdentity = (value: unknown): value is DemoIdentity => {
  if (typeof value !== "object" || value === null) return false;
  const identity = value as Partial<DemoIdentity>;
  return (
    typeof identity.username === "string" &&
    ["ADMIN", "NURSE", "HEAD_NURSE", "DEVELOPER"].includes(identity.role ?? "")
  );
};

/**
 * 本地凭证与偏好读写
 */
export const AuthStorage = {
  /**
   * 读取访问令牌
   */
  getAccessToken(): string {
    const isRememberMe = Storage.get(STORAGE_KEYS.REMEMBER_ME, false, isBoolean);
    return isRememberMe
      ? Storage.get(STORAGE_KEYS.ACCESS_TOKEN, "", isString)
      : Storage.sessionGet(STORAGE_KEYS.ACCESS_TOKEN, "", isString);
  },

  /**
   * 读取刷新令牌
   */
  getRefreshToken(): string {
    const isRememberMe = Storage.get(STORAGE_KEYS.REMEMBER_ME, false, isBoolean);
    return isRememberMe
      ? Storage.get(STORAGE_KEYS.REFRESH_TOKEN, "", isString)
      : Storage.sessionGet(STORAGE_KEYS.REFRESH_TOKEN, "", isString);
  },

  /**
   * 按“记住我”选择凭证存储，并清理另一存储中的旧令牌。
   * renewing 表示当前会话续期，不递增会话版本。
   */
  setTokens(
    accessToken: string,
    refreshToken: string,
    rememberMe: boolean,
    renewing = false,
  ): void {
    Storage.clear(STORAGE_KEYS.DEMO_IDENTITY);
    Storage.set(STORAGE_KEYS.REMEMBER_ME, rememberMe);
    if (rememberMe) {
      Storage.set(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      Storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      Storage.sessionRemove(STORAGE_KEYS.ACCESS_TOKEN);
      Storage.sessionRemove(STORAGE_KEYS.REFRESH_TOKEN);
    } else {
      Storage.sessionSet(STORAGE_KEYS.ACCESS_TOKEN, accessToken);
      Storage.sessionSet(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      Storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
      Storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    }
    if (!renewing) sessionRevision.value += 1;
  },

  /**
   * 清空令牌
   */
  clearAuth(): void {
    Storage.remove(STORAGE_KEYS.ACCESS_TOKEN);
    Storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
    Storage.sessionRemove(STORAGE_KEYS.ACCESS_TOKEN);
    Storage.sessionRemove(STORAGE_KEYS.REFRESH_TOKEN);
    Storage.clear(STORAGE_KEYS.DEMO_IDENTITY);
    sessionRevision.value += 1;
  },

  /**
   * 保存演示账号身份，供刷新后恢复角色和用户信息。
   */
  setDemoIdentity(identity: DemoIdentity, rememberMe: boolean): void {
    if (rememberMe) {
      Storage.set(STORAGE_KEYS.DEMO_IDENTITY, identity);
    } else {
      Storage.sessionSet(STORAGE_KEYS.DEMO_IDENTITY, identity);
    }
  },

  /**
   * 读取演示账号身份。
   */
  getDemoIdentity(): DemoIdentity | null {
    return (
      Storage.sessionGet(STORAGE_KEYS.DEMO_IDENTITY, null, isDemoIdentity) ??
      Storage.get(STORAGE_KEYS.DEMO_IDENTITY, null, isDemoIdentity)
    );
  },

  /**
   * 当前访问令牌是否来自本地演示登录。
   */
  isDemoSession(): boolean {
    return this.getAccessToken().startsWith("demo-session.");
  },

  /**
   * 读取"记住我"偏好
   */
  getRememberMe(): boolean {
    return Storage.get(STORAGE_KEYS.REMEMBER_ME, false, isBoolean);
  },
};
