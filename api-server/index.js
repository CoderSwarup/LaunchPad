const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
// const Redis = require("ioredis");
const { Server } = require("socket.io");
const http = require("http");
const { PrismaClient } = require("@prisma/client");
const { createClient } = require("@clickhouse/client");
const { Kafka } = require("kafkajs");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const dotenv = require("dotenv");
dotenv.config({});

const config = {
  CLUSTER: process.env.AWS_CLUSTER_ARN,
  TASK: process.env.AWS_TASK_DEF_ARN,
  AWS_ACCESSKEYID: process.env.AWS_ACCESSKEYID,
  AWS_SECRETACCESSKEY: process.env.AWS_SECRETACCESSKEY,
  //  redis
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,

  //Click House
  CLICK_HOUSE_URL: process.env.CLICK_HOUSE_URL,
  CLICK_HOUSE_DB: process.env.CLICK_HOUSE_DB,
  CLICK_HOUSE_USERNAME: process.env.CLICK_HOUSE_USERNAME,
  CLICK_HOUSE_PASSWORD: process.env.CLICK_HOUSE_PASSWORD,

  // Kafka
  KAFKA_BROKER_URL: process.env.KAFKA_BROKER_URL,
  KAFKA_USER_NAME: process.env.KAFKA_USER_NAME,
  KAFKA_PASSWORD: process.env.KAFKA_PASSWORD,

  // frontend
  FRONTEND_URL: process.env.FRONTEND_URL,
  FRONTEND_PROXY_URL: process.env.FRONTEND_PROXY_URL,
};

const PORT = 9000;
const app = express();

// Create an HTTP server
const server = http.createServer(app);

// Initialize Socket.IO with the HTTP server
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: "*",
  },
});

// const REDIS_URL = `rediss://${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}`;

// // redis Connection
// const subscriber = new Redis(REDIS_URL);

// Click House Connection
const clickhouseClient = createClient({
  host: config.CLICK_HOUSE_URL,
  database: config.CLICK_HOUSE_DB,
  username: config.CLICK_HOUSE_USERNAME,
  password: config.CLICK_HOUSE_PASSWORD,
});

// ECS Connection
const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: config.AWS_ACCESSKEYID,
    secretAccessKey: config.AWS_SECRETACCESSKEY,
  },
});

// Rrisma Connectin
const prisma = new PrismaClient({});

// Kafka Connection
const kafka = new Kafka({
  clientId: `api-server`,
  brokers: [config.KAFKA_BROKER_URL],
  ssl: {
    ca: [fs.readFileSync(path.join(__dirname, "kafka.pem"), "utf-8")],
  },
  sasl: {
    username: config.KAFKA_USER_NAME,
    password: config.KAFKA_PASSWORD,
    mechanism: "plain",
  },
});

// Kafka Consumer
const consumer = kafka.consumer({ groupId: "api-server-logs-consumer" });

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: config.FRONTEND_URL || "*",
  })
);

// Redis Subscriber
// async function initRedisSubscribe() {
//   console.log("Subscribed to logs....");
//   subscriber.psubscribe("logs:*");
//   // get on the Frontend ::   logs:<PROJECT_SLUG>
//   subscriber.on("pmessage", (pattern, channel, message) => {
//     io.to(channel).emit("message", message);
//   });
// }

// Kafka Consumer function
async function initkafkaConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topics: ["container-logs"], fromBeginning: true });

  await consumer.run({
    eachBatch: async function ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) {
      const messages = batch.messages;
      console.log(`Recv. ${messages.length} messages..`);
      for (const message of messages) {
        if (!message.value) continue;
        const stringMessage = message.value.toString();
        const { PROJECT_ID, DEPLOYEMENT_ID, log } = JSON.parse(stringMessage);
        console.log({ log, DEPLOYEMENT_ID });
        try {
          const { query_id } = await clickhouseClient.insert({
            table: "log_events",
            values: [
              { event_id: uuidv4(), deployment_id: DEPLOYEMENT_ID, log },
            ],
            format: "JSONEachRow",
          });
          console.log(query_id);
          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (err) {
          console.log("Error Get : ", err);
        }
      }
    },
  });
}

// Routes

app.post("/project", async (req, res) => {
  const { name, gitURL } = req.body;

  const gitURLPattern = /^(https?:\/\/)?(www\.)?github\.com\/.+/i;

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({
      message: "Invalid project name. It must be a non-empty string.",
    });
  }

  // Validate the gitURL
  if (
    typeof gitURL !== "string" ||
    gitURL.trim() === "" ||
    !gitURLPattern.test(gitURL)
  ) {
    return res.status(400).json({
      error:
        "Invalid git URL. It must be a non-empty string starting with github.com.",
    });
  }

  const project = await prisma.project.create({
    data: {
      name,
      gitURL,
      subDomain: generateSlug(),
    },
  });

  return res.json({ status: "success", data: { project } });
});

app.post("/deploy", async (req, res) => {
  const { projectId } = req.body;

  if (typeof projectId !== "string" || !projectId || projectId.trim() === "") {
    return res.status(400).json({ error: "Project ID is required." });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    return res.status(404).json({ error: "Project not found." });
  }
  // console.log("Project ", project);

  // TODO => Check any Deployment is no running
  const deployment = await prisma.deployement.create({
    data: {
      project: { connect: { id: projectId } },
      status: "QUEUED",
    },
  });
  // console.log("Deployment ", deployment);

  // Spin the container AWS
  const command = new RunTaskCommand({
    cluster: config.CLUSTER,
    taskDefinition: config.TASK,
    launchType: "FARGATE",
    count: 1,
    networkConfiguration: {
      awsvpcConfiguration: {
        assignPublicIp: "ENABLED",
        subnets: [
          "subnet-0f1c8efa3a40f272e",
          "subnet-0b0d86a51a477985e",
          "subnet-08d6adbe482395c1b",
        ],
        securityGroups: ["sg-0eed262b572e26da8"],
      },
    },
    overrides: {
      containerOverrides: [
        {
          name: "builder-image",
          environment: [
            { name: "GIT_REPOSITORY__URL", value: project.gitURL },
            { name: "PROJECT_ID", value: projectId },
            { name: "DEPLOYEMENT_ID", value: deployment.id },
            { name: "AWS_ACCESSKEYID", value: config.AWS_ACCESSKEYID },
            { name: "AWS_SECRETACCESSKEY", value: config.AWS_SECRETACCESSKEY },

            // { name: "REDIS_HOST", value: config.REDIS_HOST },
            // { name: "REDIS_PORT", value: config.REDIS_PORT },
            // { name: "REDIS_PASSWORD", value: config.REDIS_PASSWORD },

            { name: "KAFKA_BROKER_URL", value: config.KAFKA_BROKER_URL },
            { name: "KAFKA_USER_NAME", value: config.KAFKA_USER_NAME },
            { name: "KAFKA_PASSWORD", value: config.KAFKA_PASSWORD },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  // return res.json({
  //   status: "queued",
  //   data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  // });

  return res.json({
    status: "queued",
    data: {
      deploymentId: deployment.id,
      url: `http://${project.subDomain}.${config.FRONTEND_PROXY_URL}`,
    },
  });

  // Run the Docker image locally
  // const command = `docker run -it -e PROJECT_ID=${projectSlug} -e GIT_REPOSITORY__URL=${gitURL} 6e9178b0fbb6d526451651ac938003ea65a5b8551962ee4c4ad787c048829169`;

  // exec(command, (error, stdout, stderr) => {
  //   if (error) {
  //     console.error(`Error executing Docker run: ${error}`);
  //     return res.status(500).json({
  //       error: "Failed to run Docker image",
  //       details: stderr || stdout,
  //     });
  //   }
  //   console.log(`Docker run output: ${stdout}`);
  //   if (stderr) {
  //     console.error(`Docker run error: ${stderr}`);
  //   }
  //   return res.json({
  //     status: "queued",
  //     data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  //   });
  // });
});

app.get("/logs/:id", async (req, res) => {
  const id = req.params.id; // Deployment ID
  const logs = await clickhouseClient.query({
    query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
    query_params: {
      deployment_id: id,
    },
    format: "JSONEachRow",
  });

  const rawLogs = await logs.json();

  return res.json({ logs: rawLogs });
});

// Socket

io.on("connection", (socket) => {
  console.log("Connection ", socket.id);

  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

// initRedisSubscribe();  // For redis
initkafkaConsumer(); // Kafka
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
