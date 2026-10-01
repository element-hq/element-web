/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, it, expect, afterEach } from "vitest";

import SdkConfig from "../SdkConfig";
import { shouldShowFeedback } from "./Feedback";
import SettingsStore from "../settings/SettingsStore";
import { UIFeature } from "../settings/UIFeature";
import { BugReportEndpointURLLocal } from "../IConfigOptions";

const realGetValue = SettingsStore.getValue;

describe("shouldShowFeedback", () => {
    afterEach(() => {
        SdkConfig.reset();
        vi.restoreAllMocks();
    });

    it("should return false if bug_report_endpoint_url is falsey", () => {
        SdkConfig.put({
            bug_report_endpoint_url: undefined,
        });
        expect(shouldShowFeedback()).toEqual(false);
    });

    it("should return false if bug_report_endpoint_url is 'test'", () => {
        SdkConfig.put({
            bug_report_endpoint_url: BugReportEndpointURLLocal,
        });
        expect(shouldShowFeedback()).toEqual(false);
    });

    it("should return false if UIFeature.Feedback is disabled", () => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation((key, ...params) => {
            if (key === UIFeature.Feedback) {
                return false;
            }
            return realGetValue(key, ...params);
        });
        expect(shouldShowFeedback()).toEqual(false);
    });

    it("should return true if bug_report_endpoint_url is set and UIFeature.Feedback is true", () => {
        SdkConfig.put({
            bug_report_endpoint_url: "https://rageshake.server",
        });
        vi.spyOn(SettingsStore, "getValue").mockImplementation((key, ...params) => {
            if (key === UIFeature.Feedback) {
                return true;
            }
            return realGetValue(key, ...params);
        });
        expect(shouldShowFeedback()).toEqual(true);
    });
});
