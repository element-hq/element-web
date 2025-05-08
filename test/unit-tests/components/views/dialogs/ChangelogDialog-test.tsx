/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import fetchMock from "fetch-mock-jest";
import { render, screen, waitForElementToBeRemoved } from "jest-matrix-react";

import ChangelogDialog, {
    type DevelopVersionString,
    parseVersion,
} from "../../../../../src/components/views/dialogs/ChangelogDialog";

describe("<ChangelogDialog />", () => {
    it("should fetch github proxy url for each repo with old and new version strings", async () => {
        const webUrl = "https://riot.im/github/repos/element-hq/element-web/compare/oldsha1...newsha1";
        fetchMock.get(webUrl, {
            url: "https://api.github.com/repos/element-hq/element-web/compare/master...develop",
            html_url: "https://github.com/element-hq/element-web/compare/master...develop",
            permalink_url: "https://github.com/element-hq/element-web/compare/vector-im:72ca95e...vector-im:8891698",
            diff_url: "https://github.com/element-hq/element-web/compare/master...develop.diff",
            patch_url: "https://github.com/element-hq/element-web/compare/master...develop.patch",
            base_commit: {},
            merge_base_commit: {},
            status: "ahead",
            ahead_by: 24,
            behind_by: 0,
            total_commits: 24,
            commits: [
                {
                    sha: "commit-sha",
                    html_url: "https://api.github.com/repos/element-hq/element-web/commit/commit-sha",
                    commit: { message: "This is the first commit message" },
                },
            ],
            files: [],
        });
        const jsUrl = "https://riot.im/github/repos/matrix-org/matrix-js-sdk/compare/oldsha3...newsha3";
        fetchMock.get(jsUrl, {
            url: "https://api.github.com/repos/matrix-org/matrix-js-sdk/compare/master...develop",
            html_url: "https://github.com/matrix-org/matrix-js-sdk/compare/master...develop",
            permalink_url: "https://github.com/matrix-org/matrix-js-sdk/compare/matrix-org:6166a8f...matrix-org:fec350",
            diff_url: "https://github.com/matrix-org/matrix-js-sdk/compare/master...develop.diff",
            patch_url: "https://github.com/matrix-org/matrix-js-sdk/compare/master...develop.patch",
            base_commit: {},
            merge_base_commit: {},
            status: "ahead",
            ahead_by: 48,
            behind_by: 0,
            total_commits: 48,
            commits: [
                {
                    sha: "commit-sha1",
                    html_url: "https://api.github.com/repos/matrix-org/matrix-js-sdk/commit/commit-sha1",
                    commit: { message: "This is a commit message" },
                },
                {
                    sha: "commit-sha2",
                    html_url: "https://api.github.com/repos/matrix-org/matrix-js-sdk/commit/commit-sha2",
                    commit: { message: "This is another commit message" },
                },
            ],
            files: [],
        });

        const newVersion = "newsha1-js-newsha3" as DevelopVersionString;
        const oldVersion = "oldsha1-js-oldsha3" as DevelopVersionString;
        const { asFragment } = render(
            <ChangelogDialog newVersion={newVersion} version={oldVersion} onFinished={jest.fn()} />,
        );

        // Wait for spinners to go away
        await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));

        expect(fetchMock).toHaveFetched(webUrl);
        expect(fetchMock).toHaveFetched(jsUrl);
        expect(asFragment()).toMatchSnapshot();
    });
});

describe("parseVersion", () => {
    it("should return null for old-style version strings", () => {
        expect(parseVersion("aaaabbbb-react-ccccdddd-js-eeeeffff")).toBeNull();
    });

    it("should return null for invalid version strings", () => {
        expect(parseVersion("aaaabbbb-react-ccccdddd")).toBeNull();
    });

    it("should return null for release version strings", () => {
        expect(parseVersion("v1.22.33")).toBeNull();
    });

    it("should return mapping for develop version string", () => {
        expect(parseVersion("aaaabbbb-js-eeeeffff")).toEqual({
            "element-hq/element-web": "aaaabbbb",
            "matrix-org/matrix-js-sdk": "eeeeffff",
        });
    });
});
