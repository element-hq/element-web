/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";

import SdkConfig from "../../../src/SdkConfig";
import { shouldShowFeedback } from "../../../src/utils/Feedback";
import SettingsStore from "../../../src/settings/SettingsStore";

jest.mock("../../../src/SdkConfig");
jest.mock("../../../src/settings/SettingsStore");

describe("shouldShowFeedback", () => {
    it("should return false if bug_report_endpoint_url is falsey", () => {
        mocked(SdkConfig).get.mockReturnValue({
            bug_report_endpoint_url: null,
        });
        expect(shouldShowFeedback()).toBeFalsy();
    });

    it("should return false if UIFeature.Feedback is disabled", () => {
        mocked(SettingsStore).getValue.mockReturnValue(false);
        expect(shouldShowFeedback()).toBeFalsy();
    });

    it("should return true if bug_report_endpoint_url is set and UIFeature.Feedback is true", () => {
        mocked(SdkConfig).get.mockReturnValue({
            bug_report_endpoint_url: "https://rageshake.server",
        });
        mocked(SettingsStore).getValue.mockReturnValue(true);
        expect(shouldShowFeedback()).toBeTruthy();
    });
});
