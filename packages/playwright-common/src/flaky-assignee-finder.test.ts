/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { describe, expect, it, vi } from "vitest";

import { FlakyAssigneeFinder, parseIgnoreRevs } from "./flaky-assignee-finder.js";

const API = "https://api.example.test";

function commit(sha: string, login: string | null, type = "User"): object {
    return { sha, html_url: `https://github.com/o/r/commit/${sha}`, author: login ? { login, type } : null };
}

function urlOf(input: RequestInfo | URL): URL {
    return new URL(input instanceof Request ? input.url : input);
}

/**
 * A fake GitHub API: `commits` is the history of the requested path, `members` maps a login to its
 * team membership state, and anyone else is a 404.
 */
function fakeApi(commits: object[], members: Record<string, string>, membershipStatus = 200) {
    return vi.fn(async (input: RequestInfo | URL) => {
        const url = urlOf(input);
        if (url.pathname === "/repos/o/r/commits") {
            return Response.json(commits);
        }
        const match = url.pathname.match(/^\/orgs\/o\/teams\/t\/memberships\/(.+)$/);
        if (match) {
            if (membershipStatus !== 200) return new Response(null, { status: membershipStatus });
            const state = members[decodeURIComponent(match[1])];
            return state ? Response.json({ state }) : new Response(null, { status: 404 });
        }
        throw new Error(`Unexpected request ${url}`);
    });
}

function finder(fetch: ReturnType<typeof fakeApi>): FlakyAssigneeFinder {
    return new FlakyAssigneeFinder({ apiUrl: API, token: "tok", repo: "o/r", org: "o", team: "t", fetch });
}

describe("FlakyAssigneeFinder", () => {
    it("skips bots, unlinked authors and non-members to find the most recent team member", async () => {
        const fetch = fakeApi(
            [
                commit("1", "renovate[bot]", "Bot"),
                commit("3", null),
                commit("3a", "RiotRobot", "User"),
                commit("4", "outsider"),
                commit("5", "invited", "User"),
                commit("6", "alice"),
                commit("7", "bob"),
            ],
            { invited: "pending", alice: "active", bob: "active", RiotRobot: "active" },
        );

        await expect(finder(fetch).find("apps/web/playwright/e2e/a.spec.ts", "abc123")).resolves.toEqual({
            login: "alice",
            commitUrl: "https://github.com/o/r/commit/6",
        });

        const commitsUrl = urlOf(fetch.mock.calls[0][0]);
        expect(commitsUrl.searchParams.get("path")).toBe("apps/web/playwright/e2e/a.spec.ts");
        expect(commitsUrl.searchParams.get("sha")).toBe("abc123");
        // Bots and unlinked authors never cost a membership lookup, and we stop at the first member
        const membershipLookups = fetch.mock.calls
            .map(([url]) => urlOf(url).pathname)
            .filter((path) => path.includes("/memberships/"))
            .map((path) => path.split("/").pop());
        expect(membershipLookups).toEqual(["outsider", "invited", "alice"]);
    });

    it("returns undefined when no recent author is a team member", async () => {
        const fetch = fakeApi([commit("1", "outsider"), commit("2", "dependabot[bot]", "Bot")], {});
        await expect(finder(fetch).find("a.spec.ts")).resolves.toBeUndefined();
    });

    it("omits sha when no ref is given", async () => {
        const fetch = fakeApi([], {});
        await finder(fetch).find("a.spec.ts");
        expect(urlOf(fetch.mock.calls[0][0]).searchParams.has("sha")).toBe(false);
    });

    it("caches membership across lookups", async () => {
        const fetch = fakeApi([commit("1", "outsider"), commit("2", "alice")], { alice: "active" });
        const f = finder(fetch);
        await f.find("a.spec.ts");
        await f.find("b.spec.ts");
        const membershipLookups = fetch.mock.calls.filter(([url]) => urlOf(url).pathname.includes("/memberships/"));
        // outsider and alice once each, not twice
        expect(membershipLookups).toHaveLength(2);
    });

    it("throws when the token cannot read team membership, rather than treating everyone as a non-member", async () => {
        const fetch = fakeApi([commit("1", "alice")], { alice: "active" }, 403);
        // The full message, which must not name the login as it ends up in a public CI log
        await expect(finder(fetch).find("a.spec.ts")).rejects.toThrow(
            new Error("Checking o/t membership failed: HTTP 403"),
        );
    });

    it("does not cache a failed membership lookup", async () => {
        let membershipLookups = 0;
        const fetch = vi.fn(async (input: RequestInfo | URL) => {
            if (urlOf(input).pathname === "/repos/o/r/commits") return Response.json([commit("1", "alice")]);
            membershipLookups++;
            return membershipLookups === 1 ? new Response(null, { status: 502 }) : Response.json({ state: "active" });
        });
        const f = finder(fetch);
        await expect(f.find("a.spec.ts")).rejects.toThrow("HTTP 502");
        await expect(f.find("b.spec.ts")).resolves.toEqual({
            login: "alice",
            commitUrl: "https://github.com/o/r/commit/1",
        });
    });

    it("skips commits listed as ignored, such as mass reformatting", async () => {
        const fetch = fakeApi([commit("aaa", "sweeper"), commit("bbb", "alice")], {
            sweeper: "active",
            alice: "active",
        });
        const f = new FlakyAssigneeFinder({
            apiUrl: API,
            token: "tok",
            repo: "o/r",
            org: "o",
            team: "t",
            ignoredCommits: new Set(["aaa"]),
            fetch,
        });
        await expect(f.find("a.spec.ts")).resolves.toEqual({
            login: "alice",
            commitUrl: "https://github.com/o/r/commit/bbb",
        });
    });

    it("throws when commits cannot be listed", async () => {
        const fetch = vi.fn(async (_input: RequestInfo | URL) => new Response(null, { status: 500 }));
        await expect(finder(fetch).find("a.spec.ts")).rejects.toThrow("HTTP 500");
    });
});

describe("parseIgnoreRevs", () => {
    it("reads one SHA per line, ignoring comments and blank lines", () => {
        const text = [
            "# prettier",
            "526645C79160AB1AD4B4C3845DE27D51263A405E",
            "",
            "7921a6cbf86b035d2b0c1daecb4c24beaf5a5abc  # trailing comment",
            "   ",
        ].join("\n");
        expect(parseIgnoreRevs(text)).toEqual(
            new Set(["526645c79160ab1ad4b4c3845de27d51263a405e", "7921a6cbf86b035d2b0c1daecb4c24beaf5a5abc"]),
        );
    });
});
