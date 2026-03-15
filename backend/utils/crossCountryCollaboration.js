const COUNTRY_CONFIG = {
  india: {
    code: "india",
    label: "India",
    region: "APAC",
    timezone: "Asia/Kolkata",
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

export const buildUserCollaborationProfile = (user) => {
  const countryConfig = getCountryConfig(user?.country, user?.timezone || "UTC");

  return {
    user_id: user?._id,
    name: `${user?.first_name || ""} ${user?.last_name || ""}`.trim(),
    country: countryConfig.code,
    country_label: countryConfig.label,
    region: countryConfig.region,
    timezone: user?.timezone || countryConfig.timezone,
    gdpr_region: countryConfig.gdpr_region,
    working_hours: countryConfig.working_hours,
    feature_flags: countryConfig.feature_flags,
    local_time: formatLocalDateTime(new Date(), user?.timezone || countryConfig.timezone),
  };
};

export const calculateOverlapWindow = (sourceProfile, targetProfile, referenceDate = new Date()) => {
  const sourceStart = zonedDateTimeToUtc(
    referenceDate,
    sourceProfile.timezone,
    sourceProfile.working_hours.start
  );
  const sourceEnd = zonedDateTimeToUtc(
    referenceDate,
    sourceProfile.timezone,
    sourceProfile.working_hours.end
  );
  const targetStart = zonedDateTimeToUtc(
    referenceDate,
    targetProfile.timezone,
    targetProfile.working_hours.start
  );
  const targetEnd = zonedDateTimeToUtc(
    referenceDate,
    targetProfile.timezone,
    targetProfile.working_hours.end
  );

  const overlapStart = new Date(Math.max(sourceStart.getTime(), targetStart.getTime()));
  const overlapEnd = new Date(Math.min(sourceEnd.getTime(), targetEnd.getTime()));
  const hasOverlap = overlapStart < overlapEnd;
  const overlapMinutes = hasOverlap
    ? Math.round((overlapEnd.getTime() - overlapStart.getTime()) / 60000)
    : 0;

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

export const getCountryComparisonMatrix = (sourceUser) => {
  const sourceProfile = buildUserCollaborationProfile(sourceUser);

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
