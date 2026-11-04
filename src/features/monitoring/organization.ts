export interface RoleProtectedRoute {
  path: string;
  meta?: {
    roles?: readonly string[];
    module?: string;
    [key: string]: unknown;
  };
  children?: readonly RoleProtectedRoute[];
}

export function filterRoutesForRole<T extends RoleProtectedRoute>(
  routes: readonly T[],
  role: string,
  permissions?: readonly string[],
): T[] {
  return routes.flatMap((route) => {
    const roles = route.meta?.roles;
    if (roles?.length && !roles.includes(role)) return [];
    const module = route.meta?.module;
    if (permissions && module && !permissions.includes(module)) return [];
    if (!route.children?.length) return [{ ...route }];

    return [
      {
        ...route,
        children: filterRoutesForRole(route.children, role, permissions),
      } as T,
    ];
  });
}
