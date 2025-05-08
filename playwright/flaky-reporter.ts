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

const REPO = "element-hq/element-web";
const LABEL = "Z-Flaky-Test";
const ISSUE_TITLE_PREFIX = "Flaky playwright test: ";

type PaginationLinks = {
    prev?: string;
    next?: string;
    last?: string;
    first?: string;
};

// We see quite a few test flakes which are caused by the app exploding
// so we have some magic strings we check the logs for to better track the flake with its cause
const SPECIAL_CASES = {
    "ChunkLoadError": "ChunkLoadError",
    "Unreachable code should not be executed": "Rust crypto panic",
    "Out of bounds memory access": "Rust crypto memory error",
};

class FlakyReporter implements Reporter {
    private flakes = new Map<string, TestCase[]>();

    public onTestEnd(test: TestCase): void {
        // Ignores flakes on Dendrite and Pinecone as they have their own flakes we do not track
        if (["Dendrite", "Pinecone"].includes(test.parent.project()?.name)) return;
        let failures = [`${test.location.file.split("playwright/e2e/")[1]}: ${test.title}`];
        if (test.outcome() === "flaky") {
            const timedOutRuns = test.results.filter((result) => result.status === "timedOut");
            const pageLogs = timedOutRuns.flatMap((result) =>
                result.attachments.filter((attachment) => attachment.name.startsWith("page-")),
            );
            // If a test failed due to a systemic fault then the test is not flaky, the app is, record it as such.
            const specialCases = Object.keys(SPECIAL_CASES).filter((log) =>
                pageLogs.some((attachment) => attachment.name.startsWith("page-") && attachment.body.includes(log)),
            );
            if (specialCases.length > 0) {
                failures = specialCases.map((specialCase) => SPECIAL_CASES[specialCase]);
            }

            for (const title of failures) {
                if (!this.flakes.has(title)) {
                    this.flakes.set(title, []);
                }
                this.flakes.get(title).push(test);
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
            const { link, type } = match.groups;
            map[type] = link;
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
            const linkHeader = issuesResponse.headers.get("Link");
            const parsed = this.parseLinkHeader(linkHeader);
            url = parsed.next;
        }
        return issues;
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

        const { GITHUB_TOKEN, GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
        if (!GITHUB_TOKEN) return;

        const issues = await this.getAllIssues();
        for (const [flake, results] of this.flakes) {
            const title = ISSUE_TITLE_PREFIX + "`" + flake + "`";
            const existingIssue = issues.find((issue) => issue.title === title);
            const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
            const body = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

            const labels = [LABEL, ...results.map((test) => `${LABEL}-${test.parent.project()?.name}`)];

            if (existingIssue) {
                console.log(`Found issue ${existingIssue.number} for ${flake}, adding comment...`);
                // Ensure that the test is open
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
                await fetch(`${GITHUB_API_URL}/repos/${REPO}/issues`, {
                    method: "POST",
                    headers,
                    body: JSON.stringify({
                        title,
                        body,
                        labels: [...labels],
                    }),
                });
            }
        }
    }
}

export default FlakyReporter;
