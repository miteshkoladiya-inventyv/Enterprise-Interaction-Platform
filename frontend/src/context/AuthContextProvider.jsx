import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createSocketConnection } from "../hooks/useSocket";

const AuthContext = createContext(null);

export default function AuthContextProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  // Function to update user and trigger socket connection
  const updateUser = (userData) => {
    setUser(userData);
  };

  // Load user from localStorage
  useEffect(() => {
    const employeeData = localStorage.getItem("user");
    const adminData = localStorage.getItem("adminData");
    const customerData = localStorage.getItem("customerData");

    // If both exist somehow (stale data), keep only the one whose
    // user_type matches. If we can't tell, clear the stale one.
    if (employeeData && adminData) {
      try {
        const emp = JSON.parse(employeeData);
        const adm = JSON.parse(adminData);
        // Determine which is current by checking the path or just
        // prefer the admin if at adminDashboard, otherwise employee.
        if (window.location.pathname.startsWith("/admin")) {
          localStorage.removeItem("user");
          setUser(adm);
        } else {
          localStorage.removeItem("adminData");
          setUser(emp);
        }
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("adminData");
      }
    } else if (customerData) {
      try {
        setUser(JSON.parse(customerData));
      } catch {
        localStorage.removeItem("customerData");
      }
    } else if (adminData) {
      try {
        setUser(JSON.parse(adminData));
      } catch {
        localStorage.removeItem("adminData");
      }
    } else if (employeeData) {
      try {
        setUser(JSON.parse(employeeData));
      } catch {
        localStorage.removeItem("user");
      }
    }

    setLoading(false);
  }, []);

  // Create socket connection when user is available
  const userId = user?.id || user?._id;
  useEffect(() => {
    if (!user || !userId) {
      // No user — tear down any existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      return;
    }

    // Disconnect old socket BEFORE creating a new one so the backend
    // processes the disconnect before the new connection registers.
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const newSocket = createSocketConnection(userId);
    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      if (socketRef.current === newSocket) {
        socketRef.current = null;
      }
    };
  }, [userId, user]); // Added 'user' dependency to trigger when user object changes

  return (
    <AuthContext.Provider
      value={{
        loading,
        user,
        setUser: updateUser, // Use the wrapper function instead of direct setState
        setLoading,
        socket,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuthContext must be used within AuthContextProvider");
  }
  return context;
}
