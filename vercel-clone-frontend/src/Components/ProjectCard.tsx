import Card from "@mui/material/Card";
import CardHeader from "@mui/material/CardHeader";
import CardContent from "@mui/material/CardContent";

import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";

import { Stack } from "@mui/material";
import { Link, useNavigate } from "react-router-dom";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { Dashboard, GitHub } from "@mui/icons-material";

export interface ProjectCardProps {
  id: string;
  name: string;
  subDomain: string;
  customDomain?: string;
  gitURL: string;
  createdAt: string;
  updatedAt: string;
  status: string;
}

export default function ProjectCard({
  id,
  name,
  subDomain,
  customDomain,
  gitURL,
  createdAt,
  status,
}: ProjectCardProps) {
  const navigate = useNavigate();
  return (
    <Card
      sx={{
        width: 365,
        maxWidth: 365,
        background: "#000000",
        border: "1px solid #fff",
      }}
    >
      <CardHeader
        avatar={
          <Avatar
            sx={{ bgcolor: "#fff", color: "#000" }}
            aria-label="project-avatar"
          >
            {name?.charAt(0).toUpperCase()}
          </Avatar>
        }
        action={
          <>
            <IconButton
              aria-label="Analytics"
              onClick={() => {
                navigate(`/project-analyics/${id}`);
              }}
            >
              <InsightsOutlinedIcon
                sx={{
                  fontSize: "20px",
                  color: "#fff",
                }}
              />
            </IconButton>
            <IconButton
              aria-label="Dashboard"
              onClick={() => {
                navigate(`/project/${id}`);
              }}
            >
              <Dashboard style={{ color: "#fff" }} />
            </IconButton>
          </>
        }
        title={name}
        subheader={`Created At: ${new Date(createdAt).toLocaleDateString()}`}
        titleTypographyProps={{ color: "#fff" }}
        subheaderTypographyProps={{ color: "#888" }}
      />

      <CardContent>
        <Stack
          direction={"row"}
          gap={"10px"}
          alignItems={"center"}
          sx={{
            padding: "4px",
            background: "#242424",
            borderRadius: "10px",
          }}
        >
          <GitHub sx={{ color: "#fff" }} />
          <Typography variant="body2" color="text.secondary">
            <Link to={gitURL} style={{ textDecoration: "none", color: "#fff" }}>
              {gitURL}
            </Link>
          </Typography>
        </Stack>
        <Stack marginTop={"30px"} direction={"column"} gap={"10px"}>
          <Typography variant="body2" color="text.secondary">
            Status: {status}
          </Typography>
          <Link
            to={customDomain || `http://${subDomain}.localhost:8000`}
            style={{ textDecoration: "none", color: "#fff" }}
          >
            <Typography variant="body2" color="text.secondary">
              Visit 👉 {customDomain || `http://${subDomain}.localhost:8000`}
            </Typography>
          </Link>
        </Stack>
      </CardContent>
    </Card>
  );
}
