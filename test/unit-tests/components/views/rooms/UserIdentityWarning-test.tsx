/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { sleep } from "matrix-js-sdk/src/utils";
import {
    EventType,
    type MatrixClient,
    MatrixEvent,
    type Room,
    RoomState,
    RoomStateEvent,
    type RoomMember,
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

function mockMembershipForRoom(room: Room, users: string[] | [string, "joined" | "invited"][]): void {
    const encryptToInvited = room.shouldEncryptForInvitedMembers();
    const members = users
        .filter((user) => {
            if (Array.isArray(user)) {
                return encryptToInvited || user[1] === "joined";
            } else {
                return true;
            }
        })
        .map((id) => {
            if (Array.isArray(id)) {
                return mockRoomMember(id[0]);
            } else {
                return mockRoomMember(id);
            }
        });

    jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue(members);

    jest.spyOn(room, "getMember").mockImplementation((userId) => {
        return members.find((member) => member.userId === userId) ?? null;
    });
}

function emitMembershipChange(client: MatrixClient, userId: string, membership: "join" | "leave" | "invite"): void {
    const sender = membership === "invite" ? "@carol:example.org" : userId;
    client.emit(
        RoomStateEvent.Events,
        new MatrixEvent({
            event_id: "$event_id",
            type: EventType.RoomMember,
            state_key: userId,
            content: {
                membership: membership,
            },
            room_id: ROOM_ID,
            sender: sender,
        }),
        dummyRoomState(),
        null,
    );
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
        crypto.pinCurrentUserIdentity = jest.fn().mockResolvedValue(undefined);
        renderComponent(client, room);

        await waitFor(() =>
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );
        await userEvent.click(screen.getByRole("button")!);
        await waitFor(() => expect(crypto.pinCurrentUserIdentity).toHaveBeenCalledWith("@alice:example.org"));
    });

    // This tests the basic functionality of the component.  If we have a room
    // member whose identity is in verification violation, we should display a warning.  When
    // the "Withdraw verification" button gets pressed, it should call `withdrawVerification`.
    it("displays a warning when a user's identity is in verification violation", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
        ]);
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(false, true, false, true),
        );
        crypto.withdrawVerificationRequirement = jest.fn().mockResolvedValue(undefined);
        renderComponent(client, room);

        await waitFor(() =>
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );

        expect(
            screen.getByRole("button", {
                name: "Withdraw verification",
            }),
        ).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button")!);
        await waitFor(() => expect(crypto.withdrawVerificationRequirement).toHaveBeenCalledWith("@alice:example.org"));
    });

    it("Should not display a warning if the user was verified and is still verified", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
        ]);
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
            new UserVerificationStatus(true, true, false, false),
        );

        renderComponent(client, room);
        await sleep(10); // give it some time to finish initialising

        expect(() => getWarningByText("Alice's (@alice:example.org) identity was reset.")).toThrow();
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
        expect(() => getWarningByText("Alice's (@alice:example.org) identity was reset.")).toThrow();

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
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );
    });

    describe("Warnings are displayed in consistent order", () => {
        it("Ensure lexicographic order for prompt", async () => {
            // members are not returned lexicographic order
            mockMembershipForRoom(room, ["@b:example.org", "@a:example.org"]);

            const crypto = client.getCrypto()!;

            // All identities needs approval
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );

            crypto.pinCurrentUserIdentity = jest.fn();
            renderComponent(client, room);

            await waitFor(() => expect(getWarningByText("@a:example.org's identity was reset.")).toBeInTheDocument());
        });

        it("Ensure existing prompt stays even if a new violation with lower lexicographic order detected", async () => {
            mockMembershipForRoom(room, ["@b:example.org"]);

            const crypto = client.getCrypto()!;

            // All identities needs approval
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );

            crypto.pinCurrentUserIdentity = jest.fn();
            renderComponent(client, room);

            await waitFor(() => expect(getWarningByText("@b:example.org's identity was reset.")).toBeInTheDocument());

            // Simulate a new member joined with lower lexico order and also in violation
            mockMembershipForRoom(room, ["@a:example.org", "@b:example.org"]);

            act(() => {
                emitMembershipChange(client, "@a:example.org", "join");
            });

            // We should still display the warning for @b:example.org
            await waitFor(() => expect(getWarningByText("@b:example.org's identity was reset.")).toBeInTheDocument());
        });
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
        await act(async () => {
            renderComponent(client, room);
            await sleep(50);
        });

        expect(() => getWarningByText("Alice's (@alice:example.org) identity was reset.")).toThrow();

        // The user changes their identity, so we should show the warning.
        act(() => {
            const newStatus = new UserVerificationStatus(false, false, false, true);
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(newStatus);
            client.emit(CryptoEvent.UserTrustStatusChanged, "@alice:example.org", newStatus);
        });

        await waitFor(() =>
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );

        // Simulate the user's new identity having been approved, so we no
        // longer show the warning.
        act(() => {
            const newStatus = new UserVerificationStatus(false, false, false, false);
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(newStatus);
            client.emit(CryptoEvent.UserTrustStatusChanged, "@alice:example.org", newStatus);
        });
        await waitFor(() =>
            expect(() => getWarningByText("Alice's (@alice:example.org) identity was reset.")).toThrow(),
        );
    });

    // We only display warnings about users in the room.  When someone
    // joins/leaves, we should update the warning appropriately.
    describe("updates the display when a member joins/leaves", () => {
        it("when invited users can see encrypted messages", async () => {
            // Nobody in the room yet
            mockMembershipForRoom(room, []);
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(true);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising

            // Alice joins.  Her identity needs approval, so we should show a warning.
            act(() => {
                mockMembershipForRoom(room, ["@alice:example.org"]);
                emitMembershipChange(client, "@alice:example.org", "join");
            });

            await waitFor(() =>
                expect(getWarningByText("@alice:example.org's identity was reset.")).toBeInTheDocument(),
            );

            // Bob is invited.  His identity needs approval, so we should show a
            // warning for him after Alice's warning is resolved by her leaving.
            act(() => {
                mockMembershipForRoom(room, ["@alice:example.org", "@bob:example.org"]);
                emitMembershipChange(client, "@bob:example.org", "invite");
            });

            // Alice leaves, so we no longer show her warning, but we will show
            // a warning for Bob.
            act(() => {
                mockMembershipForRoom(room, ["@bob:example.org"]);
                emitMembershipChange(client, "@alice:example.org", "leave");
            });

            await waitFor(() => expect(() => getWarningByText("@alice:example.org's identity was reset.")).toThrow());
            await waitFor(() => expect(getWarningByText("@bob:example.org's identity was reset.")).toBeInTheDocument());
        });

        it("when invited users cannot see encrypted messages", async () => {
            // Nobody in the room yet
            mockMembershipForRoom(room, []);
            // jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([]);
            // jest.spyOn(room, "getMember").mockImplementation((userId) => mockRoomMember(userId));
            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(false);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );
            renderComponent(client, room);
            await sleep(10); // give it some time to finish initialising

            // Alice joins.  Her identity needs approval, so we should show a warning.
            act(() => {
                mockMembershipForRoom(room, ["@alice:example.org"]);
                emitMembershipChange(client, "@alice:example.org", "join");
            });
            await waitFor(() =>
                expect(getWarningByText("@alice:example.org's identity was reset.")).toBeInTheDocument(),
            );

            // Bob is invited. His identity needs approval, but we don't encrypt
            // to him, so we won't show a warning. (When Alice leaves, the
            // display won't be updated to show a warningfor Bob.)
            act(() => {
                mockMembershipForRoom(room, [
                    ["@alice:example.org", "joined"],
                    ["@bob:example.org", "invited"],
                ]);
                emitMembershipChange(client, "@bob:example.org", "invite");
            });

            // Alice leaves, so we no longer show her warning, and we don't show
            // a warning for Bob.
            act(() => {
                mockMembershipForRoom(room, [["@bob:example.org", "invited"]]);
                emitMembershipChange(client, "@alice:example.org", "leave");
            });
            await waitFor(() => expect(() => getWarningByText("@alice:example.org's identity was reset.")).toThrow());
            await waitFor(() => expect(() => getWarningByText("@bob:example.org's identity was reset.")).toThrow());
        });

        it("when member leaves immediately after component is loaded", async () => {
            let hasLeft = false;
            jest.spyOn(room, "getEncryptionTargetMembers").mockImplementation(async () => {
                if (hasLeft) return [];
                setTimeout(() => {
                    emitMembershipChange(client, "@alice:example.org", "leave");
                    hasLeft = true;
                });
                return [mockRoomMember("@alice:example.org")];
            });

            jest.spyOn(room, "shouldEncryptForInvitedMembers").mockReturnValue(false);
            const crypto = client.getCrypto()!;
            jest.spyOn(crypto, "getUserVerificationStatus").mockResolvedValue(
                new UserVerificationStatus(false, false, false, true),
            );

            await act(async () => {
                renderComponent(client, room);
                await sleep(10);
            });
            expect(() => getWarningByText("@alice:example.org's identity was reset.")).toThrow();
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
            expect(() => getWarningByText("@alice:example.org's identity was reset.")).toThrow();
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
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );

        // Simulate Alice's new identity having been approved, so now we warn
        // about Bob's identity.
        act(() => {
            const newStatus = new UserVerificationStatus(false, false, false, false);
            jest.spyOn(crypto, "getUserVerificationStatus").mockImplementation(async (userId) => {
                if (userId == "@alice:example.org") {
                    return newStatus;
                } else {
                    return new UserVerificationStatus(false, false, false, true);
                }
            });
            client.emit(CryptoEvent.UserTrustStatusChanged, "@alice:example.org", newStatus);
        });
        await waitFor(() => expect(getWarningByText("@bob:example.org's identity was reset.")).toBeInTheDocument());
    });

    it("displays the next user when the verification requirement is withdrawn", async () => {
        jest.spyOn(room, "getEncryptionTargetMembers").mockResolvedValue([
            mockRoomMember("@alice:example.org", "Alice"),
            mockRoomMember("@bob:example.org"),
        ]);
        const crypto = client.getCrypto()!;
        jest.spyOn(crypto, "getUserVerificationStatus").mockImplementation(async (userId) => {
            if (userId == "@alice:example.org") {
                return new UserVerificationStatus(false, true, false, true);
            } else {
                return new UserVerificationStatus(false, false, false, true);
            }
        });

        renderComponent(client, room);
        // We should warn about Alice's identity first.
        await waitFor(() =>
            expect(getWarningByText("Alice's (@alice:example.org) identity was reset.")).toBeInTheDocument(),
        );

        // Simulate Alice's new identity having been approved, so now we warn
        // about Bob's identity.
        act(() => {
            jest.spyOn(crypto, "getUserVerificationStatus").mockImplementation(async (userId) => {
                if (userId == "@alice:example.org") {
                    return new UserVerificationStatus(false, false, false, false);
                } else {
                    return new UserVerificationStatus(false, false, false, true);
                }
            });
            client.emit(
                CryptoEvent.UserTrustStatusChanged,
                "@alice:example.org",
                new UserVerificationStatus(false, false, false, false),
            );
        });
        await waitFor(() => expect(getWarningByText("@bob:example.org's identity was reset.")).toBeInTheDocument());
    });
});
