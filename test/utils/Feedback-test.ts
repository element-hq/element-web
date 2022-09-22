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

import { mocked } from "jest-mock";

import SdkConfig from "../../src/SdkConfig";
import { shouldShowFeedback } from "../../src/utils/Feedback";
import SettingsStore from "../../src/settings/SettingsStore";

jest.mock("../../src/SdkConfig");
jest.mock("../../src/settings/SettingsStore");

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
