#!/usr/bin/env node
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { CloudFrontClient, CreateInvalidationCommand } = require("@aws-sdk/client-cloudfront");
const fs = require("fs");
const path = require("path");

const s3 = new S3Client({ region: process.env.AWS_REGION || "eu-central-1" });
const cloudfront = new CloudFrontClient({ region: process.env.AWS_REGION || "eu-central-1" });

const BUCKET = process.env.ZAKAI_PACKS_BUCKET || "packs.zakai.io";
const DISTRIBUTION_ID = process.env.CLOUDFRONT_DISTRIBUTION_ID;

function walk(dir, files = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, files);
    else files.push(p);
  }
  return files;
}

async function uploadFile(localPath, s3Key) {
  const body = fs.readFileSync(localPath);
  const contentType = localPath.endsWith(".json") ? "application/json" : "text/plain";

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: contentType,
      CacheControl: "public, max-age=300",
    }),
  );

  console.log(`📤 ${localPath} → s3://${BUCKET}/${s3Key}`);
}

async function publish() {
  if (!process.env.ZAKAI_PACKS_BUCKET && process.env.CI !== "true") {
    console.log("ZAKAI_PACKS_BUCKET not set — dry run listing files only.");
    walk("packs").forEach((f) => console.log("would upload", f));
    return;
  }

  await uploadFile("schema/zakai-rights-schema.json", "schema/zakai-rights-schema.json");

  for (const file of walk("packs")) {
    const s3Key = file.replace(/^packs\//, "");
    await uploadFile(file, s3Key);
  }

  await uploadFile("maintainers/_registry.json", "maintainers/_registry.json");

  if (DISTRIBUTION_ID) {
    await cloudfront.send(
      new CreateInvalidationCommand({
        DistributionId: DISTRIBUTION_ID,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: { Quantity: 1, Items: ["/*"] },
        },
      }),
    );
    console.log("🔄 CloudFront cache invalidated");
  }

  console.log("✅ Publish complete");
}

publish().catch((err) => {
  console.error(err);
  process.exit(1);
});
