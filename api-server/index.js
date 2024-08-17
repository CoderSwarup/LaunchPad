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
const { exec } = require("child_process");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { isAuthicatedUser } = require("./middlewares/AuthMiddleware");
const jwt = require("jsonwebtoken");
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

  JWT_SECRET: process.env.JWT_SECRET,
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

app.post("/api/v1/register", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }

  const hashPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      password: hashPassword,
      firstName,
      lastName,
    },
  });

  res.status(200).send({
    message: "User created successfully",
    user,
  });
});

app.post("/api/v1/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Please fill in all fields" });
  }

  // find the user
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!user) {
    console.log("User not found");

    return res.status(401).json({ message: "Invalid email or password" });
  }
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const accessToken = jwt.sign(user, config.JWT_SECRET, { expiresIn: "15m" });

  res.status(200).cookie("token", accessToken).send({
    success: true,
    message: "User login successfully",
    user,
  });
});

app.post("/api/v1/project", isAuthicatedUser, async (req, res) => {
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
      userId: req.user.id,
    },
  });

  return res.json({ status: "success", data: { project } });
});

app.post("/api/v1/deploy", isAuthicatedUser, async (req, res) => {
  const { projectId } = req.body;

  if (typeof projectId !== "string" || !projectId || projectId.trim() === "") {
    return res.status(400).json({ error: "Project ID is required." });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId, userId: req.user.id },
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

  // await ecsClient.send(command);

  // return res.json({
  //   status: "queued",
  //   data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  // });

  return res.json({
    status: "queued",
    data: {
      // deploymentId: deployment.id,
      url: `http://${project.subDomain}.${config.FRONTEND_PROXY_URL}`,
    },
  });

  // Run the Docker image locally
  // const command = `docker run -it -e GIT_REPOSITORY__URL=${project.gitURL} -e PROJECT_ID=${projectId} -e DEPLOYEMENT_ID=${deployment.id} -e AWS_ACCESSKEYID=${config.AWS_ACCESSKEYID} -e AWS_SECRETACCESSKEY=${config.AWS_SECRETACCESSKEY} -e KAFKA_BROKER_URL=${config.KAFKA_BROKER_URL} -e KAFKA_USER_NAME=${config.KAFKA_USER_NAME} -e KAFKA_PASSWORD=${config.KAFKA_PASSWORD} builder-server`;

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
  //   // return res.json({
  //   //   status: "queued",
  //   //   data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
  //   // });
  //   return res.json({
  //     status: "queued",
  //     data: {
  //       deploymentId: deployment.id,
  //       url: `http://${project.subDomain}.${config.FRONTEND_PROXY_URL}`,
  //     },
  //   });
  // });
});

app.get("/api/v1/logs/:id", isAuthicatedUser, async (req, res) => {
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
