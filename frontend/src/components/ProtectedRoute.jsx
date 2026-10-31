import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  // If user is not logged in, redirect to login page
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified and user doesn't have permissions, show access denied
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger text-center shadow-sm p-5" role="alert">
          <h4 className="alert-heading fw-bold mb-3">Access Denied!</h4>
          <p className="mb-4">You do not have the required permissions to view this page. Restricted to roles: {allowedRoles.join(', ')}.</p>
          <hr />
          <div className="mt-4">
            <a href="/" className="btn btn-danger px-4 py-2">Go back to Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  // Render children if all validation passes
  return children;
};

export default ProtectedRoute;
