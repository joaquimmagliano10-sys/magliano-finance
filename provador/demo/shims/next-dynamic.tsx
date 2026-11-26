/** Substituto de `next/dynamic` na demonstração estática (React.lazy + Suspense). */
import { type ComponentType, forwardRef, lazy, type ReactNode, Suspense } from "react";

type Loader = () => Promise<ComponentType<never> | { default: ComponentType<never> }>;

export default function dynamic(loader: Loader, opts?: { loading?: () => ReactNode; ssr?: boolean }) {
  const Lazy = lazy(async () => {
    const m = await loader();
    return { default: ("default" in m ? m.default : m) as ComponentType<Record<string, unknown>> };
  });
  return forwardRef<unknown, Record<string, unknown>>(function DynamicComponent(props, ref) {
    return (
      <Suspense fallback={opts?.loading?.() ?? null}>
        <Lazy {...props} ref={ref} />
      </Suspense>
    );
  });
}
