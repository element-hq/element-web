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
import { mocked } from "jest-mock";
import { render, screen } from "@testing-library/react";

import { shouldShowFeedback } from "../../../../src/utils/Feedback";
import BetaCard from "../../../../src/components/views/beta/BetaCard";
import SettingsStore from "../../../../src/settings/SettingsStore";

jest.mock("../../../../src/utils/Feedback");
jest.mock("../../../../src/settings/SettingsStore");

describe("<BetaCard />", () => {
    describe("Feedback prompt", () => {
        const featureId = "featureId";

        beforeEach(() => {
            mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title",
                caption: () => "caption",
                feedbackLabel: "feedbackLabel",
                feedbackSubheading: "feedbackSubheading",
            });
            mocked(SettingsStore).getValue.mockReturnValue(true);
            mocked(shouldShowFeedback).mockReturnValue(true);
        });

        it("should show feedback prompt", () => {
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeTruthy();
        });

        it("should not show feedback prompt if beta is disabled", () => {
            mocked(SettingsStore).getValue.mockReturnValue(false);
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if label is unset", () => {
            mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title",
                caption: () => "caption",
                feedbackSubheading: "feedbackSubheading",
            });
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if subheading is unset", () => {
            mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title",
                caption: () => "caption",
                feedbackLabel: "feedbackLabel",
            });
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if feedback is disabled", () => {
            mocked(shouldShowFeedback).mockReturnValue(false);
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });
    });
});
