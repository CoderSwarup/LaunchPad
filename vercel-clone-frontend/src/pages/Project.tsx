import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Link,
  Stack,
  IconButton,
} from "@mui/material";
import Header from "../Components/Header";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import AxiosInstance from "../AxiosInstance";
import { useEffect, useState } from "react";
import { TerminalOutput } from "react-terminal-ui";
import TerminalUI from "../Components/Terminal";

export default function Project() {
  const { projectId } = useParams();
  const [project, setProject] = useState<any>(null); // Change to any to accommodate project object
  const navigate = useNavigate();
  const [terminalLineData, setTerminalLineData] = useState<JSX.Element[]>([]);
  const fetchProjectDetails = async () => {
    try {
      const response = await AxiosInstance.get(
        `/get-single-project/${projectId}`
      );
      setProject(response.data.project);
      FetchLogs(response.data.project.id);
    } catch (error: any) {
      console.log(error);
      navigate("/");
      toast.error("Project not found");
    }
  };

  const FetchLogs = async (projectid: string) => {
    try {
      const deploymentRes = await AxiosInstance.get(
        `/get-deployment-id/${projectid}`
      );
      console.log(deploymentRes);

      const response = await AxiosInstance.get(
        `/logs/${deploymentRes.data.deploymentId}`
      );

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
      console.log(error);

      toast.error("Something went wrong");
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  if (!project) {
    return (
      <Box
        sx={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Typography variant="h6" color="textSecondary">
          Loading project details...
        </Typography>
      </Box>
    );
  }

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
        <Typography variant="h4" sx={{ mb: 4 }}>
          Project Details
        </Typography>

        <Paper sx={{ p: 4, bgcolor: "#1e1e1e" }}>
          <Stack
            width={"100%"}
            direction={"row"}
            justifyContent={"space-between"}
            alignItems={"center"}
          >
            <Box>
              <Typography variant="h5" sx={{ mb: 2 }}>
                {project.name}
              </Typography>
              <Typography sx={{ mb: 4 }}>
                The deployment that is available to your visitors.
              </Typography>
            </Box>
            <IconButton
              sx={{
                padding: "5px",
                border: "2px solid #fff",
              }}
              onClick={() => {
                navigate(`/project-analyics/${projectId}`);
              }}
            >
              <InsightsOutlinedIcon style={{ color: "#fff" }} />
            </IconButton>
          </Stack>

          <Grid container spacing={4}>
            <Grid item xs={12} sm={8}>
              <Box
                sx={{
                  bgcolor: "#000",
                  height: 250,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Typography variant="h6" color="textSecondary">
                  {project.customDomain
                    ? `Domain: ${project.customDomain}`
                    : "No custom domain set"}
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Box>
                <Typography variant="body1">
                  <strong>Deployment:</strong>{" "}
                  <Link
                    href={
                      project.customDomain ||
                      `http://${project.subDomain}.localhost:8000`
                    }
                    target="_blank"
                    color="primary"
                  >
                    {project.customDomain ||
                      `http://${project.subDomain}.localhost:8000`}
                  </Link>
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Github URL:</strong>{" "}
                  <Link
                    href={project.gitURL}
                    target="_blank"
                    color="primary"
                    sx={{ ml: 1 }}
                  >
                    {project.gitURL}
                  </Link>
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Status:</strong> {project.status || "Ready"}
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Created:</strong>{" "}
                  {new Date(project.createdAt).toLocaleDateString()}
                </Typography>
                <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Source:</strong>{" "}
                  <Link href="#" color="primary" sx={{ ml: 1 }}>
                    main
                  </Link>
                </Typography>
                {/* <Typography variant="body1" sx={{ mt: 2 }}>
                  <strong>Commit:</strong> 9cc2f66 Frontend verification form
                  changes
                </Typography> */}
              </Box>
            </Grid>
          </Grid>

          <Box sx={{ mt: 4, display: "flex", gap: 2 }}>
            <Button variant="outlined" color="inherit">
              Build Logs
            </Button>
            <Button variant="outlined" color="inherit">
              Runtime Logs
            </Button>
            <Button variant="outlined" color="inherit">
              Instant Rollback
            </Button>
          </Box>
        </Paper>

        <Box sx={{ mt: 4 }}>
          {terminalLineData.length > 0 && (
            <TerminalUI terminalLineData={terminalLineData} />
          )}
        </Box>
      </Box>
    </Box>
  );
}
