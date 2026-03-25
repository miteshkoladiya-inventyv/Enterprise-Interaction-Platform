const COUNTRY_CONFIG = {
  india: {
    code: "india",
    label: "India",
    region: "APAC",
    timezone: "Asia/Kolkata",
    gdpr_region: false,
    working_hours: { start: 10, end: 19 },
    feature_flags: {
      meeting_recording: "enabled",
      ai_assistant: "enabled",
      data_export: "enabled",
      external_guest_access: "enabled",
      regional_data_residency: "optional",
    },
  },
  usa: {
    code: "usa",
    label: "USA",
    region: "North America",
    timezone: "America/New_York",
    gdpr_region: false,
    working_hours: { start: 9, end: 18 },
    feature_flags: {
      meeting_recording: "enabled",
      ai_assistant: "enabled",
      data_export: "enabled",
      external_guest_access: "enabled",
      regional_data_residency: "optional",
    },
  },
  germany: {
    code: "germany",
    label: "Germany",
    region: "Europe",
    timezone: "Europe/Berlin",
    gdpr_region: true,
    working_hours: { start: 9, end: 18 },
    feature_flags: {
      meeting_recording: "conditional",
      ai_assistant: "conditional",
      data_export: "conditional",
      external_guest_access: "enabled",
      regional_data_residency: "required",
    },
  },
};

const INDIA_SHIFT_CONFIG = {
  day: { start: 10, end: 19, label: "Day Shift" },
  night: { start: 19, end: 4, label: "Night Shift" },
};

const DISPLAY_FORMATTER_CACHE = new Map();

const getFormatter = (timeZone, options) => {
  const key = `${timeZone}:${JSON.stringify(options)}`;
  if (!DISPLAY_FORMATTER_CACHE.has(key)) {
    DISPLAY_FORMATTER_CACHE.set(
      key,
      new Intl.DateTimeFormat("en-US", { timeZone, ...options })
    );
  }
  return DISPLAY_FORMATTER_CACHE.get(key);
};

const getDatePartsInTimeZone = (date, timeZone) => {
  const formatter = getFormatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value),
  };
};

const getTimeZoneOffsetMinutes = (date, timeZone) => {
  const formatter = getFormatter(timeZone, {
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const offsetValue = parts.find((part) => part.type === "timeZoneName")?.value || "GMT+0";
  const match = offsetValue.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/i);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
};

const zonedDateTimeToUtc = (referenceDate, timeZone, hour, minute = 0) => {
  const { year, month, day } = getDatePartsInTimeZone(referenceDate, timeZone);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, 0) - offsetMinutes * 60000);
};

const formatLocalDateTime = (date, timeZone) =>
  getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    weekday: "short",
  }).format(date);

const formatLocalTime = (date, timeZone) =>
  getFormatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

const addDays = (date, days) => new Date(date.getTime() + days * 86400000);

const getProfileWorkingHours = (user, countryConfig, options = {}) => {
  if (countryConfig.code === "india" && options.shift_type) {
    const shiftConfig = INDIA_SHIFT_CONFIG[options.shift_type];
    if (shiftConfig) {
      return {
        start: shiftConfig.start,
        end: shiftConfig.end,
        shift_type: options.shift_type,
        shift_label: shiftConfig.label,
      };
    }
  }

  return {
    ...countryConfig.working_hours,
    shift_type: options.shift_type || null,
    shift_label: null,
  };
};

const getWorkIntervals = (profile, referenceDate = new Date()) => {
  if (!profile?.timezone || !profile?.working_hours) return [];

  const intervals = [];
  const currentStart = zonedDateTimeToUtc(
    referenceDate,
    profile.timezone,
    profile.working_hours.start
  );
  let currentEnd = zonedDateTimeToUtc(
    referenceDate,
    profile.timezone,
    profile.working_hours.end
  );

  if (profile.working_hours.end <= profile.working_hours.start) {
    currentEnd = addDays(currentEnd, 1);

    const previousReference = addDays(referenceDate, -1);
    const previousStart = zonedDateTimeToUtc(
      previousReference,
      profile.timezone,
      profile.working_hours.start
    );
    const previousEnd = addDays(
      zonedDateTimeToUtc(
        previousReference,
        profile.timezone,
        profile.working_hours.end
      ),
      1
    );
    intervals.push({ start: previousStart, end: previousEnd });
  }

  intervals.push({ start: currentStart, end: currentEnd });
  return intervals;
};

const getWorkingDayDurationMinutes = (profile) => {
  if (!profile?.working_hours) return 0;
  const start = Number(profile.working_hours.start);
  const end = Number(profile.working_hours.end);
  const durationHours = end > start ? end - start : 24 - start + end;
  return Math.max(0, durationHours * 60);
};

export const isWithinWorkingHours = (profile, referenceDate = new Date()) => {
  if (!profile?.timezone || !profile?.working_hours) {
    return false;
  }

  return getWorkIntervals(profile, referenceDate).some(
    (interval) => referenceDate >= interval.start && referenceDate <= interval.end
  );
};

export const getWorkingHoursLabel = (profile) => {
  if (!profile?.working_hours || !profile?.timezone) return null;

  const base = new Date();
  const intervals = getWorkIntervals(profile, base);
  const currentInterval = intervals[intervals.length - 1];
  const start = currentInterval?.start;
  const end = currentInterval?.end;

  if (!start || !end) return null;

  return `${formatLocalTime(start, profile.timezone)} - ${formatLocalTime(
    end,
    profile.timezone
  )}`;
};

export const formatDateTimeForTimeZone = (date, timeZone) =>
  getFormatter(timeZone, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

export const convertScheduledLocalToUtc = (dateString, timeString, timeZone) => {
  const [year, month, day] = String(dateString || "").split("-").map(Number);
  const [hour, minute] = String(timeString || "").split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }

  const referenceDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return zonedDateTimeToUtc(referenceDate, timeZone || "UTC", hour, minute);
};

export const getSupportedCountries = () => Object.values(COUNTRY_CONFIG);

export const getCountryConfig = (country, fallbackTimeZone = "UTC") => {
  if (country && COUNTRY_CONFIG[country]) {
    return COUNTRY_CONFIG[country];
  }

  return {
    code: country || "custom",
    label: country ? country.charAt(0).toUpperCase() + country.slice(1) : "Custom",
    region: "Global",
    timezone: fallbackTimeZone,
    gdpr_region: false,
    working_hours: { start: 9, end: 18 },
    feature_flags: {},
  };
};

export const buildUserCollaborationProfile = (user, options = {}) => {
  const countryConfig = getCountryConfig(user?.country, user?.timezone || "UTC");
  const timezone = user?.timezone || countryConfig.timezone;
  const workingHours = getProfileWorkingHours(user, countryConfig, options);
  const profile = {
    user_id: user?._id,
    name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
    country: countryConfig.code,
    country_label: countryConfig.label,
    region: countryConfig.region,
    timezone,
    gdpr_region: countryConfig.gdpr_region,
    working_hours: workingHours,
    feature_flags: countryConfig.feature_flags,
    local_time: formatLocalDateTime(new Date(), timezone),
    shift_type: workingHours.shift_type || null,
    shift_label: workingHours.shift_label || null,
  };

  return {
    ...profile,
    working_now: isWithinWorkingHours(profile),
    working_hours_label: getWorkingHoursLabel(profile),
  };
};

export const calculateOverlapWindow = (sourceProfile, targetProfile, referenceDate = new Date()) => {
  const sourceIntervals = getWorkIntervals(sourceProfile, referenceDate);
  const targetIntervals = getWorkIntervals(targetProfile, referenceDate);
  let bestOverlap = null;

  sourceIntervals.forEach((sourceInterval) => {
    targetIntervals.forEach((targetInterval) => {
      const overlapStart = new Date(
        Math.max(sourceInterval.start.getTime(), targetInterval.start.getTime())
      );
      const overlapEnd = new Date(
        Math.min(sourceInterval.end.getTime(), targetInterval.end.getTime())
      );

      if (overlapStart < overlapEnd) {
        const overlapMinutes = Math.round(
          (overlapEnd.getTime() - overlapStart.getTime()) / 60000
        );

        if (!bestOverlap || overlapMinutes > bestOverlap.overlapMinutes) {
          bestOverlap = { overlapStart, overlapEnd, overlapMinutes };
        }
      }
    });
  });

  const hasOverlap = Boolean(bestOverlap);
  const overlapStart = bestOverlap?.overlapStart || null;
  const overlapEnd = bestOverlap?.overlapEnd || null;
  const overlapMinutes = bestOverlap?.overlapMinutes || 0;

  return {
    target_country: targetProfile.country,
    target_country_label: targetProfile.country_label,
    has_overlap: hasOverlap,
    overlap_minutes: overlapMinutes,
    overlap_hours: Number((overlapMinutes / 60).toFixed(2)),
    source_window_label: hasOverlap
      ? `${formatLocalTime(overlapStart, sourceProfile.timezone)} - ${formatLocalTime(overlapEnd, sourceProfile.timezone)}`
      : null,
    target_window_label: hasOverlap
      ? `${formatLocalTime(overlapStart, targetProfile.timezone)} - ${formatLocalTime(overlapEnd, targetProfile.timezone)}`
      : null,
    source_timezone: sourceProfile.timezone,
    target_timezone: targetProfile.timezone,
  };
};

export const getCountryComparisonMatrix = (sourceUser, options = {}) => {
  const sourceProfile = buildUserCollaborationProfile(sourceUser, options);

  return getSupportedCountries().map((countryConfig) => {
    const targetProfile = {
      country: countryConfig.code,
      country_label: countryConfig.label,
      region: countryConfig.region,
      timezone: countryConfig.timezone,
      working_hours: countryConfig.working_hours,
      gdpr_region: countryConfig.gdpr_region,
      feature_flags: countryConfig.feature_flags,
    };

    return {
      country: countryConfig.code,
      label: countryConfig.label,
      region: countryConfig.region,
      timezone: countryConfig.timezone,
      gdpr_region: countryConfig.gdpr_region,
      feature_flags: countryConfig.feature_flags,
      overlap: calculateOverlapWindow(sourceProfile, targetProfile),
    };
  });
};

export const buildUserCollaborationMember = (
  sourceUser,
  teammateUser,
  options = {}
) => {
  const sourceProfile = buildUserCollaborationProfile(sourceUser, {
    shift_type: options.source_shift_type,
  });
  const teammateProfile = buildUserCollaborationProfile(teammateUser, {
    shift_type: options.shift_type,
  });
  const overlap = calculateOverlapWindow(sourceProfile, teammateProfile);
  const sourceCountryConfig = getCountryConfig(sourceProfile.country, sourceProfile.timezone);
  const teammateCountryConfig = getCountryConfig(
    teammateProfile.country,
    teammateProfile.timezone
  );
  const sourceWorkingMinutes = getWorkingDayDurationMinutes(sourceProfile);
  const targetWorkingMinutes = getWorkingDayDurationMinutes(teammateProfile);
  const maxComparableMinutes = Math.max(sourceWorkingMinutes, targetWorkingMinutes, 1);
  const overlapPercentage = Math.min(
    100,
    Math.round(((overlap?.overlap_minutes || 0) / maxComparableMinutes) * 100)
  );

  return {
    user_id: teammateUser?._id,
    name:
      teammateProfile.name ||
      teammateUser?.email ||
      "User",
    email: teammateUser?.email || "",
    profile_picture: teammateUser?.profile_picture || null,
    user_type: teammateUser?.user_type || "employee",
    country: teammateProfile.country,
    country_label: teammateProfile.country_label,
    region: teammateProfile.region,
    timezone: teammateProfile.timezone,
    local_time: teammateProfile.local_time,
    working_now: teammateProfile.working_now,
    working_hours_label: teammateProfile.working_hours_label,
    shift_type: teammateProfile.shift_type,
    shift_label: teammateProfile.shift_label,
    same_country: teammateProfile.country === sourceProfile.country,
    overlap,
    overlap_percentage: overlapPercentage,
    department: options.department || null,
    position: options.position || null,
    data_region: {
      gdpr_region: teammateCountryConfig.gdpr_region,
      label: teammateCountryConfig.gdpr_region ? "GDPR-aware" : "Standard",
      regional_data_residency:
        teammateCountryConfig.feature_flags?.regional_data_residency || "optional",
    },
    policy_badges: {
      gdpr_region: teammateCountryConfig.gdpr_region,
      data_residency:
        teammateCountryConfig.feature_flags?.regional_data_residency || "optional",
      ai_assistant:
        teammateCountryConfig.feature_flags?.ai_assistant || "enabled",
    },
    source_user: {
      timezone: sourceProfile.timezone,
      country: sourceCountryConfig.code,
      country_label: sourceCountryConfig.label,
      local_time: sourceProfile.local_time,
      working_now: sourceProfile.working_now,
      working_hours_label: sourceProfile.working_hours_label,
      shift_type: sourceProfile.shift_type,
      shift_label: sourceProfile.shift_label,
    },
  };
};

const normalizePolicyValue = (policyValue) => {
  if (policyValue === "enabled" || policyValue === "disabled" || policyValue === "conditional") {
    return policyValue;
  }
  return "enabled";
};

export const evaluateCountryFeatureAccess = (
  country,
  featureKey,
  options = {}
) => {
  const countryConfig = getCountryConfig(country);
  const policyValue = normalizePolicyValue(countryConfig.feature_flags?.[featureKey]);
  const complianceApproved = options.complianceApproved === true;

  if (policyValue === "disabled") {
    return {
      allowed: false,
      policy: "disabled",
      requires_compliance_ack: false,
      reason: `${countryConfig.label} policy disables ${featureKey.replace(/_/g, " ")}.`,
    };
  }

  if (policyValue === "conditional" && !complianceApproved) {
    return {
      allowed: false,
      policy: "conditional",
      requires_compliance_ack: true,
      reason: `${countryConfig.label} policy requires compliance acknowledgment for ${featureKey.replace(/_/g, " ")}.`,
    };
  }

  return {
    allowed: true,
    policy: policyValue,
    requires_compliance_ack: policyValue === "conditional",
    reason: null,
  };
};

export const applyMeetingCountryPolicies = ({
  hostCountry,
  requestedRecordingEnabled,
  requestedOpenToEveryone,
  complianceApproved = false,
}) => {
  const warnings = [];

  const recordingPolicy = evaluateCountryFeatureAccess(hostCountry, "meeting_recording", {
    complianceApproved,
  });
  const guestPolicy = evaluateCountryFeatureAccess(hostCountry, "external_guest_access", {
    complianceApproved,
  });

  let recordingEnabled = requestedRecordingEnabled;
  if (requestedRecordingEnabled === true && !recordingPolicy.allowed) {
    recordingEnabled = false;
    warnings.push(recordingPolicy.reason);
  }

  let openToEveryone = requestedOpenToEveryone;
  if (requestedOpenToEveryone === true && !guestPolicy.allowed) {
    openToEveryone = false;
    warnings.push(guestPolicy.reason);
  }

  return {
    recording_enabled: recordingEnabled,
    open_to_everyone: openToEveryone,
    policy_warnings: warnings.filter(Boolean),
    policy_flags: {
      meeting_recording: recordingPolicy,
      external_guest_access: guestPolicy,
    },
  };
};

export const buildMeetingCollaborationContext = (meeting) => {
  if (!meeting || !meeting.scheduled_at) return null;

  const scheduledAt = new Date(meeting.scheduled_at);
  const hostSource = meeting.host_id?._id ? meeting.host_id : {
    ...meeting.host_id,
    country: meeting.host_country,
    timezone: meeting.host_timezone || meeting.scheduled_timezone || "UTC",
  };
  const hostProfile = buildUserCollaborationProfile(hostSource);
  const participantProfiles = (meeting.participants || [])
    .map((participant) => buildUserCollaborationProfile(participant))
    .filter((participant) => String(participant.user_id || "") !== String(hostProfile.user_id || ""));

  const uniqueCountries = [];
  const seenCountries = new Set();
  participantProfiles.forEach((profile) => {
    if (!seenCountries.has(profile.country)) {
      seenCountries.add(profile.country);
      uniqueCountries.push(profile);
    }
  });

  return {
    scheduled_timezone: meeting.scheduled_timezone || hostProfile.timezone,
    host_timezone: hostProfile.timezone,
    host_country: hostProfile.country,
    host_country_label: hostProfile.country_label,
    scheduled_label_host: formatDateTimeForTimeZone(scheduledAt, hostProfile.timezone),
    scheduled_label_origin: formatDateTimeForTimeZone(
      scheduledAt,
      meeting.scheduled_timezone || hostProfile.timezone
    ),
    participant_countries: uniqueCountries.map((profile) => ({
      country: profile.country,
      country_label: profile.country_label,
      timezone: profile.timezone,
      overlap: calculateOverlapWindow(hostProfile, profile, scheduledAt),
      scheduled_label_local: formatDateTimeForTimeZone(scheduledAt, profile.timezone),
    })),
    is_cross_country: uniqueCountries.some((profile) => profile.country !== hostProfile.country),
  };
};
