let pendingContext = null;

export function setNavigationContext(route, context = {}) {
  pendingContext = route ? { route, ...context } : null;
}

export function takeNavigationContext(route) {
  if (!pendingContext || pendingContext.route !== route) return null;
  const context = { ...pendingContext };
  pendingContext = null;
  delete context.route;
  return context;
}

export function clearNavigationContext() {
  pendingContext = null;
}
