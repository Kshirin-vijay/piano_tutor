import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import { buildDynamoItem, buildLogEntry, s3ObjectKeyForEntry } from "../../lib/normalize.mjs";
import { jsonResponse } from "../../lib/response.mjs";

const s3 = new S3Client({ region: process.env.AWS_REGION || "us-east-1" });
const ddb = new DynamoDBClient({});

const BUCKET = process.env.LOG_BUCKET || "kshirinvijay-piano-logs";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "piano-friend-events";
const MAX_BODY_BYTES = 8192;
const DUAL_WRITE_ENABLED = process.env.DUAL_WRITE_ENABLED !== "false";

export async function handler(event) {
  try {
    const rawBody = event.isBase64Encoded
      ? Buffer.from(event.body || "", "base64").toString("utf8")
      : event.body || "";

    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: "Payload too large." });
    }

    const body = JSON.parse(rawBody || "{}");
    const teacherId = String(body.teacherId || "").trim();
    const studentId = String(body.studentId || "").trim();
    const eventName = String(body.event || "").trim();

    if (!teacherId || !studentId || !eventName) {
      return jsonResponse(400, {
        error: "Missing teacherId, studentId, or event.",
      });
    }

    const receivedAt = new Date();
    const logEntry = buildLogEntry(body, receivedAt);
    const key = s3ObjectKeyForEntry(logEntry, receivedAt);

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: `${JSON.stringify(logEntry)}\n`,
        ContentType: "application/json",
      }),
    );

    if (DUAL_WRITE_ENABLED) {
      await writeNormalizedEvent(logEntry);
    }

    return jsonResponse(200, { ok: true });
  } catch (err) {
    console.error("Log handler error:", err);
    return jsonResponse(500, { error: "Internal error" });
  }
}

async function writeNormalizedEvent(logEntry) {
  const item = buildDynamoItem(logEntry);
  try {
    await ddb.send(
      new PutItemCommand({
        TableName: EVENTS_TABLE,
        Item: marshall(item, { removeUndefinedValues: true }),
        ConditionExpression: "attribute_not_exists(eventKey)",
      }),
    );
  } catch (err) {
    if (err.name === "ConditionalCheckFailedException") {
      return;
    }
    console.error("DynamoDB dual-write failed:", err);
    throw err;
  }
}
