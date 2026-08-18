/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "test-utils-rtl";

import { shouldShowFeedback } from "../../../utils/Feedback";
import BetaCard from "./BetaCard";
import SettingsStore from "../../../settings/SettingsStore";
import { type FeatureSettingKey } from "../../../settings/Settings.tsx";

vi.mock("../../../utils/Feedback");
vi.mock("../../../settings/SettingsStore");

describe("<BetaCard />", () => {
    describe("Feedback prompt", () => {
        const featureId = "featureId" as FeatureSettingKey;

        beforeEach(() => {
            vi.mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title" as TranslationKey,
                caption: () => "caption",
                feedbackLabel: "feedbackLabel",
                feedbackSubheading: "feedbackSubheading" as TranslationKey,
            });
            vi.mocked(SettingsStore).getValue.mockReturnValue(true);
            vi.mocked(shouldShowFeedback).mockReturnValue(true);
        });

        it("should show feedback prompt", () => {
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeTruthy();
        });

        it("should not show feedback prompt if beta is disabled", () => {
            vi.mocked(SettingsStore).getValue.mockReturnValue(false);
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if label is unset", () => {
            vi.mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title" as TranslationKey,
                caption: () => "caption",
                feedbackSubheading: "feedbackSubheading" as TranslationKey,
            });
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if subheading is unset", () => {
            vi.mocked(SettingsStore).getBetaInfo.mockReturnValue({
                title: "title" as TranslationKey,
                caption: () => "caption",
                feedbackLabel: "feedbackLabel",
            });
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });

        it("should not show feedback prompt if feedback is disabled", () => {
            vi.mocked(shouldShowFeedback).mockReturnValue(false);
            render(<BetaCard featureId={featureId} />);
            expect(screen.queryByText("Feedback")).toBeFalsy();
        });
    });
});
