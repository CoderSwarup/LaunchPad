const express = require("express");
const httpProxy = require("http-proxy");
const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");
const { Kafka } = require("kafkajs");
const fs = require("fs");
const path = require("path");
dotenv.config();

// Kafka env
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL;
const KAFKA_USER_NAME = process.env.KAFKA_USER_NAME;
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD;

const app = express();
const PORT = 8000;

const BASE_PATH = process.env.OUTPUT_BASE_PATH;

// Rrisma Connectin
const prisma = new PrismaClient({});

const proxy = httpProxy.createProxy();

// Kafka Producer
const kafka = new Kafka({
  clientId: `docker-build-server-${new Date().now}`,
  brokers: [KAFKA_BROKER_URL],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")],
  },
  sasl: {
    username: KAFKA_USER_NAME,
    password: KAFKA_PASSWORD,
    mechanism: "plain",
  },
});

const producer = kafka.producer();

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
  await producer.send({
    topic: `visitor-counts`,
    messages: [
      {
        key: "counts",
        value: JSON.stringify({ PROJECT_ID: id }),
      },
    ],
  });
  const resolvesTo = `${BASE_PATH}/${id}`;
  // console.log(resolvesTo);

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += "index.html";
});

async function init() {
  await producer.connect();
}
init();
app.listen(PORT, () => console.log(`Reverse Proxy Running..${PORT}`));
