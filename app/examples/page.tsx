import Link from "next/link";

const EXAMPLE_CARDS = [
  {
    title: "360 Image Tour",
    href: "/examples/360-tour",
    status: "Live now",
    description:
      "A multi-panorama A-Frame tour with compact HTML navigation and in-scene hotspots.",
  },
  {
    title: "Superhero Flight",
    href: "/examples/superhero-flight",
    status: "New",
    description:
      "A mobile-friendly endless flying runner with drag steering, near-miss bonuses, and a low-poly city skyline.",
  },
  {
    title: "Jersey Spotlight",
    href: "/examples/jersey-spotlight",
    status: "Live now",
    description:
      "A branded product spotlight that renders a 3D jersey GLB with stage lighting and live color selection.",
  },
];

export function ExamplesPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f8fafc_0%,_#ecfeff_48%,_#eef2ff_100%)] px-4 py-10 sm:px-6 lg:px-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-700">
            A-Frame Examples
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
            Interactive WebXR experiments built in A Frame
          </h1>
          <p className="mt-4 text-lg leading-8 text-slate-700">
            Explore the 360 tour, then jump into the new superhero flight
            runner built for quick replayable sessions.
          </p>
        </div>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {EXAMPLE_CARDS.map((card) => {
            const content = (
              <article className="flex h-full flex-col rounded-[1.75rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-700">
                  {card.status}
                </p>
                <h2 className="mt-4 text-2xl font-semibold text-slate-950">
                  {card.title}
                </h2>
                <p className="mt-3 flex-1 text-base leading-7 text-slate-700">
                  {card.description}
                </p>
                <p className="mt-6 text-sm font-semibold text-slate-950">
                  {card.href ? "Open example" : "Awaiting design"}
                </p>
              </article>
            );

            return card.href ? (
              <Link key={card.title} href={card.href} className="block">
                {content}
              </Link>
            ) : (
              <div key={card.title}>{content}</div>
            );
          })}
        </section>
      </div>
    </main>
  );
}

export default ExamplesPage;
