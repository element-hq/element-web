/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import React from "react";
import { render } from "jest-matrix-react";
import { type AccountDataEvents } from "matrix-js-sdk/src/types";
import { ClientEvent, MatrixEvent } from "matrix-js-sdk/src/matrix";
import userEvent from "@testing-library/user-event";

import { stubClient } from "../../../../test-utils";
import { InviteControlsPanel } from "../../../../../src/components/views/settings/InviteControlsPanel";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

describe("InviteControlsPanel", () => {
    it("does not render if not supported", async () => {
        const client = stubClient();
        client.getAccountData = jest.fn().mockReturnValue(undefined);
        client.doesServerSupportUnstableFeature = jest.fn().mockResolvedValue(false);
        const { findByText, findByLabelText } = render(
            <MatrixClientContext.Provider value={client}>
                <InviteControlsPanel />
            </MatrixClientContext.Provider>,
        );
        const input = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.hover(input);
        const result = await findByText("Your server does not implement this feature.");
        expect(result).toBeInTheDocument();
    });
    it("renders correct state when no value is present", async () => {
        const client = stubClient();
        client.getAccountData = jest.fn().mockReturnValue(undefined);
        client.doesServerSupportUnstableFeature = jest.fn().mockImplementation(async (v) => v === "org.matrix.msc4155");
        const { findByLabelText } = render(
            <MatrixClientContext.Provider value={client}>
                <InviteControlsPanel />
            </MatrixClientContext.Provider>,
        );
        const result = await findByLabelText("Allow users to invite you to rooms");
        expect((result as HTMLInputElement).checked).toEqual(true);
    });
    it.each([{}, { blocked_users: ["some"] }, { blocked_users: [" *"] }])(
        "renders correct state when permissive values are present",
        async (eventData: AccountDataEvents["org.matrix.msc4155.invite_permission_config"]) => {
            const client = stubClient();
            client.getAccountData = jest
                .fn()
                .mockImplementation((v) =>
                    v === "org.matrix.msc4155.invite_permission_config"
                        ? new MatrixEvent({ content: eventData })
                        : undefined,
                );
            client.doesServerSupportUnstableFeature = jest
                .fn()
                .mockImplementation(async (v) => v === "org.matrix.msc4155");
            const { findByLabelText } = render(
                <MatrixClientContext.Provider value={client}>
                    <InviteControlsPanel />
                </MatrixClientContext.Provider>,
            );
            const result = await findByLabelText("Allow users to invite you to rooms");
            expect((result as HTMLInputElement).checked).toEqual(true);
        },
    );
    it("renders correct state when invites are blocked", async () => {
        const client = stubClient();
        client.getAccountData = jest
            .fn()
            .mockImplementation((v) =>
                v === "org.matrix.msc4155.invite_permission_config"
                    ? new MatrixEvent({ content: { blocked_users: "*" } })
                    : undefined,
            );
        client.doesServerSupportUnstableFeature = jest.fn().mockImplementation(async (v) => v === "org.matrix.msc4155");
        const { findByLabelText } = render(
            <MatrixClientContext.Provider value={client}>
                <InviteControlsPanel />
            </MatrixClientContext.Provider>,
        );
        const result = await findByLabelText("Allow users to invite you to rooms");
        expect((result as HTMLInputElement).checked).toEqual(false);
    });
    it("handles disabling all invites", async () => {
        const client = stubClient();
        const setAccountData = (client.setAccountData = jest.fn().mockImplementation((type, content) => {
            client.emit(ClientEvent.AccountData, new MatrixEvent({ type, content }));
        }));
        client.getAccountData = jest
            .fn()
            .mockImplementation((v) =>
                v === "org.matrix.msc4155.invite_permission_config"
                    ? new MatrixEvent({ content: { blocked_users: ["other_rules"], foo_bar: true } })
                    : undefined,
            );
        client.doesServerSupportUnstableFeature = jest.fn().mockImplementation(async (v) => v === "org.matrix.msc4155");
        const { findByLabelText } = render(
            <MatrixClientContext.Provider value={client}>
                <InviteControlsPanel />
            </MatrixClientContext.Provider>,
        );
        const result = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.click(result);
        // Preserves other rules that might already be configured.
        expect(setAccountData).toHaveBeenCalledWith("org.matrix.msc4155.invite_permission_config", {
            blocked_users: ["other_rules", "*"],
            foo_bar: true,
        });
        expect((result as HTMLInputElement).checked).toEqual(false);
    });
    it("handles enabling invites", async () => {
        const client = stubClient();
        const setAccountData = (client.setAccountData = jest.fn().mockImplementation((type, content) => {
            client.emit(ClientEvent.AccountData, new MatrixEvent({ type, content }));
        }));
        client.getAccountData = jest
            .fn()
            .mockImplementation((v) =>
                v === "org.matrix.msc4155.invite_permission_config"
                    ? new MatrixEvent({ content: { blocked_users: ["*", "other_rules"], foo_bar: true } })
                    : undefined,
            );
        client.doesServerSupportUnstableFeature = jest.fn().mockImplementation(async (v) => v === "org.matrix.msc4155");
        const { findByLabelText } = render(
            <MatrixClientContext.Provider value={client}>
                <InviteControlsPanel />
            </MatrixClientContext.Provider>,
        );
        const result = await findByLabelText("Allow users to invite you to rooms");
        await userEvent.click(result);
        expect(setAccountData).toHaveBeenCalledWith("org.matrix.msc4155.invite_permission_config", {
            blocked_users: ["other_rules"],
            foo_bar: true,
        });
        expect((result as HTMLInputElement).checked).toEqual(true);
    });
});
