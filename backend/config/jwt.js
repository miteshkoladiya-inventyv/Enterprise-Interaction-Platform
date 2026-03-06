import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRE = process.env.JWT_EXPIRE || "7d";
const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || "30d";

export const generateAccessToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRE });

export const generateRefreshToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_REFRESH_EXPIRE });

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    throw new Error("Invalid or expired token");
  }
};
