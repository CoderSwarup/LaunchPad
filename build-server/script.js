const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const mime = require("mime-types");
const Redis = require("ioredis");
// const dotenv = require("dotenv");
// dotenv.config({});

const REDIS_HOST = process.env.REDIS_HOST; // Your Upstash Redis hostname
const REDIS_PORT = process.env.REDIS_PORT; // Replace with your Upstash Redis port
const REDIS_PASSWORD = process.env.REDIS_PASSWORD; // Replace with your Upstash Redis password

const REDIS_URL = `rediss://${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`;

const redis = new Redis(REDIS_URL);

const PROJECT_ID = process.env.PROJECT_ID;

const s3Client = new S3Client({
  region: "ap-south-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESSKEYID,
    secretAccessKey: process.env.AWS_SECRETACCESSKEY,
  },
});

function publishLog(log) {
  redis.publish(`logs:${PROJECT_ID}`, JSON.stringify({ log }));
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
      publishLog(`uploading ${itemPath}`);
      const command = new PutObjectCommand({
        Bucket: "vercel-clone-outputs.swarup",
        Key: `__outputs/${PROJECT_ID}/${itemKey}`,
        Body: fs.createReadStream(itemPath),
        ContentType: mime.lookup(itemPath),
      });

      await s3Client.send(command);
      console.log("Uploaded", itemPath);
      publishLog(`uploaded ${itemPath}`);
    }
  }
}

async function init() {
  console.log("Executing script.js");
  publishLog("Build Started...");
  const outDirPath = path.join(__dirname, "output");

  const p = exec(`cd ${outDirPath} && npm install && npm run build`);

  p.stdout.on("data", function (data) {
    console.log(data.toString());
    publishLog(data.toString());
  });

  p.stderr.on("data", function (data) {
    console.error("Error", data.toString());
    publishLog(`error: ${data.toString()}`);
  });

  p.on("close", async function () {
    console.log("Build Complete");
    publishLog(`Build Complete`);
    const distFolderPath = path.join(__dirname, "output", "dist");

    console.log(`Starting to upload`);
    publishLog(`Starting to upload`);
    await uploadDirectory(distFolderPath);
    console.log("Done...");
    publishLog(`Done`);

    process.exit(0);
  });
}

init();
