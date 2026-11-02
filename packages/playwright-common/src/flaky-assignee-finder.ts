/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Picks who a newly reported flaky test should be assigned to: the author of the most recent commit
 * touching the test's file who is not a bot and is a member of the given GitHub team.
 */

export interface FlakyAssignee {
    login: string;
    /** The commit which made this person the assignee, for the issue body. */
    commitUrl: string;
}

export interface FlakyAssigneeFinderOptions {
    apiUrl: string;
    token: string;
    /** owner/name */
    repo: string;
    org: string;
    /** Team slug, e.g. `element-web-contributors` */
    team: string;
    /** Full SHAs of mechanical commits to skip, such as those listed in .git-blame-ignore-revs */
    ignoredCommits?: ReadonlySet<string>;
    fetch?: typeof fetch;
}

interface Author {
    login: string;
    type: string;
}

/** The subset of the GitHub "list commits" response we use. */
interface CommitListEntry {
    sha: string;
    html_url: string;
    author: Author | null;
}

// The release automation account, which commits as "ElementRobot <releases@riot.im>". It is an ordinary
// user account, so GitHub reports its type as "User" rather than "Bot".
const RELEASE_BOT_LOGIN = "RiotRobot";

function isBot(author: Author): boolean {
    // GitHub Apps such as renovate[bot] have type "Bot"
    return author.type === "Bot" || author.login === RELEASE_BOT_LOGIN;
}

/**
 * Parse a git blame.ignoreRevsFile: one full commit SHA per line, with `#` comments.
 */
export function parseIgnoreRevs(text: string): Set<string> {
    return new Set(
        text
            .split("\n")
            .map((line) => line.replace(/#.*/, "").trim().toLowerCase())
            .filter(Boolean),
    );
}

export class FlakyAssigneeFinder {
    private readonly membership = new Map<string, boolean>();
    private readonly fetch: typeof fetch;

    public constructor(private readonly options: FlakyAssigneeFinderOptions) {
        this.fetch = options.fetch ?? fetch;
    }

    private get headers(): Record<string, string> {
        return {
            Authorization: `Bearer ${this.options.token}`,
            Accept: "application/vnd.github+json",
        };
    }

    /**
     * @param path - repository-relative path of the test file
     * @param ref - commit to walk history back from; defaults to the repository's default branch
     * @returns the assignee, or undefined if none of the recent authors qualify
     * @throws if the GitHub API cannot be queried
     */
    public async find(path: string, ref?: string): Promise<FlakyAssignee | undefined> {
        const { apiUrl, repo } = this.options;
        const url = new URL(`${apiUrl}/repos/${repo}/commits`);
        url.searchParams.set("path", path);
        // The file's 100 most recent commits; if none qualify, give up
        url.searchParams.set("per_page", "100");
        if (ref) url.searchParams.set("sha", ref);

        const response = await this.fetch(url, { headers: this.headers });
        if (!response.ok) {
            throw new Error(`Listing commits for ${path} failed: HTTP ${response.status}`);
        }
        const commits = (await response.json()) as CommitListEntry[];

        for (const commit of commits) {
            // A null author means the commit email isn't linked to a GitHub account
            if (!commit.author || isBot(commit.author)) continue;
            if (this.options.ignoredCommits?.has(commit.sha)) continue;
            if (await this.isTeamMember(commit.author.login)) {
                return { login: commit.author.login, commitUrl: commit.html_url };
            }
        }
        return undefined;
    }

    private async isTeamMember(login: string): Promise<boolean> {
        let member = this.membership.get(login);
        if (member === undefined) {
            // A failed lookup throws before anything is cached, so a later lookup in the same run retries it
            member = await this.fetchMembership(login);
            this.membership.set(login, member);
        }
        return member;
    }

    private async fetchMembership(login: string): Promise<boolean> {
        const { apiUrl, org, team } = this.options;
        // See https://docs.github.com/en/rest/teams/members#get-team-membership-for-a-user
        // Includes members of child teams.
        const url = `${apiUrl}/orgs/${org}/teams/${team}/memberships/${encodeURIComponent(login)}`;
        const response = await this.fetch(url, { headers: this.headers });
        // GitHub also answers 404 if the token cannot see the team, which would make everyone a non-member.
        // ELEMENT_BOT_TOKEN can read org teams (triage-move-review-requests.yml relies on it).
        if (response.status === 404) return false;
        if (!response.ok) {
            // No login in the message: it ends up in the reporter's public CI log
            throw new Error(`Checking ${org}/${team} membership failed: HTTP ${response.status}`);
        }
        const { state } = (await response.json()) as { state: string };
        // "pending" means invited but not yet accepted
        return state === "active";
    }
}
