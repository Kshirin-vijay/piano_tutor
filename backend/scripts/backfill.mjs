#!/usr/bin/env node
import { createInterface } from "node:readline";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { ListObjectsV2Command, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { marshall } from "@aws-sdk/util-dynamodb";
import {
  buildDynamoItem,
  buildLogEntry,
  collapseDuplicateStarts,
  correlateLegacyEvents,
  parseS3JsonLine,
} from "../lib/normalize.mjs";

const s3 = new S3Client({});
const ddb = new DynamoDBClient({});

const BUCKET = process.env.LOG_BUCKET || "kshirinvijay-piano-logs";
const PREFIX = process.env.LOG_PREFIX || "raw/";
const EVENTS_TABLE = process.env.EVENTS_TABLE || "piano-friend-events";
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = Number(process.env.BACKFILL_LIMIT || 0);

const stats = {
  scanned: 0,
  parsed: 0,
  collapsed: 0,
  written: 0,
  skippedDuplicate: 0,
  failed: 0,
};

async function main() {
  console.log(`Backfill from s3://${BUCKET}/${PREFIX} -> ${EVENTS_TABLE}`);
  if (DRY_RUN) console.log("DRY RUN: no DynamoDB writes");

  let continuationToken;
  const batch = [];

  do {
    const listing = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: PREFIX,
        ContinuationToken: continuationToken,
      }),
    );

    for (const object of listing.Contents || []) {
      if (!object.Key?.endsWith(".json")) continue;
      stats.scanned += 1;
      const entries = await readS3Object(object.Key);
      batch.push(...entries);
      if (LIMIT > 0 && batch.length >= LIMIT) break;
    }

    continuationToken = listing.IsTruncated ? listing.NextContinuationToken : undefined;
    if (LIMIT > 0 && batch.length >= LIMIT) break;
  } while (continuationToken);

  const collapsed = collapseDuplicateStarts(batch);
  stats.collapsed = batch.length - collapsed.length;
  const correlated = correlateLegacyEvents(collapsed);

  for (const raw of correlated) {
    try {
      const logEntry = buildLogEntry(raw, new Date(raw.ts || raw.clientSentAt || Date.now()));
      const item = buildDynamoItem(logEntry);
      if (DRY_RUN) {
        stats.written += 1;
        continue;
      }
      await ddb.send(
        new PutItemCommand({
          TableName: EVENTS_TABLE,
          Item: marshall(item, { removeUndefinedValues: true }),
          ConditionExpression: "attribute_not_exists(eventKey)",
        }),
      );
      stats.written += 1;
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        stats.skippedDuplicate += 1;
        continue;
      }
      stats.failed += 1;
      console.error("Failed to write event:", err.message);
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  if (stats.failed > 0) process.exitCode = 1;
}

async function readS3Object(key) {
  const response = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  );
  const entries = [];
  const rl = createInterface({ input: response.Body });
  for await (const line of rl) {
    const parsed = parseS3JsonLine(line);
    if (!parsed) continue;
    stats.parsed += 1;
    entries.push(parsed);
  }
  return entries;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
