const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");

// const Redis = require("ioredis"); // V1
const { Kafka } = require("kafkajs");

// const dotenv = require("dotenv");
// dotenv.config({});

const REDIS_HOST = process.env.REDIS_HOST; // Your Upstash Redis hostname
const REDIS_PORT = process.env.REDIS_PORT; // Replace with your Upstash Redis port
const REDIS_PASSWORD = process.env.REDIS_PASSWORD; // Replace with your Upstash Redis password

// const REDIS_URL = `rediss://${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

// const redis = new Redis(REDIS_URL);

const PROJECT_ID = process.env.PROJECT_ID;
const DEPLOYEMENT_ID = process.env.DEPLOYEMENT_ID;

// Kafka env
const KAFKA_BROKER_URL = process.env.KAFKA_BROKER_URL;
const KAFKA_USER_NAME = process.env.KAFKA_USER_NAME;
const KAFKA_PASSWORD = process.env.KAFKA_PASSWORD;

// S3 Client Connection
const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID,
    secretAccessKey: process.env.AWS_SECRETACCESSKEY,
  },
});

// Kafka Producer
const kafka = new Kafka({
  clientId: `docker-build-server-${DEPLOYEMENT_ID}`,
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

// kafka producer
const producer = kafka.producer();

async function publishLog(log) {
  // *** Redis Publisher if we use redis
  // redis.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));

  // *** Kafka Producer
  await producer.send({
    topic: `container-logs`,
    messages: [
      {
        key: "log",
        value: JSON.stringify({ PROJECT_ID, DEPLOYEMENT_ID, log }),
      },
    ],
  });
}

async function uploadDirectory(directoryPath, baseKey = "") {
  const directoryContents = fs.readdirSync(directoryPath);

  for (const item of directoryContents) {
    const itemPath = path.join(directoryPath, item);
    const itemKey = path.join(baseKey, item).replace(/\\/g, "/");

    if (fs.lstatSync(itemPath).isDirectory()) {
      // Recursively upload subdirectory
      await uploadDirectory(itemPath, itemKey);
    } else {
      // Upload file
      console.log("Uploading", itemPath);
      await publishLog(`uploading ${itemPath}`);
      const command = new PutObjectCommand({
        Bucket: "vercel-clone-outputs.swarup",
        Key: `__outputs/${PROJECT_ID}/${itemKey}`,
        Body: fs.createReadStream(itemPath),
        ContentType: mime.lookup(itemPath),
      });

      await s3Client.send(command);
      console.log("Uploaded", itemPath);
      await publishLog(`uploaded ${itemPath}`);
    }
  }
}

async function init() {
  // kafka Producer Connect
  await producer.connect();

  console.log("Executing script.js");
  await publishLog("Build Started...");
  const outDirPath = path.join(__dirname, "output");

  // TODO => Add validation which command use to build
  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", async function (data) {
    console.log(data.toString());
    await publishLog(data.toString());
  });

  p.stderr.on("data", async function (data) {
    console.error("Error", data.toString());
    await publishLog(`error: ${data.toString()}`);
  });

  p.on("close", async function () {
    console.log("Build Complete");
    await publishLog(`Build Complete`);
    const distFolderPath = path.join(__dirname, "output", "dist");

    console.log(`Starting to upload`);
    await publishLog(`Starting to upload`);
    await uploadDirectory(distFolderPath);
    console.log("Done...");
    await publishLog(`Done`);

    process.exit(0);
  });
}

init();
