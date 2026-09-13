import { useState, useMemo } from 'react';
import { useParams, Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Code2, Plus, Trash2, Pencil, Search, Filter } from 'lucide-react';
import { 
  useListTeacherClasses, 
  useListTeacherClassActivities, 
  useCreateTeacherClassActivity,
  useDeleteTeacherActivity,
  getListTeacherClassActivitiesQueryKey,
  TeacherActivity
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';
import { getModuleConfig } from '@/lib/modules-config';

export function TeacherClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classId = Number(id);
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  
  const classQuery = useListTeacherClasses();
  const activitiesQuery = useListTeacherClassActivities(classId);
  const createActivity = useCreateTeacherClassActivity();
  const deleteActivity = useDeleteTeacherActivity();
  
  const cls = (classQuery.data || []).find(c => c.id === classId);
  const allActivities = activitiesQuery.data || [];
  
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<number | 'all'>('all');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newModuleId, setNewModuleId] = useState<number | ''>('');
  
  const filteredActivities = useMemo(() => {
    return allActivities.filter(a => {
      const matchSearch = a.title.toLowerCase().includes(search.toLowerCase());
      const matchModule = moduleFilter === 'all' || a.moduleId === moduleFilter;
      return matchSearch && matchModule;
    });
  }, [allActivities, search, moduleFilter]);

  if (!cls && classQuery.isSuccess) {
    return (
      <div className="page-enter">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
          <h3 className="font-semibold text-destructive">Classe introuvable</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cette classe n'existe pas ou ne vous est pas assignée.</p>
          <Link href="/teacher" className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Retour aux classes</Link>
        </div>
      </div>
    );
  }

  const handleCreate = () => {
    if (!newTitle.trim() || !newModuleId) return;
    
    const mod = cls?.modules.find(m => m.id === Number(newModuleId));
    const starterCode = mod ? getModuleConfig(mod.slug).starterCode : '';

    createActivity.mutate({
      classId,
      data: {
        title: newTitle,
        moduleId: Number(newModuleId),
        instructions: '',
        editorMode: 'block',
        sourceCode: starterCode
      }
    }, {
      onSuccess: (newActivity) => {
        qc.invalidateQueries({ queryKey: getListTeacherClassActivitiesQueryKey(classId) });
        toast({ title: 'Activité créée', description: 'Redirection vers l\'éditeur...' });
        setLocation(`/teacher/activities/${newActivity.id}`);
      }
    });
  };

  const handleDelete = (activity: TeacherActivity) => {
    if (!window.confirm(`Supprimer l'activité "${activity.title}" ?`)) return;
    deleteActivity.mutate({ activityId: activity.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTeacherClassActivitiesQueryKey(classId) });
        toast({ title: 'Activité supprimée', description: 'L\'activité a été supprimée avec succès.' });
      }
    });
  };

  return (
    <div className="page-enter">
      <Link href="/teacher" className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft size={16} /> Retour aux classes
      </Link>
      
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mono text-[10px] uppercase tracking-[.2em] text-primary">{cls?.level || '...'} • {cls?.academicYear || '...'}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-.045em] sm:text-4xl">{cls?.name || 'Chargement...'}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Gérez les activités et les devoirs pour cette classe.</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus size={16} /> Nouvelle activité
        </button>
      </div>

      <section className="rounded-2xl border border-border bg-card">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <input 
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder="Rechercher des activités..." 
            />
          </div>
          <div className="relative">
            <Filter size={16} className="absolute left-3 top-3 text-muted-foreground" />
            <select 
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-shadow focus:ring-2 focus:ring-ring/30 sm:w-48"
              value={moduleFilter}
              onChange={e => setModuleFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            >
              <option value="all">Tous les modules</option>
              {cls?.modules.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        {activitiesQuery.isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : filteredActivities.length > 0 ? (
          <div className="divide-y divide-border">
            {filteredActivities.map(activity => {
              const mod = cls?.modules.find(m => m.id === activity.moduleId);
              return (
                <div key={activity.id} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-muted/40">
                  <div className="flex flex-1 items-center gap-4">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/30">
                      <Code2 size={18} className="text-foreground" />
                    </div>
                    <div>
                      <Link href={`/teacher/activities/${activity.id}`} className="font-semibold hover:text-primary transition-colors">
                        {activity.title}
                      </Link>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        {mod && (
                          <span className="flex items-center gap-1.5 rounded-full bg-background px-2 py-0.5 border border-border">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: mod.color }} />
                            {mod.name}
                          </span>
                        )}
                        <span>• Mis à jour le {new Date(activity.updatedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link 
                      href={`/teacher/activities/${activity.id}`}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                      title="Modifier l'activité"
                    >
                      <Pencil size={16} />
                    </Link>
                    <button 
                      onClick={() => handleDelete(activity)}
                      className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title="Supprimer l'activité"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary/30 text-foreground mb-4">
              <Code2 size={21} />
            </div>
            <h3 className="font-semibold text-lg">Aucune activité trouvée</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              {search || moduleFilter !== 'all' 
                ? "Essayez d'ajuster vos filtres pour voir plus de résultats." 
                : "Créez la première activité pour cette classe pour commencer."}
            </p>
            {!search && moduleFilter === 'all' && (
              <button 
                onClick={() => setShowCreate(true)}
                className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
              >
                Créer une activité
              </button>
            )}
          </div>
        )}
      </section>

      {showCreate && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl page-enter">
            <h2 className="text-xl font-semibold">Nouvelle activité</h2>
            <p className="mt-1 text-sm text-muted-foreground">Créez une nouvelle activité de programmation pour cette classe.</p>
            
            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Titre de l'activité</span>
                <input 
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" 
                  value={newTitle} 
                  onChange={e => setNewTitle(e.target.value)} 
                  placeholder="ex. Défi LED clignotante" 
                  autoFocus
                />
              </label>
              
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Contexte du module</span>
                <select 
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                  value={newModuleId}
                  onChange={e => setNewModuleId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="" disabled>Sélectionnez un module</option>
                  {cls?.modules.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </label>
            </div>
            
            <div className="mt-8 flex justify-end gap-2">
              <button 
                className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted" 
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </button>
              <button 
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50" 
                disabled={!newTitle.trim() || !newModuleId || createActivity.isPending} 
                onClick={handleCreate}
              >
                {createActivity.isPending ? 'Création...' : 'Créer l\'activité'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
