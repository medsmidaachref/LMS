import { ArrowLeft, Compass } from 'lucide-react';
import { Link } from 'wouter';

export default function NotFound() {
  return <main className="grid min-h-[100dvh] place-items-center bg-background px-6 text-center"><div className="page-enter"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-accent text-accent-foreground"><Compass size={28} /></div><p className="mono mt-6 text-xs uppercase tracking-[.2em] text-primary">404 · off the map</p><h1 className="mt-3 text-5xl font-semibold tracking-[-.06em]">That page wandered off.</h1><p className="mx-auto mt-4 max-w-md text-muted-foreground">The address is not part of this workspace. Let’s get you somewhere useful.</p><Link href="/" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-3 text-sm font-semibold text-background" data-testid="link-not-found-home"><ArrowLeft size={16} /> Back to Master Class</Link></div></main>;
}
