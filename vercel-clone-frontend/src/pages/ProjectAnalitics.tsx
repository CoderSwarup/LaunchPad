import { useState, useEffect } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { useParams } from "react-router-dom";
import Header from "../Components/Header";
import AxiosInstance from "../AxiosInstance";

export default function ProjectAnalytics() {
  const { projectId } = useParams<{ projectId: string }>(); // Extract projectId from URL params
  const [data, setData] = useState<any[]>([]); // Replace 'any' with your data type
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [chartWidth, setChartWidth] = useState(1200);

  useEffect(() => {
    if (!projectId) {
      setError("Project ID is missing.");
      return;
    }

    // Fetch visitor count data from the backend
    const fetchVisitorData = async () => {
      setLoading(true);
      try {
        const response = await AxiosInstance.get(`/visitor-count/${projectId}`);
        console.log(response);
        setData(response.data);
      } catch (err) {
        setError("Project does not exist or failed to fetch data.");
      } finally {
        setLoading(false);
      }
    };

    fetchVisitorData();
  }, [projectId]);

  useEffect(() => {
    const handleResize = () => {
      const parentWidth =
        document.getElementById("chart-container")?.offsetWidth || 1200;
      setChartWidth(Math.max(parentWidth, 800)); // Minimum width is 800px
    };

    // Set initial width
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup event listener on component unmount
    return () => {
      window.removeEventListener("resize", handleResize);
    };
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
          textAlign: "center",
        }}
      >
        <Typography variant="h4" gutterBottom>
          Project Analytics
        </Typography>

        {!projectId && (
          <Typography color="error">No Project ID provided in URL.</Typography>
        )}

        {loading && <CircularProgress />}

        {error && (
          <Typography color="error" sx={{ marginTop: "20px" }}>
            {error}
          </Typography>
        )}

        {data.length > 0 && !loading && (
          <Box
            sx={{ marginTop: "20px", width: "100%", overflowX: "scroll" }}
            id="chart-container"
            className="hide-scroll"
          >
            <Typography variant="h6" gutterBottom>
              Visitor Counts
            </Typography>
            <LineChart
              data={data}
              width={chartWidth}
              height={300}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="visitor_count" stroke="#8884d8" />
            </LineChart>
          </Box>
        )}
      </Box>
    </Box>
  );
}
