import { Navigate } from "react-router-dom";

const CustomerProtectedRoute = ({ children }) => {
  const customer = localStorage.getItem("customerData");

  if (!customer) {
    return <Navigate to="/customer/login" replace />;
  }

  return children;
};

export default CustomerProtectedRoute;
