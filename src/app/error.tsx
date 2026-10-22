"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-screen place-content-center gap-5 p-6 text-center">
      <h1 className="text-2xl font-semibold">We couldn’t load this page</h1>
      <p>Please check your connection and try again.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-emerald-950 px-5 py-3 font-semibold text-white"
      >
        Try again
      </button>
    </main>
  );
}
