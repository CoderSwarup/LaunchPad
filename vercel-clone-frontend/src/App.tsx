import React from "react";
import "./App.css";
import { AppBar, Box, Button, Link, Toolbar, Typography } from "@mui/material";
import { Navigate, useNavigate } from "react-router-dom";
import { GitHub, Instagram, LinkedIn } from "@mui/icons-material";

function App(): React.ReactNode {
  const user_details = localStorage.getItem("user_details");
  if (user_details) {
    return <Navigate to="/dashboard" />;
  }
  const navigate = useNavigate();
  return (
    <>
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <AppBar position="static" elevation={0}>
          <Toolbar
            sx={{
              justifyContent: "space-between",
              background: "#000",
              width: "100%",
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: "#ffff",
              }}
            >
              LaunchPad
            </Typography>
            <Box>
              <Button
                sx={{ textTransform: "none", color: "#ffff" }}
                onClick={() => navigate("/login")}
              >
                Log In
              </Button>
              <Button sx={{ textTransform: "none", color: "#ffff" }}>
                Contact
              </Button>
              <Button
                variant="outlined"
                sx={{
                  marginLeft: "10px",
                  textTransform: "none",
                  color: "#ffff",
                }}
                onClick={() => navigate("/signup")}
              >
                Sign Up
              </Button>
            </Box>
          </Toolbar>
        </AppBar>
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            textAlign: "center",
            background: "linear-gradient(to bottom right, #000000, #292929)",
          }}
        >
          <Typography
            variant="h3"
            color="primary"
            fontWeight="bold"
            gutterBottom
          >
            Your complete platform for static websites
          </Typography>
          <Typography
            variant="h6"
            color="primary"
            sx={{ marginBottom: "20px" }}
          >
            LaunchPad provides the tools and infrastructure to deploy your
            static websites easily and securely.
          </Typography>
          <Box>
            <Button
              variant="contained"
              color="primary"
              sx={{ marginRight: "10px", textTransform: "none" }}
              onClick={() => navigate("/dashboard")}
            >
              Start Deploying
            </Button>
            <Button
              variant="outlined"
              color="primary"
              sx={{ textTransform: "none" }}
            >
              Get a Demo
            </Button>
          </Box>
        </Box>

        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap",
            textAlign: "center",
            padding: "10px",
          }}
        >
          <Typography variant="body1" sx={{ marginBottom: "10px" }}>
            © 2024 LaunchPad. All rights reserved.
          </Typography>
          <Box sx={{ display: "flex", gap: "30px", justifyContent: "center" }}>
            <Link
              href="https://www.linkedin.com/in/swarup-bhise-a981932aa/"
              color="inherit"
              sx={{
                listStyle: "none",
                textDecoration: "none",
              }}
            >
              <LinkedIn
                sx={{
                  fontSize: "30px",
                  color: "lightblue",
                }}
              />
            </Link>
            <Link
              href="https://www.instagram.com/swarup_bhise999/"
              color="inherit"
              sx={{
                listStyle: "none",
                textDecoration: "none",
              }}
            >
              <Instagram
                sx={{
                  fontSize: "30px",
                  color: "pink",
                }}
              />
            </Link>
            <Link
              href="https://github.com/CoderSwarup"
              color="inherit"
              sx={{
                listStyle: "none",
                textDecoration: "none",
              }}
            >
              <GitHub
                sx={{
                  fontSize: "30px",
                  color: "#fff",
                }}
              />
            </Link>
          </Box>
        </Box>
      </Box>
    </>
  );
}

export default App;
