import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateTeacherReport,
} from "../lib/aggregate.mjs";
import {
  buildDynamoItem,
  buildLogEntry,
  collapseDuplicateStarts,
  correlateLegacyEvents,
  deriveEventId,
} from "../lib/normalize.mjs";
import { formatDateInTimezone, resolveReportRange } from "../lib/dates.mjs";

describe("normalize", () => {
  it("derives stable legacy event IDs", () => {
    const body = {
      teacherId: "TEST",
      studentId: "TEST__alice-1a2b",
      event: "task.succeeded",
      ts: "2026-08-01T01:00:00.000Z",
      levelNumber: 1,
      attemptNumber: 1,
      taskIndex: 0,
    };
    const a = deriveEventId(body, body.ts);
    const b = deriveEventId(body, body.ts);
    assert.equal(a, b);
    assert.match(a, /^legacy-/);
  });

  it("collapses duplicate level.started within 500ms", () => {
    const events = [
      {
        teacherId: "T",
        studentId: "S",
        event: "level.started",
        clientSentAt: "2026-08-01T01:00:00.000Z",
        levelNumber: 1,
        attemptNumber: 1,
      },
      {
        teacherId: "T",
        studentId: "S",
        event: "level.started",
        clientSentAt: "2026-08-01T01:00:00.200Z",
        levelNumber: 1,
        attemptNumber: 1,
      },
    ];
    const collapsed = collapseDuplicateStarts(events);
    assert.equal(collapsed.length, 1);
  });

  it("builds DynamoDB keys with UTC teacherDay", () => {
    const entry = buildLogEntry({
      teacherId: "VIJAY-HOME",
      studentId: "VIJAY-HOME__saanvi-abcd",
      event: "practice.session_started",
      clientSentAt: "2026-08-01T08:00:00.000Z",
      eventId: "evt-1",
    });
    const item = buildDynamoItem(entry);
    assert.equal(item.teacherDay, "VIJAY-HOME#2026-08-01");
    assert.match(item.eventKey, /^2026-08-01T08:00:00.000Z#/);
  });

  it("correlates legacy task and finish events to their level start", () => {
    const events = correlateLegacyEvents([
      { teacherId: "T", studentId: "S", event: "level.started", ts: "2026-08-01T01:00:00.000Z", levelNumber: 2, attemptNumber: 1, title: "Meet D", kind: "level" },
      { teacherId: "T", studentId: "S", event: "task.mistake", ts: "2026-08-01T01:00:01.000Z", expected: "D", got: "C" },
      { teacherId: "T", studentId: "S", event: "level.attempt_finished", ts: "2026-08-01T01:00:03.000Z", levelNumber: 2, attemptNumber: 1 },
    ]);
    assert.ok(events[0].attemptId);
    assert.equal(events[1].attemptId, events[0].attemptId);
    assert.equal(events[2].attemptId, events[0].attemptId);
    assert.equal(events[1].levelNumber, 2);
  });
});

describe("dates", () => {
  it("rejects ranges over 90 days", () => {
    assert.throws(() => resolveReportRange({ from: "2026-01-01", to: "2026-05-01" }));
  });

  it("formats timezone-local dates", () => {
    const day = formatDateInTimezone("2026-08-01T06:30:00.000Z", "America/Los_Angeles");
    assert.equal(day, "2026-07-31");
  });
});

describe("aggregate", () => {
  it("attributes mistakes to attempt context and aggregates session duration fallback", () => {
    const events = [
      {
        teacherId: "CLASS",
        studentId: "CLASS__student-1111",
        studentLabel: "Student",
        event: "practice.session_started",
        clientSentAt: "2026-08-02T16:00:00.000Z",
        sessionId: "sess-1",
      },
      {
        teacherId: "CLASS",
        studentId: "CLASS__student-1111",
        event: "level.started",
        clientSentAt: "2026-08-02T16:00:10.000Z",
        sessionId: "sess-1",
        attemptId: "att-1",
        levelNumber: 1,
        title: "Meet C",
        kind: "level",
        attemptNumber: 1,
        totalTasks: 3,
      },
      {
        teacherId: "CLASS",
        studentId: "CLASS__student-1111",
        event: "task.mistake",
        clientSentAt: "2026-08-02T16:00:12.000Z",
        sessionId: "sess-1",
        attemptId: "att-1",
        levelNumber: 1,
        attemptNumber: 1,
        expected: "C",
        got: "D",
      },
      {
        teacherId: "CLASS",
        studentId: "CLASS__student-1111",
        event: "level.attempt_finished",
        clientSentAt: "2026-08-02T16:01:00.000Z",
        sessionId: "sess-1",
        attemptId: "att-1",
        levelNumber: 1,
        attemptNumber: 1,
        outcome: "passed",
        clean: false,
        durationMs: 50_000,
        taskSuccesses: 3,
        taskMistakes: 1,
        totalTasks: 3,
        mistakesByExpected: { C: 1 },
        mistakesByWrongKey: { D: 1 },
      },
      {
        teacherId: "CLASS",
        studentId: "CLASS__student-1111",
        event: "practice.session_ended",
        clientSentAt: "2026-08-02T16:02:00.000Z",
        sessionId: "sess-1",
        durationMs: 120_000,
      },
    ];

    const report = aggregateTeacherReport({
      events,
      rosterByTeacher: new Map([
        [
          "CLASS",
          {
            teacherId: "CLASS",
            teacherName: "Teacher",
            students: [{ id: "student-1111", label: "Student" }],
          },
        ],
      ]),
      teacherIds: ["CLASS"],
      from: "2026-08-02",
      to: "2026-08-02",
      timezone: "UTC",
    });

    const student = report.teachers[0].students[0];
    const day = student.days[0];
    assert.equal(day.totalMistakes, 1);
    assert.equal(day.activeTimeMs, 120_000);
    assert.equal(day.levels[0].mistakes, 1);
    assert.equal(day.levels[0].mistakesByExpected.C, 1);
    assert.equal(day.levels[0].durationMs, 50_000);
  });

  it("aggregates public practice without inventing stable students", () => {
    const events = [
      {
        teacherId: "public",
        studentId: "device-1",
        event: "practice.session_started",
        clientSentAt: "2026-08-03T12:00:00.000Z",
        sessionId: "p1",
      },
      {
        teacherId: "public",
        studentId: "device-1",
        event: "practice.session_ended",
        clientSentAt: "2026-08-03T12:10:00.000Z",
        sessionId: "p1",
        durationMs: 600_000,
        legacy: true,
      },
    ];

    const report = aggregateTeacherReport({
      events,
      rosterByTeacher: new Map(),
      teacherIds: ["public"],
      from: "2026-08-03",
      to: "2026-08-03",
      timezone: "UTC",
    });

    assert.equal(report.public.days[0].activeTimeMs, 600_000);
    assert.equal(report.public.partialData, true);
    assert.equal(report.teachers[0].students.length, 0);
  });
});
