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
function isStaticProject(directoryPath) {
  // Define non-static indicators
  const nonStaticFiles = [
    "package.json",
    "webpack.config.js",
    "next.config.js",
  ];
  const nonStaticDependencies = [
    "react",
    "next",
    "vue",
    "angular",
    "@nestjs/core",
  ];

  // Check if any non-static indicator files are present
  const files = fs.readdirSync(directoryPath);
  const hasNonStaticFile = files.some((file) => nonStaticFiles.includes(file));

  if (hasNonStaticFile) {
    return false; // If any non-static indicator file is found, it's not a static project
  }

  // Check for dependencies in package.json if it exists
  const packageJsonPath = path.join(directoryPath, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    // If any non-static dependency is found, it's not a static project
    const hasNonStaticDependency = nonStaticDependencies.some(
      (dep) => dep in dependencies
    );
    if (hasNonStaticDependency) {
      return false;
    }
  }

  // If no non-static indicators are found, it's a static project
  return true;
}

// Function to check if a project is React or Next.js
async function isReactOrNextProject() {
  const packageJsonPath = path.join(__dirname, "output", "package.json");
  if (fs.existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };
    return dependencies.react || dependencies.next;
  }
  return false;
}
const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
function shouldSkip(item) {
  // Define patterns for files and folders that should be skipped
  const skipPatterns = [
    /^\.git/, // Folders starting with .git
    /^\.github/, // Folders starting with .github
    /^node_modules/, // Folders starting with node_modules
    /^\.env/, // Files starting with .env
    /^Dockerfile/, // Files named Dockerfile
    /^\.dockerignore/, // Files named .dockerignore
    /^\.gitignore/, // Files named .gitignore
    /^README\.md$/, // Files ending with README.md
    /^LICENSE$/, // Files ending with LICENSE
    /^\..*/, // Any file or folder starting with a dot (hidden files/folders)
    /.*~$/, // Any file ending with a tilde (~), common for backup files
    /.*\.log$/, // Any file ending with .log (log files)
    /.*\.tmp$/, // Any file ending with .tmp (temporary files)
    /.*\.bak$/, // Any file ending with .bak (backup files)
    /.*\.swp$/, // Any file ending with .swp (swap files)
  ];

  // Check if the item matches any of the skip patterns
  return skipPatterns.some((pattern) => pattern.test(item));
}
// Upload file with the Directory
async function uploadDirectory(directoryPath, baseKey = "") {
  const directoryContents = fs.readdirSync(directoryPath);

  for (const item of directoryContents) {
    const itemPath = path.join(directoryPath, item);
    const itemKey = path.join(baseKey, item).replace(/\\/g, "/");

    const stats = fs.lstatSync(itemPath);

    // Skip files or folders that are not required to be uploaded
    if (shouldSkip(item)) {
      console.log(`Skipping ${itemPath} (Non-required file/folder)`);
      // await publishLog(`Skipping ${itemPath} (Non-required file/folder)`);
      continue;
    }

    if (stats.isDirectory()) {
      // Recursively upload subdirectory
      await uploadDirectory(itemPath, itemKey);
    } else {
      if (stats.size > MAX_FILE_SIZE_BYTES) {
        console.log(`Skipping ${itemPath} (File size exceeds 5 MB)`);
        await publishLog(`Skipping ${itemPath} (File size exceeds 5 MB)`);
        continue;
      }

      // Proceed with the upload if the file size is within the limit
      console.log("Uploading", itemPath);
      await publishLog(`Uploading ${itemPath}`);
      const command = new PutObjectCommand({
        Bucket: "vercel-clone-outputs.swarup",
        Key: `__outputs/${PROJECT_ID}/${itemKey}`,
        Body: fs.createReadStream(itemPath),
        ContentType: mime.lookup(itemPath) || "application/octet-stream",
      });

      await s3Client.send(command);
      console.log("Uploaded", itemPath);
      await publishLog(`Uploaded ${itemPath}`);
    }
  }
}
// Function to identify project type and return relevant build directory and command
async function getBuildInfo() {
  const packageJsonPath = path.join(__dirname, "output", "package.json");

  if (!fs.existsSync(packageJsonPath)) {
    return null;
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  const dependencies = {
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
  };

  // Default build info (for static files)
  let buildDir = "dist";
  let buildCommand = "npm run build";

  if (dependencies.next) {
    buildDir = "out"; // Default for Next.js is "out"
    buildCommand = "npm run build";
  } else if (dependencies.vue) {
    buildDir = "dist"; // Default for Vue.js is "dist"
    buildCommand = "npm run build";
  } else if (dependencies.angular) {
    buildDir = "dist"; // Default for Angular is "dist/{project-name}"
    buildCommand = "npm run build";
  } else if (dependencies["@nestjs/core"]) {
    buildDir = "dist"; // Default for NestJS is "dist"
    buildCommand = "npm run build";
  } else {
    console.warn(
      "Unrecognized project type. Using default build configuration."
    );
    await publishLog(
      `Unrecognized project type. Using default build configuration.`
    );
  }

  return { buildDir, buildCommand };
}

async function init() {
  try {
    // Kafka Producer Connect
    await producer.connect();

    console.log("Executing script.js");
    await publishLog("Build Started...");
    const outDirPath = path.join(__dirname, "output");

    const files = fs.readdirSync(outDirPath);

    // Check if it's a static site
    const onlyStaticFiles = await isStaticProject(outDirPath);

    const buildInfo = await getBuildInfo();
    console.log(onlyStaticFiles);

    if (onlyStaticFiles) {
      console.log(`Starting to  upload`);
      await publishLog(`Starting to upload`);

      // Upload all files directly from the output directory
      await uploadDirectory(outDirPath);

      console.log("Done...");
      await publishLog("Done");

      process.exit(0);
      return;
    } else if (isReactOrNextProject()) {
      const p = exec(
        `cd ${outDirPath} && npm install && ${buildInfo.buildCommand}`
      );
      console.log(
        "Buidl command is " +
          `${outDirPath} && npm install && ${buildInfo.buildCommand}`
      );

      p.stdout.on("data", async function (data) {
        console.log(data.toString());
        await publishLog(data.toString());
      });

      p.stderr.on("data", async function (data) {
        console.error("Error", data.toString());
        await publishLog(`Error: ${data.toString()}`);
      });

      p.on("close", async function (code) {
        if (code === 0) {
          console.log("Build Complete");
          await publishLog("Build Complete");
          const distFolderPath = path.join(outDirPath, buildInfo.buildDir);

          if (fs.existsSync(distFolderPath)) {
            console.log(`Starting to upload`);
            await publishLog("Starting to upload");
            await uploadDirectory(distFolderPath);
            console.log("Done...");
            await publishLog("Done");
          } else {
            console.error("Dist folder not found");
            await publishLog("Dist folder not found");
          }
        } else {
          console.error(`Build failed with exit code ${code}`);
          await publishLog(`Build failed with exit code ${code}`);
        }

        process.exit(0);
      });
    } else {
      console.log(
        "Non-static and non-React/Next.js project detected, handle accordingly."
      );

      await publishLog(
        "Sorry, we can't upload this project. Non-static and non-React/Next.js project detected."
      );
      process.exit(0);
    }
  } catch (error) {
    console.error("Unexpected error", error);
    await publishLog(`Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

init();
