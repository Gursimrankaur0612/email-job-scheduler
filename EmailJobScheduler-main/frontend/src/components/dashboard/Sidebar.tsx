import type { Session } from "next-auth";
import { useRouter } from "next/navigation";
import { ClockIcon, PaperPlaneIcon, PlusIcon } from "@/components/icons";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { silkscreen } from "@/lib/fonts";

export type TabKey = "scheduled" | "sent";

interface SidebarProps {
  user: Session["user"];
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  counts: { scheduled: number | null; sent: number | null };
}

const NAV_ITEMS: { key: TabKey; label: string; Icon: typeof ClockIcon }[] = [
  { key: "scheduled", label: "Scheduled", Icon: ClockIcon },
  { key: "sent", label: "Sent", Icon: PaperPlaneIcon },
];

export function Sidebar({ user, activeTab, onTabChange, counts }: SidebarProps) {
  const router = useRouter();

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-6 border-r border-gray-200 bg-white p-5">
      <span className={`${silkscreen.className} text-3xl text-gray-900`}>ONB</span>

      <UserMenu user={user} />

      <button
        type="button"
        onClick={() => router.push("/dashboard/compose")}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-green-600 px-4 py-2.5 text-sm font-semibold text-green-600 transition hover:bg-green-50"
      >
        <PlusIcon className="h-4 w-4" />
        Compose
      </button>

      <div>
        <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Core</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ key, label, Icon }) => {
            const isActive = activeTab === key;
            const count = counts[key];

            return (
              <button
                key={key}
                type="button"
                onClick={() => onTabChange(key)}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-green-50 text-green-700" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4" />
                  {label}
                </span>
                <span
                  className={`min-w-[1.5rem] rounded-full px-2 py-0.5 text-center text-xs font-semibold ${
                    isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {count ?? "–"}
                </span>
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
