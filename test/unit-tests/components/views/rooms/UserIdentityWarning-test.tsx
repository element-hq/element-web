/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    CryptoEvent,
    EventType,
    MatrixClient,
    MatrixEvent,
    Room,
    RoomState,
    RoomStateEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { UserVerificationStatus } from "matrix-js-sdk/src/crypto-api";
import { fireEvent, render, screen, waitFor } from "jest-matrix-react";

import { stubClient } from "../../../../test-utils";
import UserIdentityWarning from "../../../../../src/components/views/rooms/UserIdentityWarning";
import MatrixClientContext from "../../../../../src/contexts/MatrixClientContext";

const ROOM_ID = "!room:id";

function mockRoom(): Room {
    const room = {
        getEncryptionTargetMembers: jest.fn(async () => []),
        getMember: jest.fn((userId) => {}),
        roomId: ROOM_ID,
        shouldEncryptForInvitedMembers: jest.fn(() => true),
        hasEncryptionStateEvent: jest.fn(() => true),
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

// Get the warning element, given the warning text (excluding the "Learn more" link).
function getWarningByText(text: string): Element {
    return screen.getByText((content?: string, element?: Element | null): boolean => {
        return (
            !!element &&
            element.classList.contains("mx_UserIdentityWarning_main") &&
            element.textContent === text + " Learn more"
        );
    });
}

describe("UserIdentityWarning", () => {
    let client: MatrixClient;
    let room: Room;

    beforeEach(async () => {
        client = stubClient();
        room = mockRoom();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    // This tests the basic functionality of the component.  If we have a room
    // member whose identity needs accepting, we should display a warning.  When
    // the "OK" button gets pressed, it should call `pinCurrentUserIdentity`.
    it("displays a warning when a user's identity needs approval", async () => {
        room.getEncryptionTargetMembers = jest.fn(async () => {
            return [mockRoomMember("@alice:example.org", "Alice")];
        });
        const crypto = client.getCrypto()!;
        crypto["getUserVerificationStatus"] = jest.fn(async () => {
            return Promise.resolve(new UserVerificationStatus(false, false, false, true));
        });
        crypto.pinCurrentUserIdentity = jest.fn();
        const { container } = render(<UserIdentityWarning room={room} />, {
            wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
        });

        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );
        fireEvent.click(container.querySelector("[role=button]")!);
        await waitFor(() => expect(crypto.pinCurrentUserIdentity).toHaveBeenCalledWith("@alice:example.org"));
    });

    // We don't display warnings in non-encrypted rooms, but if encryption is
    // enabled, then we should display a warning if there are any users whose
    // identity need accepting.
    it("displays pending warnings when encryption is enabled", async () => {
        room.getEncryptionTargetMembers = jest.fn(async () => {
            return [mockRoomMember("@alice:example.org", "Alice")];
        });
        // Start the room off unencrypted.  We shouldn't display anything.
        room.hasEncryptionStateEvent = jest.fn(() => false);
        const crypto = client.getCrypto()!;
        crypto["getUserVerificationStatus"] = jest.fn(async () => {
            return Promise.resolve(new UserVerificationStatus(false, false, false, true));
        });

        render(<UserIdentityWarning room={room} />, {
            wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
        });
        await sleep(10); // give it some time to finish initialising
        expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow();

        // Encryption gets enabled in the room.  We should now warn that Alice's
        // identity changed.
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
        room.getEncryptionTargetMembers = jest.fn(async () => {
            return [mockRoomMember("@alice:example.org", "Alice")];
        });
        room.getMember = jest.fn(() => mockRoomMember("@alice:example.org", "Alice"));
        const crypto = client.getCrypto()!;
        crypto["getUserVerificationStatus"] = jest.fn(async () => {
            return Promise.resolve(new UserVerificationStatus(false, false, false, false));
        });
        render(<UserIdentityWarning room={room} />, {
            wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
        });
        await sleep(10); // give it some time to finish initialising
        expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow();

        // The user changes their identity, so we should show the warning.
        client.emit(
            CryptoEvent.UserTrustStatusChanged,
            "@alice:example.org",
            new UserVerificationStatus(false, false, false, true),
        );
        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );

        // Simulate the user's new identity having been approved, so we no
        // longer show the warning.
        client.emit(
            CryptoEvent.UserTrustStatusChanged,
            "@alice:example.org",
            new UserVerificationStatus(false, false, false, false),
        );
        await waitFor(() =>
            expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow(),
        );
    });

    // We only display warnings about users in the room.  When someone
    // joins/leaves, we should update the warning appropriately.
    it("updates the display when a member joins/leaves", async () => {
        // Nobody in the room yet
        room.getEncryptionTargetMembers = jest.fn(async () => {
            return [];
        });
        room.getMember = jest.fn(() => mockRoomMember("@alice:example.org", "Alice"));
        const crypto = client.getCrypto()!;
        crypto["getUserVerificationStatus"] = jest.fn(async () => {
            return Promise.resolve(new UserVerificationStatus(false, false, false, true));
        });
        render(<UserIdentityWarning room={room} />, {
            wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
        });
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
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );

        // Alice leaves, so we no longer show her warning.
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
        await waitFor(() =>
            expect(() => getWarningByText("Alice's (@alice:example.org) identity appears to have changed.")).toThrow(),
        );
    });

    // When we have multiple users whose identity needs approval, one user's
    // identity no longer reeds approval (e.g. their identity was approved),
    // then we show the next one.
    it("displays the next user when the current user's identity is approved", async () => {
        room.getEncryptionTargetMembers = jest.fn(async () => {
            return [mockRoomMember("@alice:example.org", "Alice"), mockRoomMember("@bob:example.org")];
        });
        const crypto = client.getCrypto()!;
        crypto["getUserVerificationStatus"] = jest.fn(async () => {
            return Promise.resolve(new UserVerificationStatus(false, false, false, true));
        });

        render(<UserIdentityWarning room={room} />, {
            wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
        });
        // We should warn about Alice's identity first.
        await waitFor(() =>
            expect(
                getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
            ).toBeInTheDocument(),
        );

        // Simulate Alice's new identity having been approved, so now we warn
        // about Bob's identity.
        client.emit(
            CryptoEvent.UserTrustStatusChanged,
            "@alice:example.org",
            new UserVerificationStatus(false, false, false, false),
        );
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
            room.getEncryptionTargetMembers = jest.fn(async () => {
                return [mockRoomMember("@alice:example.org", "Alice")];
            });
            room.getMember = jest.fn(() => mockRoomMember("@alice:example.org", "Alice"));
            const crypto = client.getCrypto()!;
            crypto["getUserVerificationStatus"] = jest.fn(async () => {
                client.emit(
                    CryptoEvent.UserTrustStatusChanged,
                    "@alice:example.org",
                    new UserVerificationStatus(false, false, false, true),
                );
                return Promise.resolve(new UserVerificationStatus(false, false, false, false));
            });
            render(<UserIdentityWarning room={room} />, {
                wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
            });
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
            room.getEncryptionTargetMembers = jest.fn(async () => {
                return [mockRoomMember("@alice:example.org", "Alice")];
            });
            room.getMember = jest.fn(() => mockRoomMember("@alice:example.org", "Alice"));
            const crypto = client.getCrypto()!;
            crypto["getUserVerificationStatus"] = jest.fn(async () => {
                client.emit(
                    CryptoEvent.UserTrustStatusChanged,
                    "@alice:example.org",
                    new UserVerificationStatus(false, false, false, false),
                );
                return Promise.resolve(new UserVerificationStatus(false, false, false, true));
            });
            render(<UserIdentityWarning room={room} />, {
                wrapper: ({ ...rest }) => <MatrixClientContext.Provider value={client} {...rest} />,
            });
            await sleep(10); // give it some time to finish initialising
            await waitFor(() =>
                expect(() =>
                    getWarningByText("Alice's (@alice:example.org) identity appears to have changed."),
                ).toThrow(),
            );
        });
    });
});
