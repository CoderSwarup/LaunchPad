const express = require("express");
const { generateSlug } = require("random-word-slugs");
const { ECSClient, RunTaskCommand } = require("@aws-sdk/client-ecs");
const Redis = require("ioredis");
const { Server } = require("socket.io");
const http = require("http");

const dotenv = require("dotenv");
dotenv.config({});

const config = {
  CLUSTER: process.env.AWS_CLUSTER_ARN,
  TASK: process.env.AWS_TASK_DEF_ARN,
  AWS_ACCESSKEYID: process.env.AWS_ACCESSKEYID,
  AWS_SECRETACCESSKEY: process.env.AWS_SECRETACCESSKEY,
  REDIS_HOST: process.env.REDIS_HOST,
  REDIS_PORT: process.env.REDIS_PORT,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
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

const REDIS_URL = `rediss://${config.REDIS_PASSWORD}@${config.REDIS_HOST}:${config.REDIS_PORT}`;

const subscriber = new Redis(REDIS_URL);

const ecsClient = new ECSClient({
  region: "ap-south-1",
  credentials: {
    accessKeyId: config.AWS_ACCESSKEYID,
    secretAccessKey: config.AWS_SECRETACCESSKEY,
  },
});

// Middlewares
app.use(express.json());

async function initRedisSubscribe() {
  console.log("Subscribed to logs....");
  subscriber.psubscribe("logs:*");
  // get on the Frontend ::   logs:<PROJECT_SLUG>
  subscriber.on("pmessage", (pattern, channel, message) => {
    io.to(channel).emit("message", message);
  });
}

// Routes
app.post("/project", async (req, res) => {
  const { gitURL, slug } = req.body;
  const projectSlug = slug ? slug : generateSlug();

  const gitURLPattern = /^(https?:\/\/)?(www\.)?github\.com\/.+/i;

  // Validate the gitURL
  if (!gitURL || gitURL.trim() === "" || !gitURLPattern.test(gitURL)) {
    return res
      .status(400)
      .json({ error: "Invalid git URL. It must start with github.com." });
  }

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
            { name: "GIT_REPOSITORY__URL", value: gitURL },
            { name: "PROJECT_ID", value: projectSlug },
            { name: "AWS_ACCESSKEYID", value: config.AWS_ACCESSKEYID },
            { name: "AWS_SECRETACCESSKEY", value: config.AWS_SECRETACCESSKEY },
            { name: "REDIS_HOST", value: config.REDIS_HOST },
            { name: "REDIS_PORT", value: config.REDIS_PORT },
            { name: "REDIS_PASSWORD", value: config.REDIS_PASSWORD },
          ],
        },
      ],
    },
  });

  await ecsClient.send(command);

  return res.json({
    status: "queued",
    data: { projectSlug, url: `http://${projectSlug}.localhost:8000` },
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

// Socket

io.on("connection", (socket) => {
  console.log("Connection ", socket.id);

  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

initRedisSubscribe();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
