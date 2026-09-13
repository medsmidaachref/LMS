import { ArrowRight, Check, Code2, Layers3, Sparkles } from 'lucide-react';
import { Link } from 'wouter';

export default function Landing() {
  return (
    <main className="grain min-h-[100dvh] overflow-hidden bg-background text-foreground">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 lg:px-10">
        <Link href="/" className="flex items-center gap-3" data-testid="link-brand">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Code2 size={21} strokeWidth={2.4} />
          </span>
          <span className="font-semibold tracking-[-0.03em] text-lg">Master Class</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform hover:-translate-y-0.5" data-testid="link-sign-in">Se connecter</Link>
        </div>
      </nav>

      <section className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 lg:grid-cols-[1.05fr_.95fr] lg:px-10 lg:pb-32 lg:pt-20">
        <div className="relative z-10 max-w-2xl page-enter">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-secondary/60 bg-secondary/20 px-3 py-1.5 text-xs font-semibold uppercase tracking-[.16em] text-foreground">
            <span className="h-2 w-2 rounded-full bg-primary" /> L’écosystème de l’apprentissage concret
          </div>
          <h1 className="max-w-xl text-5xl font-semibold leading-[.98] tracking-[-.065em] sm:text-6xl lg:text-8xl">
            Donnez de la place à un <span className="text-primary">meilleur</span> apprentissage.
          </h1>
          <p className="mt-7 max-w-lg text-lg leading-8 text-muted-foreground">
            Un centre de pilotage simple pour les équipes, les classes et les activités de programmation qui font avancer votre établissement.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/sign-in" className="group inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3.5 font-semibold text-primary-foreground shadow-[0_8px_0_hsl(10_57%_48%)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_0_hsl(10_57%_48%)] active:translate-y-0 active:shadow-[0_4px_0_hsl(10_57%_48%)]" data-testid="button-start">
              Accéder à votre espace <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
            </Link>
            <span className="text-sm text-muted-foreground">Pour les administrateurs, enseignants et étudiants</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[520px] lg:ml-auto page-enter stagger-2">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-accent/70 blur-2xl" />
          <div className="absolute -bottom-7 -left-8 h-32 w-32 rounded-full bg-secondary/70 blur-2xl" />
          <div className="relative rounded-[2rem] border border-border bg-card p-3 shadow-[0_28px_70px_rgba(30,73,80,.13)]">
            <div className="rounded-[1.4rem] bg-sidebar p-5 text-sidebar-foreground sm:p-7">
              <div className="flex items-center justify-between border-b border-sidebar-border pb-5">
                 <div><p className="text-xs text-sidebar-foreground/60">Mardi 14 mai</p><h2 className="mt-1 text-xl font-semibold tracking-tight">Bonjour, Amina</h2></div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground"><Sparkles size={18} /></div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                 <div className="rounded-xl bg-sidebar-accent p-4"><p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/55">Classes actives</p><p className="mt-2 text-3xl font-semibold">12</p><div className="mt-3 h-1.5 rounded-full bg-sidebar-border"><div className="h-full w-[76%] rounded-full bg-sidebar-primary" /></div></div>
                 <div className="rounded-xl bg-sidebar-accent p-4"><p className="text-[11px] uppercase tracking-widest text-sidebar-foreground/55">Étudiants</p><p className="mt-2 text-3xl font-semibold">284</p><p className="mt-3 text-xs text-sidebar-primary">+18 ce trimestre</p></div>
              </div>
              <div className="mt-3 rounded-xl bg-sidebar-accent p-4">
                 <div className="flex items-center justify-between"><p className="text-sm font-semibold">Activité en direct</p><span className="flex items-center gap-1.5 text-[11px] text-sidebar-primary"><span className="h-1.5 w-1.5 rounded-full bg-sidebar-primary" /> Mise à jour</span></div>
                <div className="mt-4 space-y-3">
                   {['Maya a publié « Construire un capteur »', 'La classe 3B a commencé le module 04', 'Leo a rejoint le laboratoire robotique'].map((item, i) => <div key={item} className="flex items-center gap-3 text-xs text-sidebar-foreground/70"><span className={`h-7 w-7 rounded-lg ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-accent' : 'bg-sidebar-primary'} opacity-90`} /><span>{item}</span><span className="ml-auto text-[10px] text-sidebar-foreground/40">{i + 2} min</span></div>)}
                </div>
              </div>
            </div>
          </div>
           <div className="absolute -bottom-5 -right-5 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-semibold shadow-lg"><span className="grid h-6 w-6 place-items-center rounded-md bg-secondary"><Check size={14} /></span> Tout est connecté</div>
        </div>
      </section>

      <section className="border-y border-border bg-card/60 px-5 py-16 lg:px-10">
        <div className="mx-auto max-w-7xl">
           <div className="max-w-xl"><p className="mono text-xs uppercase tracking-[.18em] text-primary">Une façon plus claire d’enseigner</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] sm:text-4xl">Pilotez tout l’établissement sans perdre le lien humain.</h2></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
               { icon: Layers3, title: 'Relier les bonnes personnes', text: 'Gardez enseignants, étudiants, classes et modules dans une même vision partagée.' },
               { icon: Code2, title: 'Rendre les projets concrets', text: 'Faites passer les activités de l’idée à la classe avec un suivi clair.' },
               { icon: Sparkles, title: 'Avancer sereinement', text: 'Des indicateurs utiles et une activité lisible, sans bruit ni tableur interminable.' },
            ].map(({ icon: Icon, title, text }, i) => <article key={title} className={`rise-hover rounded-2xl border border-border bg-background p-6 stagger-in stagger-${i + 1}`}><div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary/35 text-foreground"><Icon size={20} /></div><h3 className="mt-6 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></article>)}
          </div>
        </div>
      </section>

       <footer className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between lg:px-10"><span className="font-semibold text-foreground">Master Class</span><span>L’apprentissage progresse quand chacun voit clairement la prochaine étape.</span></footer>
    </main>
  );
}