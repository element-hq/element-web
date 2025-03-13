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

import { createTestClient, mkStubRoom, withClientContextRenderOptions } from "../../../../test-utils";
import { UrlPreviewSettings } from "../../../../../src/components/views/room_settings/UrlPreviewSettings.tsx";
import SettingsStore from "../../../../../src/settings/SettingsStore.ts";
import dis from "../../../../../src/dispatcher/dispatcher.ts";
import { Action } from "../../../../../src/dispatcher/actions.ts";

describe("UrlPreviewSettings", () => {
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
        return render(<UrlPreviewSettings room={room} />, withClientContextRenderOptions(client));
    }

    it("should display the correct preview when the setting is in a loading state", () => {
        jest.spyOn(client, "getCrypto").mockReturnValue(undefined);
        const { asFragment } = renderComponent();
        expect(screen.getByText("URL Previews")).toBeInTheDocument();

        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the correct preview when the room is encrypted and the url preview is enabled", async () => {
        jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
        jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);

        const { asFragment } = renderComponent();
        await waitFor(() => {
            expect(
                screen.getByText(
                    "In encrypted rooms, like this one, URL previews are disabled by default to ensure that your homeserver (where the previews are generated) cannot gather information about links you see in this room.",
                ),
            ).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });

    it("should display the correct preview when the room is unencrypted and the url preview is enabled", async () => {
        jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(false);
        jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(true);
        jest.spyOn(dis, "fire").mockReturnValue(undefined);

        const { asFragment } = renderComponent();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "enabled" })).toBeInTheDocument();
            expect(
                screen.getByText("URL previews are enabled by default for participants in this room."),
            ).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();

        screen.getByRole("button", { name: "enabled" }).click();
        expect(dis.fire).toHaveBeenCalledWith(Action.ViewUserSettings);
    });

    it("should display the correct preview when the room is unencrypted and the url preview is disabled", async () => {
        jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(false);
        jest.spyOn(SettingsStore, "getValueAt").mockReturnValue(false);

        const { asFragment } = renderComponent();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "disabled" })).toBeInTheDocument();
            expect(
                screen.getByText("URL previews are disabled by default for participants in this room."),
            ).toBeInTheDocument();
        });
        expect(asFragment()).toMatchSnapshot();
    });
});
