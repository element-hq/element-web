/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type TestCase, type TestResult } from "@playwright/test/reporter";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import FlakyReporter from "./flaky-reporter.js";

const API = "https://api.example.test";
const ISSUES = `${API}/repos/element-hq/element-web/issues`;
const ROOT = "/home/runner/work/element-web/element-web/apps/web/playwright/e2e";

function flakyTest(project: string, file: string, title: string, results: Partial<TestResult>[] = []): TestCase {
    return {
        title,
        outcome: () => "flaky",
        location: { file: `${ROOT}/${file}`, line: 10, column: 5 },
        parent: { project: () => ({ name: project }) },
        results,
    } as unknown as TestCase;
}

interface FakeGitHub {
    existingIssues?: object[];
    commits?: object[];
    members?: string[];
    membershipStatus?: number;
    createStatus?: number;
    /** How the assignees call behaves: GitHub accepts it, silently drops the assignee, rejects it, or the request throws */
    assign?: "ok" | "dropped" | "rejected" | "throws";
}

describe("FlakyReporter", () => {
    let writes: { method: string; url: string; body: any }[];
    let reads: string[];

    function stubGitHub({
        existingIssues = [],
        commits = [],
        members = [],
        membershipStatus = 200,
        createStatus = 201,
        assign = "ok",
    }: FakeGitHub) {
        vi.stubGlobal(
            "fetch",
            vi.fn(async (input: string | URL, init?: RequestInit) => {
                const url = input.toString();
                const method = init?.method ?? "GET";
                if (method !== "GET") {
                    const body = JSON.parse(init!.body as string);
                    writes.push({ method, url, body });
                    if (url === ISSUES) {
                        if (createStatus !== 201) return new Response(null, { status: createStatus });
                        return Response.json(
                            { number: 99, url: `${ISSUES}/99`, html_url: "https://github.com/i/99" },
                            { status: 201 },
                        );
                    }
                    if (url.endsWith("/assignees")) {
                        if (assign === "throws") throw new TypeError("fetch failed");
                        if (assign === "rejected") return new Response(null, { status: 422 });
                        const assignees =
                            assign === "dropped" ? [] : body.assignees.map((login: string) => ({ login }));
                        return Response.json({ assignees }, { status: 201 });
                    }
                    return Response.json({});
                }
                reads.push(url);
                const { pathname } = new URL(url);
                if (pathname === "/repos/element-hq/element-web/issues") return Response.json(existingIssues);
                if (pathname === "/repos/element-hq/element-web/commits") return Response.json(commits);
                const member = pathname.match(
                    /^\/orgs\/element-hq\/teams\/element-web-contributors\/memberships\/(.+)$/,
                );
                if (member) {
                    if (membershipStatus !== 200) return new Response(null, { status: membershipStatus });
                    return members.includes(member[1])
                        ? Response.json({ state: "active" })
                        : new Response(null, { status: 404 });
                }
                throw new Error(`Unexpected request ${method} ${url}`);
            }),
        );
    }

    beforeEach(() => {
        writes = [];
        reads = [];
        vi.stubEnv("GITHUB_TOKEN", "tok");
        vi.stubEnv("GITHUB_API_URL", API);
        vi.stubEnv("GITHUB_SERVER_URL", "https://github.com");
        vi.stubEnv("GITHUB_REPOSITORY", "element-hq/element-web");
        vi.stubEnv("GITHUB_RUN_ID", "123");
        vi.stubEnv("GITHUB_SHA", "deadbeef");
        vi.stubEnv("GITHUB_EVENT_NAME", "push");
        vi.spyOn(console, "log").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("assigns a new flake to the last team member to change the test file", async () => {
        stubGitHub({
            commits: [
                { html_url: "https://github.com/c/1", author: { login: "renovate[bot]", type: "Bot" } },
                { html_url: "https://github.com/c/2", author: { login: "alice", type: "User" } },
            ],
            members: ["alice"],
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "editing/editing.spec.ts", "should edit"));
        reporter.onTestEnd(flakyTest("Firefox", "editing/editing.spec.ts", "should edit"));
        await reporter.onExit();

        const commitsUrl = new URL(reads.find((u) => u.includes("/commits"))!);
        expect(commitsUrl.searchParams.get("path")).toBe("apps/web/playwright/e2e/editing/editing.spec.ts");
        expect(commitsUrl.searchParams.get("sha")).toBe("deadbeef");

        expect(writes).toEqual([
            {
                method: "POST",
                url: ISSUES,
                body: {
                    title: "Flaky playwright test: `editing/editing.spec.ts: should edit`",
                    body:
                        "https://github.com/element-hq/element-web/actions/runs/123\n\n" +
                        "Assigned to alice, who last changed " +
                        "`apps/web/playwright/e2e/editing/editing.spec.ts` (https://github.com/c/2).",
                    labels: ["Z-Flaky-Test", "Z-Flaky-Test-Chrome", "Z-Flaky-Test-Firefox"],
                },
            },
            { method: "POST", url: `${ISSUES}/99/assignees`, body: { assignees: ["alice"] } },
        ]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("only comments on an existing issue, without looking up or changing the assignee", async () => {
        const title = "Flaky playwright test: `editing/editing.spec.ts: should edit`";
        stubGitHub({ existingIssues: [{ number: 5, title, url: `${ISSUES}/5` }], members: ["alice"] });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "editing/editing.spec.ts", "should edit"));
        await reporter.onExit();

        expect(reads.some((u) => u.includes("/commits") || u.includes("/memberships/"))).toBe(false);
        expect(writes.map(({ method, url }) => `${method} ${url}`)).toEqual([
            `PATCH ${ISSUES}/5`,
            `POST ${ISSUES}/5/labels`,
            `POST ${ISSUES}/5/comments`,
        ]);
    });

    it("skips commits listed in .git-blame-ignore-revs at the repository root", async () => {
        const root = await mkdtemp(path.join(tmpdir(), "ignore-revs-"));
        try {
            await writeFile(path.join(root, ".git-blame-ignore-revs"), "# mass reformat\nsweep1\n");
            vi.spyOn(process, "cwd").mockReturnValue(root);
            stubGitHub({
                commits: [
                    { sha: "sweep1", html_url: "https://github.com/c/sweep", author: { login: "bob", type: "User" } },
                    { sha: "real2", html_url: "https://github.com/c/real", author: { login: "alice", type: "User" } },
                ],
                members: ["alice", "bob"],
            });
            const reporter = new FlakyReporter();
            reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "t"));
            await reporter.onExit();

            expect(writes.at(-1)).toEqual({
                method: "POST",
                url: `${ISSUES}/99/assignees`,
                body: { assignees: ["alice"] },
            });
        } finally {
            await rm(root, { recursive: true });
        }
    });

    it("files the issue unassigned when nobody qualifies", async () => {
        stubGitHub({ commits: [{ html_url: "c", author: { login: "outsider", type: "User" } }] });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "t"));
        await reporter.onExit();

        expect(writes).toHaveLength(1);
        expect(writes[0].url).toBe(ISSUES);
        expect(writes[0].body.body).not.toContain("Assigned to");
    });

    it("still files the issue when the assignee lookup fails", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            membershipStatus: 403,
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "t"));
        await reporter.onExit();

        expect(writes.map(({ url }) => url)).toEqual([ISSUES]);
        expect(console.error).toHaveBeenCalledWith(
            "Could not pick an assignee for apps/web/playwright/e2e/a.spec.ts:",
            expect.any(Error),
        );
    });

    it("does not assign when creating the issue fails", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
            createStatus: 500,
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "t"));
        await reporter.onExit();

        expect(writes.map(({ url }) => url)).toEqual([ISSUES]);
        expect(console.error).not.toHaveBeenCalled();
    });

    it("keeps reporting later flakes when assigning one throws", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
            assign: "throws",
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "first"));
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "second"));
        await reporter.onExit();

        expect(writes.map(({ url }) => url)).toEqual([
            ISSUES,
            `${ISSUES}/99/assignees`,
            ISSUES,
            `${ISSUES}/99/assignees`,
        ]);
        expect(console.error).toHaveBeenCalledWith("Could not assign the new issue:", expect.any(TypeError));
    });

    it.each([
        ["rejected", "Assigning https://github.com/i/99 failed: HTTP 422"],
        ["dropped", "GitHub dropped the assignee of https://github.com/i/99; they may lack access to the repository"],
    ] as const)("logs when GitHub has %s the assignee", async (assign, message) => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
            assign,
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Chrome", "a.spec.ts", "t"));
        await reporter.onExit();

        expect(console.error).toHaveBeenCalledWith(message);
    });

    it("looks up Desktop flakes in apps/desktop, although the merged report places them under apps/web", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("Desktop", "launch/launch.spec.ts", "launches"));
        await reporter.onExit();

        const commitsUrl = new URL(reads.find((u) => u.includes("/commits?"))!);
        expect(commitsUrl.searchParams.get("path")).toBe("apps/desktop/playwright/e2e/launch/launch.spec.ts");
        expect(writes.map(({ url }) => url)).toEqual([ISSUES, `${ISSUES}/99/assignees`]);
        expect(writes[0].body.title).toBe("Flaky playwright test: `launch/launch.spec.ts: launches`");
    });

    it("does not assign module flakes, whose project names do not map to a directory", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(flakyTest("widget-toggle", "widget-toggles.spec.ts", "toggles"));
        await reporter.onExit();

        expect(reads.some((u) => u.includes("/commits"))).toBe(false);
        expect(writes.map(({ url }) => url)).toEqual([ISSUES]);
    });

    it("does not assign systemic flakes that are not attributable to one test", async () => {
        stubGitHub({
            commits: [{ html_url: "c", author: { login: "alice", type: "User" } }],
            members: ["alice"],
        });
        const reporter = new FlakyReporter();
        reporter.onTestEnd(
            flakyTest("Chrome", "a.spec.ts", "t", [
                {
                    status: "timedOut",
                    attachments: [{ name: "page-1", contentType: "text/plain", body: Buffer.from("ChunkLoadError") }],
                },
            ]),
        );
        await reporter.onExit();

        expect(reads.some((u) => u.includes("/commits"))).toBe(false);
        expect(writes).toHaveLength(1);
        expect(writes[0].body.title).toBe("Flaky playwright test: `ChunkLoadError`");
    });
});
