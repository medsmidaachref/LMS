import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Blocks, CheckCircle2, Code2, HardDrive, Loader2, Save, Send, Globe2 } from 'lucide-react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  EditorMode,
  getGetStudentActivityQueryKey,
  useGetStudentActivity,
  useSaveStudentSubmission,
} from '@workspace/api-client-react';
import { toast } from '@/hooks/use-toast';
import { EditorAdapter, EditorAdapterRef } from '@/components/editor-adapter';
import { VittascienceEditor } from '@/components/vittascience-editor';

export function StudentActivityPage() {
  const { id } = useParams<{ id: string }>();
  const activityId = Number(id);
  const activityQuery = useGetStudentActivity(activityId);
  const saveSubmission = useSaveStudentSubmission();
  const qc = useQueryClient();
  const editorRef = useRef<EditorAdapterRef>(null);
  const initializedForId = useRef<number | null>(null);
  const lastSaved = useRef({ blockXml: '', sourceCode: '', editorMode: 'block' as EditorMode });
  const [mode, setMode] = useState<EditorMode>('block');
  const [blockXml, setBlockXml] = useState('');
  const [sourceCode, setSourceCode] = useState('');
  const [editorProvider, setEditorProvider] = useState<'local' | 'vittascience'>('vittascience');
  const [submissionStatus, setSubmissionStatus] = useState<'draft' | 'submitted' | null>(null);

  const activity = activityQuery.data;
  useEffect(() => {
    if (activity && initializedForId.current !== activityId) {
      initializedForId.current = activityId;
      const initialBlockXml = activity.submission?.blockXml || activity.blockXml || '';
      const initialSourceCode = activity.submission?.sourceCode || activity.sourceCode || '';
      const initialMode = activity.submission?.editorMode || activity.editorMode || 'block';
      setBlockXml(initialBlockXml);
      setSourceCode(initialSourceCode);
      setMode(initialMode);
      setSubmissionStatus(activity.submission?.status || null);
      lastSaved.current = { blockXml: initialBlockXml, sourceCode: initialSourceCode, editorMode: initialMode };
    }
  }, [activity, activityId]);

  const hasChanges = blockXml !== lastSaved.current.blockXml || sourceCode !== lastSaved.current.sourceCode || mode !== lastSaved.current.editorMode;

  const persist = useCallback((status: 'draft' | 'submitted') => {
    if (!activity) return;
    const currentBlockXml = editorRef.current?.getXml() || blockXml;
    const currentSourceCode = editorRef.current?.getTextCode() || sourceCode;
    saveSubmission.mutate({
      activityId,
      data: { editorMode: mode, blockXml: currentBlockXml, sourceCode: currentSourceCode, status },
    }, {
      onSuccess: (submission) => {
        lastSaved.current = { blockXml: submission.blockXml, sourceCode: submission.sourceCode, editorMode: submission.editorMode };
        setBlockXml(submission.blockXml);
        setSourceCode(submission.sourceCode);
        setSubmissionStatus(submission.status);
        qc.setQueryData(getGetStudentActivityQueryKey(activityId), (old: typeof activity | undefined) => old ? { ...old, submission } : old);
        qc.invalidateQueries({ queryKey: getGetStudentActivityQueryKey(activityId) });
        toast({
          title: status === 'submitted' ? 'Travail envoyé' : 'Brouillon enregistré',
          description: status === 'submitted' ? 'Votre enseignant peut maintenant consulter votre travail.' : 'Vous pourrez reprendre cette activité plus tard.',
        });
      },
    });
  }, [activity, activityId, blockXml, mode, qc, saveSubmission, sourceCode]);

  if (activityQuery.isError) {
    return <div className="page-enter flex flex-col items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-16 text-center"><h3 className="font-semibold text-destructive">Activité introuvable</h3><p className="mt-1 text-sm text-muted-foreground">Cette activité n’existe pas ou ne vous est pas assignée.</p><Link href="/student" className="mt-5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background">Retour aux classes</Link></div>;
  }
  if (activityQuery.isLoading || !activity || initializedForId.current !== activityId) {
    return <div className="page-enter grid h-[60dvh] place-items-center"><Loader2 className="animate-spin text-primary" size={32} /></div>;
  }

  return (
    <div className="page-enter -m-5 flex h-[calc(100dvh-72px)] flex-col lg:-m-10">
      <header className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-5 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex min-w-0 items-center gap-4">
          <Link href={`/student/classes/${activity.classId}`} className="text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft size={18} /></Link>
          <div className="h-6 w-px bg-border" />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{activity.title}</h1>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: activity.module.color }} />{activity.module.name}</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-lg border border-border bg-background p-1">
            <button type="button" onClick={() => setEditorProvider('local')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${editorProvider === 'local' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><HardDrive size={14} /> Éditeur sauvegardable</button>
            <button type="button" onClick={() => setEditorProvider('vittascience')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${editorProvider === 'vittascience' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Globe2 size={14} /> Éditeur officiel</button>
          </div>
          {editorProvider === 'local' ? (
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <button type="button" onClick={() => setMode('block')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === 'block' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Blocks size={14} /> Blocs</button>
              <button type="button" onClick={() => setMode('code')} className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === 'code' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}><Code2 size={14} /> Code</button>
            </div>
          ) : (
            <span className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
              Blocs + code + simulateur
            </span>
          )}
          <button type="button" onClick={() => persist('draft')} disabled={saveSubmission.isPending || editorProvider !== 'local'} className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"><Save size={15} /> Enregistrer</button>
          <button type="button" onClick={() => persist('submitted')} disabled={saveSubmission.isPending || editorProvider !== 'local'} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"><Send size={15} /> Envoyer</button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden bg-muted/20">
        <aside className="hidden w-80 shrink-0 flex-col border-r border-border bg-card p-5 lg:flex">
          <h2 className="text-sm font-semibold">Consignes</h2>
          <div className="mt-3 flex-1 overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-muted-foreground">{activity.instructions || 'Aucune consigne supplémentaire.'}</div>
          <div className="mt-5 border-t border-border pt-4">
            {submissionStatus === 'submitted' ? <p className="flex items-center gap-2 text-xs font-semibold text-[#328d79]"><CheckCircle2 size={15} /> Travail envoyé à l’enseignant</p> : submissionStatus === 'draft' ? <p className="flex items-center gap-2 text-xs font-semibold text-[#8b632b]"><Save size={15} /> Brouillon sauvegardé</p> : <p className="text-xs text-muted-foreground">Pensez à enregistrer votre travail avant de l’envoyer.</p>}
          </div>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 p-4 lg:p-5">
          {editorProvider === 'local' ? (
            <EditorAdapter ref={editorRef} moduleSlug={activity.module.slug} editorMode={mode} initialBlockXml={blockXml} initialSourceCode={sourceCode} onChange={({ blockXml: nextXml, sourceCode: nextCode }) => { setBlockXml(nextXml); setSourceCode(nextCode); }} />
          ) : (
            <VittascienceEditor moduleSlug={activity.module.slug} />
          )}
        </main>
      </div>
    </div>
  );
}