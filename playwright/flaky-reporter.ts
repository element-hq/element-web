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

class FlakyReporter implements Reporter {
    private flakes = new Set<string>();

    public onTestEnd(test: TestCase): void {
        const title = `${test.location.file.split("playwright/e2e/")[1]}: ${test.title}`;
        if (test.outcome() === "flaky") {
            this.flakes.add(title);
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

        const { GITHUB_TOKEN, GITHUB_API_URL, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID } = process.env;
        if (!GITHUB_TOKEN) return;

        const body = `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`;

        const headers = { Authorization: `Bearer ${GITHUB_TOKEN}` };
        // Fetch all existing issues with the flaky-test label.
        const issuesRequest = await fetch(`${GITHUB_API_URL}/repos/${REPO}/issues?labels=${LABEL}`, { headers });
        const issues = await issuesRequest.json();
        for (const flake of this.flakes) {
            const title = ISSUE_TITLE_PREFIX + "`" + flake + "`";
            const existingIssue = issues.find((issue) => issue.title === title);

            if (existingIssue) {
                console.log(`Found issue ${existingIssue.number} for ${flake}, adding comment...`);
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
