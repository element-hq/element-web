/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { mocked } from "jest-mock";
import { type MatrixClient, type MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { render, screen } from "jest-matrix-react";
import { waitFor } from "@testing-library/dom";

import EncryptionEvent from "../../../../../src/components/views/messages/EncryptionEvent";
import { createTestClient, mkMessage } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import { LocalRoom } from "../../../../../src/models/LocalRoom";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

const renderEncryptionEvent = (client: MatrixClient, event: MatrixEvent) => {
    render(
        <MatrixClientContext.Provider value={client}>
            <EncryptionEvent mxEvent={event} />
        </MatrixClientContext.Provider>,
    );
};

const checkTexts = async (title: string, subTitle: string) => {
    await screen.findByText(title);
    await screen.findByText(subTitle);
};

describe("EncryptionEvent", () => {
    const roomId = "!room:example.com";
    const algorithm = "m.megolm.v1.aes-sha2";
    let client: MatrixClient;
    let event: MatrixEvent;

    beforeEach(() => {
        jest.clearAllMocks();
        client = createTestClient();
        jest.spyOn(MatrixClientPeg, "get").mockReturnValue(client);
        jest.spyOn(MatrixClientPeg, "safeGet").mockReturnValue(client);
        event = mkMessage({
            event: true,
            room: roomId,
            user: client.getUserId()!,
        });
        jest.spyOn(DMRoomMap, "shared").mockReturnValue({
            getUserIdForRoomId: jest.fn(),
        } as unknown as DMRoomMap);
    });

    describe("for an encrypted room", () => {
        beforeEach(() => {
            event.event.content!.algorithm = algorithm;
            jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
            const room = new Room(roomId, client, client.getUserId()!);
            mocked(client.getRoom).mockReturnValue(room);
        });

        it("should show the expected texts", async () => {
            renderEncryptionEvent(client, event);
            await waitFor(() =>
                checkTexts(
                    "Encryption enabled",
                    "Messages in this room are end-to-end encrypted. " +
                        "When people join, you can verify them in their profile, just tap on their profile picture.",
                ),
            );
        });

        describe("with same previous algorithm", () => {
            beforeEach(() => {
                jest.spyOn(event, "getPrevContent").mockReturnValue({
                    algorithm: algorithm,
                });
            });

            it("should show the expected texts", async () => {
                renderEncryptionEvent(client, event);
                await waitFor(() => checkTexts("Encryption enabled", "Some encryption parameters have been changed."));
            });
        });

        describe("with unknown algorithm", () => {
            beforeEach(() => {
                event.event.content!.algorithm = "unknown";
            });

            it("should show the expected texts", async () => {
                renderEncryptionEvent(client, event);
                await waitFor(() => checkTexts("Encryption enabled", "Ignored attempt to disable encryption"));
            });
        });
    });

    describe("for an unencrypted room", () => {
        beforeEach(() => {
            jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(false);
            renderEncryptionEvent(client, event);
        });

        it("should show the expected texts", async () => {
            expect(client.getCrypto()!.isEncryptionEnabledInRoom).toHaveBeenCalledWith(roomId);
            await waitFor(() =>
                checkTexts("Encryption not enabled", "The encryption used by this room isn't supported."),
            );
        });
    });

    describe("for an encrypted local room", () => {
        beforeEach(() => {
            event.event.content!.algorithm = algorithm;
            jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
            const localRoom = new LocalRoom(roomId, client, client.getUserId()!);
            mocked(client.getRoom).mockReturnValue(localRoom);
            renderEncryptionEvent(client, event);
        });

        it("should show the expected texts", async () => {
            expect(client.getCrypto()!.isEncryptionEnabledInRoom).toHaveBeenCalledWith(roomId);
            await checkTexts("Encryption enabled", "Messages in this chat will be end-to-end encrypted.");
        });
    });
});
