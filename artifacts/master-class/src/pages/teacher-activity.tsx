import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, Link } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Loader2, Code2, Blocks, RefreshCw, Globe2, HardDrive, Users, CheckCircle2, Clock3 } from 'lucide-react';
import { 
  useGetTeacherActivity, 
  useUpdateTeacherActivity,
  getGetTeacherActivityQueryKey,
  useListTeacherClasses,
  useListTeacherActivitySubmissions,
  EditorMode
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';
import { EditorAdapter, EditorAdapterRef } from '@/components/editor-adapter';
import { VittascienceEditor } from '@/components/vittascience-editor';

export function TeacherActivityPage() {
  const { id } = useParams<{ id: string }>();
  const activityId = Number(id);
  const qc = useQueryClient();
  
  const classQuery = useListTeacherClasses();
  const activityQuery = useGetTeacherActivity(activityId);
  const updateActivity = useUpdateTeacherActivity();
  const submissionsQuery = useListTeacherActivitySubmissions(activityId);
  
  const activity = activityQuery.data;
  const classes = classQuery.data || [];
  
  const cls = activity ? classes.find(c => c.id === activity.classId) : undefined;
  const mod = (cls && activity) ? cls.modules.find(m => m.id === activity.moduleId) : undefined;
  
  const editorRef = useRef<EditorAdapterRef>(null);
  
  const initializedForId = useRef<number | null>(null);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mode, setMode] = useState<EditorMode>('block');
  const [blockXml, setBlockXml] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [editorProvider, setEditorProvider] = useState<'vittascience' | 'local'>('vittascience');
  
  // Track last saved to prevent loop and show dirty state
  const lastSaved = useRef({
    title: '',
    instructions: '',
    editorMode: 'block' as EditorMode,
    blockXml: '',
    sourceCode: ''
  });
  
  useEffect(() => {
    if (activity && initializedForId.current !== activityId) {
      initializedForId.current = activityId;
      setTitle(activity.title);
      setInstructions(activity.instructions || '');
      setMode(activity.editorMode || 'block');
      setBlockXml(activity.blockXml || '');
      setSourceCode(activity.sourceCode || '');
      lastSaved.current = {
        title: activity.title,
        instructions: activity.instructions || '',
        editorMode: activity.editorMode || 'block',
        blockXml: activity.blockXml || '',
        sourceCode: activity.sourceCode || '',
      };
    }
  }, [activity, activityId]);

  const hasChanges = 
    title !== lastSaved.current.title || 
    instructions !== lastSaved.current.instructions || 
    mode !== lastSaved.current.editorMode || 
    blockXml !== lastSaved.current.blockXml || 
    sourceCode !== lastSaved.current.sourceCode;

  const handleSave = useCallback(() => {
    if (!activity) return;
    
    // Get latest from editor adapter if possible
    const currentBlockXml = editorRef.current ? editorRef.current.getXml() : blockXml;
    const currentSourceCode = editorRef.current ? editorRef.current.getTextCode() : sourceCode;
    
    updateActivity.mutate({
      activityId,
      data: {
        title,
        instructions,
        editorMode: mode,
        blockXml: currentBlockXml,
        sourceCode: currentSourceCode,
      }
    }, {
      onSuccess: (data) => {
        toast({
          title: 'Enregistré',
          description: editorProvider === 'vittascience'
            ? 'L’activité a été enregistrée avec l’éditeur du module.'
            : 'Les modifications et le programme local ont été enregistrés avec succès.'
        });
        lastSaved.current = {
          title: data.title,
          instructions: data.instructions || '',
          editorMode: data.editorMode || 'block',
          blockXml: data.blockXml || '',
          sourceCode: data.sourceCode || '',
        };
        
        qc.setQueryData(getGetTeacherActivityQueryKey(activityId), (old: any) => 
          old ? { ...old, ...data } : old
        );
      }
    });
  }, [activityId, activity, title, instructions, mode, blockXml, sourceCode, editorProvider, updateActivity, qc]);

  if (activityQuery.isError) {
    return (
      <div className="page-enter">
        <div className="flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center">
          <h3 className="font-semibold text-destructive">Activité introuvable</h3>
          <p className="mt-1 text-sm text-muted-foreground">Cette activité a peut-être été supprimée ou ne vous est pas assignée.</p>
          <Link href="/teacher" className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Retour aux classes</Link>
        </div>
      </div>
    );
  }

  if (activityQuery.isLoading || !activity || initializedForId.current !== activityId) {
    return (
      <div className="page-enter h-[100dvh] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="page-enter flex h-[calc(100dvh-72px)] flex-col -m-5 lg:-m-10">
      <header className="flex shrink-0 items-center justify-between border-b border-border bg-card px-5 py-4 lg:px-8">
        <div className="flex items-center gap-4">
          <Link href={`/teacher/classes/${activity.classId}`} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="h-6 w-px bg-border" />
          <div className="flex flex-col">
            <input 
              className="bg-transparent font-semibold outline-none placeholder:text-muted-foreground focus:text-primary transition-colors text-lg"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titre de l'activité"
            />
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              {cls ? <Link href={`/teacher/classes/${cls.id}`} className="hover:text-foreground">{cls.name}</Link> : 'Classe inconnue'}
              <span>•</span>
              {mod ? (
                <span className="flex items-center gap-1.5 rounded-full bg-background px-1.5 py-0.5 border border-border">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: mod.color }} />
                  {mod.name}
                </span>
              ) : 'Module inconnu'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-border bg-background p-1">
            <button
              type="button"
              onClick={() => setEditorProvider('vittascience')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${editorProvider === 'vittascience' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <Globe2 size={14} /> Éditeur officiel
            </button>
            <button
              type="button"
              onClick={() => setEditorProvider('local')}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${editorProvider === 'local' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <HardDrive size={14} /> Éditeur local
            </button>
          </div>

          {editorProvider === 'local' && (
              <button
                onClick={() => {
                  if (editorRef.current) {
                    const generated = editorRef.current.getGeneratedCode();
                    editorRef.current.setTextCode(generated);
                    setSourceCode(generated);
                    toast({ title: 'Code généré', description: 'Le code source a été remplacé par le code des blocs.' });
                  }
                }}
                className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <RefreshCw size={14} /> Générer le code
              </button>
          )}

          {editorProvider === 'local' ? (
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button
                onClick={() => setMode('block')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'block' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Blocks size={14} /> Blocs
              </button>
              <button
                onClick={() => setMode('code')}
                className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${mode === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Code2 size={14} /> Code
              </button>
            </div>
          ) : (
            <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
              Blocs + code + simulateur
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={!hasChanges || updateActivity.isPending}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors disabled:opacity-50 hover:bg-primary/90"
          >
            {updateActivity.isPending ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Enregistrer
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden bg-muted/20">
        <aside className="w-80 shrink-0 border-r border-border bg-card p-5 flex flex-col">
          <h3 className="text-sm font-semibold mb-3">Consignes</h3>
          <textarea 
            className="flex-1 resize-none rounded-xl border border-input bg-background p-4 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-ring/30"
            placeholder="Rédigez les consignes pour les élèves ici..."
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
          />
          <p className="mt-5 border-t border-border pt-4 text-[11px] leading-relaxed text-muted-foreground">
            L’éditeur officiel est sélectionné automatiquement selon le module de l’activité. Il fournit les blocs, le code et le simulateur sans lien de projet.
          </p>
        </aside>
        
        <main className="flex-1 p-5 relative min-w-0 min-h-0">
          {editorProvider === 'vittascience' ? (
            <VittascienceEditor moduleSlug={mod?.slug || 'python'} />
          ) : (
            <EditorAdapter
              ref={editorRef}
              moduleSlug={mod?.slug || 'python'}
              editorMode={mode}
              initialBlockXml={activity.blockXml}
              initialSourceCode={activity.sourceCode}
              onChange={({ blockXml, sourceCode }) => {
                setBlockXml(blockXml);
                setSourceCode(sourceCode);
              }}
            />
          )}
        </main>

        <aside className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-card xl:flex">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Users size={16} /> Travaux reçus</h3>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{submissionsQuery.data?.length || 0}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {submissionsQuery.isLoading ? (
              <div className="space-y-2 p-2">{[1, 2, 3].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
            ) : submissionsQuery.isError ? (
              <div className="p-3 text-center text-xs text-destructive">Impossible de charger les travaux reçus.</div>
            ) : submissionsQuery.data?.length ? (
              <div className="space-y-2">
                {submissionsQuery.data.map((submission) => (
                  <details key={submission.id} className="group rounded-xl border border-border bg-background">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3 [&::-webkit-details-marker]:hidden">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{submission.studentName}</p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{submission.studentEmail}</p>
                      </div>
                      <span className={`flex shrink-0 items-center gap-1 text-[11px] font-semibold ${submission.status === 'submitted' ? 'text-[#328d79]' : 'text-[#8b632b]'}`}>
                        {submission.status === 'submitted' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}
                        {submission.status === 'submitted' ? 'Envoyé' : 'Brouillon'}
                      </span>
                    </summary>
                    <div className="border-t border-border px-3 pb-3 pt-2">
                      <p className="mb-2 text-[11px] text-muted-foreground">Mis à jour le {new Date(submission.updatedAt).toLocaleString('fr-FR')}</p>
                      <pre className="max-h-48 overflow-auto rounded-lg bg-muted/60 p-3 text-[10px] leading-5 text-foreground">{submission.sourceCode || submission.blockXml || 'Aucun contenu enregistré.'}</pre>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-4 text-center">
                <Users size={24} className="text-muted-foreground" />
                <p className="mt-3 text-sm font-semibold">Aucun travail reçu</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Les travaux envoyés par vos étudiants apparaîtront ici.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
