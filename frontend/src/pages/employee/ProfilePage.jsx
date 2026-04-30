import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
  User,
  Mail,
  Building,
  Globe,
  Shield,
  Calendar,
  Edit2,
  Save,
  ArrowLeft,
  Key,
  Clock,
  Camera,
  Trash2,
  Loader2,
} from "lucide-react";
import { BACKEND_URL } from "@/config.js";
import { toast } from "sonner";
import ImageCropModal from "@/components/ImageCropModal";

const EmployeeProfilePage = () => {
  const [editing, setEditing] = useState(false);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    department: "",
    timezone: "",
    countryCode: "",
  });
  const fileInputRef = useRef(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [selectedImageSrc, setSelectedImageSrc] = useState(null);
  console.log(userData);
  const user = JSON.parse(localStorage.getItem("user"));

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const userId = user.employee.id;
      const token = localStorage.getItem("token");

      const response = await axios.get(`${BACKEND_URL}/employees/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = response.data;
      const userDataFromApi = result.user;
      setUserData(userDataFromApi);
      setFormData({
        fullName: userDataFromApi.full_name,
        email: userDataFromApi.user_id.email,
        department: userDataFromApi.department?.name || userDataFromApi.department || "",
        timezone: userDataFromApi.user_id.timezone,
        countryCode: userDataFromApi.user_id.country,
      });

      setLoading(false);
    } catch (error) {
      console.error("Axios error:", error);
      if (error.response) console.error("Backend error:", error.response.data);
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        setUserData((prev) => ({
          ...prev,
          user_id: {
            ...prev.user_id,
            profile_picture: response.data.profile_picture,
          },
        }));
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        storedUser.profile_picture = response.data.profile_picture;
        localStorage.setItem("user", JSON.stringify(storedUser));
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
        setUserData((prev) => ({
          ...prev,
          user_id: { ...prev.user_id, profile_picture: null },
        }));
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
        delete storedUser.profile_picture;
        localStorage.setItem("user", JSON.stringify(storedUser));
        toast.success("Profile picture removed");
      }
    } catch (error) {
      console.error("Error removing profile picture:", error);
      toast.error("Failed to remove profile picture");
    } finally {
      setUploadingPicture(false);
    }
  };

  const handleSave = async () => {
    setEditing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-zinc-400">
          <div className="w-5 h-5 border-2 border-zinc-600 border-t-indigo-500 rounded-full animate-spin" />
          <span className="text-sm">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4 lg:p-8">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => (window.location.href = "/")}
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        {/* Profile Card */}
        <div className="bg-zinc-900 rounded-xl border border-zinc-700/50 overflow-hidden">
          {/* Profile Header */}
          <div className="px-6 py-5 border-b border-zinc-700/30">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className="w-14 h-14 rounded-full overflow-hidden flex items-center justify-center bg-indigo-500/20">
                    {userData?.user_id?.profile_picture ? (
                      <img
                        src={userData.user_id.profile_picture}
                        alt="Profile"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-indigo-400 font-semibold text-lg">
                        {userData?.user_id?.first_name
                          ?.split(" ")
                          .map((n) => n[0])
                          .join("") || "U"}
                      </span>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                    {uploadingPicture ? (
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="p-1 cursor-pointer"
                        title="Change profile picture"
                      >
                        <Camera className="w-5 h-5 text-white" />
                      </button>
                    )}
                  </div>
                  {userData?.user_id?.profile_picture && !uploadingPicture && (
                    <button
                      onClick={handleRemovePicture}
                      className="absolute -bottom-1 -right-1 p-1 bg-red-600 hover:bg-red-700 rounded-full transition-colors"
                      title="Remove profile picture"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  )}
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-white">
                    {userData?.user_id?.first_name +
                      userData?.user_id?.last_name}
                  </h1>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {userData?.roles?.map((role, index) => (
                      <span
                        key={index}
                        className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs font-medium rounded-md"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {/* <button
                onClick={() => (editing ? handleSave() : setEditing(true))}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800 transition-colors"
              >
                {editing ? (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </>
                )}
              </button> */}
            </div>
          </div>

          {/* Profile Details */}
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              <InfoCard
                icon={Mail}
                label="Email"
                value={formData.email}
                name="email"
                editing={editing}
                onChange={handleChange}
                type="email"
              />
              <InfoCard
                icon={Building}
                label="Department"
                value={formData.department}
                name="department"
                editing={editing}
                onChange={handleChange}
              />
              <InfoCard
                icon={Globe}
                label="Country"
                value={formData.countryCode}
                name="countryCode"
                editing={editing}
                onChange={handleChange}
              />
              <InfoCard
                icon={Clock}
                label="Timezone"
                value={formData.timezone}
                name="timezone"
                editing={editing}
                onChange={handleChange}
              />
              <InfoCard
                icon={Calendar}
                label="Member Since"
                value={new Date(
                  userData?.created_at || Date.now()
                ).toLocaleDateString()}
                editing={false}
              />
              <InfoCard
                icon={Shield}
                label="Status"
                value={userData?.is_active ? "Active" : "Inactive"}
                editing={false}
              />
            </div>

            {/* Security */}
            <div className="pt-4 border-t border-zinc-700/30">
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Key className="w-4 h-4 text-zinc-500" />
                Security
              </h2>
              <button
                onClick={() => (window.location.href = "/change-password")}
                className="px-4 py-2 text-sm font-medium border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <Key className="w-3.5 h-3.5" />
                Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Permissions */}
        {userData?.permissions?.length > 0 && (
          <div className="mt-4 bg-zinc-900 rounded-xl border border-zinc-700/50 p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Permissions
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {userData?.permissions?.slice(0, 8).map((permission, index) => (
                <span
                  key={index}
                  className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs font-medium rounded-md border border-zinc-700/50"
                >
                  {permission}
                </span>
              ))}
            </div>
          </div>
        )}
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

const InfoCard = ({
  icon: Icon,
  label,
  value,
  name,
  editing,
  onChange,
  type = "text",
}) => (
  <div className="p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="w-3.5 h-3.5 text-zinc-500" />
      <span className="text-xs font-medium text-zinc-500">{label}</span>
    </div>
    {editing && name ? (
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full px-2 py-1 border border-zinc-600 rounded text-sm bg-zinc-800 text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
    ) : (
      <p className="text-sm font-medium text-white">{value || "Not set"}</p>
    )}
  </div>
);

export default EmployeeProfilePage;
