const express = require("express");
const httpProxy = require("http-proxy");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
dotenv.config();

const app = express();
const PORT = 8000;

const BASE_PATH = process.env.OUTPUT_BASE_PATH;

// Rrisma Connectin
const prisma = new PrismaClient({});

const proxy = httpProxy.createProxy();

// TODO => Create a Kafka events that give the analytics-
app.use(async (req, res) => {
  // console.log("REQUEST ");
  const hostname = req.hostname;
  const subdomain = hostname.split(".")[0];
  // console.log("SUBDOMAIN IS ", subdomain);

  // Custom Domain || SubDomain  - DB Query
  // find the id of the project
  const project = await prisma.project.findFirst({
    where: {
      subDomain: subdomain,
    },
  });

  // console.log(project);

  const id = project?.id;
  // const id = "a368073d-20bd-4555-abae-4d3ce138ee57";

  const resolvesTo = `${BASE_PATH}/${id}`;
  // console.log(resolvesTo);

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += "index.html";
});

app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`));
