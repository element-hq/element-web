/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { mocked } from "jest-mock";

import RoomListActions from "../../../src/actions/RoomListActions";
import { DefaultTagID } from "../../../src/stores/room-list-v3/skip-list/tag";
import Modal from "../../../src/Modal";
import * as Rooms from "../../../src/Rooms";
import { createTestClient, flushPromises, mkRoom } from "../../test-utils";

jest.mock("../../../src/Modal");
jest.mock("../../../src/Rooms");

describe("RoomListActions", () => {
    const ROOM_ID = "!room:example.org";

    let client: MatrixClient;
    let room: Room;
    const dispatch = jest.fn();

    beforeEach(() => {
        client = createTestClient();
        room = mkRoom(client, ROOM_ID);
        mocked(Rooms.guessAndSetDMRoom).mockResolvedValue(undefined);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe("tagRoom", () => {
        /**
         * Invoke the async payload returned by tagRoom and wait for all promises to settle.
         */
        async function invokeTagRoom(
            oldTag: Parameters<typeof RoomListActions.tagRoom>[2],
            newTag: Parameters<typeof RoomListActions.tagRoom>[3],
        ): Promise<void> {
            const payload = RoomListActions.tagRoom(client, room, oldTag, newTag);

            // Execute the async function embedded in the payload.
            payload.fn(dispatch);

            // Flush all microtasks / pending promises.
            await flushPromises();
        }

        it("dispatches a pending action immediately with the optimistic update data", () => {
            const payload = RoomListActions.tagRoom(client, room, DefaultTagID.Favourite, DefaultTagID.LowPriority);

            payload.fn(dispatch);

            expect(dispatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    action: "RoomListActions.tagRoom.pending",
                    request: { room, oldTag: DefaultTagID.Favourite, newTag: DefaultTagID.LowPriority },
                }),
            );
        });

        describe("DM tag handling", () => {
            it.each([
                [undefined, DefaultTagID.DM],
                [DefaultTagID.DM, undefined],
            ])(
                "treats oldTag=%s and newTag=%s as a DM tag change and does not call setRoomTag or deleteRoomTag",
                async (oldTag, newTag) => {
                    await invokeTagRoom(oldTag, newTag as unknown as null);

                    expect(Rooms.guessAndSetDMRoom).toHaveBeenCalledWith(room, newTag === DefaultTagID.DM);
                    expect(client.deleteRoomTag).not.toHaveBeenCalled();
                    expect(client.setRoomTag).not.toHaveBeenCalled();
                },
            );

            it("opens an ErrorDialog and swallows the error if guessAndSetDMRoom rejects", async () => {
                const error = new Error("DM tag error");
                mocked(Rooms.guessAndSetDMRoom).mockRejectedValue(error);

                await invokeTagRoom(undefined, DefaultTagID.DM);

                expect(Modal.createDialog).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ description: error.message }),
                );
                // Error is swallowed — success is still dispatched.
                expect(dispatch).toHaveBeenCalledWith(
                    expect.objectContaining({ action: "RoomListActions.tagRoom.success" }),
                );
            });
        });

        describe("regular tag changes (non-DM)", () => {
            it("deletes the old tag and adds the new tag when moving between two non-DM tags", async () => {
                await invokeTagRoom(DefaultTagID.Favourite, DefaultTagID.LowPriority);

                expect(client.deleteRoomTag).toHaveBeenCalledWith(ROOM_ID, DefaultTagID.Favourite);
                expect(client.setRoomTag).toHaveBeenCalledWith(ROOM_ID, DefaultTagID.LowPriority);
                expect(dispatch).toHaveBeenCalledWith(
                    expect.objectContaining({ action: "RoomListActions.tagRoom.success" }),
                );
            });

            it("only calls setRoomTag when there was no previous tag", async () => {
                await invokeTagRoom(null, DefaultTagID.Favourite);

                expect(client.deleteRoomTag).not.toHaveBeenCalled();
                expect(client.setRoomTag).toHaveBeenCalledWith(ROOM_ID, DefaultTagID.Favourite);
            });

            it.each([null, DefaultTagID.DM])(
                "only calls deleteRoomTag when moving from %s to another non-DM tag",
                async (newTag) => {
                    await invokeTagRoom(DefaultTagID.Favourite, newTag);

                    expect(client.deleteRoomTag).toHaveBeenCalledWith(ROOM_ID, DefaultTagID.Favourite);
                    expect(client.setRoomTag).not.toHaveBeenCalled();
                },
            );

            it("makes no API calls when oldTag equals newTag", async () => {
                await invokeTagRoom(DefaultTagID.Favourite, DefaultTagID.Favourite);

                expect(client.deleteRoomTag).not.toHaveBeenCalled();
                expect(client.setRoomTag).not.toHaveBeenCalled();
            });

            it("skips deleteRoomTag for the DM tag but still sets the new tag", async () => {
                await invokeTagRoom(DefaultTagID.DM, DefaultTagID.Favourite);

                expect(client.deleteRoomTag).not.toHaveBeenCalled();
                expect(client.setRoomTag).toHaveBeenCalledWith(ROOM_ID, DefaultTagID.Favourite);
            });

            it("shows an ErrorDialog but still dispatches success when deleteRoomTag fails", async () => {
                const error = new Error("delete failed");
                jest.spyOn(client, "deleteRoomTag").mockRejectedValue(error);

                await invokeTagRoom(DefaultTagID.Favourite, DefaultTagID.LowPriority);

                expect(Modal.createDialog).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ description: error.message }),
                );
                // deleteRoomTag swallows the error, so Promise.all still resolves.
                expect(dispatch).toHaveBeenCalledWith(
                    expect.objectContaining({ action: "RoomListActions.tagRoom.success" }),
                );
            });

            it("shows an ErrorDialog and dispatches failure when setRoomTag fails", async () => {
                const error = new Error("set failed");
                jest.spyOn(client, "setRoomTag").mockRejectedValue(error);

                await invokeTagRoom(DefaultTagID.Favourite, DefaultTagID.LowPriority);

                expect(Modal.createDialog).toHaveBeenCalledWith(
                    expect.anything(),
                    expect.objectContaining({ description: error.message }),
                );
                // setRoomTag rethrows, so Promise.all rejects → failure dispatched.
                expect(dispatch).toHaveBeenCalledWith(
                    expect.objectContaining({ action: "RoomListActions.tagRoom.failure" }),
                );
            });
        });
    });
});
