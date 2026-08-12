/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi, describe, beforeEach, it, expect } from "vitest";
import { type MatrixClient, RoomNameType } from "matrix-js-sdk/src/matrix";

import { createClientWithCreds } from "./createMatrixClient";

describe("createMatrixClient", () => {
    let client: MatrixClient;

    beforeEach(() => {
        vi.stubGlobal("localStorage", {
            getItem: vi.fn().mockReturnValue(null),
            setItem: vi.fn(),
            removeItem: vi.fn(),
        });

        client = createClientWithCreds({
            homeserverUrl: "https://test.dummy",
            userId: "@user:test.dummy",
            accessToken: "access_token",
        });
    });

    describe("room name generator", () => {
        it("should return empty room for an empty room", () => {
            const roomName = client.roomNameGenerator?.("", {
                type: RoomNameType.EmptyRoom,
            });
            expect(roomName).toBe("Empty room");
        });

        it("should include the old name for an empty room that used to have a name", () => {
            const roomName = client.roomNameGenerator?.("", {
                type: RoomNameType.EmptyRoom,
                oldName: "Old Room",
            });
            expect(roomName).toBe("Empty room (was Old Room)");
        });

        it("should return null for an actual room name", () => {
            const roomName = client.roomNameGenerator?.("", {
                type: RoomNameType.Actual,
                name: "Some name",
            });
            expect(roomName).toBeNull();
        });

        describe("generated room names", () => {
            it("should return empty room when there are no members", () => {
                const roomName = client.roomNameGenerator?.("", {
                    type: RoomNameType.Generated,
                    names: [],
                    count: 0,
                });
                expect(roomName).toBe("Empty room");
            });

            it("should return the single member name when there is only one other member", () => {
                const roomName = client.roomNameGenerator?.("", {
                    type: RoomNameType.Generated,
                    names: ["Alice"],
                    count: 2,
                });
                expect(roomName).toBe("Alice");
            });

            it("should join two member names with 'and'", () => {
                const roomName = client.roomNameGenerator?.("", {
                    type: RoomNameType.Generated,
                    names: ["Alice", "Bob"],
                    count: 2,
                });
                expect(roomName).toBe("Alice and Bob");
            });

            it("should name the first member and count the rest when there is one other member not named", () => {
                const roomName = client.roomNameGenerator?.("", {
                    type: RoomNameType.Generated,
                    names: ["Alice", "Bob"],
                    count: 3,
                });
                expect(roomName).toBe("Alice and one other");
            });

            it("should name the first member and count the rest when there are multiple members not named", () => {
                const roomName = client.roomNameGenerator?.("", {
                    type: RoomNameType.Generated,
                    names: ["Alice", "Bob", "Carol"],
                    count: 3,
                });
                expect(roomName).toBe("Alice and 2 others");
            });

            describe("when inviting", () => {
                it("should return empty room when there are no invitees", () => {
                    const roomName = client.roomNameGenerator?.("", {
                        type: RoomNameType.Generated,
                        subtype: "Inviting",
                        names: [],
                        count: 0,
                    });
                    expect(roomName).toBe("Empty room");
                });

                it("should return the single invitee name when there is only one invitee", () => {
                    const roomName = client.roomNameGenerator?.("", {
                        type: RoomNameType.Generated,
                        subtype: "Inviting",
                        names: ["Alice"],
                        count: 1,
                    });
                    expect(roomName).toBe("Alice");
                });

                it("should say who is being invited when there are two invitees", () => {
                    const roomName = client.roomNameGenerator?.("", {
                        type: RoomNameType.Generated,
                        subtype: "Inviting",
                        names: ["Alice", "Bob"],
                        count: 2,
                    });
                    expect(roomName).toBe("Inviting Alice and Bob");
                });

                it("should name the first invitee and count the rest when there are more than two invitees", () => {
                    const roomName = client.roomNameGenerator?.("", {
                        type: RoomNameType.Generated,
                        subtype: "Inviting",
                        names: ["Alice", "Bob", "Carol"],
                        count: 3,
                    });
                    expect(roomName).toBe("Inviting Alice and 2 others");
                });

                it("should count uninvited members separately from named invitees", () => {
                    const roomName = client.roomNameGenerator?.("", {
                        type: RoomNameType.Generated,
                        subtype: "Inviting",
                        names: ["Alice", "Bob"],
                        count: 4,
                    });
                    expect(roomName).toBe("Inviting Alice and 3 others");
                });
            });
        });
    });
});
