import { Card } from '@/ui';

/** Shown until the role owner replaces roles/<role>/index.tsx with the real screens. */
export function Placeholder({ role, owner, routes }: { role: string; owner: string; routes: string[] }) {
  return (
    <Card title={`${role} screens`} subtitle={`Owned by ${owner}. Replace apps/web/src/roles/${role.toLowerCase()}/index.tsx.`}>
      <p className="mb-2 text-sm">The scaffold is wired: auth, role guard, layout, API client, fixtures and UI kit are ready. Routes expected here:</p>
      <ul className="list-inside list-disc text-sm text-muted">{routes.map((r) => <li key={r}><code>{r}</code></li>)}</ul>
    </Card>
  );
}
