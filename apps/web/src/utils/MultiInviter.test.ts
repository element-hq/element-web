/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { vi, describe, it, expect, beforeEach, afterEach, type Mocked } from "vitest";
import { EventType, type MatrixClient, MatrixError, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import * as TestUtilsMatrix from "test-utils";

import { MatrixClientPeg } from "../MatrixClientPeg";
import Modal, { type ComponentType, type ComponentProps } from "../Modal";
import SettingsStore from "../settings/SettingsStore";
import MultiInviter, { type CompletionStates } from "./MultiInviter";
import AskInviteAnywayDialog from "../components/views/dialogs/AskInviteAnywayDialog";
import ConfirmUserActionDialog from "../components/views/dialogs/ConfirmUserActionDialog";

const ROOMID = "!room:server";

const MXID1 = "@user1:server";
const MXID2 = "@user2:server";
const MXID3 = "@user3:server";

const MXID_PROFILE_STATES: Record<string, () => {}> = {
    [MXID1]: () => ({}),
    [MXID2]: () => {
        throw new MatrixError({ errcode: "M_FORBIDDEN" });
    },
    [MXID3]: () => {
        throw new MatrixError({ errcode: "M_NOT_FOUND" });
    },
};

vi.mock("../Modal", () => ({
    default: {
        createDialog: vi.fn(),
    },
}));

vi.mock("../settings/SettingsStore", () => ({
    default: {
        getValue: vi.fn(),
        monitorSetting: vi.fn(),
        watchSetting: vi.fn(),
    },
}));

const mockPromptBeforeInviteUnknownUsers = (value: boolean) => {
    vi.mocked(SettingsStore.getValue).mockImplementation(
        (settingName: string, roomId?: string | null, _excludeDefault = false): any => {
            if (settingName === "promptBeforeInviteUnknownUsers" && roomId === ROOMID) {
                return value;
            }
        },
    );
};

const mockCreateTrackedDialog = (callbackName: "onInviteAnyways" | "onGiveUp") => {
    vi.mocked(Modal.createDialog).mockImplementation(
        (Element: ComponentType, props?: ComponentProps<ComponentType>) => {
            if (Element === AskInviteAnywayDialog) {
                (props as ComponentProps<typeof AskInviteAnywayDialog>)[callbackName]();
            }
            return { close: vi.fn(), finished: new Promise(() => {}) };
        },
    );
};

const expectAllInvitedResult = (result: CompletionStates) => {
    expect(result).toEqual({
        [MXID1]: "invited",
        [MXID2]: "invited",
        [MXID3]: "invited",
    });
};

describe("MultiInviter", () => {
    let client: Mocked<MatrixClient>;
    let inviter: MultiInviter;

    beforeEach(() => {
        vi.mocked(Modal.createDialog).mockReturnValue({ close: vi.fn(), finished: new Promise(() => {}) });

        TestUtilsMatrix.stubClient();
        client = vi.mocked(MatrixClientPeg.safeGet());

        client.invite = vi.fn();
        client.invite.mockResolvedValue({});

        client.getProfileInfo = vi.fn();
        client.getProfileInfo.mockImplementation(async (userId: string) => {
            const m = MXID_PROFILE_STATES[userId];
            if (m) return m();
            throw new Error();
        });
        client.unban = vi.fn();

        inviter = new MultiInviter(client, ROOMID);
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe("invite", () => {
        it("should show a progress dialog while the invite happens", async () => {
            const mockModalHandle = { close: vi.fn(), finished: new Promise<[]>(() => {}) };
            vi.mocked(Modal.createDialog).mockReturnValue(mockModalHandle);

            const invitePromise = Promise.withResolvers<{}>();
            client.invite.mockReturnValue(invitePromise.promise);

            const resultPromise = inviter.invite([MXID1]);
            expect(Modal.createDialog).toHaveBeenCalledTimes(1);
            expect(mockModalHandle.close).not.toHaveBeenCalled();

            invitePromise.resolve({});
            await resultPromise;
            expect(mockModalHandle.close).toHaveBeenCalled();
        });

        describe("when the server rate limits us", () => {
            const rateLimited = (retryAfterMs?: number) =>
                new MatrixError({
                    errcode: "M_LIMIT_EXCEEDED",
                    error: "Too Many Requests",
                    retry_after_ms: retryAfterMs,
                });

            beforeEach(() => {
                mockPromptBeforeInviteUnknownUsers(false);
                vi.useFakeTimers();
            });

            afterEach(() => {
                vi.useRealTimers();
            });

            it("should wait as long as the server asks before retrying", async () => {
                client.invite.mockRejectedValueOnce(rateLimited(2000)).mockResolvedValue({});

                const resultPromise = inviter.invite([MXID1]);

                await vi.advanceTimersByTimeAsync(1999);
                expect(client.invite).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(1);
                await resultPromise;

                expect(client.invite).toHaveBeenCalledTimes(2);
                expect(inviter.getCompletionState(MXID1)).toBe("invited");
            });

            it("should give up instead of retrying forever", async () => {
                client.invite.mockRejectedValue(rateLimited(1000));

                const resultPromise = inviter.invite([MXID1]);
                await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
                await resultPromise;

                // the initial attempt plus a bounded number of retries, not an unbounded loop
                expect(client.invite).toHaveBeenCalledTimes(4);
                expect(inviter.getCompletionState(MXID1)).toBe("error");
                expect(inviter.getErrorText(MXID1)).toMatchInlineSnapshot(
                    `"Too many invites were sent. Please try again later."`,
                );
            });

            it("should fall back to a fixed delay when the server does not say how long to wait", async () => {
                client.invite.mockRejectedValueOnce(rateLimited()).mockResolvedValue({});

                const resultPromise = inviter.invite([MXID1]);

                await vi.advanceTimersByTimeAsync(4999);
                expect(client.invite).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(1);
                await resultPromise;

                expect(client.invite).toHaveBeenCalledTimes(2);
            });

            it("should not wait longer than the maximum delay however long the server asks for", async () => {
                // The report which prompted this had the server asking for over four minutes.
                client.invite.mockRejectedValueOnce(rateLimited(255839)).mockResolvedValue({});

                const resultPromise = inviter.invite([MXID1]);

                await vi.advanceTimersByTimeAsync(29999);
                expect(client.invite).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(1);
                await resultPromise;

                expect(client.invite).toHaveBeenCalledTimes(2);
            });
        });

        describe("with promptBeforeInviteUnknownUsers = false", () => {
            beforeEach(() => mockPromptBeforeInviteUnknownUsers(false));

            it("should invite all users", async () => {
                const result = await inviter.invite([MXID1, MXID2, MXID3]);

                expect(client.invite).toHaveBeenCalledTimes(3);
                expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, { shareEncryptedHistory: true });
                expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, { shareEncryptedHistory: true });
                expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, { shareEncryptedHistory: true });

                expectAllInvitedResult(result);
            });
        });

        describe("with promptBeforeInviteUnknownUsers = true and", () => {
            beforeEach(() => mockPromptBeforeInviteUnknownUsers(true));

            describe("confirming the unknown user dialog", () => {
                beforeEach(() => mockCreateTrackedDialog("onInviteAnyways"));

                it("should invite all users", async () => {
                    const result = await inviter.invite([MXID1, MXID2, MXID3]);

                    expect(client.invite).toHaveBeenCalledTimes(3);
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, { shareEncryptedHistory: true });
                    expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, { shareEncryptedHistory: true });
                    expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, { shareEncryptedHistory: true });

                    expectAllInvitedResult(result);
                });
            });

            describe("declining the unknown user dialog", () => {
                beforeEach(() => mockCreateTrackedDialog("onGiveUp"));

                it("should only invite existing users", async () => {
                    const result = await inviter.invite([MXID1, MXID2, MXID3]);

                    expect(client.invite).toHaveBeenCalledTimes(1);
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, { shareEncryptedHistory: true });

                    // The resolved state is 'invited' for all users.
                    // With the above client expectations, the test ensures that only the first user is invited.
                    expectAllInvitedResult(result);
                });
            });
        });

        it("should show sensible error when attempting 3pid invite with no identity server", async () => {
            client.inviteByEmail = vi.fn().mockRejectedValueOnce(
                new MatrixError({
                    errcode: "ORG.MATRIX.JSSDK_MISSING_PARAM",
                }),
            );
            await inviter.invite(["foo@bar.com"]);
            expect(inviter.getErrorText("foo@bar.com")).toMatchInlineSnapshot(
                `"Cannot invite user by email without an identity server. You can connect to one under "Settings"."`,
            );
        });

        it("should ask if user wants to unban user if they have permission", async () => {
            vi.mocked(Modal.createDialog).mockImplementation(
                (Element: ComponentType, props?: ComponentProps<ComponentType>): any => {
                    // We stub out the modal with an immediate affirmative (proceed) return
                    return { finished: Promise.resolve([true]) };
                },
            );

            const room = new Room(ROOMID, client, client.getSafeUserId());
            vi.mocked(client.getRoom).mockReturnValue(room);
            const ourMember = new RoomMember(ROOMID, client.getSafeUserId());
            ourMember.membership = KnownMembership.Join;
            ourMember.powerLevel = 100;
            const member = new RoomMember(ROOMID, MXID1);
            member.membership = KnownMembership.Ban;
            member.powerLevel = 0;
            room.getMember = (userId: string) => {
                if (userId === client.getSafeUserId()) return ourMember;
                if (userId === MXID1) return member;
                return null;
            };

            await inviter.invite([MXID1]);
            expect(Modal.createDialog).toHaveBeenCalledWith(ConfirmUserActionDialog, {
                member,
                title: "User cannot be invited until they are unbanned",
                action: "Unban",
            });
            expect(client.unban).toHaveBeenCalledWith(ROOMID, MXID1);
        });

        it("should show sensible error when attempting to invite over federation with m.federate=false", async () => {
            vi.mocked(client.invite).mockRejectedValueOnce(
                new MatrixError({
                    errcode: "M_FORBIDDEN",
                }),
            );
            const room = new Room(ROOMID, client, client.getSafeUserId());
            room.currentState.setStateEvents([
                new MatrixEvent({
                    type: EventType.RoomCreate,
                    state_key: "",
                    content: {
                        "m.federate": false,
                    },
                    room_id: ROOMID,
                }),
            ]);
            vi.mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite(["@user:other_server"]);
            expect(inviter.getErrorText("@user:other_server")).toMatchInlineSnapshot(
                `"This room is unfederated. You cannot invite people from external servers"`,
            );
        });

        it("should not blame permissions for a refusal of an invite we are allowed to send", async () => {
            vi.mocked(client.invite).mockRejectedValueOnce(
                new MatrixError({
                    errcode: "M_FORBIDDEN",
                    error: "Ablehnung: Einladung durch Serverrichtlinie verweigert",
                }),
            );
            const room = new Room(ROOMID, client, client.getSafeUserId());
            room.updateMyMembership(KnownMembership.Join);
            vi.mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite([MXID1, MXID2]);

            expect(inviter.getErrorText(MXID1)).toMatchInlineSnapshot(`"Not accepting invites"`);
            // The server's own wording is untranslated, so it must not reach the user.
            expect(inviter.getErrorText(MXID1)).not.toContain("Serverrichtlinie");
            // The refusal was about one invitee, so the rest of the batch is still worth trying.
            expect(client.invite).toHaveBeenCalledWith(ROOMID, MXID2, { shareEncryptedHistory: true });
        });

        it("should blame permissions only when the user really cannot invite", async () => {
            vi.mocked(client.invite).mockRejectedValue(
                new MatrixError({
                    errcode: "M_FORBIDDEN",
                    error: "You don't have permission to invite users",
                }),
            );
            const room = new Room(ROOMID, client, client.getSafeUserId());
            room.updateMyMembership(KnownMembership.Join);
            room.currentState.setStateEvents([
                new MatrixEvent({
                    type: EventType.RoomPowerLevels,
                    state_key: "",
                    content: { invite: 100 },
                    room_id: ROOMID,
                }),
            ]);
            const ourMember = new RoomMember(ROOMID, client.getSafeUserId());
            ourMember.membership = KnownMembership.Join;
            ourMember.powerLevel = 0;
            room.getMember = (userId: string) => (userId === client.getSafeUserId() ? ourMember : null);
            vi.mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite([MXID1, MXID2]);

            expect(inviter.getErrorText(MXID1)).toMatchInlineSnapshot(
                `"You do not have permission to invite people to this room"`,
            );
            // That will hold for everyone else too, so nothing further is attempted.
            expect(client.invite).toHaveBeenCalledTimes(1);
        });

        it("should show sensible error when attempting to invite over federation with m.federate=false to space", async () => {
            vi.mocked(client.invite).mockRejectedValueOnce(
                new MatrixError({
                    errcode: "M_FORBIDDEN",
                }),
            );
            const room = new Room(ROOMID, client, client.getSafeUserId());
            room.currentState.setStateEvents([
                new MatrixEvent({
                    type: EventType.RoomCreate,
                    state_key: "",
                    content: {
                        "m.federate": false,
                        "type": "m.space",
                    },
                    room_id: ROOMID,
                }),
            ]);
            vi.mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite(["@user:other_server"]);
            expect(inviter.getErrorText("@user:other_server")).toMatchInlineSnapshot(
                `"This space is unfederated. You cannot invite people from external servers"`,
            );
        });
    });
});
