import * as React from "react";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import CssBaseline from "@mui/material/CssBaseline";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
import Checkbox from "@mui/material/Checkbox";
import Link from "@mui/material/Link";
import Grid from "@mui/material/Grid";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Container from "@mui/material/Container";
import Copyright from "../Components/Copywrite";
import { Navigate, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AxiosInstance from "../AxiosInstance";

type userDataType = {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
};

function validateField(value?: string): string | null {
  if (!value || value.trim() === "") {
    return "This field is required.";
  }
  return null;
}

export default function SignUp() {
  const user_details = localStorage.getItem("user_details");
  const [loading, setLoading] = React.useState(false);
  const Navigator = useNavigate();
  if (user_details) {
    return <Navigate to="/dashboard" />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    const data = new FormData(event.currentTarget);

    const userData: userDataType = {
      email: data.get("email") as string | "", // Explicitly cast to string or null
      password: data.get("password") as string | "",
      firstName: data.get("firstName") as string | "",
      lastName: data.get("lastName") as string | "",
    };
    const errors = {
      email: validateField(userData.email),
      password: validateField(userData.password),
      firstName: validateField(userData.firstName),
      lastName: validateField(userData.lastName),
    };

    const hasErrors = Object.values(errors).some((error) => error !== null);

    if (hasErrors) {
      setLoading(false);
      return toast.error("All Fields are reuqired");
    }

    try {
      const response = await AxiosInstance.post("/register", userData);
      console.log(response.data);
      Navigator("/login");
      toast.success("user Register successfully !");
    } catch (error: any) {
      // console.log("Error is", error.response.data.message);

      toast.error(error.response.data.message || "somthing Went wrong");
    }

    setLoading(false);
  };

  return (
    <Container component="main" maxWidth="md">
      <CssBaseline />
      <Box
        sx={{
          marginTop: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Avatar sx={{ m: 1, bgcolor: "secondary.main" }}></Avatar>
        <Typography component="h1" variant="h5">
          Sign up
        </Typography>
        <Box component="form" noValidate onSubmit={handleSubmit} sx={{ mt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                autoComplete="given-name"
                name="firstName"
                required
                fullWidth
                id="firstName"
                label="First Name"
                autoFocus
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                required
                fullWidth
                id="lastName"
                label="Last Name"
                name="lastName"
                autoComplete="family-name"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="new-password"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox value="allowExtraEmails" color="primary" />}
                label="I want to receive inspiration, marketing promotions and updates via email."
              />
            </Grid>
          </Grid>
          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={loading}
          >
            Sign Up
          </Button>
          <Grid container justifyContent="flex-end">
            <Grid item>
              <Link href="login" variant="body2">
                Already have an account? Sign in
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Box>
      <Copyright sx={{ mt: 5 }} />
    </Container>
  );
}
