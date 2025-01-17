/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    EventType,
    MatrixClient,
    MatrixEvent,
    Room,
    RoomState,
    RoomStateEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { CryptoEvent, UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { act, render, screen, waitFor } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { stubClient } from "../../../../test-utils";
import { UserIdentityWarning } from "../../../../../src/components/views/rooms/UserIdentityWarning";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

const ROOM_ID = "!room:id";

function mockRoom(): Room {
    const room = {
        getEncryptionTargetMembers: jest.fn(async () => []),
        getMember: jest.fn((userId) => {}),
        roomId: ROOM_ID,
        shouldEncryptForInvitedMembers: jest.fn(() => true),
    } as unknown as Room;

    return room;
}

function mockRoomMember(userId: string, name?: string): RoomMember {
    return {
        userId,
        name: name ?? userId,
        rawDisplayName: name ?? userId,
        roomId: ROOM_ID,
        getMxcAvatarUrl: jest.fn(),
    } as unknown as RoomMember;
}

function dummyRoomState(): RoomState {
    return new RoomState(ROOM_ID);
}

/**
 * Get the warning element, given the warning text (excluding the "Learn more"
 * link).  This is needed because the warning text contains a `<b>` tag, so the
 * normal `getByText` doesn't work.
 */
function getWarningByText(text: string): Element {
    return screen.getByText((content?: string, element?: Element | null): boolean => {
        return (
            !!element &&
            element.classList.contains("mx_UserIdentityWarning_main") &&
            element.textContent === text + " Learn more"
        );
    });
}

function renderComponent(client: MatrixClient, room: Room) {
    return render(<UserIdentityWarning room={room} key={ROOM_ID} />, {
        wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
    });
}

describe("UserIdentityWarning", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(async () => {
        client = stubClient();
        room = mockRoom();
        jest.spyOn(client.getCrypto()!, "isEncryptionEnabledInRoom").mockResolvedValue(true);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // This tests the basic functionality of the component.  If we have a room
    // member whose identity needs accepting, we should display a warning.  When
    // the "OK" button gets pressed, it should call `pinCurrentUserIdentity`.
    it("displays a warning when a user's identity needs approval", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
        ]);
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false, true),
        );
        crypto.pinCurrentUserIdentity = jest.fn();
        renderComponent(client, room);

        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );
        await userEvent.click(screen.getByRole("button")!);
        await waitFor(() => expect(crypto.pinCurrentUserIdentity).toHaveBeenCalledWith("@alice:example.org"));
    });

    // We don't display warnings in non-encrypted rooms, but if encryption is
    // enabled, then we should display a warning if there are any users whose
    // identity need accepting.
    it("displays pending warnings when encryption is enabled", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
        ]);
        // Start the room off unencrypted.  We shouldn't display anything.
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "isEncryptionEnabledInRoom").mockResolvedValue(false);
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false, true),
        );

        renderComponent(client, room);
        await sleep(10); // give it some time to finish initialising
        expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow();

        // Encryption gets enabled in the room.  We should now warn that Alice's
        // identity changed.
        jest.spyOn(crypto, "isEncryptionEnabledInRoom").mockResolvedValue(true);
        client.emit(
            RoomStateEvent.Events,
            new MatrixEvent({
                event_id: "$event_id",
                type: EventType.RoomEncryption,
                state_key: "",
                content: {
                    algorithm: "m.megolm.v1.aes-sha2",
                },
                room_id: ROOM_ID,
                sender: "@alice:example.org",
            }),
            dummyRoomState(),
            null,
        );
        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );
    });

    // When a user's identity needs approval, or has been approved, the display
    // should update appropriately.
    it("updates the display when identity changes", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
        ]);
        jest.spyOn(room, "getMember").mockReturnValue(mockRoomMember("@alice:example.org", "Alice"));
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false, false),
        );
        renderComponent(client, room);
        await sleep(10); // give it some time to finish initialising
        expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow();

        // The user changes their identity, so we should show the warning.
        act(() => {
            client.emit(
                CryptoEvent.UserTrustStatusChanged,
                "@alice:example.org",
                new UserVerificationStatus(false, false, false, true),
            );
        });
        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );

        // Simulate the user's new identity having been approved, so we no
        // longer show the warning.
        act(() => {
            client.emit(
                CryptoEvent.UserTrustStatusChanged,
                "@alice:example.org",
                new UserVerificationStatus(false, false, false, false),
            );
        });
        await waitFor(() =>
            expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow(),
        );
    });

    // We only display warnings about users in the room.  When someone
    // joins/leaves, we should update the warning appropriately.
    describe("updates the display when a member joins/leaves", () => {
        it("when invited users can see encrypted messages", async () => {
            // Nobody in the room yet
            jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([]);
            jest.spyOn(room, "getMember").mockImplementation((userId) => mockRoomMember(userId));
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(true);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising

            // Alice joins.  Her identity needs approval, so we should show a warning.
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@alice:example.org",
                    content: {
                        membership: "join",
                    },
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                }),
                dummyRoomState(),
                null,
            );
            await waitFor(() =>
                expect(getWarningByText("@alice:example.org's identity appears to have changed.")).toBeInTheDocument(),
            );

            // Bob is invited.  His identity needs approval, so we should show a
            // warning for him after Alice's warning is resolved by her leaving.
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@bob:example.org",
                    content: {
                        membership: "invite",
                    },
                    room_id: ROOM_ID,
                    sender: "@carol:example.org",
                }),
                dummyRoomState(),
                null,
            );

            // Alice leaves, so we no longer show her warning, but we will show
            // a warning for Bob.
            act(() => {
                client.emit(
                    RoomStateEvent.Events,
                    new MatrixEvent({
                        event_id: "$event_id",
                        type: EventType.RoomMember,
                        state_key: "@alice:example.org",
                        content: {
                            membership: "leave",
                        },
                        room_id: ROOM_ID,
                        sender: "@alice:example.org",
                    }),
                    dummyRoomState(),
                    null,
                );
            });
            await waitFor(() =>
                expect(() => getWarningByText("@alice:example.org's identity appears to have changed.")).toThrow(),
            );
            await waitFor(() =>
                expect(getWarningByText("@bob:example.org's identity appears to have changed.")).toBeInTheDocument(),
            );
        });

        it("when invited users cannot see encrypted messages", async () => {
            // Nobody in the room yet
            jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([]);
            jest.spyOn(room, "getMember").mockImplementation((userId) => mockRoomMember(userId));
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(false);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising

            // Alice joins.  Her identity needs approval, so we should show a warning.
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@alice:example.org",
                    content: {
                        membership: "join",
                    },
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                }),
                dummyRoomState(),
                null,
            );
            await waitFor(() =>
                expect(getWarningByText("@alice:example.org's identity appears to have changed.")).toBeInTheDocument(),
            );

            // Bob is invited. His identity needs approval, but we don't encrypt
            // to him, so we won't show a warning. (When Alice leaves, the
            // display won't be updated to show a warningfor Bob.)
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@bob:example.org",
                    content: {
                        membership: "invite",
                    },
                    room_id: ROOM_ID,
                    sender: "@carol:example.org",
                }),
                dummyRoomState(),
                null,
            );

            // Alice leaves, so we no longer show her warning, and we don't show
            // a warning for Bob.
            act(() => {
                client.emit(
                    RoomStateEvent.Events,
                    new MatrixEvent({
                        event_id: "$event_id",
                        type: EventType.RoomMember,
                        state_key: "@alice:example.org",
                        content: {
                            membership: "leave",
                        },
                        room_id: ROOM_ID,
                        sender: "@alice:example.org",
                    }),
                    dummyRoomState(),
                    null,
                );
            });
            await waitFor(() =>
                expect(() => getWarningByText("@alice:example.org's identity appears to have changed.")).toThrow(),
            );
            await waitFor(() =>
                expect(() => getWarningByText("@bob:example.org's identity appears to have changed.")).toThrow(),
            );
        });

        it("when member leaves immediately after component is loaded", async () => {
            jest.spyOn(room, "getEncryptionTargetMembers").mockImplementation(async () => {
                setTimeout(() => {
                    // Alice immediately leaves after we get the room
                    // membership, so we shouldn't show the warning any more
                    client.emit(
                        RoomStateEvent.Events,
                        new MatrixEvent({
                            event_id: "$event_id",
                            type: EventType.RoomMember,
                            state_key: "@alice:example.org",
                            content: {
                                membership: "leave",
                            },
                            room_id: ROOM_ID,
                            sender: "@alice:example.org",
                        }),
                        dummyRoomState(),
                        null,
                    );
                });
                return [mockRoomMember("@alice:example.org")];
            });
            jest.spyOn(room, "getMember").mockImplementation((userId) => mockRoomMember(userId));
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(false);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);

            await sleep(10);
            expect(() => getWarningByText("@alice:example.org's identity appears to have changed.")).toThrow();
        });

        it("when member leaves immediately after joining", async () => {
            // Nobody in the room yet
            jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([]);
            jest.spyOn(room, "getMember").mockImplementation((userId) => mockRoomMember(userId));
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(false);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising

            // Alice joins.  Her identity needs approval, so we should show a warning.
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@alice:example.org",
                    content: {
                        membership: "join",
                    },
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                }),
                dummyRoomState(),
                null,
            );
            // ... but she immediately leaves, so we shouldn't show the warning any more
            client.emit(
                RoomStateEvent.Events,
                new MatrixEvent({
                    event_id: "$event_id",
                    type: EventType.RoomMember,
                    state_key: "@alice:example.org",
                    content: {
                        membership: "leave",
                    },
                    room_id: ROOM_ID,
                    sender: "@alice:example.org",
                }),
                dummyRoomState(),
                null,
            );
            await sleep(10); // give it some time to finish
            expect(() => getWarningByText("@alice:example.org's identity appears to have changed.")).toThrow();
        });
    });

    // When we have multiple users whose identity needs approval, one user's
    // identity no longer needs approval (e.g. their identity was approved),
    // then we show the next one.
    it("displays the next user when the current user's identity is approved", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
            mockRoomMember("@bob:example.org"),
        ]);
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, false, false, true),
        );

        renderComponent(client, room);
        // We should warn about Alice's identity first.
        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );

        // Simulate Alice's new identity having been approved, so now we warn
        // about Bob's identity.
        act(() => {
            client.emit(
                CryptoEvent.UserTrustStatusChanged,
                "@alice:example.org",
                new UserVerificationStatus(false, false, false, false),
            );
        });
        await waitFor(() =>
            expect(getWarningByText("@bob:example.org's identity appears to have changed.")).toBeInTheDocument(),
        );
    });

    // If we get an update for a user's verification status while we're fetching
    // that user's verification status, we should display based on the updated
    // value.
    describe("handles races between fetching verification status and receiving updates", () => {
        // First case: check that if the update says that the user identity
        // needs approval, but the fetch says it doesn't, we show the warning.
        it("update says identity needs approval", async () => {
            jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
                mockRoomMember("@alice:example.org", "Alice"),
            ]);
            jest.spyOn(room, "getMember").mockReturnValue(mockRoomMember("@alice:example.org", "Alice"));
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockImplementation(async () => {
                act(() => {
                    client.emit(
                        CryptoEvent.UserTrustStatusChanged,
                        "@alice:example.org",
                        new UserVerificationStatus(false, false, false, true),
                    );
                });
                return Promise.resolve(new UserVerificationStatus(false, false, false, false));
            });
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising
            await waitFor(() =>
                expect(
                    getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
                ).toBeInTheDocument(),
            );
        });

        // Second case: check that if the update says that the user identity
        // doesn't needs approval, but the fetch says it does, we don't show the
        // warning.
        it("update says identity doesn't need approval", async () => {
            jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
                mockRoomMember("@alice:example.org", "Alice"),
            ]);
            jest.spyOn(room, "getMember").mockReturnValue(mockRoomMember("@alice:example.org", "Alice"));
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockImplementation(async () => {
                act(() => {
                    client.emit(
                        CryptoEvent.UserTrustStatusChanged,
                        "@alice:example.org",
                        new UserVerificationStatus(false, false, false, false),
                    );
                });
                return Promise.resolve(new UserVerificationStatus(false, false, false, true));
            });
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising
            await waitFor(() =>
                expect(() =>
                    getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
                ).toThrow(),
            );
        });
    });
});
