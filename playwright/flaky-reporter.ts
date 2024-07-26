/*
Copyright 2024 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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

class FlakyReporter implements Reporter {
    private flakes = new Set<string>();

    public onTestEnd(test: TestCase): void {
        const title = `${test.location.file.split("playwright/e2e/")[1]}: ${test.title}`;
        if (test.outcome() === "flaky") {
            this.flakes.add(title);
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
        for (const flake of this.flakes) {
            const title = ISSUE_TITLE_PREFIX + "`" + flake + "`";
            const existingIssue = issues.find((issue) => issue.title === title);
            const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
            const body = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

            if (existingIssue) {
                console.log(`Found issue ${existingIssue.number} for ${flake}, adding comment...`);
                // Ensure that the test is open
                await fetch(existingIssue.url, {
                    method: "PATCH",
                    headers,
                    body: JSON.stringify({ state: "open" }),
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
                        labels: [LABEL],
                    }),
                });
            }
        }
    }
}

export default FlakyReporter;
