/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "test-utils-rtl";

import SdkConfig from "../../../SdkConfig";
import FeedbackDialog from "./FeedbackDialog";

describe("FeedbackDialog", () => {
    it("should respect feedback config", () => {
        SdkConfig.put({
            feedback: {
                existing_issues_url: "http://existing?foo=bar",
                new_issue_url: "https://new.issue.url?foo=bar",
            },
        });

        const { asFragment } = render(<FeedbackDialog onFinished={vi.fn()} />);
        expect(asFragment()).toMatchSnapshot();
    });
});
