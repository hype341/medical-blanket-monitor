import { defineMock } from "./base";

/**
 * 本地开发未启动实时通知服务。
 *
 * 按后端约定返回 503 + B0102，前端会静默禁用实时连接，
 * 不会把本地 Mock 会话误判为登录失效。
 */
export default defineMock([
  {
    url: "realtime/tickets",
    method: ["POST"],
    status: 503,
    body: {
      code: "B0102",
      data: null,
      msg: "实时服务未启用",
    },
  },
]);
