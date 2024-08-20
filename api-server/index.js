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
const { isAuthenticatedUser } = require("./middlewares/AuthMiddleware");
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
  express.urlencoded({
    extended: true,
  })
);
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
const logConsumer = kafka.consumer({ groupId: "log-group" });

async function initLogConsumer() {
  await logConsumer.connect();
  await logConsumer.subscribe({
    topics: ["container-logs"],
    fromBeginning: true,
  });

  await logConsumer.run({
    eachBatch: async ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) => {
      const messages = batch.messages;
      console.log(`Received ${messages.length} log messages.`);
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
          console.error("Error in log consumer: ", err);
        }
      }
    },
  });
}

// Visitor Count
const visitorConsumer = kafka.consumer({ groupId: "visitor-group" });

async function initVisitorConsumer() {
  await visitorConsumer.connect();
  await visitorConsumer.subscribe({
    topics: ["visitor-counts"],
    fromBeginning: true,
  });

  await visitorConsumer.run({
    eachBatch: async ({
      batch,
      heartbeat,
      commitOffsetsIfNecessary,
      resolveOffset,
    }) => {
      const messages = batch.messages;
      console.log(`Received ${messages.length} visitor count messages.`);
      for (const message of messages) {
        if (!message.value) continue;
        const stringMessage = message.value.toString();
        const { PROJECT_ID } = JSON.parse(stringMessage);
        console.log({ PROJECT_ID });

        // Get the current date in YYYY-MM-DD format
        const currentDate = new Date().toISOString().split("T")[0];

        try {
          const { query_id } = await clickhouseClient.insert({
            table: "visitor_counts",
            values: [
              {
                project_id: PROJECT_ID,
                visitor_count: 1,
                date: currentDate,
              },
            ],
            format: "JSONEachRow",
          });

          console.log(`Inserted new record with query_id: ${query_id}`);

          resolveOffset(message.offset);
          await commitOffsetsIfNecessary(message.offset);
          await heartbeat();
        } catch (err) {
          console.error("Error in visitor consumer: ", err);
        }
      }
    },
  });
}

// Routes

// register
app.post("/api/v1/register", async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  if (!email || !password || !firstName || !lastName) {
    return res
      .status(400)
      .send({ success: false, message: "Please fill in all fields" });
  }

  const isUserExist = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (isUserExist) {
    return res
      .status(400)
      .send({ success: false, message: "User already exist" });
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

// Login
app.post("/api/v1/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .send({ success: false, message: "Please fill in all fields" });
  }

  // find the user
  const user = await prisma.user.findUnique({
    where: {
      email: email,
    },
  });

  if (!user) {
    return res
      .status(401)
      .send({ success: false, message: "Invalid email or password" });
  }
  const isPasswordCorrect = await bcrypt.compare(password, user.password);

  if (!isPasswordCorrect) {
    return res
      .status(401)
      .send({ success: false, message: "Invalid email or password" });
  }

  const accessToken = jwt.sign(user, config.JWT_SECRET, { expiresIn: "1d" });

  res.status(200).cookie("token", accessToken).send({
    success: true,
    message: "User login successfully",
    user,
    token: accessToken,
  });
});

// Get prokects
app.get("/api/v1/get-projects", isAuthenticatedUser, async (req, res) => {
  const projects = await prisma.project.findMany({
    where: {
      userId: req.user.id,
    },
    include: {
      Deployement: {
        select: {
          status: true,
        },
      },
    },
  });

  const formattedProjects = projects.map((project) => ({
    ...project,
    status: project.Deployement[0]?.status || "NOT_STARTED",
  }));

  return res.status(200).send({
    success: true,
    message: "Projects retrieved successfully",
    projects: formattedProjects,
  });
});

// get the Single Project
app.get(
  "/api/v1/get-single-project/:projectID",
  isAuthenticatedUser,
  async (req, res) => {
    const { projectID } = req.params; // Use req.params for GET requests

    try {
      const project = await prisma.project.findUnique({
        where: {
          id: projectID,
          userId: req.user.id,
        },
      });

      if (!project) {
        return res.status(404).send({
          success: false,
          message: "Project not found",
        });
      }

      return res.status(200).send({
        success: true,
        message: "Project retrieved successfully",
        project,
      });
    } catch (error) {
      console.log(error);

      return res.status(500).send({
        success: false,
        message: "An error occurred while retrieving the project",
        error: error.message,
      });
    }
  }
);

// get the Deployment id
app.get(
  "/api/v1/get-deployment-id/:projectID",
  isAuthenticatedUser,
  async (req, res) => {
    const { projectID } = req.params;

    try {
      const deployment = await prisma.deployement.findFirst({
        where: {
          projectId: projectID,
        },
      });

      if (!deployment) {
        return res.status(404).send({
          success: false,
          message: "Deployment Id not found",
        });
      }

      return res.status(200).send({
        success: true,
        message: "Project retrieved successfully",
        deploymentId: deployment.id,
      });
    } catch (error) {
      console.log(error);

      return res.status(500).send({
        success: false,
        message: "An error occurred while retrieving the project",
        error: error.message,
      });
    }
  }
);

// Create a Project
app.post("/api/v1/project", isAuthenticatedUser, async (req, res) => {
  const { name, gitURL } = req.body;

  const gitURLPattern = /^(https?:\/\/)?(www\.)?github\.com\/.+/i;

  if (typeof name !== "string" || name.trim() === "") {
    return res.status(400).send({
      success: false,
      message: "Invalid project name. It must be a non-empty string.",
    });
  }

  // Validate the gitURL
  if (
    typeof gitURL !== "string" ||
    gitURL.trim() === "" ||
    !gitURLPattern.test(gitURL)
  ) {
    return res.status(400).send({
      success: false,
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

  return res.send({
    success: true,
    status: "success",
    message: "Project created Succefully",
    project,
  });
});

// Deploy the Project
app.post("/api/v1/deploy", isAuthenticatedUser, async (req, res) => {
  const { projectId } = req.body;

  if (typeof projectId !== "string" || !projectId || projectId.trim() === "") {
    return res
      .status(400)
      .send({ success: false, error: "Project ID is required." });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId, userId: req.user.id },
  });

  if (!project) {
    return res
      .status(404)
      .send({ success: false, error: "Project not found." });
  }
  // console.log("Project ", project);

  // TODO => Check any Deployment is no running
  const deployment = await prisma.deployement.create({
    data: {
      project: { connect: { id: projectId } },
      status: "READY",
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
    success: true,
    status: "queued",
    message: "Deployed Succefully",
    data: {
      deploymentId: deployment.id,
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

// Get logs
app.get("/api/v1/logs/:id", isAuthenticatedUser, async (req, res) => {
  const id = req.params.id; // Deployment ID
  const logs = await clickhouseClient.query({
    query: `SELECT event_id, deployment_id, log, timestamp from log_events where deployment_id = {deployment_id:String}`,
    query_params: {
      deployment_id: id,
    },
    format: "JSONEachRow",
  });

  const rawLogs = await logs.json();

  return res.status(200).send({ success: true, logs: rawLogs });
});
// get the Visitors Count
app.get(
  "/api/v1/visitor-count/:projectID",
  isAuthenticatedUser,
  async (req, res) => {
    const { projectID } = req.params;

    try {
      const result = await clickhouseClient.query({
        query: `
        SELECT 
          date, 
          SUM(visitor_count) AS visitor_count
        FROM 
          visitor_counts
        WHERE 
          project_id = {projectID:String}
        GROUP BY 
          date
        ORDER BY 
          date DESC
        LIMIT 15;
      `,
        query_params: { projectID },
        format: "JSONEachRow",
      });

      const data = await result.json();
      res.status(200).json(data);
    } catch (err) {
      console.error("Error fetching visitor data: ", err);
      res.status(500).json({ error: "Failed to fetch visitor data" });
    }
  }
);

// Socket

io.on("connection", (socket) => {
  console.log("Connection ", socket.id);

  socket.on("subscribe", (channel) => {
    socket.join(channel);
    socket.emit("message", `Joined ${channel}`);
  });
});

// initRedisSubscribe();  // For redis
initLogConsumer(); // Kafka
initVisitorConsumer();
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
