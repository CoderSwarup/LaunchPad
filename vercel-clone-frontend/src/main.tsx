import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { RouterProvider } from "react-router-dom";
import router from "./router";
import { ThemeProvider } from "@emotion/react";
import defaultTheme from "./Theme";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <RouterProvider router={router}></RouterProvider>
      <ToastContainer autoClose={5000} />
    </ThemeProvider>
  </StrictMode>
);
