import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoutes({
  children,
}: {
  children: React.ReactNode;
}) {
  const userDetails = localStorage.getItem("user_details");
  const token = localStorage.getItem("token");
  if (!userDetails || !token) {
    return <Navigate to="/login" replace={true} />;
  }
  return children;
}
