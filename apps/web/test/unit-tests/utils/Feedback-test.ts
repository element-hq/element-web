/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import SdkConfig from "../../../src/SdkConfig";
import { shouldShowFeedback } from "../../../src/utils/Feedback";
import SettingsStore from "../../../src/settings/SettingsStore";
import { UIFeature } from "../../../src/settings/UIFeature";
import { BugReportEndpointURLLocal } from "../../../src/IConfigOptions";

const realGetValue = SettingsStore.getValue;

describe("shouldShowFeedback", () => {
    afterEach(() => {
        SdkConfig.reset();
        jest.restoreAllMocks();
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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((key, ...params) => {
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
        jest.spyOn(SettingsStore, "getValue").mockImplementation((key, ...params) => {
            if (key === UIFeature.Feedback) {
                return true;
            }
            return realGetValue(key, ...params);
        });
        expect(shouldShowFeedback()).toEqual(true);
    });
});
