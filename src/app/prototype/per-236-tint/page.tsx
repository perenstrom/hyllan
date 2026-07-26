// PROTOTYPE — throwaway, not part of the app. See PER-236.
// One row after another, no switcher: every out-of-stock row-shading
// candidate stacked so they can be eyeballed side by side against a
// real in-stock row above each. Muted text is corrected to zinc-600 /
// dark:zinc-300 in every candidate except "current", which keeps
// today's zinc-400 / dark:zinc-600 to show the baseline contrast bug.
import { notFound } from "next/navigation";

if (process.env.NODE_ENV === "production") {
  notFound();
}

const ACTION_BUTTON_CLASS =
  "flex h-8 w-8 items-center justify-center rounded border border-zinc-300 text-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300";

type Candidate = {
  key: string;
  label: string;
  note: string;
  rowBgClass: string;
  mutedTextClass: string;
};

const candidates: Candidate[] = [
  {
    key: "current",
    label: "Current (no tint)",
    note:
      "bg: page bg only — muted text-zinc-400/dark:text-zinc-600 vs bg: 2.46:1 light / 2.72:1 dark — FAILS AA (needs 4.5:1)",
    rowBgClass: "",
    mutedTextClass: "text-zinc-400 dark:text-zinc-600",
  },
  {
    key: "red",
    label: "Red — red-100 / dark:red-950",
    note:
      "muted text-zinc-600/dark:text-zinc-300 vs bg: 6.33:1 light / 10.92:1 dark — passes AA",
    rowBgClass: "bg-red-100 dark:bg-red-950",
    mutedTextClass: "text-zinc-600 dark:text-zinc-300",
  },
  {
    key: "rose",
    label: "Rose — rose-100 / dark:rose-950",
    note: "same corrected muted text as above, softer/pinker hue than red",
    rowBgClass: "bg-rose-100 dark:bg-rose-950",
    mutedTextClass: "text-zinc-600 dark:text-zinc-300",
  },
  {
    key: "orange",
    label: "Orange — orange-100 / dark:orange-950",
    note: "warmer, less \"error\"-coded than red/rose",
    rowBgClass: "bg-orange-100 dark:bg-orange-950",
    mutedTextClass: "text-zinc-600 dark:text-zinc-300",
  },
  {
    key: "amber",
    label: "Amber — amber-100 / dark:amber-950",
    note: "warm/low-key, reads closer to \"low stock\" than \"error\"",
    rowBgClass: "bg-amber-100 dark:bg-amber-950",
    mutedTextClass: "text-zinc-600 dark:text-zinc-300",
  },
];

function DemoTable({ candidate }: { candidate: Candidate }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="border-b border-zinc-200 dark:border-zinc-800">
          <tr>
            <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Name
            </th>
            <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Amount
            </th>
            <th className="px-4 py-2 font-medium text-zinc-600 dark:text-zinc-400">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
            <td className="px-4 py-2">Olive oil</td>
            <td className="px-4 py-2">1 l</td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-1.5">
                <button className={ACTION_BUTTON_CLASS} disabled>
                  −
                </button>
                <button className={ACTION_BUTTON_CLASS} disabled>
                  +
                </button>
              </div>
            </td>
          </tr>
          <tr
            className={`border-b border-zinc-100 last:border-0 dark:border-zinc-900 ${candidate.rowBgClass} ${candidate.mutedTextClass}`}
          >
            <td className="px-4 py-2">
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
                <span>Flour</span>
                <span className="sr-only">Out of stock</span>
              </div>
            </td>
            <td className="px-4 py-2">0 kg</td>
            <td className="px-4 py-2">
              <div className="flex items-center gap-1.5">
                <button className={ACTION_BUTTON_CLASS} disabled>
                  −
                </button>
                <button className={ACTION_BUTTON_CLASS} disabled>
                  +
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default function Page() {
  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-6 font-sans dark:bg-black">
      <div>
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
          PROTOTYPE — PER-236 row-tint options
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          &ldquo;Flour&rdquo; is the out-of-stock row in every table below. Toggle your
          OS/browser color scheme to compare light and dark.
        </p>
      </div>
      {candidates.map((candidate) => (
        <div key={candidate.key} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
            {candidate.label}
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-500">
            {candidate.note}
          </p>
          <DemoTable candidate={candidate} />
        </div>
      ))}
    </div>
  );
}
