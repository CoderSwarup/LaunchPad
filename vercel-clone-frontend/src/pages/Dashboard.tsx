import { Box, Button, Stack, TextField } from "@mui/material";
import React, { useEffect, useState } from "react";
import Header from "../Components/Header";
import ProjectCard, { ProjectCardProps } from "../Components/ProjectCard";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import AxiosInstance from "../AxiosInstance";

export default function Dashboard(): React.ReactNode {
  const navigator = useNavigate();
  const [projects, setProjects] = useState([]);

  const fetchProjects = async () => {
    try {
      const response = await AxiosInstance.get("get-projects");
      console.log(response.data);

      setProjects(response.data.projects);
    } catch (error: any) {
      toast.error(error.response.data.message || "somthing Went wrong");
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);
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
                  borderColor: "#fff",
                },

                "&.Mui-focused fieldset": {
                  borderColor: "#00d0ff",
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
            label="Search Repositories"
            id="fullWidth"
            placeholder="Search Repositories and Projects..."
          />
          <Button
            variant="outlined"
            sx={{
              background: "#ffff",
              color: "#000",
              fontWeight: "700",
              "&:hover": {
                background: "#00fffb",
                color: "#000000",
              },
            }}
            onClick={() => {
              navigator("/newproject");
            }}
          >
            Deploy new Project
          </Button>
        </Stack>
        <Stack
          direction={"row"}
          gap={"20px"}
          flexWrap={"wrap"}
          justifyContent={"space-around"}
          sx={{
            marginTop: "20px",
          }}
        >
          {projects.map((ele: ProjectCardProps, index: number) => {
            return <ProjectCard {...ele} key={index} />;
          })}
        </Stack>
      </Box>
    </Box>
  );
}
