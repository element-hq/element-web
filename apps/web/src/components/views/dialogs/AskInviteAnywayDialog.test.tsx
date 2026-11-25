/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { getByText, render, type RenderResult } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, afterEach } from "vitest";

import AskInviteAnywayDialog, { type AskInviteAnywayDialogProps } from "./AskInviteAnywayDialog";
import SettingsStore from "../../../settings/SettingsStore";

describe("AskInviteaAnywayDialog", () => {
    const onFinished = vi.fn();
    const onGiveUp = vi.fn();
    const onInviteAnyways = vi.fn();

    function renderComponent(props: Partial<AskInviteAnywayDialogProps> = {}): RenderResult {
        return render(
            <AskInviteAnywayDialog
                onFinished={onFinished}
                onGiveUp={onGiveUp}
                onInviteAnyways={onInviteAnyways}
                unknownProfileUsers={[
                    {
                        userId: "@alice:localhost",
                        errorText: "🤷‍♂️",
                    },
                ]}
                {...props}
            />,
        );
    }

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("remembers to not warn again", async () => {
        const { container } = renderComponent();

        vi.spyOn(SettingsStore, "setValue").mockImplementation(async (): Promise<void> => {});

        const neverWarnAgainBtn = getByText(container, /never warn/);
        await userEvent.click(neverWarnAgainBtn);

        expect(SettingsStore.setValue).toHaveBeenCalledWith(
            "promptBeforeInviteUnknownUsers",
            null,
            expect.any(String),
            false,
        );
        expect(onInviteAnyways).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("invites anyway", async () => {
        const { container } = renderComponent();

        vi.spyOn(SettingsStore, "setValue");

        const inviteAnywayBtn = getByText(container, "Invite anyway");
        await userEvent.click(inviteAnywayBtn);

        expect(onInviteAnyways).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(true);
    });

    it("gives up", async () => {
        const { container } = renderComponent();

        vi.spyOn(SettingsStore, "setValue");

        const closeBtn = getByText(container, /Close/);
        await userEvent.click(closeBtn);

        expect(onGiveUp).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
