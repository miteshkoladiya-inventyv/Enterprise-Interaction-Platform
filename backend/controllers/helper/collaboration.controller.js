import User from "../../models/User.js";
import Employee from "../../models/Employee.js";
import {
  buildUserCollaborationMember,
  buildUserCollaborationProfile,
  getCountryComparisonMatrix,
  getSupportedCountries,
} from "../../utils/crossCountryCollaboration.js";

export const getCollaborationOverview = async (req, res) => {
  try {
    const currentUser = req.user;
    const currentEmployee = await Employee.findOne({
      user_id: currentUser._id,
    })
      .select("shift_type")
      .lean();
    const userProfile = buildUserCollaborationProfile(currentUser, {
      shift_type: currentEmployee?.shift_type,
    });
    const countryMatrix = getCountryComparisonMatrix(currentUser, {
      shift_type: currentEmployee?.shift_type,
    });

    const matchStage = currentUser.company_id
      ? {
          company_id: currentUser.company_id,
          status: "active",
          user_type: { $in: ["admin", "employee"] },
        }
      : { status: "active", user_type: { $in: ["admin", "employee"] } };

    const teamDistribution = await User.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$country",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const normalizedDistribution = getSupportedCountries().map((country) => {
      const found = teamDistribution.find((item) => item._id === country.code);
      return {
        country: country.code,
        label: country.label,
        count: found?.count || 0,
      };
    });

    const teamUsers = await User.find(matchStage)
      .select(
        "_id first_name last_name email user_type country timezone profile_picture company_id"
      )
      .sort({ first_name: 1, last_name: 1 })
      .lean();

    const employeeProfiles = await Employee.find({
      user_id: { $in: teamUsers.map((user) => user._id) },
      is_active: true,
    })
      .populate("department", "name code type")
      .select("user_id position department shift_type")
      .lean();

    const employeeProfileMap = new Map(
      employeeProfiles.map((profile) => [String(profile.user_id), profile])
    );

    const globalTeamMembers = teamUsers
      .filter((user) => String(user._id) !== String(currentUser._id))
      .map((user) => {
        const employeeProfile = employeeProfileMap.get(String(user._id));

        return buildUserCollaborationMember(currentUser, user, {
          source_shift_type: currentEmployee?.shift_type,
          shift_type: employeeProfile?.shift_type || null,
          department: employeeProfile?.department
            ? {
                _id: employeeProfile.department._id,
                name: employeeProfile.department.name,
                code: employeeProfile.department.code,
                type: employeeProfile.department.type,
              }
            : null,
          position: employeeProfile?.position || null,
        });
      });

    const allActiveProfiles = teamUsers.map((user) =>
      buildUserCollaborationProfile(user, {
        shift_type: employeeProfileMap.get(String(user._id))?.shift_type || null,
      })
    );

    const enrichedDistribution = normalizedDistribution.map((item) => {
      const activeProfiles = allActiveProfiles.filter(
        (profile) => profile.country === item.country
      );
      const members = globalTeamMembers.filter(
        (member) => member.country === item.country
      );

      return {
        ...item,
        working_now_count: activeProfiles.filter((profile) => profile.working_now)
          .length,
        overlap_available_count: members.filter(
          (member) => member.overlap?.has_overlap
        ).length,
        same_country_count: members.filter((member) => member.same_country).length,
      };
    });

    const countriesWithOverlap = countryMatrix.filter(
      (country) => country.overlap?.has_overlap
    );
    const bestOverlapCountry = countriesWithOverlap.reduce((best, current) => {
      if (!best) return current;
      return (current.overlap?.overlap_minutes || 0) >
        (best.overlap?.overlap_minutes || 0)
        ? current
        : best;
    }, null);

    const totalTeamMembers = normalizedDistribution.reduce(
      (sum, country) => sum + (country.count || 0),
      0
    );
    const workingNowCount = globalTeamMembers.filter(
      (member) => member.working_now
    ).length;
    const overlapAvailableCount = globalTeamMembers.filter(
      (member) => member.overlap?.has_overlap
    ).length;
    const crossCountryCount = globalTeamMembers.filter(
      (member) => !member.same_country
    ).length;

    res.json({
      current_user: userProfile,
      supported_countries: countryMatrix,
      team_distribution: enrichedDistribution,
      global_team_members: globalTeamMembers,
      summary: {
        total_team_members: totalTeamMembers,
        total_teammates: globalTeamMembers.length,
        working_now_count: workingNowCount,
        overlap_available_count: overlapAvailableCount,
        cross_country_count: crossCountryCount,
        countries_covered: normalizedDistribution.filter(
          (country) => country.count > 0
        ).length,
        no_overlap_countries: countryMatrix.filter(
          (country) => !country.overlap?.has_overlap
        ).length,
        role_scope:
          currentUser?.user_type === "admin"
            ? "admin_overview"
            : "personal_view",
        best_overlap_country: bestOverlapCountry
          ? {
              country: bestOverlapCountry.country,
              label: bestOverlapCountry.label,
              overlap_hours: bestOverlapCountry.overlap?.overlap_hours || 0,
              source_window_label:
                bestOverlapCountry.overlap?.source_window_label || null,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Get collaboration overview error:", error);
    res.status(500).json({ error: error.message });
  }
};
