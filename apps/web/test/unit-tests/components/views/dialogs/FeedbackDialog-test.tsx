/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";

import SdkConfig from "../../../../../src/SdkConfig";
import FeedbackDialog from "../../../../../src/components/views/dialogs/FeedbackDialog";

describe("FeedbackDialog", () => {
    it("should respect feedback config", () => {
        SdkConfig.put({
            feedback: {
                existing_issues_url: "http://existing?foo=bar",
                new_issue_url: "https://new.issue.url?foo=bar",
            },
        });

        const { asFragment } = render(<FeedbackDialog onFinished={jest.fn()} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
