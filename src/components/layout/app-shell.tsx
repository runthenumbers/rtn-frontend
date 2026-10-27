"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { routes } from "@/lib/routes";
import { useAuth } from "@/components/auth/auth-provider";
import { useWorkspace } from "@/components/auth/auth-provider";

const navigation = [
  { href: routes.dashboard, label: "Dashboard" },
  { href: routes.materials, label: "Materials" },
  { href: routes.batches, label: "Batches" },
  { href: routes.settings, label: "Settings" },
] as const;

interface AppShellProps {
  children: ReactNode;
}

interface NavigationProps {
  onNavigate?: () => void;
}

function WorkspaceNavigation({ onNavigate }: NavigationProps) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary navigation">
      <ul className="grid gap-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== routes.dashboard &&
              pathname.startsWith(`${item.href}/`));

          return (
            <li key={item.href}>
              <Link
                className={[
                  "flex min-h-11 items-center rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700",
                  isActive
                    ? "bg-emerald-50 text-emerald-900"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-950",
                ].join(" ")}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AppShell({ children }: AppShellProps) {
  const router = useRouter();
  const { signOut: endSession } = useAuth();
  const [signOutError, setSignOutError] = useState<string>();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const workspace = useWorkspace();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (isMenuOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isMenuOpen && dialog.open) {
      dialog.close();
      menuButtonRef.current?.focus();
    }
  }, [isMenuOpen]);

  useEffect(() => {
    const desktopViewport = window.matchMedia("(min-width: 768px)");

    function closeAtDesktopWidth(event: MediaQueryListEvent) {
      if (event.matches) {
        setIsMenuOpen(false);
      }
    }

    desktopViewport.addEventListener("change", closeAtDesktopWidth);

    return () => {
      desktopViewport.removeEventListener("change", closeAtDesktopWidth);
    };
  }, []);

  function closeMenu() {
    setIsMenuOpen(false);
  }

  async function signOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setSignOutError(undefined);
    try {
      await endSession();
      closeMenu();
      router.replace(routes.signIn);
      router.refresh();
    } catch {
      setSignOutError("We couldn’t sign you out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {signOutError ? (
        <p role="alert" className="bg-red-50 p-4 text-red-800">
          {signOutError}
        </p>
      ) : null}
      <a
        className="fixed top-3 left-3 z-50 -translate-y-20 rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white transition focus:translate-y-0 focus:outline-none"
        href="#main-content"
      >
        Skip to main content
      </a>

      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            className="inline-flex items-baseline gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-700"
            href={routes.dashboard}
          >
            <span className="text-xl font-bold tracking-tight text-emerald-800">
              RTN
            </span>
            <span className="hidden text-sm text-slate-500 sm:inline">
              Production costing
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              className="hidden min-h-11 items-center rounded-lg px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 md:inline-flex"
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
            >
              Sign out
            </button>
            <button
              className="inline-flex size-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 md:hidden"
              type="button"
              aria-controls="mobile-navigation"
              aria-expanded={isMenuOpen}
              aria-label="Open navigation menu"
              onClick={() => setIsMenuOpen(true)}
              ref={menuButtonRef}
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <dialog
        className="m-0 ml-auto h-full max-h-none w-[min(22rem,calc(100%-2rem))] max-w-none border-0 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/50 md:hidden"
        id="mobile-navigation"
        aria-labelledby="mobile-navigation-title"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            closeMenu();
          }
        }}
        onClose={() => setIsMenuOpen(false)}
        ref={dialogRef}
      >
        <div className="flex min-h-full flex-col p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h2
              className="text-base font-semibold text-slate-950"
              id="mobile-navigation-title"
            >
              Workspace
            </h2>
            <button
              className="inline-flex size-11 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              type="button"
              aria-label="Close navigation menu"
              onClick={closeMenu}
            >
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                aria-hidden="true"
              >
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
          <div className="mt-5">
            <p className="mb-3 truncate px-3 text-sm font-semibold text-slate-950">
              {workspace?.businessName ?? "Active workspace"}
            </p>
            <WorkspaceNavigation onNavigate={closeMenu} />
          </div>
          <div className="mt-auto border-t border-slate-200 pt-5">
            <button
              className="inline-flex min-h-11 w-full items-center rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              type="button"
              onClick={signOut}
              disabled={isSigningOut}
            >
              Sign out
            </button>
          </div>
        </div>
      </dialog>

      <div className="mx-auto grid w-full max-w-screen-2xl md:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-4rem)] border-r border-slate-200 bg-white md:block">
          <div className="sticky top-16 p-4 lg:p-6">
            <p className="px-3 text-xs font-semibold tracking-wider text-slate-500 uppercase">
              Workspace
            </p>
            <p className="mt-2 truncate px-3 text-sm font-semibold text-slate-950">
              {workspace?.businessName ?? "Active workspace"}
            </p>
            <div className="mt-3">
              <WorkspaceNavigation />
            </div>
          </div>
        </aside>

        <main
          className="min-w-0 px-4 py-8 sm:px-6 lg:px-10 lg:py-10"
          id="main-content"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
