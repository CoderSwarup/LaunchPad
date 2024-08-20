import React, { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import Header from "../Components/Header";
import axios from "axios";
import TerminalUI from "../Components/Terminal";
import { TerminalOutput } from "react-terminal-ui";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import AxiosInstance from "../AxiosInstance";

export default function DeployProjectPage() {
  const [gitUrl, setGitUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isValid, setIsValid] = useState(false);
  const [terminalLineData, setTerminalLineData] = useState<JSX.Element[]>([]);

  const validateGitUrl = (url: string) => {
    const regex = /^https:\/\/github\.com\/(.*?)\/(.*?)\.git$/;
    return regex.test(url);
  };

  const checkRepoExists = async (url: string) => {
    const regex = /^https:\/\/github\.com\/(.*?)\/(.*?)\.git$/;
    const match = url.match(regex);
    if (!match) return false;

    const [_, owner, repo] = match;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}`;

    try {
      const response = await axios.get(apiUrl);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  };

  const handleGitUrlChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setGitUrl(value);

    if (validateGitUrl(value)) {
      const exists = await checkRepoExists(value);
      if (exists) {
        setIsValid(true);
        setError("");
      } else {
        setIsValid(false);
        setError("The repository does not exist or is private.");
      }
    } else {
      setIsValid(false);
      setError(
        "Please enter a valid GitHub URL (e.g., https://github.com/user/repo.git)."
      );
    }
  };

  const FetchLogs = async (deploymentId: string) => {
    try {
      const response = await AxiosInstance.get(`/logs/${deploymentId}`);

      console.log(response.data);

      const logs = response.data.logs.map((log: any, index: number) => {
        return (
          <TerminalOutput key={index}>&gt; {log.log.toString()}</TerminalOutput>
        );
      });

      setTerminalLineData([
        <TerminalOutput key="header">&gt; Project Logs</TerminalOutput>,
        ...logs, // Spread the individual log elements into the array
      ]);
    } catch (error: any) {
      console.log("ERRR is get in lg");

      toast.error(error.response?.data?.message || "Something went wrong");
    }
  };

  const startPollingLogs = (deploymentId: string) => {
    const POLLING_INTERVAL = 10000; // 10 seconds
    const POLLING_DURATION = 120000; // 2 minutes

    const intervalId = setInterval(() => {
      FetchLogs(deploymentId);
    }, POLLING_INTERVAL);

    // Stop polling after 2 minutes
    const timeoutId = setTimeout(() => {
      clearInterval(intervalId);
      toast.info("Stopped polling logs after 2 minutes.");
    }, POLLING_DURATION);

    // Optionally clear the timeout if component unmounts

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
    };
  };

  const DeployProject = async (projectId: string) => {
    setLoading(true);
    try {
      const response = await AxiosInstance.post("/deploy", {
        projectId,
      });
      toast.success(response.data.message);
      const deploymentId = response.data.data.deploymentId;

      // Start polling logs
      startPollingLogs(deploymentId);
    } catch (error: any) {
      console.log("ERRR is get in deolou", error);
      toast.error(error.response?.data?.message || "Something went wrong");
    }
    setLoading(false);
  };

  const CreateProject = async () => {
    setLoading(true);
    const regex = /^https:\/\/github\.com\/(.*?)\/(.*?)\.git$/;
    const match = gitUrl.match(regex);
    if (!match) {
      toast.warning("GitHub URL is incorrect");
      setLoading(false);
      return;
    }
    const [_, __, repo] = match;
    try {
      const response = await AxiosInstance.post("/project", {
        name: repo,
        gitURL: gitUrl,
      });
      console.log(response);
      toast.success(response.data.message);
      DeployProject(response.data.project.id);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Something went wrong");
      console.log(error);
    }
    setLoading(false);
  };

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100vh",
      }}
    >
      <Header />
      <Box
        sx={{
          width: "90%",
          margin: "auto",
          marginTop: "30px",
        }}
      >
        <Stack
          direction={"column"}
          alignItems={"center"}
          justifyContent={"center"}
        >
          <Typography
            variant="h2"
            sx={{
              fontWeight: 800,
              marginBottom: "20px",
            }}
          >
            Let's build something new.
          </Typography>
          <Typography
            sx={{
              fontFamily: "cursive",
            }}
          >
            To deploy a new Project, import an existing Git Repository
          </Typography>
        </Stack>

        <Stack
          sx={{
            marginTop: "110px",
          }}
        >
          <Stack
            sx={{
              width: "100%",
              padding: "10px",
            }}
            direction={"row"}
            gap={"20px"}
          >
            <TextField
              sx={{
                "& .MuiOutlinedInput-root": {
                  "& fieldset": {
                    borderColor: isValid
                      ? "#00ff00"
                      : error
                      ? "#ff0000"
                      : "#fff",
                  },
                  "&:hover fieldset": {
                    borderColor: isValid
                      ? "#00ff00"
                      : error
                      ? "#ff0000"
                      : "#fff",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: isValid ? "#00ff00" : "#00d0ff",
                  },
                },
                input: {
                  color: "#fff", // Text color inside the input
                },
                label: {
                  color: "#fff", // Label color
                },
              }}
              fullWidth
              label="GitHub URL"
              id="fullWidth"
              placeholder="Enter Your GitHub Link"
              value={gitUrl}
              onChange={handleGitUrlChange}
              error={!!error}
              helperText={error}
            />

            <Button
              variant="outlined"
              sx={{
                background: "#ffff",
                color: "#000",
                fontWeight: "900",
                "&:hover": {
                  background: "#00fffb",
                  color: "#000000",
                },
                height: "55px",
                width: "300px",
              }}
              onClick={CreateProject}
              disabled={!isValid || loading}
            >
              DEPLOY
            </Button>
          </Stack>
        </Stack>

        {terminalLineData.length > 0 && (
          <TerminalUI terminalLineData={terminalLineData} />
        )}

        <Box
          sx={{
            width: "100%",
            display: "flex",
            margin: "20px 0",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Link to={"/dashboard"}>
            <Button variant="outlined">Go to DashBoard</Button>
          </Link>
        </Box>
      </Box>
    </Box>
  );
}
