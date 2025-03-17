/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { mocked } from "jest-mock";
import { EventType, type MatrixClient, MatrixError, MatrixEvent, Room, RoomMember } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import Modal, { type ComponentType, type ComponentProps } from "../../../src/Modal";
import SettingsStore from "../../../src/settings/SettingsStore";
import MultiInviter, { type CompletionStates } from "../../../src/utils/MultiInviter";
import * as TestUtilsMatrix from "../../test-utils";
import type AskInviteAnywayDialog from "../../../src/components/views/dialogs/AskInviteAnywayDialog";
import ConfirmUserActionDialog from "../../../src/components/views/dialogs/ConfirmUserActionDialog";

const ROOMID = "!room:server";

const MXID1 = "@user1:server";
const MXID2 = "@user2:server";
const MXID3 = "@user3:server";

const MXID_PROFILE_STATES: Record<string, Promise<any>> = {
    [MXID1]: Promise.resolve({}),
    [MXID2]: Promise.reject(new MatrixError({ errcode: "M_FORBIDDEN" })),
    [MXID3]: Promise.reject(new MatrixError({ errcode: "M_NOT_FOUND" })),
};

jest.mock("../../../src/Modal", () => ({
    createDialog: jest.fn(),
}));

jest.mock("../../../src/settings/SettingsStore", () => ({
    getValue: jest.fn(),
    monitorSetting: jest.fn(),
    watchSetting: jest.fn(),
}));

const mockPromptBeforeInviteUnknownUsers = (value: boolean) => {
    mocked(SettingsStore.getValue).mockImplementation(
        (settingName: string, roomId: string, _excludeDefault = false): any => {
            if (settingName === "promptBeforeInviteUnknownUsers" && roomId === ROOMID) {
                return value;
            }
        },
    );
};

const mockCreateTrackedDialog = (callbackName: "onInviteAnyways" | "onGiveUp") => {
    mocked(Modal.createDialog).mockImplementation(
        (Element: ComponentType, props?: ComponentProps<ComponentType>): any => {
            (props as ComponentProps<typeof AskInviteAnywayDialog>)[callbackName]();
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
    let client: jest.Mocked<MatrixClient>;
    let inviter: MultiInviter;

    beforeEach(() => {
        jest.resetAllMocks();

        TestUtilsMatrix.stubClient();
        client = MatrixClientPeg.safeGet() as jest.Mocked<MatrixClient>;

        client.invite = jest.fn();
        client.invite.mockResolvedValue({});

        client.getProfileInfo = jest.fn();
        client.getProfileInfo.mockImplementation((userId: string) => {
            return MXID_PROFILE_STATES[userId] || Promise.reject();
        });
        client.unban = jest.fn();

        inviter = new MultiInviter(client, ROOMID);
    });

    describe("invite", () => {
        describe("with promptBeforeInviteUnknownUsers = false", () => {
            beforeEach(() => mockPromptBeforeInviteUnknownUsers(false));

            it("should invite all users", async () => {
                const result = await inviter.invite([MXID1, MXID2, MXID3]);

                expect(client.invite).toHaveBeenCalledTimes(3);
                expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined);
                expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, undefined);
                expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, undefined);

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
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined);
                    expect(client.invite).toHaveBeenNthCalledWith(2, ROOMID, MXID2, undefined);
                    expect(client.invite).toHaveBeenNthCalledWith(3, ROOMID, MXID3, undefined);

                    expectAllInvitedResult(result);
                });
            });

            describe("declining the unknown user dialog", () => {
                beforeEach(() => mockCreateTrackedDialog("onGiveUp"));

                it("should only invite existing users", async () => {
                    const result = await inviter.invite([MXID1, MXID2, MXID3]);

                    expect(client.invite).toHaveBeenCalledTimes(1);
                    expect(client.invite).toHaveBeenNthCalledWith(1, ROOMID, MXID1, undefined);

                    // The resolved state is 'invited' for all users.
                    // With the above client expectations, the test ensures that only the first user is invited.
                    expectAllInvitedResult(result);
                });
            });
        });

        it("should show sensible error when attempting 3pid invite with no identity server", async () => {
            client.inviteByEmail = jest.fn().mockRejectedValueOnce(
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
            mocked(Modal.createDialog).mockImplementation(
                (Element: ComponentType, props?: ComponentProps<ComponentType>): any => {
                    // We stub out the modal with an immediate affirmative (proceed) return
                    return { finished: Promise.resolve([true]) };
                },
            );

            const room = new Room(ROOMID, client, client.getSafeUserId());
            mocked(client.getRoom).mockReturnValue(room);
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
            mocked(client.invite).mockRejectedValueOnce(
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
            mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite(["@user:other_server"]);
            expect(inviter.getErrorText("@user:other_server")).toMatchInlineSnapshot(
                `"This room is unfederated. You cannot invite people from external servers."`,
            );
        });

        it("should show sensible error when attempting to invite over federation with m.federate=false to space", async () => {
            mocked(client.invite).mockRejectedValueOnce(
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
            mocked(client.getRoom).mockReturnValue(room);

            await inviter.invite(["@user:other_server"]);
            expect(inviter.getErrorText("@user:other_server")).toMatchInlineSnapshot(
                `"This space is unfederated. You cannot invite people from external servers."`,
            );
        });
    });
});
