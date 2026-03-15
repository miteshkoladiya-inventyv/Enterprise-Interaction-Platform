import User from "../../models/User.js";
import {
  buildUserCollaborationProfile,
  getCountryComparisonMatrix,
  getSupportedCountries,
} from "../../utils/crossCountryCollaboration.js";

export const getCollaborationOverview = async (req, res) => {
  try {
    const currentUser = req.user;
    const userProfile = buildUserCollaborationProfile(currentUser);

    const matchStage = currentUser.company_id
      ? { company_id: currentUser.company_id, status: "active", user_type: { $in: ["admin", "employee"] } }
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

    res.json({
      current_user: userProfile,
      supported_countries: getCountryComparisonMatrix(currentUser),
      team_distribution: normalizedDistribution,
    });
  } catch (error) {
    console.error("Get collaboration overview error:", error);
    res.status(500).json({ error: error.message });
  }
};
