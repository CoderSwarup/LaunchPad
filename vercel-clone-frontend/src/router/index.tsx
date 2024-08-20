import { createBrowserRouter } from "react-router-dom";
import App from "../App";
import Login from "../pages/Login";
import SignUp from "../pages/SignUp";
import Dashboard from "../pages/Dashboard";
import PrivateRoutes from "./PrivateRoutes";
import DeployProjectPage from "../pages/DeployProjectPage";
import ProjectAnalytics from "../pages/ProjectAnalitics";
import Project from "../pages/Project";
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <h1>Errro</h1>,
  },
  {
    path: "/login",
    element: <Login />,
  },
  {
    path: "/signup",
    element: <SignUp />,
  },
  {
    path: "/dashboard",
    element: (
      <PrivateRoutes>
        <Dashboard />
      </PrivateRoutes>
    ),
  },
  {
    path: "/newproject",
    element: (
      <PrivateRoutes>
        <DeployProjectPage />
      </PrivateRoutes>
    ),
  },
  {
    path: "/project-analyics/:projectId",
    element: (
      <PrivateRoutes>
        <ProjectAnalytics />
      </PrivateRoutes>
    ),
  },
  {
    path: "/project/:projectId",
    element: (
      <PrivateRoutes>
        <Project />
      </PrivateRoutes>
    ),
  },
]);

export default router;
