import bcrypt from "bcryptjs";
import { User } from "../models/User.js";
import { generateAccessToken, generateRefreshToken } from "../config/jwt.js";

export const adminLogin = async (email, password) => {
  const user = await User.findOne({
    email,
    user_type: "internal",
  })
    .populate("roles", "role_name")
    .lean();

  if (!user) throw new Error("Invalid email or password");

  const roles = user.roles.map((r) => r.role_name);
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");

  if (!isAdmin) throw new Error("Admin privileges required");
  if (!user.is_active) throw new Error("Account is inactive");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  await User.updateOne({ _id: user._id }, { last_login: new Date() });

  const accessToken = generateAccessToken({
    userId: user._id,
    email: user.email,
    roles,
  });

  const refreshToken = generateRefreshToken({ userId: user._id });

  delete user.password_hash;

  return { user, accessToken, refreshToken };
};

export const employeeLogin = async (email, password) => {
  const user = await User.findOne({ email })
    .populate("roles", "role_name")
    .lean();

  if (!user) throw new Error("Invalid email or password");

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) throw new Error("Invalid email or password");

  if (!user.last_login) {
    return {
      requiresPasswordChange: true,
      userId: user._id,
      email: user.email,
      message: "Please change your password on first login",
    };
  }

  if (!user.is_active) throw new Error("Account is not activated");

  await User.updateOne({ _id: user._id }, { last_login: new Date() });

  const roles = user.roles.map((r) => r.role_name);

  const accessToken = generateAccessToken({
    userId: user._id,
    email: user.email,
    roles,
  });

  const refreshToken = generateRefreshToken({ userId: user._id });

  delete user.password_hash;

  return { user, accessToken, refreshToken };
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) throw new Error("Current password is incorrect");

  user.password_hash = await bcrypt.hash(newPassword, 10);
  user.is_active = true;
  await user.save();

  return { success: true, message: "Password changed successfully" };
};
