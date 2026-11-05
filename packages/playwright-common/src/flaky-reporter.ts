/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Flaky test reporter, creating & updating GitHub issues
 * Only intended to run from within GitHub Actions
 */

import type { Reporter, TestCase } from "@playwright/test/reporter";
import { readFileSync } from "node:fs";
import path from "node:path";

import { type FlakyAssignee, FlakyAssigneeFinder, parseIgnoreRevs } from "./flaky-assignee-finder.js";

const REPO = "element-hq/element-web";
const LABEL = "Z-Flaky-Test";
const ISSUE_TITLE_PREFIX = "Flaky playwright test: ";

// New flake issues are assigned to the last member of this team to change the test file
const ASSIGNEE_ORG = "element-hq";
const ASSIGNEE_TEAM = "element-web-contributors";

// Mechanical commits (mass reformatting and the like) whose author shouldn't become a test's owner.
// Read from the repository root, where the merge job runs.
const IGNORE_REVS_FILE = ".git-blame-ignore-revs";

function readIgnoredCommits(): Set<string> {
    try {
        return parseIgnoreRevs(readFileSync(path.resolve(process.cwd(), IGNORE_REVS_FILE), "utf8"));
    } catch (e) {
        // No file just means nothing to ignore
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") {
            console.error(`Could not read ${IGNORE_REVS_FILE}, not skipping any commits:`, e);
        }
        return new Set();
    }
}

// The merged report resolves every test path against apps/web's testDir (see playwright-merge.config.ts),
// even for Desktop and module tests, but the part after "playwright/e2e/" is still relative to the test's
// own project. This maps each project back to where its tests actually live, for the commit history lookup.
// Module projects are named after their packages, which don't reliably match their directories
// (widget-toggles is "widget-toggle"), so module flakes are filed unassigned.
const PROJECT_TEST_DIRS = new Map([
    ["Chrome", "apps/web/playwright/e2e/"],
    ["Firefox", "apps/web/playwright/e2e/"],
    ["WebKit", "apps/web/playwright/e2e/"],
    ["Desktop", "apps/desktop/playwright/e2e/"],
]);

interface Flake {
    tests: TestCase[];
    /** Repository-relative path of the test file, when the flake is attributable to a single web or Desktop test. */
    path?: string;
}

type PaginationLinks = {
    prev?: string;
    next?: string;
    last?: string;
    first?: string;
};

// oxlint-disable-next-line no-control-regex
const ANSI_COLOUR_REGEX = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

// We see quite a few test flakes which are caused by the app exploding
// so we have some magic strings we check the logs for to better track the flake with its cause
const SPECIAL_CASES: Record<string, string> = {
    "ChunkLoadError": "ChunkLoadError",
    "Unreachable code should not be executed": "Rust crypto panic",
    "Out of bounds memory access": "Rust crypto memory error",
};

class FlakyReporter implements Reporter {
    private flakes = new Map<string, Flake>();

    public onTestEnd(test: TestCase): void {
        // Ignores flakes on Dendrite and Pinecone as they have their own flakes we do not track
        if (["Dendrite", "Pinecone"].includes(test.parent.project()!.name)) return;

        if (test.outcome() === "flaky") {
            const failures: string[] = [];

            const timedOutRuns = test.results.filter((result) => result.status === "timedOut");
            const pageLogs = timedOutRuns.flatMap((result) =>
                result.attachments.filter((attachment) => attachment.name.startsWith("page-")),
            );

            // If a test failed due to a systemic fault then the test is not flaky, the app is, record it as such.
            const specialCases = Object.keys(SPECIAL_CASES).filter((log) =>
                pageLogs.some((attachment) => attachment.name.startsWith("page-") && attachment.body?.includes(log)),
            );
            if (specialCases.length > 0) {
                failures.push(...specialCases.map((specialCase) => SPECIAL_CASES[specialCase]));
            }

            // Check for fixtures failing to set up
            const errorMessages = timedOutRuns
                .map((r) => r.error?.message?.replace(ANSI_COLOUR_REGEX, ""))
                .filter(Boolean) as string[];
            for (const error of errorMessages) {
                if (error.startsWith("Fixture") && error.endsWith("exceeded during setup.")) {
                    failures.push(error);
                }
            }

            // Only a flake that is attributable to the test itself has an owner worth assigning
            let path: string | undefined;
            if (failures.length < 1) {
                const relativePath = test.location.file.split("playwright/e2e/")[1];
                failures.push(`${relativePath}: ${test.title}`);
                const testDir = PROJECT_TEST_DIRS.get(test.parent.project()!.name);
                if (testDir) path = testDir + relativePath;
            }

            for (const title of failures) {
                if (!this.flakes.has(title)) {
                    this.flakes.set(title, { tests: [] });
                }
                const flake = this.flakes.get(title)!;
                flake.tests.push(test);
                flake.path ??= path;
            }
        }
    }

    /**
     * Parse link header to retrieve pagination links
     * @see https://docs.github.com/en/rest/using-the-rest-api/using-pagination-in-the-rest-api?apiVersion=2022-11-28#using-link-headers
     * @param link link header from response or undefined
     * @returns an empty object if link is undefined otherwise returns a map from type to link
     */
    private parseLinkHeader(link: string): PaginationLinks {
        /**
         * link looks like:
         * <https://api.github.com/repositories/1300192/issues?page=2>; rel="prev", <https://api.github.com/repositories/1300192/issues?page=4>;
         */
        const map: PaginationLinks = {};
        if (!link) return map;
        const matches = link.matchAll(/(<(?<link>.+?)>; rel="(?<type>.+?)")/g);
        for (const match of matches) {
            const { link, type } = match.groups!;
            map[type as keyof PaginationLinks] = link;
        }
        return map;
    }

    /**
     * Fetch all flaky test issues that were updated since Jan-1-2024
     * @returns A promise that resolves to a list of issues
     */
    async getAllIssues(): Promise<any[]> {
        const issues = [];
        const { GITHUB_TOKEN, GITHUB_API_URL } = process.env;
        // See https://docs.github.com/en/rest/issues/issues?apiVersion=2022-11-28#list-repository-issues
        let url = `${GITHUB_API_URL}/repos/${REPO}/issues?labels=${LABEL}&state=all&per_page=100&sort=updated&since=2024-01-01`;
        const headers = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: "application / vnd.github + json",
        };
        while (url) {
            // Fetch issues and add to list
            const issuesResponse = await fetch(url, { headers });
            const fetchedIssues = await issuesResponse.json();
            issues.push(...fetchedIssues);

            // Get the next link for fetching more results
            const linkHeader = issuesResponse.headers.get("Link")!;
            const parsed = this.parseLinkHeader(linkHeader);
            url = parsed.next!;
        }
        return issues;
    }

    /**
     * Find who to assign a new flake issue to. Never throws: a failure here must not stop the issue being filed.
     */
    private async findAssignee(finder: FlakyAssigneeFinder, path: string): Promise<FlakyAssignee | undefined> {
        try {
            const assignee = await finder.find(path, process.env.GITHUB_SHA);
            if (!assignee) console.log(`No ${ASSIGNEE_TEAM} member found in recent history of ${path}`);
            return assignee;
        } catch (e) {
            console.error(`Could not pick an assignee for ${path}:`, e);
            return undefined;
        }
    }

    /**
     * Assign a newly created issue. Never throws: a failure here must not stop later flakes being reported.
     * Logs leave out the login, as the run's logs are public and would imply who is in the team.
     * @param created - the response to the issue creation request
     */
    private async assign(created: Response, login: string, headers: Record<string, string>): Promise<void> {
        try {
            const issue = await created.json();
            const response = await fetch(`${issue.url}/assignees`, {
                method: "POST",
                headers,
                body: JSON.stringify({ assignees: [login] }),
            });
            if (!response.ok) {
                console.error(`Assigning ${issue.html_url} failed: HTTP ${response.status}`);
                return;
            }
            // GitHub drops an assignee it can't assign, such as someone without access, rather than failing
            const { assignees } = (await response.json()) as { assignees: { login: string }[] };
            if (!assignees.some((assignee) => assignee.login === login)) {
                console.error(
                    `GitHub dropped the assignee of ${issue.html_url}; they may lack access to the repository`,
                );
            }
        } catch (e) {
            console.error("Could not assign the new issue:", e);
        }
    }

    public async onExit(): Promise<void> {
        if (this.flakes.size === 0) {
            console.log("No flakes found");
            return;
        }

        console.log("Found flakes: ");
        for (const flake of this.flakes) {
            console.log(flake);
        }

        const { GITHUB_TOKEN, GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_EVENT_NAME } =
            process.env;
        if (!GITHUB_TOKEN) return;

        const finder = new FlakyAssigneeFinder({
            apiUrl: GITHUB_API_URL!,
            token: GITHUB_TOKEN,
            repo: REPO,
            org: ASSIGNEE_ORG,
            team: ASSIGNEE_TEAM,
            ignoredCommits: readIgnoredCommits(),
        });

        const issues = await this.getAllIssues();
        for (const [flake, { tests, path }] of this.flakes) {
            const title = ISSUE_TITLE_PREFIX + "`" + flake + "`";
            const existingIssue = issues.find((issue) => issue.title === title);
            const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
            let body = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

            if (GITHUB_EVENT_NAME === "merge_group") {
                body += " (merge queue run, may be a false positive)";
            }

            const labels = [LABEL, ...tests.map((test) => `${LABEL}-${test.parent.project()?.name}`)];

            if (existingIssue) {
                console.log(`Found issue ${existingIssue.number} for ${flake}, adding comment...`);
                // Ensure that the issue is open
                await fetch(existingIssue.url, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ state: "open" }),
                });
                await fetch(`${existingIssue.url}/labels`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ labels }),
                });
                await fetch(`${existingIssue.url}/comments`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({ body }),
                });
            } else {
                console.log(`Creating new issue for ${flake}...`);
                const assignee = path ? await this.findAssignee(finder, path) : undefined;
                if (assignee) {
                    // No @-mention: being assigned already notifies them. The team isn't named, as the issue is
                    // public and team membership is not.
                    body += `\n\nAssigned to ${assignee.login}, who last changed \`${path}\` (${assignee.commitUrl}).`;
                }

                const response = await fetch(`${GITHUB_API_URL}/repos/${REPO}/issues`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title,
                        body,
                        labels: [...labels],
                    }),
                });

                // Assigned separately, rather than in the create call, so that an unassignable user is
                // silently dropped by GitHub instead of failing the issue creation
                if (assignee && response.ok) {
                    await this.assign(response, assignee.login, headers);
                }
            }
        }
    }
}

export default FlakyReporter;
