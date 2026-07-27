/**
 * Append one JSON line to a daily log file. Production uses Vercel Blob;
 * local dev without BLOB_READ_WRITE_TOKEN writes to logs/ on disk.
 * One file per teacher + student per day avoids cross-student write races.
 */

import { get, put } from "@vercel/blob";
import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";

export interface LogEntry {
  ts: string;
  teacherId: string;
  studentId: string;
  studentLabel?: string;
  event: string;
  [key: string]: unknown;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function fileName(
  teacherId: string,
  studentId: string,
  date = todayUtc()
): string {
  return `usage-${date}-${teacherId}-${studentId}.jsonl`;
}

function blobPathname(teacherId: string, studentId: string): string {
  return `logs/${fileName(teacherId, studentId)}`;
}

function hasBlobConfig(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function appendLocalFile(
  teacherId: string,
  studentId: string,
  line: string
): Promise<void> {
  const dir = path.join(process.cwd(), "logs");
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName(teacherId, studentId));
  await appendFile(filePath, line, "utf8");
}

async function readBlobText(
  pathname: string,
  token: string
): Promise<string | null> {
  // Private blobs require authenticated get(); a plain fetch(url) returns 401
  // and used to make every write overwrite the file with a single line.
  // useCache: false so rapid sequential appends see the latest put.
  const result = await get(pathname, {
    access: "private",
    token,
    useCache: false,
  });
  if (!result?.stream) return null;

  return new Response(result.stream).text();
}

async function appendBlobFile(
  teacherId: string,
  studentId: string,
  line: string
): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("BLOB_READ_WRITE_TOKEN is not set");

  const pathname = blobPathname(teacherId, studentId);
  let content = line;

  try {
    const previous = await readBlobText(pathname, token);
    if (previous !== null && previous.length > 0) {
      content = previous.endsWith("\n")
        ? previous + line
        : `${previous}\n${line}`;
    }
  } catch {
    /* first write for this pathname, or transient read failure */
  }

  await put(pathname, content, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/x-ndjson",
    token,
  });
}

/** Append a log entry as one JSONL line. */
export async function appendUsageLog(entry: LogEntry): Promise<void> {
  const line = `${JSON.stringify(entry)}\n`;

  if (hasBlobConfig()) {
    await appendBlobFile(entry.teacherId, entry.studentId, line);
    return;
  }

  await appendLocalFile(entry.teacherId, entry.studentId, line);
}
