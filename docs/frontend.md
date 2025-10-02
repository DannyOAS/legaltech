# Frontend Patterns and Design System

## Stack Overview

- **Framework**: React 18 + Vite with React Router for routing and SWR for declarative data fetching.
- **Styling**: Tailwind CSS (see `frontend/tailwind.config.js`) with a `primary` color scale mapped to brand tones and typography utilities.
- **State & Auth**: Context-based auth provider in `frontend/src/features/auth/AuthContext.tsx` exposes the current user, roles, and loading state to guards and UI.
- **UI Primitives**: Found under `frontend/src/components/ui/` (e.g., [`Button.tsx`](../frontend/src/components/ui/Button.tsx), [`Modal.tsx`](../frontend/src/components/ui/Modal.tsx), [`ToastProvider.tsx`](../frontend/src/components/ui/ToastProvider.tsx)). Components expect Tailwind class names and provide shared accessibility semantics.

## Loading Experience Pattern

Many pages fetch paginated data via SWR. To avoid jarring layout shifts, load states now use lightweight skeletons:

| Feature | Implementation | Notes |
|---------|----------------|-------|
| Clients | [`ClientsPage.tsx`](../frontend/src/features/clients/ClientsPage.tsx) -> `renderLoadingSkeleton()` | Desktop table + mobile cards mirror final layout with `animate-pulse`. |
| Matters | [`MattersPage.tsx`](../frontend/src/features/matters/MattersPage.tsx) -> `renderLoadingSkeleton()` | Works for both board and table layouts by matching card structure. |
| Deadlines | [`DeadlinesListPage.tsx`](../frontend/src/features/deadlines/DeadlinesListPage.tsx) -> `renderLoadingSkeleton()` | Skeleton rows maintain list spacing during filter churn. |
| Billing | [`BillingPage.tsx`](../frontend/src/features/billing/BillingPage.tsx) -> `renderTableSkeleton()` | Reusable table builder for time, expense, and invoice tabs. |
| Portal | [`PortalPage.tsx`](../frontend/src/features/portal/PortalPage.tsx) -> `renderDocumentSkeleton()` | Aligns with document list cards and respects responsive columns. |

**How to extend**

1. Read SWR state: use `const { data, isLoading } = useSWR(...)`.
2. Render skeleton until the definitive data shape exists (`isLoading` or `!data`).
3. Match the final DOM structure (`flex`, `grid`, table rows) so dimensions remain stable.
4. Use Tailwind utility `animate-pulse` with brand-neutral surfaces (`bg-slate-200`).

> Tip: extract repeated skeleton JSX into `frontend/src/components/ui/Skeleton.tsx` if more screens need similar placeholders.

## Role-Based Access Patterns

To avoid scattering role checks, two shared components manage visibility and routing:

| Component | Location | Purpose | Example |
|-----------|----------|---------|---------|
| `RoleGuard` | [`frontend/src/features/auth/RoleGuard.tsx`](../frontend/src/features/auth/RoleGuard.tsx) | Wraps interactive controls inside a page. Accepts `allow`, optional `deny`, and `fallback`. | `RoleGuard allow={["Owner", "Admin"]}><Button>Delete</Button></RoleGuard>` |
| `RoleProtectedRoute` | [`frontend/src/features/auth/RoleProtectedRoute.tsx`](../frontend/src/features/auth/RoleProtectedRoute.tsx) | Gate entire route segments. Combines with React Router `Outlet` to render nested routes only for authorized roles. | `<Route element={<RoleProtectedRoute allow={STAFF_ROLES} />}>…</Route>` |

Central wiring lives in [`frontend/src/app/App.tsx`](../frontend/src/app/App.tsx) where staff routes and client portal routes are segmented by role arrays.

When creating new screens:

1. Decide if the whole route is restricted ➜ wrap with `RoleProtectedRoute`.
2. For inline buttons/menus, wrap actions with `RoleGuard` to hide disabled states from forbidden roles.
3. Provide a `fallback` element when you need explanatory messaging (e.g., disabled notice).

## Design Tokens & Tailwind Usage

- Tailwind config defines the project token palette (primary, surface, semantic colors). Favor utility classes over bespoke CSS to keep themes consistent.
- Spacing and typography follow Tailwind scales (`text-sm`, `text-lg`, spacing multiples of 4). When in doubt, mirror existing components.
- For layout containers, leverage the `AppLayout` shell and its padding/breadcrumb slots to maintain consistency.

## Page Composition Checklist

Use this guide when adding a new feature page:

1. **Routing**: Add route in `App.tsx`; wrap with `ProtectedRoute` and `RoleProtectedRoute` if needed.
2. **Fetching**: Call backend via `api` helper (see `frontend/src/lib/api.ts`). Prefer SWR hooks for caching and revalidation.
3. **Loading**: Provide a skeleton that mirrors the finished layout, following the pattern table above.
4. **Empty states & errors**: Use Tailwind muted colors (`text-slate-500`) and `ToastProvider` for toasts.
5. **Components**: Assemble from `components/ui` primitives. Avoid duplicating button/table styles.
6. **Access control**: Gate actions with `RoleGuard`. Keep UI responsive by using the Tailwind responsive utilities already present.

## Further Reading

- [`docs/architecture.md`](./architecture.md) for system-level module boundaries.
- [`docs/api.md`](./api.md) for backend endpoint descriptions and the latest OpenAPI snapshot.
