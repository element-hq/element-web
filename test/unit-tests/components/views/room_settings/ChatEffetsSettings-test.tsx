/*
 * Copyright 2024 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";
import { waitFor } from "@testing-library/dom";
import { Form } from "@vector-im/compound-web";

import { createTestClient, mkStubRoom, withClientContextRenderOptions } from "../../../../test-utils/index.ts";
import { ChatEffectsSettings } from "../../../../../src/components/views/room_settings/ChatEffectsSettings.tsx";
import SettingsStore from "../../../../../src/settings/SettingsStore.ts";
import dis from "../../../../../src/dispatcher/dispatcher.ts";
import { Action } from "../../../../../src/dispatcher/actions.ts";

describe("ChatEffectsSettings", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(() => {
        client = createTestClient();
        room = mkStubRoom("roomId", "room", client);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    function renderComponent() {
        return render(
            <Form.Root>
                <ChatEffectsSettings room={room} />
            </Form.Root>,
            withClientContextRenderOptions(client),
        );
    }

    it("should display the correct preview when the chat effects setting is enabled", async () => {
        jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);
        jest.spyOn(dis, "fire").mockReturnValue(undefined);

        const { asFragment } = renderComponent();
        await waitFor(() => {
            expect(
                screen.getByText(
                    "Enable chat effects by default for participants in this room",
                ),
            ).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();

        screen.getByRole("button", { name: "enabled" }).click();
        expect(dis.fire).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    it("should display the correct preview when the chat effects setting is disabled", async () => {
        jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(false);
        jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(false);

        const { asFragment } = renderComponent();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "disabled" })).toBeInTheDocument();
            expect(
                screen.getByText("Enable chat effects by default for participants in this room"),
            ).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
