"use client";

import { useCounterStore } from "@/stores/use-counter-store";

export function CounterPanel() {
  const { count, increment, decrement, reset } = useCounterStore();

  return (
    <section className="w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
        Zustand Store
      </p>
      <div className="mt-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-5xl font-semibold text-slate-950">{count}</p>
          <p className="mt-2 text-sm text-slate-600">
            This value is stored in a typed Zustand store.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          Reset
        </button>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={decrement}
          className="rounded-full bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Decrease
        </button>
        <button
          type="button"
          onClick={increment}
          className="rounded-full bg-emerald-500 px-4 py-3 text-sm font-medium text-white transition hover:bg-emerald-400"
        >
          Increase
        </button>
      </div>
    </section>
  );
}
