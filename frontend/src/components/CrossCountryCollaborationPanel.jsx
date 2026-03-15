import { useEffect, useState } from "react";
import axios from "axios";
import {
  Clock3,
  Globe2,
  Loader2,
  ShieldCheck,
  ToggleLeft,
  Users,
} from "lucide-react";
import { BACKEND_URL } from "@/config";

const flagTone = {
  enabled: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  conditional: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  required: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  optional: "bg-zinc-500/10 text-zinc-300 border-zinc-500/20",
};

const prettyFlagName = (key) =>
  key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export default function CrossCountryCollaborationPanel() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOverview = async () => {
      const token = localStorage.getItem("token");
      if (!token || token === "undefined" || token === "null") {
        setError("Missing login session");
        setLoading(false);
        return;
      }

      try {
        const { data } = await axios.get(`${BACKEND_URL}/helper/collaboration-overview`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setOverview(data);
      } catch (loadError) {
        console.error("Failed to load collaboration overview", loadError);
        setError(loadError.response?.data?.error || "Failed to load collaboration overview");
      } finally {
        setLoading(false);
      }
    };

    loadOverview();
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60">
        <Loader2 className="size-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300">
        {error}
      </div>
    );
  }

  const currentUser = overview?.current_user;
  const countries = overview?.supported_countries || [];
  const teamDistribution = overview?.team_distribution || [];

  return (
    <div className="h-full overflow-auto p-4 md:p-6 bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto space-y-6">
        <section className="rounded-3xl border border-zinc-800/70 bg-gradient-to-br from-zinc-900 via-zinc-950 to-zinc-950 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                <Globe2 className="size-3.5" />
                Cross-Country Collaboration
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">Global work context for India, USA, and Germany</h2>
              <p className="mt-2 max-w-3xl text-sm text-zinc-400">
                This layer makes schedules, policies, and collaboration windows visible so teams do not need to calculate cross-country working hours manually.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 min-w-[280px]">
              <div className="text-xs uppercase tracking-wide text-zinc-500">Your collaboration context</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Country</span>
                  <span className="font-medium">{currentUser?.country_label}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Timezone</span>
                  <span className="font-medium">{currentUser?.timezone}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Region</span>
                  <span className="font-medium">{currentUser?.region}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">Current local time</span>
                  <span className="font-medium">{currentUser?.local_time}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-zinc-400">GDPR-sensitive region</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${currentUser?.gdpr_region ? "bg-blue-500/10 text-blue-300" : "bg-zinc-800 text-zinc-300"}`}>
                    {currentUser?.gdpr_region ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {teamDistribution.map((item) => (
            <div key={item.country} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">{item.label}</span>
                <Users className="size-4 text-zinc-500" />
              </div>
              <div className="mt-4 text-3xl font-semibold">{item.count}</div>
              <p className="mt-1 text-xs text-zinc-500">Active employee/admin users in this country</p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {countries.map((country) => (
            <div key={country.country} className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">{country.label}</h3>
                  <p className="text-xs text-zinc-500">{country.region} · {country.timezone}</p>
                </div>
                <div className={`rounded-full px-2 py-1 text-[11px] font-medium ${country.gdpr_region ? "bg-blue-500/10 text-blue-300" : "bg-zinc-800 text-zinc-300"}`}>
                  {country.gdpr_region ? "GDPR-aware" : "Standard"}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  <Clock3 className="size-3.5" />
                  Overlap Window
                </div>
                {country.overlap?.has_overlap ? (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium text-zinc-100">{country.overlap.overlap_hours} hours of shared work time</p>
                    <p className="text-xs text-zinc-400">Your local view: {country.overlap.source_window_label}</p>
                    <p className="text-xs text-zinc-400">{country.label} local view: {country.overlap.target_window_label}</p>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-400">No direct working-hour overlap in the current daily window.</p>
                )}
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                  <ToggleLeft className="size-3.5" />
                  Country Feature Rules
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {Object.entries(country.feature_flags || {}).map(([key, value]) => (
                    <span key={key} className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${flagTone[value] || "bg-zinc-800 text-zinc-300 border-zinc-700"}`}>
                      {prettyFlagName(key)}: {value}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-200">
            <ShieldCheck className="size-4 text-blue-300" />
            Why this matters
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm text-zinc-400">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">Meetings can be scheduled in one timezone and shown correctly in another.</div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">Sensitive data can later be restricted by region and GDPR-sensitive rules.</div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">Country-based feature toggles can control AI, exports, recording, and guest access.</div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-4">Managers can see where collaboration overlap is strong and where handoff planning is needed.</div>
          </div>
        </section>
      </div>
    </div>
  );
}
