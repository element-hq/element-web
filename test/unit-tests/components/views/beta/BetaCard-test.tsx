/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, screen } from "jest-matrix-react";

import { shouldShowFeedback } from "../../../../../src/utils/Feedback";
import BetaCard from "../../../../../src/components/views/beta/BetaCard";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { TranslationKey } from "../../../../../src/languageHandler";

jest.mock("../../../../../src/utils/Feedback");
jest.mock("../../../../../src/settings/SettingsStore");

describe("<BetaCard />", () => {
    describe("Feedback prompt", () => {
        const featureId = "featureId";

        beforeEach(() => {
            mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title" as TranslationKey,
                caption: () => "caption",
                feedbackLabel: "feedbackLabel",
                feedbackSubheading: "feedbackSubheading" as TranslationKey,
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
                title: "title" as TranslationKey,
                caption: () => "caption",
                feedbackSubheading: "feedbackSubheading" as TranslationKey,
            });
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if subheading is unset", () => {
            mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title" as TranslationKey,
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
