/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import React from "react";
import fetchMock from "fetch-mock-jest";
import { render, screen, waitForElementToBeRemoved } from "@testing-library/react";

import ChangelogDialog from "../../../../src/components/views/dialogs/ChangelogDialog";

describe("<ChangelogDialog />", () => {
    it("should fetch github proxy url for each repo with old and new version strings", async () => {
        const webUrl = "https://riot.im/github/repos/vector-im/element-web/compare/oldsha1...newsha1";
        fetchMock.get(webUrl, {
            url: "https://api.github.com/repos/vector-im/element-web/compare/master...develop",
            html_url: "https://github.com/vector-im/element-web/compare/master...develop",
            permalink_url: "https://github.com/vector-im/element-web/compare/vector-im:72ca95e...vector-im:8891698",
            diff_url: "https://github.com/vector-im/element-web/compare/master...develop.diff",
            patch_url: "https://github.com/vector-im/element-web/compare/master...develop.patch",
            base_commit: {},
            merge_base_commit: {},
            status: "ahead",
            ahead_by: 24,
            behind_by: 0,
            total_commits: 24,
            commits: [
                {
                    sha: "commit-sha",
                    html_url: "https://api.github.com/repos/vector-im/element-web/commit/commit-sha",
                    commit: { message: "This is the first commit message" },
                },
            ],
            files: [],
        });
        const reactUrl = "https://riot.im/github/repos/matrix-org/matrix-react-sdk/compare/oldsha2...newsha2";
        fetchMock.get(reactUrl, {
            url: "https://api.github.com/repos/matrix-org/matrix-react-sdk/compare/master...develop",
            html_url: "https://github.com/matrix-org/matrix-react-sdk/compare/master...develop",
            permalink_url: "https://github.com/matrix-org/matrix-react-sdk/compare/matrix-org:cdb00...matrix-org:4a926",
            diff_url: "https://github.com/matrix-org/matrix-react-sdk/compare/master...develop.diff",
            patch_url: "https://github.com/matrix-org/matrix-react-sdk/compare/master...develop.patch",
            base_commit: {},
            merge_base_commit: {},
            status: "ahead",
            ahead_by: 83,
            behind_by: 0,
            total_commits: 83,
            commits: [
                {
                    sha: "commit-sha0",
                    html_url: "https://api.github.com/repos/matrix-org/matrix-react-sdk/commit/commit-sha",
                    commit: { message: "This is a commit message" },
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

        const newVersion = "newsha1-react-newsha2-js-newsha3";
        const oldVersion = "oldsha1-react-oldsha2-js-oldsha3";
        const { asFragment } = render(
            <ChangelogDialog newVersion={newVersion} version={oldVersion} onFinished={jest.fn()} />,
        );

        // Wait for spinners to go away
        await waitForElementToBeRemoved(screen.getAllByRole("progressbar"));

        expect(fetchMock).toHaveFetched(webUrl);
        expect(fetchMock).toHaveFetched(reactUrl);
        expect(fetchMock).toHaveFetched(jsUrl);
        expect(asFragment()).toMatchSnapshot();
    });
});
