const express = require("express");
const httpProxy = require("http-proxy");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = 8000;

const BASE_PATH = process.env.OUTPUT_BASE_PATH;

const proxy = httpProxy.createProxy();

// TODO => Create a Kafka events that give the analytics-
app.use((req, res) => {
  // console.log("REQUEST ");
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];
  // console.log("SUBDOMAIN IS ", subdomain);

  // Custom Domain || SubDomain  - DB Query
  // find the id of the project

  const id = "87fd3a23-9610-418e-94ed-25458b682302";

  const resolvesTo = `${BASE_PATH}/${id}`;
  // console.log(resolvesTo);

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += "index.html";
});

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`));
