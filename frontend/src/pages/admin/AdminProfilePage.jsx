import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  User,
  Mail,
  Phone,
  Globe,
  Shield,
  Calendar,
  Edit2,
  Save,
  Key,
  Clock,
  Loader2,
  Building,
  X,
  Camera,
  Trash2,
  Lock,
  CheckCircle2,
} from "lucide-react";
import { BACKEND_URL } from "@/config";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import ImageCropModal from "@/components/ImageCropModal";

const AdminProfilePage = ({ onNavigate }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [employeeData, setEmployeeData] = useState(null);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    timezone: "",
  });
  const fileInputRef = useRef(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await axios.get(`${BACKEND_URL}/auth/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const { user, employee } = response.data;
      setProfileData(user);
      setEmployeeData(employee);
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        phone: user.phone || "",
        timezone: user.timezone || "UTC",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.put(
        `${BACKEND_URL}/auth/profile`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (response.data.success) {
        setProfileData((prev) => ({ ...prev, ...response.data.user }));
        const adminData = JSON.parse(localStorage.getItem("adminData") || "{}");
        adminData.first_name = response.data.user.first_name;
        adminData.last_name = response.data.user.last_name;
        localStorage.setItem("adminData", JSON.stringify(adminData));

        setEditing(false);
        toast.success("Profile updated successfully");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error(error.response?.data?.error || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: profileData?.first_name || "",
      last_name: profileData?.last_name || "",
      phone: profileData?.phone || "",
      timezone: profileData?.timezone || "UTC",
    });
    setEditing(false);
  };

  const getInitials = () => {
    if (!profileData) return "AD";
    return `${profileData.first_name?.[0] || ""}${
      profileData.last_name?.[0] || ""
    }`.toUpperCase();
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImageSrc(reader.result);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCroppedUpload = async (blob) => {
    setCropModalOpen(false);
    setSelectedImageSrc(null);
    setUploadingPicture(true);
    try {
      const token = localStorage.getItem("token");
      const fd = new FormData();
      fd.append("profile_picture", blob, "profile.jpg");

      const response = await axios.put(
        `${BACKEND_URL}/auth/profile/picture`,
        fd,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setProfileData((prev) => ({
          ...prev,
          profile_picture: response.data.profile_picture,
        }));
        const adminData = JSON.parse(
          localStorage.getItem("adminData") || "{}"
        );
        adminData.profile_picture = response.data.profile_picture;
        localStorage.setItem("adminData", JSON.stringify(adminData));
        toast.success("Profile picture updated");
      }
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      toast.error(
        error.response?.data?.error || "Failed to upload profile picture"
      );
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleRemovePicture = async () => {
    setUploadingPicture(true);
    try {
      const token = localStorage.getItem("token");
      const response = await axios.delete(
        `${BACKEND_URL}/auth/profile/picture`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success) {
        setProfileData((prev) => ({ ...prev, profile_picture: null }));
        const adminData = JSON.parse(
          localStorage.getItem("adminData") || "{}"
        );
        delete adminData.profile_picture;
        localStorage.setItem("adminData", JSON.stringify(adminData));
        toast.success("Profile picture removed");
      }
    } catch (error) {
      console.error("Error removing profile picture:", error);
      toast.error("Failed to remove profile picture");
    } finally {
      setUploadingPicture(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 w-full space-y-6">
        <Skeleton className="h-48 rounded-2xl w-full" />
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Skeleton className="xl:col-span-2 h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 w-full space-y-6">
      {/* ─── Hero Banner ─── */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-indigo-600/20 via-violet-600/10 to-zinc-900/80 border border-zinc-800/80">
        {/* Decorative background pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/[0.07] via-transparent to-transparent" />


        <div className="relative flex flex-col sm:flex-row items-start sm:items-end gap-5 p-6 lg:p-8">
          {/* Avatar */}
          <div className="relative group flex-shrink-0">
            <Avatar className="size-24 ring-4 ring-zinc-900 shadow-2xl shadow-indigo-500/10">
              <AvatarImage
                src={profileData?.profile_picture}
                alt="Profile"
                className="object-cover"
              />
              <AvatarFallback className="bg-gradient-to-br from-indigo-500/30 to-violet-500/20 text-indigo-200 text-2xl font-bold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Camera overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer">
              {uploadingPicture ? (
                <Loader2 className="size-6 text-white animate-spin" />
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1.5 cursor-pointer"
                  title="Change profile picture"
                >
                  <Camera className="size-6 text-white" />
                </button>
              )}
            </div>

            {profileData?.profile_picture && !uploadingPicture && (
              <button
                onClick={handleRemovePicture}
                className="absolute -bottom-1 -right-1 p-1.5 bg-red-600 hover:bg-red-500 rounded-full transition-colors shadow-lg ring-2 ring-zinc-900"
                title="Remove profile picture"
              >
                <Trash2 className="size-3 text-white" />
              </button>
            )}
          </div>

          {/* Name & meta */}
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              {profileData?.first_name} {profileData?.last_name}
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">{profileData?.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/20 hover:bg-indigo-500/20">
                <Shield className="size-3 mr-1" />
                Admin
              </Badge>
              <Badge
                className={cn(
                  "border",
                  profileData?.status === "active"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/20"
                    : "bg-zinc-500/15 text-zinc-400 border-zinc-500/20"
                )}
              >
                <CheckCircle2 className="size-3 mr-1" />
                {profileData?.status?.charAt(0).toUpperCase() +
                  profileData?.status?.slice(1)}
              </Badge>
              {employeeData?.department && (
                <Badge className="bg-violet-500/15 text-violet-300 border-violet-500/20">
                  <Building className="size-3 mr-1" />
                  {employeeData.department?.name || "—"}
                </Badge>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-2 sm:mt-0">
            {editing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  className="bg-zinc-900/60 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
                >
                  <X className="size-3.5 mr-1.5" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                >
                  {saving ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5 mr-1.5" />
                  )}
                  Save changes
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
                className="bg-zinc-900/60 border-zinc-700 hover:bg-zinc-800 text-zinc-300"
              >
                <Edit2 className="size-3.5 mr-1.5" />
                Edit profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content Grid ─── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Personal Information */}
        <Card className="xl:col-span-2 bg-zinc-900/80 border-zinc-800/80">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="size-4 text-indigo-400" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-5 sm:grid-cols-2">
              <ProfileField
                icon={User}
                label="First name"
                value={formData.first_name}
                name="first_name"
                editing={editing}
                onChange={handleChange}
              />
              <ProfileField
                icon={User}
                label="Last name"
                value={formData.last_name}
                name="last_name"
                editing={editing}
                onChange={handleChange}
              />
              <ProfileField
                icon={Mail}
                label="Email address"
                value={profileData?.email}
                readOnly
              />
              <ProfileField
                icon={Phone}
                label="Phone number"
                value={formData.phone}
                name="phone"
                editing={editing}
                onChange={handleChange}
                placeholder="Not set"
              />
              <ProfileField
                icon={Globe}
                label="Country"
                value={
                  profileData?.country
                    ? profileData.country.charAt(0).toUpperCase() +
                      profileData.country.slice(1)
                    : "—"
                }
                readOnly
              />
              <ProfileField
                icon={Clock}
                label="Timezone"
                value={formData.timezone}
                name="timezone"
                editing={editing}
                onChange={handleChange}
              />
              {employeeData && (
                <>
                  <ProfileField
                    icon={Building}
                    label="Department"
                    value={employeeData.department?.name || "—"}
                    readOnly
                  />
                  <ProfileField
                    icon={Shield}
                    label="Position"
                    value={employeeData.position?.toUpperCase()}
                    readOnly
                  />
                </>
              )}
            </div>

            {/* Member since */}
            <div className="mt-6 pt-5 border-t border-zinc-800/80">
              <div className="flex items-center gap-3 text-sm">
                <div className="size-8 rounded-lg bg-zinc-800/80 flex items-center justify-center">
                  <Calendar className="size-3.5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    Member since
                  </p>
                  <p className="text-sm font-medium text-zinc-300">
                    {new Date(
                      profileData?.created_at || Date.now()
                    ).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Security Card */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Lock className="size-4 text-amber-400" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-400">
                Keep your account secure by using a strong password and changing
                it regularly.
              </p>
              <Button
                variant="outline"
                onClick={() => onNavigate("change-password")}
                className="w-full bg-zinc-800/60 border-zinc-700 hover:bg-zinc-700 text-zinc-200 gap-2"
              >
                <Key className="size-4" />
                Change password
              </Button>
            </CardContent>
          </Card>

          {/* Quick Info Card */}
          <Card className="bg-zinc-900/80 border-zinc-800/80">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
              <User className="size-4 text-violet-400" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <InfoRow
                  label="User type"
                  value={
                    profileData?.user_type?.charAt(0).toUpperCase() +
                    profileData?.user_type?.slice(1)
                  }
                />
                <InfoRow
                  label="Last login"
                  value={
                    profileData?.last_login
                      ? new Date(profileData.last_login).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )
                      : "—"
                  }
                />
                <InfoRow
                  label="Account ID"
                  value={profileData?._id?.slice(-8).toUpperCase()}
                  mono
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ImageCropModal
        open={cropModalOpen}
        onClose={() => {
          setCropModalOpen(false);
          setSelectedImageSrc(null);
        }}
        imageSrc={selectedImageSrc}
        onCropComplete={handleCroppedUpload}
      />
    </div>
  );
};

// ─── Profile Field ─────────────────────────────────────
const ProfileField = ({
  icon: Icon,
  label,
  value,
  name,
  editing,
  onChange,
  readOnly,
  placeholder,
}) => (
  <div className="space-y-1.5">
    <Label className="text-zinc-500 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
      <Icon className="size-3" />
      {label}
    </Label>
    {editing && name && !readOnly ? (
      <Input
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder || ""}
        className="h-10 bg-zinc-800/60 border-zinc-700 focus:border-indigo-500 focus:ring-indigo-500/20 text-zinc-100"
      />
    ) : (
      <p className="text-sm font-medium text-zinc-200 py-2">
        {value || placeholder || "—"}
      </p>
    )}
  </div>
);

// ─── Info Row (compact key-value) ──────────────────────
const InfoRow = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
    <span className="text-sm text-zinc-500">{label}</span>
    <span
      className={cn(
        "text-sm font-medium text-zinc-300",
        mono && "font-mono text-xs text-zinc-400"
      )}
    >
      {value || "—"}
    </span>
  </div>
);

export default AdminProfilePage;
