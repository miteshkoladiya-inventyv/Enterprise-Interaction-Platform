import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BriefcaseBusiness,
  CircleAlert,
  Clock3,
  Copy,
  FolderKanban,
  Filter,
  Globe2,
  Loader2,
  MapPin,
  RefreshCcw,
  Search,
  ToggleLeft,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { BACKEND_URL } from "@/config";

const flagTone = {
  enabled: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  conditional: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  required: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  optional: "border-zinc-700 bg-zinc-800 text-zinc-300",
};

const overlapTone = {
  strong: "bg-emerald-400",
  medium: "bg-amber-400",
  low: "bg-rose-400",
};

const shiftTone = {
  "Day Shift": "border-sky-500/20 bg-sky-500/10 text-sky-300",
  "Night Shift": "border-violet-500/20 bg-violet-500/10 text-violet-300",
};

const getOverlapLabel = (member) => {
  if (!member?.overlap?.has_overlap) {
    return {
      label: "Async only",
      tone: "bg-amber-500/10 text-amber-300",
      note: "No direct live window today",
    };
  }

  const minutes = member.overlap?.overlap_minutes || 0;
  if (minutes >= 240) {
    return {
      label: "Good overlap",
      tone: "bg-emerald-500/10 text-emerald-300",
      note: "Strong live collaboration window",
    };
  }

  return {
    label: "Limited overlap",
    tone: "bg-orange-500/10 text-orange-300",
    note: "Best for short live check-ins",
  };
};

const prettyFlagName = (key) =>
  key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getUserTypeLabel = (userType) => {
  if (userType === "admin") return "Admin";
  if (userType === "employee") return "Employee";
  return "User";
};

const getOverlapStrength = (member) => {
  const percentage = member?.overlap_percentage || 0;
  if (percentage >= 60) return "strong";
  if (percentage >= 30) return "medium";
  return "low";
};

const getInitials = (name) =>
  String(name || "User")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

const formatCount = (value, singular, plural = `${singular}s`) =>
  `${value || 0} ${(value || 0) === 1 ? singular : plural}`;

const copyText = async (value, successMessage) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successMessage);
  } catch {
    toast.error("Failed to copy");
  }
};

const buildOverlapCopy = (member) => {
  if (!member?.overlap?.has_overlap) {
    return `${member?.name || "User"}: No overlap today`;
  }

  return [
    member.name,
    `Your time: ${member.overlap.source_window_label}`,
    `${member.country_label} time: ${member.overlap.target_window_label}`,
    `Shared time: ${member.overlap.overlap_hours} hours`,
  ].join("\n");
};

const controlClassName =
  "w-full rounded-xl border border-zinc-800 bg-zinc-950/90 px-3 py-2 text-sm text-zinc-100 shadow-sm outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10";

const actionButtonClassName =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs font-medium text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-800";

export default function CrossCountryCollaborationPanel() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [countryFilter, setCountryFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [workingFilter, setWorkingFilter] = useState("all");
  const [overlapFilter, setOverlapFilter] = useState("all");
  const [viewMode, setViewMode] = useState("grouped");

  const loadOverview = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    const token = localStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") {
      setError("Missing login session");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const { data } = await axios.get(
        `${BACKEND_URL}/helper/collaboration-overview`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setOverview(data);
    } catch (loadError) {
      console.error("Failed to load collaboration overview", loadError);
      setError(
        loadError.response?.data?.error ||
          "Failed to load collaboration overview"
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const currentUser = overview?.current_user;
  const countries = overview?.supported_countries || [];
  const teamDistribution = overview?.team_distribution || [];
  const globalTeamMembers = overview?.global_team_members || [];
  const summary = overview?.summary;

  const sortedCountries = useMemo(
    () =>
      [...countries].sort(
        (a, b) =>
          (b.overlap?.overlap_minutes || 0) - (a.overlap?.overlap_minutes || 0)
      ),
    [countries]
  );

  const teamDistributionMap = useMemo(
    () => new Map(teamDistribution.map((item) => [item.country, item])),
    [teamDistribution]
  );

  const countryOptions = useMemo(
    () =>
      [...new Set(globalTeamMembers.map((member) => member.country_label))].sort(
        (a, b) => a.localeCompare(b)
      ),
    [globalTeamMembers]
  );

  const departmentOptions = useMemo(
    () =>
      [
        ...new Set(
          globalTeamMembers
            .map((member) => member.department?.name || member.position)
            .filter(Boolean)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [globalTeamMembers]
  );

  const filteredMembers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...globalTeamMembers]
      .filter((member) => {
        if (countryFilter !== "all" && member.country_label !== countryFilter) {
          return false;
        }

        if (
          departmentFilter !== "all" &&
          member.department?.name !== departmentFilter &&
          member.position !== departmentFilter
        ) {
          return false;
        }

        if (shiftFilter !== "all" && member.shift_type !== shiftFilter) {
          return false;
        }

        if (workingFilter === "working" && !member.working_now) {
          return false;
        }

        if (workingFilter === "outside" && member.working_now) {
          return false;
        }

        if (overlapFilter === "available" && !member.overlap?.has_overlap) {
          return false;
        }

        if (overlapFilter === "none" && member.overlap?.has_overlap) {
          return false;
        }

        if (!query) return true;

        const haystack = [
          member.name,
          member.email,
          member.country_label,
          member.timezone,
          member.department?.name,
          member.position,
          member.region,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      })
      .sort((a, b) => {
        const overlapDiff =
          (b.overlap?.overlap_minutes || 0) - (a.overlap?.overlap_minutes || 0);
        if (overlapDiff !== 0) return overlapDiff;

        const sameCountryA = a.country === currentUser?.country ? 1 : 0;
        const sameCountryB = b.country === currentUser?.country ? 1 : 0;
        if (sameCountryA !== sameCountryB) return sameCountryB - sameCountryA;

        return (a.name || "").localeCompare(b.name || "");
      });
  }, [
    countryFilter,
    currentUser?.country,
    departmentFilter,
    globalTeamMembers,
    overlapFilter,
    searchQuery,
    shiftFilter,
    workingFilter,
  ]);

  const hasActiveFilters =
    countryFilter !== "all" ||
    departmentFilter !== "all" ||
    shiftFilter !== "all" ||
    workingFilter !== "all" ||
    overlapFilter !== "all" ||
    searchQuery.trim().length > 0;

  const groupedMembers = useMemo(() => {
    const groups = filteredMembers.reduce((acc, member) => {
      const key = member.country_label || "Other";
      if (!acc[key]) acc[key] = [];
      acc[key].push(member);
      return acc;
    }, {});

    return Object.entries(groups).sort((a, b) => {
      const overlapA = Math.max(
        ...a[1].map((member) => member.overlap?.overlap_minutes || 0),
        0
      );
      const overlapB = Math.max(
        ...b[1].map((member) => member.overlap?.overlap_minutes || 0),
        0
      );
      if (overlapB !== overlapA) return overlapB - overlapA;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredMembers]);

  const bestTimeSuggestion = useMemo(() => {
    const candidates = filteredMembers.filter((member) => member.overlap?.has_overlap);
    if (candidates.length === 0) return null;

    const bestMember = candidates.reduce((best, current) => {
      if (!best) return current;
      return (current.overlap?.overlap_minutes || 0) >
        (best.overlap?.overlap_minutes || 0)
        ? current
        : best;
    }, null);

    if (!bestMember?.overlap?.has_overlap) return null;

    return {
      name: bestMember.name,
      countryLabel: bestMember.country_label,
      yourWindow: bestMember.overlap.source_window_label,
      theirWindow: bestMember.overlap.target_window_label,
      hours: bestMember.overlap.overlap_hours,
    };
  }, [filteredMembers]);

  const summaryCards = [
    {
      label: "Active Team",
      value: summary?.total_team_members ?? 0,
      hint: formatCount(summary?.total_teammates, "teammate"),
    },
    {
      label: "Working Now",
      value: summary?.working_now_count ?? 0,
      hint: "Within local working hours",
    },
    {
      label: "Countries Covered",
      value: summary?.countries_covered ?? 0,
      hint: `${Math.max(
        (summary?.countries_covered ?? 0) - (currentUser?.country ? 1 : 0),
        0
      )} outside your country`,
    },
    {
      label: "Best Overlap",
      value: summary?.best_overlap_country?.label || "No overlap",
      hint: summary?.best_overlap_country
        ? `${summary.best_overlap_country.overlap_hours} hrs shared`
        : "No country currently overlaps",
    },
    {
      label: "Handoff Risk",
      value: summary?.no_overlap_countries ?? 0,
      hint: `${
        summary?.no_overlap_countries === 1 ? "1 country has" : `${summary?.no_overlap_countries ?? 0} countries have`
      } no overlap`,
    },
  ];

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950/60">
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

  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.10),_transparent_28%),linear-gradient(180deg,_rgba(9,9,11,1),_rgba(9,9,11,0.96))] p-4 text-zinc-100 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-[28px] border border-zinc-800/70 bg-[linear-gradient(135deg,rgba(24,24,27,0.94),rgba(9,9,11,0.98)),radial-gradient(circle_at_top_right,rgba(14,165,233,0.14),transparent_24%)] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                <Globe2 className="size-3.5" />
                Global Work
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight">
                Global Team + time zone awareness
              </h2>
              <p className="mt-2 text-sm text-zinc-400">
                {summary?.role_scope === "admin_overview"
                  ? "Track teammate distribution, overlap hours, and simple region context across the active organization footprint."
                  : "See who works where, what overlap exists today, and which regions need async planning."}
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-sm">
              <button
                type="button"
                onClick={() => loadOverview(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 self-start rounded-xl border border-zinc-700/80 bg-zinc-900/80 px-3 py-2 text-xs font-medium text-zinc-200 shadow-sm transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-60"
              >
                <RefreshCcw
                  className={`size-3.5 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>

              <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="text-xs uppercase tracking-wide text-zinc-500">
                  Your collaboration context
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Country</span>
                    <span className="font-medium">{currentUser?.country_label}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Timezone</span>
                    <span className="font-medium">{currentUser?.timezone}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Current local time</span>
                    <span className="font-medium">{currentUser?.local_time}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Working hours</span>
                    <span className="font-medium">
                      {currentUser?.working_hours_label || "N/A"}
                    </span>
                  </div>
                  {currentUser?.shift_label ? (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-zinc-400">Shift</span>
                      <span className="font-medium">{currentUser.shift_label}</span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-zinc-400">Data region</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        currentUser?.gdpr_region
                          ? "bg-blue-500/10 text-blue-300"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {currentUser?.gdpr_region ? "GDPR-aware" : "Standard"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.9),rgba(9,9,11,0.92))] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.18)]"
            >
              <div className="text-xs uppercase tracking-wide text-zinc-500">
                {card.label}
              </div>
              <div className="mt-4 text-3xl font-semibold">{card.value}</div>
              <p className="mt-1 text-xs text-zinc-500">{card.hint}</p>
            </div>
          ))}
        </section>

        <section className="rounded-[24px] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.84),rgba(9,9,11,0.90))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.20)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100">
                Global Team
              </h3>
              <p className="mt-1 text-sm text-zinc-400">
                Users from different countries are sorted by strongest overlap
                first so common working time is easy to spot.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
                {formatCount(filteredMembers.length, "result")}
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
                {formatCount(summary?.working_now_count, "person")} working now
              </span>
              <span className="rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
                {formatCount(summary?.overlap_available_count, "teammate")} with
                overlap
              </span>
              <div className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-950/80 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("grouped")}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    viewMode === "grouped"
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-zinc-400"
                  }`}
                >
                  Grouped
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-full px-3 py-1 text-xs transition ${
                    viewMode === "grid"
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-zinc-400"
                  }`}
                >
                  Grid
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(145deg,rgba(9,9,11,0.92),rgba(24,24,27,0.84))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <Clock3 className="size-3.5" />
                Best common time today
              </div>
              {bestTimeSuggestion ? (
                <div className="mt-3">
                  <p className="text-base font-semibold text-zinc-100">
                    {bestTimeSuggestion.yourWindow}
                  </p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Best match right now is with {bestTimeSuggestion.name} in{" "}
                    {bestTimeSuggestion.countryLabel}.
                  </p>
                  <p className="mt-2 text-xs text-zinc-500">
                    Their local window: {bestTimeSuggestion.theirWindow} | Shared
                    time: {bestTimeSuggestion.hours} hrs
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-400">
                  No direct common working time is available in the current
                  filter set. Use async planning for this slice of the team.
                </p>
              )}
            </div>
          </div>

          <div className="mt-5 grid gap-3 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] xl:items-start">
            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/55 p-3">
              <label className="mb-2 block text-[11px] uppercase tracking-wide text-zinc-500">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search teammate, country, timezone..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950/90 py-2.5 pl-10 pr-3 text-sm text-zinc-100 shadow-sm outline-none transition focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800/70 bg-zinc-950/55 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400">
                  <Filter className="size-3.5" />
                  Filter team view
                </div>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setCountryFilter("all");
                      setWorkingFilter("all");
                      setDepartmentFilter("all");
                      setShiftFilter("all");
                      setOverlapFilter("all");
                    }}
                    className="text-xs font-medium text-zinc-400 transition hover:text-zinc-200"
                  >
                    Clear all
                  </button>
                ) : null}
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Country
                  </span>
                  <select
                    value={countryFilter}
                    onChange={(e) => setCountryFilter(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="all">All countries</option>
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Schedule
                  </span>
                  <select
                    value={workingFilter}
                    onChange={(e) => setWorkingFilter(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="all">All schedules</option>
                    <option value="working">Working now</option>
                    <option value="outside">Outside hours</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Team
                  </span>
                  <select
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="all">All teams</option>
                    {departmentOptions.map((department) => (
                      <option key={department} value={department}>
                        {department}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Shift
                  </span>
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="all">All shifts</option>
                    <option value="day">Day shift</option>
                    <option value="night">Night shift</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[11px] uppercase tracking-wide text-zinc-500">
                    Overlap
                  </span>
                  <select
                    value={overlapFilter}
                    onChange={(e) => setOverlapFilter(e.target.value)}
                    className={controlClassName}
                  >
                    <option value="all">All overlap</option>
                    <option value="available">Has overlap</option>
                    <option value="none">No overlap</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
              <FolderKanban className="size-3.5" />
              {departmentFilter === "all" ? "All teams" : departmentFilter}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
              <Clock3 className="size-3.5" />
              {shiftFilter === "all"
                ? "All shifts"
                : shiftFilter === "night"
                  ? "Night shift"
                  : "Day shift"}
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-zinc-300">
              <Globe2 className="size-3.5" />
              {countryFilter === "all" ? "All countries" : countryFilter}
            </span>
          </div>

          {globalTeamMembers.length === 0 ? (
            <div className="mt-5 rounded-3xl border border-dashed border-zinc-700 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/80 p-10 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80">
                <Users className="size-7 text-zinc-400" />
              </div>
              <h4 className="mt-4 text-lg font-semibold text-zinc-100">
                No active teammates available yet
              </h4>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-400">
                This workspace will populate when active employee or admin users
                are available in your company scope.
              </p>
            </div>
          ) : (
            <div className="mt-5">
              {filteredMembers.length > 0 ? (
                viewMode === "grouped" ? (
                  <div className="space-y-5">
                    {groupedMembers.map(([countryName, members]) => (
                      <section
                        key={countryName}
                        className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(9,9,11,0.72),rgba(24,24,27,0.68))] p-4 shadow-[0_14px_34px_rgba(0,0,0,0.16)]"
                      >
                        <div className="flex flex-col gap-2 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="text-base font-semibold text-zinc-100">
                              {countryName}
                            </h4>
                            <p className="mt-1 text-sm text-zinc-400">
                              {formatCount(members.length, "teammate")} in this
                              country group
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
                              {formatCount(
                                members.filter((member) => member.working_now).length,
                                "person"
                              )}{" "}
                              working now
                            </span>
                            <span className="rounded-full border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-zinc-300">
                              {formatCount(
                                members.filter(
                                  (member) => member.overlap?.has_overlap
                                ).length,
                                "teammate"
                              )}{" "}
                              with overlap
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                          {members.map((member) => {
                            const overlapStrength = getOverlapStrength(member);
                            const overlapStatus = getOverlapLabel(member);

                            return (
                              <article
                                key={member.user_id}
                                className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.90),rgba(9,9,11,0.94))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                              >
                                <div className="flex items-start gap-4">
                                  <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-indigo-500/15 text-base font-semibold text-indigo-300">
                                    {member.profile_picture ? (
                                      <img
                                        src={member.profile_picture}
                                        alt={member.name}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      getInitials(member.name)
                                    )}
                                  </div>

                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h4 className="truncate text-base font-semibold text-zinc-100">
                                        {member.name}
                                      </h4>
                                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                                        {getUserTypeLabel(member.user_type)}
                                      </span>
                                      {member.shift_label ? (
                                        <span
                                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                            shiftTone[member.shift_label] ||
                                            "border-zinc-700 bg-zinc-900 text-zinc-400"
                                          }`}
                                        >
                                          {member.shift_label}
                                        </span>
                                      ) : null}
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${overlapStatus.tone}`}
                                      >
                                        {overlapStatus.label}
                                      </span>
                                    </div>

                                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400">
                                      <span className="inline-flex items-center gap-2">
                                        <MapPin className="size-3.5 shrink-0" />
                                        {member.country_label} | {member.timezone}
                                      </span>
                                      <span className="inline-flex items-center gap-2">
                                        <Clock3 className="size-3.5 shrink-0" />
                                        Local time: {member.local_time}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                          member.working_now
                                            ? "bg-emerald-500/10 text-emerald-300"
                                            : "bg-amber-500/10 text-amber-300"
                                        }`}
                                      >
                                        {member.working_now
                                          ? "Working now"
                                          : "Outside hours"}
                                      </span>
                                      {member.department?.name || member.position ? (
                                        <span className="inline-flex items-center gap-2">
                                          <BriefcaseBusiness className="size-3.5 shrink-0" />
                                          {[member.department?.name, member.position]
                                            .filter(Boolean)
                                            .join(" | ")}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                                  <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                                      <Clock3 className="size-3.5" />
                                      Common working time
                                    </div>
                                    <span className="text-xs font-medium text-zinc-400">
                                      {member.overlap?.has_overlap
                                        ? `${member.overlap.overlap_hours} hrs shared`
                                        : "No overlap"}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm font-medium text-zinc-200">
                                    {overlapStatus.note}
                                  </p>

                                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        overlapTone[overlapStrength]
                                      }`}
                                      style={{
                                        width: `${member.overlap_percentage || 0}%`,
                                      }}
                                    />
                                  </div>

                                  {member.overlap?.has_overlap ? (
                                    <div className="mt-3 space-y-1.5 text-sm">
                                      <p className="font-medium text-zinc-100">
                                        Your time: {member.overlap.source_window_label}
                                      </p>
                                      <p className="text-zinc-400">
                                        {member.country_label} time:{" "}
                                        {member.overlap.target_window_label}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-zinc-400">
                                      No direct overlap today. Plan this teammate as
                                      an async handoff.
                                    </p>
                                  )}
                                </div>

                                <div className="mt-4 flex flex-wrap gap-2">
                                  {member.data_region?.gdpr_region ? (
                                    <span className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-blue-500/10 text-blue-300">
                                      {member.data_region?.label || "GDPR-aware"}
                                    </span>
                                  ) : null}
                                  <span
                                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                                      member.overlap?.has_overlap
                                        ? "bg-emerald-500/10 text-emerald-300"
                                        : "bg-amber-500/10 text-amber-300"
                                    }`}
                                  >
                                    {member.overlap?.has_overlap
                                      ? "Live overlap"
                                      : "Async handoff"}
                                  </span>
                                  {/* <button
                                    type="button"
                                    onClick={() =>
                                      copyText(
                                        buildOverlapCopy(member),
                                        "Overlap window copied"
                                      )
                                    }
                                    className={actionButtonClassName}
                                  >
                                    <Copy className="size-3.5" />
                                    Copy overlap
                                  </button> */}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
                    {filteredMembers.map((member) => {
                  const overlapStrength = getOverlapStrength(member);
                  const overlapStatus = getOverlapLabel(member);

                  return (
                    <article
                      key={member.user_id}
                      className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.90),rgba(9,9,11,0.96))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex size-14 items-center justify-center overflow-hidden rounded-2xl bg-indigo-500/15 text-base font-semibold text-indigo-300">
                          {member.profile_picture ? (
                            <img
                              src={member.profile_picture}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(member.name)
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="truncate text-base font-semibold text-zinc-100">
                              {member.name}
                            </h4>
                            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">
                              {getUserTypeLabel(member.user_type)}
                            </span>
                            {member.shift_label ? (
                              <span
                                className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                  shiftTone[member.shift_label] ||
                                  "border-zinc-700 bg-zinc-900 text-zinc-400"
                                }`}
                              >
                                {member.shift_label}
                              </span>
                            ) : null}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${overlapStatus.tone}`}
                            >
                              {overlapStatus.label}
                            </span>
                            <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-zinc-400">
                              {member.same_country
                                ? "Same country"
                                : member.country_label}
                            </span>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-zinc-400">
                            <span className="inline-flex items-center gap-2">
                              <MapPin className="size-3.5 shrink-0" />
                              {member.country_label} | {member.timezone}
                            </span>
                            <span className="inline-flex items-center gap-2">
                              <Clock3 className="size-3.5 shrink-0" />
                              Local time: {member.local_time}
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                member.working_now
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {member.working_now ? "Working now" : "Outside hours"}
                            </span>
                            {member.department?.name || member.position ? (
                              <span className="inline-flex items-center gap-2">
                                <BriefcaseBusiness className="size-3.5 shrink-0" />
                                {[member.department?.name, member.position]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                            <Clock3 className="size-3.5" />
                            Common working time
                          </div>
                          <span className="text-xs font-medium text-zinc-400">
                            {member.overlap?.has_overlap
                              ? `${member.overlap.overlap_hours} hrs shared`
                              : "No overlap"}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium text-zinc-200">
                          {overlapStatus.note}
                        </p>

                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className={`h-full rounded-full transition-all ${
                              overlapTone[overlapStrength]
                            }`}
                            style={{ width: `${member.overlap_percentage || 0}%` }}
                          />
                        </div>

                        {member.overlap?.has_overlap ? (
                          <div className="mt-3 space-y-1.5 text-sm">
                            <p className="font-medium text-zinc-100">
                              Your time: {member.overlap.source_window_label}
                            </p>
                            <p className="text-zinc-400">
                              {member.country_label} time:{" "}
                              {member.overlap.target_window_label}
                            </p>
                            <p className="text-xs text-zinc-500">
                              Overlap coverage: {member.overlap_percentage || 0}%
                              of the shared workday window
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 flex gap-3 text-sm text-zinc-400">
                            <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                            <p>
                              No direct overlap today. Use async updates or
                              handoff planning instead of expecting a live window.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {member.data_region?.gdpr_region ? (
                          <span className="rounded-full px-2.5 py-1 text-[11px] font-medium bg-blue-500/10 text-blue-300">
                            {member.data_region?.label || "GDPR-aware"}
                          </span>
                        ) : null}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                            member.overlap?.has_overlap
                              ? "bg-emerald-500/10 text-emerald-300"
                              : "bg-amber-500/10 text-amber-300"
                          }`}
                        >
                          {member.overlap?.has_overlap
                            ? "Live overlap"
                            : "Async handoff"}
                        </span>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              `${member.name} | ${member.timezone}`,
                              "Timezone copied"
                            )
                          }
                          className={actionButtonClassName}
                        >
                          <Copy className="size-3.5" />
                          Copy timezone
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              buildOverlapCopy(member),
                              "Overlap window copied"
                            )
                          }
                          className={actionButtonClassName}
                        >
                          <Copy className="size-3.5" />
                          Copy overlap
                        </button>
                      </div>
                    </article>
                  );
                    })}
                  </div>
                )
              ) : (
                <div className="rounded-3xl border border-dashed border-zinc-700 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900/80 p-8 text-center text-sm text-zinc-400">
                  <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/80">
                    <Search className="size-5 text-zinc-500" />
                  </div>
                  <p className="mt-4 text-base font-medium text-zinc-200">
                    No teammates match these filters
                  </p>
                  <p className="mx-auto mt-2 max-w-md leading-6 text-zinc-400">
                    Try switching the country, team, or overlap filter to see a
                    wider view of your global team.
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(24,24,27,0.84),rgba(9,9,11,0.90))] p-5 shadow-[0_20px_44px_rgba(0,0,0,0.20)]">
          <div className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <Globe2 className="size-4 text-indigo-300" />
            Country Insights
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Country-level view of team coverage, overlap hours, and simple data
            region context.
          </p>

          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {sortedCountries.map((country) => {
              const distribution = teamDistributionMap.get(country.country);

              return (
                <div
                  key={country.country}
                  className="rounded-2xl border border-zinc-800/80 bg-[linear-gradient(180deg,rgba(9,9,11,0.84),rgba(24,24,27,0.78))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.16)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold">{country.label}</h3>
                      <p className="text-xs text-zinc-500">
                        {country.region} | {country.timezone}
                      </p>
                    </div>
                    <div
                      className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                        country.gdpr_region
                          ? "bg-blue-500/10 text-blue-300"
                          : "bg-zinc-800 text-zinc-300"
                      }`}
                    >
                      {country.gdpr_region ? "GDPR-aware" : "Standard"}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Active
                      </div>
                      <div className="mt-2 text-xl font-semibold">
                        {distribution?.count ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Working
                      </div>
                      <div className="mt-2 text-xl font-semibold">
                        {distribution?.working_now_count ?? 0}
                      </div>
                    </div>
                    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-3">
                      <div className="text-[11px] uppercase tracking-wide text-zinc-500">
                        Overlap
                      </div>
                      <div className="mt-2 text-xl font-semibold">
                        {distribution?.overlap_available_count ?? 0}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-900/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <Clock3 className="size-3.5" />
                      Overlap Window
                    </div>
                    {country.overlap?.has_overlap ? (
                      <div className="mt-3 space-y-1">
                        <p className="text-sm font-medium text-zinc-100">
                          {country.overlap.overlap_hours} hours of shared work time
                        </p>
                        <p className="text-xs text-zinc-400">
                          Your local view: {country.overlap.source_window_label}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {country.label} local view:{" "}
                          {country.overlap.target_window_label}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-sm text-zinc-400">
                        No direct working-hour overlap in the current daily window.
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                      <ToggleLeft className="size-3.5" />
                      Country Feature Rules
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {Object.entries(country.feature_flags || {}).map(
                        ([key, value]) => (
                          <span
                            key={key}
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                              flagTone[value] || flagTone.optional
                            }`}
                          >
                            {prettyFlagName(key)}: {value}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </div>
    </div>
  );
}
