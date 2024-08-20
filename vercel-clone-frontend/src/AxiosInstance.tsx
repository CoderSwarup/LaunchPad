import axios from "axios";

const AxiosInstance = axios.create({
  baseURL: "http://localhost:9000/api/v1",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

AxiosInstance.interceptors.request.use(
  (config) => {
    // Modify the request before it is sent (e.g., attach a token)
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    // Handle the request error here
    return Promise.reject(error);
  }
);

export default AxiosInstance;
