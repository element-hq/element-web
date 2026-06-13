/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { shouldShowFeedback } from "../../../../../src/utils/Feedback";
import BetaCard from "../../../../../src/components/views/beta/BetaCard";
import SettingsStore from "../../../../../src/settings/SettingsStore";
import { type FeatureSettingKey } from "../../../../../src/settings/Settings.tsx";
import SdkConfig from "../../../../../src/SdkConfig.ts";

jest.mock("../../../../../src/utils/Feedback");
jest.mock("../../../../../src/settings/SettingsStore");

describe("<BetaCard />", () => {
    const featureId = "featureId" as FeatureSettingKey;

    afterEach(() => {
        SdkConfig.reset();
    });

    beforeEach(() => {
        mocked(SettingsStore).getBetaInfo.mockReturnValue({
            title: "title" as TranslationKey,
            caption: () => "caption",
            feedbackLabel: "feedbackLabel",
            feedbackSubheading: "feedbackSubheading" as TranslationKey,
        });
        mocked(SettingsStore).getValue.mockImplementation((settingId) => settingId === featureId);
        mocked(shouldShowFeedback).mockReturnValue(true);
    });
    describe("Feedback prompt", () => {
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
        describe("Removed betas", () => {
            it("should show warning if the user has a removed beta enabled", () => {
                mocked(SettingsStore).getBetaInfo.mockReturnValue({
                    title: "title" as TranslationKey,
                    removed: true,
                    caption: () => "caption",
                    feedbackLabel: "feedbackLabel",
                    feedbackSubheading: "feedbackSubheading" as TranslationKey,
                });
                const { queryByText } = render(<BetaCard featureId={featureId} />);
                expect(queryByText("This feature is due to be removed from the beta system.")).toBeTruthy();
            });

            it("should warn if user tries to disable a removed beta without labs enabled", async () => {
                SdkConfig.put({ show_labs_settings: false });
                mocked(SettingsStore).getBetaInfo.mockReturnValue({
                    title: "title" as TranslationKey,
                    removed: true,
                    caption: () => "caption",
                    feedbackLabel: "feedbackLabel",
                    feedbackSubheading: "feedbackSubheading" as TranslationKey,
                });
                const { getByRole } = render(<BetaCard featureId={featureId} />);
                const button = getByRole("button", { name: "Leave the beta" });
                await userEvent.click(button);
                const dialog = getByRole("dialog");
                expect(dialog).toMatchSnapshot();
                const cancelButton = getByRole("button", { name: "Cancel" });
                await userEvent.click(cancelButton);
                expect(SettingsStore.setValue).not.toHaveBeenCalled();
            });

            it("should not warn if user tries to disable a removed beta with labs enabled", async () => {
                SdkConfig.put({ show_labs_settings: true });
                mocked(SettingsStore).getBetaInfo.mockReturnValue({
                    title: "title" as TranslationKey,
                    removed: true,
                    caption: () => "caption",
                    feedbackLabel: "feedbackLabel",
                    feedbackSubheading: "feedbackSubheading" as TranslationKey,
                });
                const { getByRole, queryByRole } = render(<BetaCard featureId={featureId} />);
                const button = getByRole("button", { name: "Leave the beta" });
                await userEvent.click(button);
                waitFor(
                    () => {
                        expect(queryByRole("dialog")).toBeFalsy();
                        expect(SettingsStore.setValue).toHaveBeenCalled();
                    },
                    // Button has a 2s delay
                    { timeout: 2500 },
                );
            });
        });
    });
});
