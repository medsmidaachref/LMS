import { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Clock3, Code2, Search } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { useListStudentClassActivities, useListStudentClasses } from '@workspace/api-client-react';

export function StudentClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classId = Number(id);
  const classQuery = useListStudentClasses();
  const activitiesQuery = useListStudentClassActivities(classId);
  const [search, setSearch] = useState('');
  const classItem = (classQuery.data || []).find((item) => item.id === classId);
  const activities = useMemo(
    () => (activitiesQuery.data || []).filter((activity) => activity.title.toLowerCase().includes(search.toLowerCase())),
    [activitiesQuery.data, search],
  );

  if (!classItem && classQuery.isSuccess) {
    return (
      <div className="page-enter flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
        <h3 className="font-semibold text-destructive">Classe introuvable</h3>
        <p className="mt-1 text-sm text-muted-foreground">Cette classe ne vous est pas assignée.</p>
        <Link href="/student" className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Retour aux classes</Link>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Link href="/student" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft size={16} /> Retour aux classes</Link>
      <div className="mb-8">
        <p className="mono text-[10px] uppercase tracking-[.2em] text-primary">{classItem?.level || '...'} · {classItem?.academicYear || '...'}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{classItem?.name || 'Chargement...'}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Consultez les activités envoyées par votre enseignant et ouvrez celles que vous souhaitez réaliser.</p>
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border p-4">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher une activité..." className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          </div>
          <span className="hidden text-sm text-muted-foreground sm:block">{activities.length} activité{activities.length > 1 ? 's' : ''}</span>
        </div>

        {activitiesQuery.isError ? (
          <div className="p-12 text-center"><p className="font-semibold text-destructive">Impossible de charger les activités.</p><button type="button" onClick={() => activitiesQuery.refetch()} className="mt-4 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Réessayer</button></div>
        ) : activitiesQuery.isLoading ? (
          <div className="space-y-3 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : activities.length ? (
          <div className="divide-y divide-border">
            {activities.map((activity) => {
              const submitted = activity.submission?.status === 'submitted';
              return (
                <Link key={activity.id} href={`/student/activities/${activity.id}`} className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/30"><Code2 size={18} /></div>
                    <div className="min-w-0">
                      <h2 className="truncate font-semibold transition-colors hover:text-primary">{activity.title}</h2>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: activity.module.color }} />{activity.module.name}</span>
                        <span>·</span><span>{new Date(activity.updatedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${submitted ? 'bg-[#328d79]/10 text-[#328d79]' : activity.submission ? 'bg-[#edc898]/25 text-[#8b632b]' : 'bg-muted text-muted-foreground'}`}>
                    {submitted ? <><CheckCircle2 size={14} /> Envoyée</> : activity.submission ? <><Clock3 size={14} /> Brouillon</> : 'À faire'}
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="p-16 text-center"><Code2 className="mx-auto text-muted-foreground" size={28} /><h3 className="mt-4 font-semibold">Aucune activité</h3><p className="mt-1 text-sm text-muted-foreground">{search ? 'Aucune activité ne correspond à votre recherche.' : 'Votre enseignant n’a pas encore envoyé d’activité.'}</p></div>
        )}
      </section>
    </div>
  );
}