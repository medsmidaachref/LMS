import { ReactNode, useState } from 'react';
import { BookOpen, Code2, GraduationCap, LogOut, Menu, X } from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { useListStudentClasses } from '@workspace/api-client-react';

function initials(name?: string) {
  return (name || '?').split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

const statusLabel: Record<string, string> = {
  active: 'Active',
  draft: 'Brouillon',
  archived: 'Archivée',
};

export function StudentShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <div className="grain min-h-[100dvh] bg-background text-foreground">
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar px-4 py-5 text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-3">
          <Link href="/student" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Code2 size={18} /></span>
            <span className="font-semibold tracking-tight">Master Class</span>
          </Link>
          <button type="button" className="text-sidebar-foreground/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation">
            <X size={19} />
          </button>
        </div>
        <div className="mt-10 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-sidebar-foreground/40">Espace étudiant</div>
        <nav className="mt-3">
          <Link
            href="/student"
            onClick={() => setMobileOpen(false)}
            className={`nav-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${location === '/student' || location.startsWith('/student/classes') ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'}`}
          >
            <GraduationCap size={17} /> Mes classes
            {(location === '/student' || location.startsWith('/student/classes')) && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
          </Link>
        </nav>
        <div className="mt-auto space-y-1">
          <button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })} className="nav-item flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut size={17} /> Se déconnecter
          </button>
          <div className="mt-4 flex items-center gap-3 border-t border-sidebar-border px-3 pt-4">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials(user?.fullName || user?.firstName || 'Étudiant')}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.firstName || 'Étudiant'}</p>
              <p className="truncate text-xs text-sidebar-foreground/45">{user?.primaryEmailAddress?.emailAddress || 'Compte étudiant'}</p>
            </div>
          </div>
        </div>
      </aside>

      {mobileOpen && <button type="button" className="fixed inset-0 z-30 bg-foreground/30 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Fermer la navigation" />}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border bg-background/90 px-5 backdrop-blur-md lg:px-10">
          <button type="button" className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Ouvrir la navigation">
            <Menu size={18} />
          </button>
          <div className="hidden text-sm text-muted-foreground lg:block">
            Espace étudiant <span className="mx-2 text-border">/</span> <span className="text-foreground">{location === '/student' ? 'Mes classes' : location.split('/').pop()}</span>
          </div>
          <div className="ml-auto grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-xs font-bold">
            {initials(user?.fullName || user?.firstName || 'Étudiant')}
          </div>
        </header>
        <main className="mx-auto max-w-[1480px] p-5 lg:p-10">{children}</main>
      </div>
    </div>
  );
}

export function StudentClassesPage() {
  const query = useListStudentClasses();
  const classes = query.data || [];

  return (
    <div className="page-enter">
      <div className="mb-8">
        <p className="mono text-[10px] uppercase tracking-[.2em] text-primary">Votre parcours</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">Mes classes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Retrouvez vos classes et les activités envoyées par vos enseignants.</p>
      </div>

      {query.isError ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
          <p className="font-semibold text-destructive">Impossible de charger vos classes.</p>
          <button type="button" onClick={() => query.refetch()} className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Réessayer</button>
        </div>
      ) : query.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-44 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : classes.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((classItem, index) => (
            <Link key={classItem.id} href={`/student/classes/${classItem.id}`} className={`rise-hover group block overflow-hidden rounded-2xl border border-border bg-card p-6 stagger-in stagger-${Math.min(index + 1, 6)}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight transition-colors group-hover:text-primary">{classItem.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{classItem.level} <span className="mx-1">·</span> {classItem.academicYear}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${classItem.status === 'active' ? 'bg-[#328d79]/10 text-[#328d79]' : 'bg-muted text-muted-foreground'}`}>
                  {statusLabel[classItem.status] || classItem.status}
                </span>
              </div>
              <div className="mt-8 flex items-center justify-between border-t border-border pt-4">
                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground"><BookOpen size={16} /> {classItem.modules.length} modules</span>
                <span className="text-sm font-medium text-muted-foreground">{classItem.submittedCount}/{classItem.activityCount} envoyées</span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary/30 text-foreground"><GraduationCap size={21} /></div>
          <h3 className="mt-4 font-semibold">Aucune classe assignée</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Votre administrateur doit vous ajouter à une classe avant que les activités apparaissent ici.</p>
        </div>
      )}
    </div>
  );
}