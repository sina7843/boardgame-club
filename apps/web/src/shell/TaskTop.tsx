import { Button } from '@bg/ui/bgv';

/** Phone task screens (Studio, avatar builder): a ✕ bar instead of the shell; hidden on desktop by CSS. */
export function TaskTop({ title, close }: { title: string; close: string }) {
  return (
    <header className="pf-tasktop">
      <Button variant="ghost" iconOnly icon="x" href={close}>بستن</Button>
      <h1 className="t-h3">{title}</h1>
    </header>
  );
}
