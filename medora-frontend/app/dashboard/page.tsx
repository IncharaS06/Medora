// Everything above remains exactly the same until the helper components

// ---------- Helper Components with correct types ----------
function MetricCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 rounded-2xl shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2 text-[var(--primary)]">
        {icon}
        <p className="text-sm text-[var(--text-soft)]">{label}</p>
      </div>
      <p className="text-2xl font-bold mt-3 text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function RealChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white p-6 rounded-[28px] shadow-[var(--shadow-card)]">
      <h3 className="font-bold text-lg text-[var(--foreground)]">{title}</h3>
      <div className="mt-5 rounded-2xl bg-[var(--card)] p-4">{children}</div>
    </div>
  );
}

function ExplainCard({ title, image, fallback }: { title: string; image: string; fallback: string }) {
  return (
    <div className="rounded-2xl bg-[var(--card)] p-4">
      <h4 className="text-sm font-medium text-[var(--text-soft)] mb-3">{title}</h4>
      {image ? (
        <img src={image} alt={title} className="rounded-xl shadow w-full object-contain max-h-[320px] bg-white" />
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-white min-h-[220px] flex items-center justify-center text-sm text-[var(--text-soft)] text-center px-4">
          {fallback}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3">
      <span className="text-sm text-[var(--text-soft)]">{label}</span>
      <span className="text-sm font-medium text-[var(--foreground)] text-right break-words">{value}</span>
    </div>
  );
}
