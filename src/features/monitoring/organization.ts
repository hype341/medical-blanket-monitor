export interface RoleProtectedRoute {
  path: string;
  meta?: {
    roles?: readonly string[];
    [key: string]: unknown;
  };
  children?: readonly RoleProtectedRoute[];
}

export function filterRoutesForRole<T extends RoleProtectedRoute>(
  routes: readonly T[],
  role: string,
): T[] {
  return routes.flatMap((route) => {
    const roles = route.meta?.roles;
    if (roles?.length && !roles.includes(role)) return [];
    if (!route.children?.length) return [{ ...route }];

    return [
      {
        ...route,
        children: filterRoutesForRole(route.children, role),
      } as T,
    ];
  });
}
