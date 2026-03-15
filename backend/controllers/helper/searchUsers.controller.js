import User from "../../models/User.js";
import Employee from "../../models/Employee.js";

/**
 * Search for users/employees by query
 * GET /helper/search-users?query=&limit=20
 */
export const searchUsers = async (req, res) => {
  try {
    const { query, limit = 20 } = req.query;
    const currentUserId = req.user.id || req.user._id;

    if (!query || query.trim().length === 0) {
      return res.json({ users: [] });
    }

    // Search in User collection by name or email
    const searchRegex = new RegExp(query.trim(), "i");

    const users = await User.find({
      $and: [
        { _id: { $ne: currentUserId } }, // Exclude current user
        {
          $or: [
            { first_name: searchRegex },
            { last_name: searchRegex },
            { email: searchRegex },
          ],
        },
      ],
    })
      .select("_id first_name last_name email user_type avatar")
      .limit(parseInt(limit))
      .lean();

    // Enrich with employee info if available
    const enrichedUsers = await Promise.all(
      users.map(async (user) => {
        const emp = await Employee.findOne({ user_id: user._id })
          .select("position employee_type department")
          .lean();

        return {
          ...user,
          position: emp?.position || null,
          employee_type: emp?.employee_type || null,
          department: emp?.department || null,
        };
      })
    );

    res.json({ users: enrichedUsers });
  } catch (error) {
    console.error("Search users error:", error);
    res.status(500).json({ 
      error: "Failed to search users",
      message: error.message 
    });
  }
};
