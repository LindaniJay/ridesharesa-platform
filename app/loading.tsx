export default function RootLoading() {
  return (
    <main className="space-y-6 animate-pulse">
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="h-6 w-40 rounded-full bg-muted" />
          <div className="h-12 w-full max-w-2xl rounded-xl bg-muted" />
          <div className="h-5 w-full max-w-xl rounded-lg bg-muted" />
          <div className="flex flex-wrap gap-2">
            <div className="h-9 w-36 rounded-lg bg-muted" />
            <div className="h-9 w-36 rounded-lg bg-muted" />
          </div>
          <div className="rounded-2xl border border-border bg-card/60 p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="h-10 rounded-lg bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card/60 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
            <div className="h-20 rounded-xl bg-muted" />
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="h-32 rounded-2xl border border-border bg-card/60" />
        <div className="h-32 rounded-2xl border border-border bg-card/60" />
        <div className="h-32 rounded-2xl border border-border bg-card/60" />
        <div className="h-32 rounded-2xl border border-border bg-card/60" />
      </section>
    </main>
  );
}
