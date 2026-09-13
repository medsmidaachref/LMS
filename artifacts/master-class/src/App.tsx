import { type ReactNode, useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, Show, SignIn, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import { AdminShell, ClassDetailPage, ClassesPage, ModulesPage, Overview, SuperAdminShell, UsersPage } from '@/pages/admin';
import {
  Redirect,
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

import { TeacherShell, TeacherClassesPage } from '@/pages/teacher';
import { TeacherClassDetailPage } from '@/pages/teacher-class';
import { TeacherActivityPage } from '@/pages/teacher-activity';
import { StudentShell, StudentClassesPage } from '@/pages/student';
import { StudentClassDetailPage } from '@/pages/student-class';
import { StudentActivityPage } from '@/pages/student-activity';
import { useGetCurrentUser } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#e8755f',
    colorForeground: '#193348',
    colorMutedForeground: '#6a7f80',
    colorDanger: '#d95d56',
    colorBackground: '#ffffff',
    colorInput: '#f2f8f5',
    colorInputForeground: '#193348',
    colorNeutral: '#d2e0dc',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.8rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden border border-[#d2e0dc]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#193348] font-semibold',
    headerSubtitle: 'text-[#6a7f80]',
    socialButtonsBlockButtonText: 'text-[#193348]',
    formFieldLabel: 'text-[#193348]',
    footerActionLink: 'text-[#d75f4c]',
    footerActionText: 'text-[#6a7f80]',
    dividerText: 'text-[#6a7f80]',
    identityPreviewEditButton: 'text-[#d75f4c]',
    formFieldSuccessText: 'text-[#328d79]',
    alertText: 'text-[#193348]',
    logoBox: 'h-10',
    logoImage: 'h-10',
    socialButtonsBlockButton: 'border-[#d2e0dc] bg-[#f2f8f5]',
    formButtonPrimary: 'bg-[#e8755f] hover:bg-[#d75f4c] text-white',
    formFieldInput: 'border-[#d2e0dc] bg-[#f2f8f5] text-[#193348]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#d2e0dc]',
    alert: 'bg-[#fff2e5] border-[#edc898]',
    otpCodeFieldInput: 'border-[#d2e0dc] bg-[#f2f8f5]',
    formFieldRow: 'gap-1',
    main: 'gap-5',
  },
};

function UserRoleRedirect() {
  const { data: user, error, isLoading, refetch } = useGetCurrentUser();
  const { signOut } = useClerk();
  if (isLoading) return <div className="grid min-h-[100dvh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (error || !user) {
    const status = typeof error === 'object' && error !== null && 'status' in error ? error.status : undefined;
    const message = status === 404
      ? "Votre compte est authentifié, mais aucun profil pédagogique ne lui est associé. Contactez un administrateur."
      : status === 409
        ? "Ce profil est déjà associé à un autre compte. Contactez un administrateur."
        : "La vérification de votre profil a échoué. Réessayez ou contactez un administrateur si le problème persiste.";
    return <ProfileAccessState title={status === 404 ? "Compte non lié" : "Profil indisponible"} message={message} onRetry={() => void refetch()} onSignOut={() => void signOut({ redirectUrl: basePath || '/' })} />;
  }
  if (user.status !== 'active') {
    return <ProfileAccessState title="Compte inactif" message="Votre profil existe mais il n'est pas actif. Contactez un administrateur pour retrouver l'accès." onRetry={() => void refetch()} onSignOut={() => void signOut({ redirectUrl: basePath || '/' })} />;
  }
  if (user.role === 'teacher') return <Redirect to="/teacher" />;
  if (user.role === 'admin') return <Redirect to="/admin" />;
  if (user.role === 'superadmin') return <Redirect to="/superadmin" />;
  if (user.role === 'student') return <StudentShell><StudentClassesPage /></StudentShell>;
  return <div className="grid min-h-[100dvh] place-items-center px-4"><div className="max-w-md text-center"><h2 className="text-xl font-semibold">Espace étudiant</h2><p className="mt-2 text-muted-foreground">Votre profil ne possède pas encore d’espace disponible.</p></div></div>;
}

function ProfileAccessState({ title, message, onRetry, onSignOut }: { title: string; message: string; onRetry: () => void; onSignOut: () => void }) {
  return <div className="grid min-h-[100dvh] place-items-center bg-background px-4"><div className="w-full max-w-md rounded-2xl border border-[#d2e0dc] bg-white p-8 text-center shadow-sm"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d75f4c]">Master Class</p><h2 className="mt-3 text-2xl font-semibold text-[#193348]">{title}</h2><p className="mt-3 text-muted-foreground">{message}</p><div className="mt-6 flex justify-center gap-3"><button type="button" onClick={onRetry} className="rounded-lg bg-[#e8755f] px-4 py-2 font-medium text-white hover:bg-[#d75f4c]">Réessayer</button><button type="button" onClick={onSignOut} className="rounded-lg border border-[#d2e0dc] px-4 py-2 font-medium text-[#193348] hover:bg-[#f2f8f5]">Se déconnecter</button></div></div></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><UserRoleRedirect /></Show><Show when="signed-out"><Landing /></Show></>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  return <><Show when="signed-in">{isLoading ? <div className="grid min-h-[100dvh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (!user || user.role !== 'admin') ? <Redirect to="/" /> : <AdminShell>{children}</AdminShell>}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  return <><Show when="signed-in">{isLoading ? <div className="grid min-h-[100dvh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (!user || user.role !== 'superadmin') ? <Redirect to="/" /> : <SuperAdminShell>{children}</SuperAdminShell>}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function TeacherRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  return <><Show when="signed-in">{isLoading ? <div className="grid min-h-[100dvh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (!user || user.role !== 'teacher') ? <Redirect to="/" /> : <TeacherShell>{children}</TeacherShell>}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/404" component={NotFound} />
        <Route path="/admin"><AdminRoute><Overview /></AdminRoute></Route>
        <Route path="/admin/users"><AdminRoute><UsersPage /></AdminRoute></Route>
        <Route path="/admin/classes/:id"><AdminRoute><ClassDetailPage /></AdminRoute></Route>
        <Route path="/admin/classes"><AdminRoute><ClassesPage /></AdminRoute></Route>
        <Route path="/admin/modules"><AdminRoute><ModulesPage /></AdminRoute></Route>
        <Route path="/superadmin"><SuperAdminRoute><UsersPage scope="superadmin" /></SuperAdminRoute></Route>
        <Route path="/superadmin/admins"><SuperAdminRoute><UsersPage scope="superadmin" /></SuperAdminRoute></Route>
        <Route path="/teacher"><TeacherRoute><TeacherClassesPage /></TeacherRoute></Route>
        <Route path="/teacher/classes/:id"><TeacherRoute><TeacherClassDetailPage /></TeacherRoute></Route>
        <Route path="/teacher/activities/:id"><TeacherRoute><TeacherActivityPage /></TeacherRoute></Route>
        <Route path="/student"><StudentRoute><StudentClassesPage /></StudentRoute></Route>
        <Route path="/student/classes/:id"><StudentRoute><StudentClassDetailPage /></StudentRoute></Route>
        <Route path="/student/activities/:id"><StudentRoute><StudentActivityPage /></StudentRoute></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function StudentRoute({ children }: { children: ReactNode }) {
  const { data: user, isLoading } = useGetCurrentUser();
  return <><Show when="signed-in">{isLoading ? <div className="grid min-h-[100dvh] place-items-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : (!user || user.role !== 'student') ? <Redirect to="/" /> : <StudentShell>{children}</StudentShell>}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function SignInPage() {
  const [location] = useLocation();
  const isClerkSubpath = location !== '/sign-in';

  // Clerk owns its callback and factor subpaths. Rendering its form directly
  // keeps OAuth and MFA completion on the same route. The destination is
  // resolved after authentication from the user's Master Class role.
  return <div className="grain grid min-h-[100dvh] place-items-center bg-background px-4 py-8"><div className="w-full max-w-[440px]"><SignIn routing="path" path={`${basePath}/sign-in`} /></div></div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => { const userId = user?.id ?? null; if (previous.current !== undefined && previous.current !== userId) queryClient.clear(); previous.current = userId; }), [addListener]);
  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} localization={{ signIn: { start: { title: 'Bon retour parmi nous', subtitle: 'Votre espace pédagogique vous attend.' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}><QueryClientProvider client={queryClient}><ClerkCacheInvalidator /><Router /></QueryClientProvider></ClerkProvider>;
}

function App() {
  return (
    <TooltipProvider><WouterRouter base={basePath}><ClerkRoutes /></WouterRouter><Toaster /></TooltipProvider>
  );
}

export default App;
