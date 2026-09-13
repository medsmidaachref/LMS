import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

interface VittascienceModuleConfig {
  slug: string;
  label: string;
  interfacePath: string;
  entrypoint: string;
  source: {
    repositoryUrl: string;
  };
  capabilities: {
    blocks: boolean;
    code: boolean;
    simulator: boolean;
    simulatorLabel: string;
  };
}

interface VittascienceEditorProps {
  moduleSlug: string;
}

export function VittascienceEditor({ moduleSlug }: VittascienceEditorProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const [catalogRequestKey, setCatalogRequestKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [config, setConfig] = useState<VittascienceModuleConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const editorUrl = useMemo(() => {
    if (!config) return null;
    return new URL(config.entrypoint, window.location.origin).toString();
  }, [config]);

  useEffect(() => {
    const controller = new AbortController();
    setConfig(null);
    setConfigError(null);
    setLoaded(false);

    fetch(`/api/vittascience/modules/${encodeURIComponent(moduleSlug)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Impossible de charger la configuration du module (${response.status}).`);
        }
        return response.json() as Promise<VittascienceModuleConfig>;
      })
      .then(setConfig)
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setConfigError(error instanceof Error ? error.message : 'Configuration indisponible.');
      });

    return () => controller.abort();
  }, [moduleSlug, catalogRequestKey]);

  const reload = () => {
    setLoaded(false);
    if (config) {
      setReloadKey((current) => current + 1);
    } else {
      setCatalogRequestKey((current) => current + 1);
    }
  };

  useEffect(() => {
    if (!editorUrl) return;
    setLoaded(false);

    const detectEditor = window.setInterval(() => {
      try {
        const document = iframeRef.current?.contentDocument;
        if (document?.querySelector('.blocklySvg, .ace_editor')) {
          setLoaded(true);
        }
      } catch {
        // onLoad and the fallback timeout still reveal cross-origin responses.
      }
    }, 250);

    // Vittascience loads hundreds of optional assets. Its window load event can
    // remain pending even after the usable editor has rendered.
    const fallback = window.setTimeout(() => setLoaded(true), 8000);

    return () => {
      window.clearInterval(detectEditor);
      window.clearTimeout(fallback);
    };
  }, [editorUrl, reloadKey]);

  const capabilityLabels = config
    ? [
        config.capabilities.blocks ? 'Blocs' : null,
        config.capabilities.code ? 'Code' : null,
        config.capabilities.simulator ? config.capabilities.simulatorLabel : null,
      ].filter(Boolean)
    : [];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4 py-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-foreground">
            Éditeur · {config?.label ?? moduleSlug}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {capabilityLabels.length ? capabilityLabels.join(' · ') : 'Configuration du module'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={reload}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Recharger l’éditeur"
            title="Recharger"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 bg-white">
        {!config && !configError && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="animate-spin text-primary" size={20} />
              Récupération de la configuration…
            </div>
          </div>
        )}
        {configError ? (
          <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center">
            <div className="max-w-md">
              <p className="text-sm font-semibold text-foreground">Interface indisponible</p>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{configError}</p>
              <button
                type="button"
                onClick={reload}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <RefreshCw size={14} /> Réessayer
              </button>
            </div>
          </div>
        ) : config && editorUrl ? (
          <>
            {!loaded && (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-background">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="animate-spin text-primary" size={20} />
                  Chargement de l’éditeur…
                </div>
              </div>
            )}
            <iframe
              ref={iframeRef}
              key={reloadKey}
              src={editorUrl}
              title={`Éditeur ${config.label}`}
              onLoad={() => setLoaded(true)}
              className="h-full w-full border-0"
              allow="camera; microphone; serial; usb; bluetooth; clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-downloads allow-pointer-lock"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </>
        ) : null}
      </div>

      <div className="flex shrink-0 items-start gap-2 border-t border-sky-200 bg-sky-50 px-4 py-2 text-[11px] leading-relaxed text-sky-900">
        <span className="mt-0.5 shrink-0 text-sm">✓</span>
        <p>
          Interface officielle chargée depuis le dépôt GitHub avec les blocs, le code et le simulateur concernés.
        </p>
      </div>
    </div>
  );
}