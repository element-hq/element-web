/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ComponentProps } from "react";
import { render, fireEvent, type RenderResult, waitFor, waitForElementToBeRemoved } from "jest-matrix-react";
import { Room, type RoomMember, MatrixError, type IContent } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { withClientContextRenderOptions, stubClient } from "../../../../test-utils";
import { MatrixClientPeg } from "../../../../../src/MatrixClientPeg";
import DMRoomMap from "../../../../../src/utils/DMRoomMap";
import RoomPreviewBar from "../../../../../src/components/views/rooms/RoomPreviewBar";
import defaultDispatcher from "../../../../../src/dispatcher/dispatcher";

jest.mock("../../../../../src/IdentityAuthClient", () => {
    return jest.fn().mockImplementation(() => {
        return { getAccessToken: jest.fn().mockResolvedValue("mock-token") };
    });
});

jest.useRealTimers();

const createRoom = (roomId: string, userId: string): Room => {
    const cli = MatrixClientPeg.safeGet();
    const newRoom = new Room(roomId, cli, userId, {});
    DMRoomMap.makeShared(cli).start();
    return newRoom;
};

const makeMockRoomMember = ({
    userId,
    isKicked,
    membership,
    content,
    memberContent,
    oldMembership,
}: {
    userId?: string;
    isKicked?: boolean;
    membership?: KnownMembership.Invite | KnownMembership.Ban | KnownMembership.Leave;
    content?: Partial<IContent>;
    memberContent?: Partial<IContent>;
    oldMembership?: KnownMembership.Join | KnownMembership.Knock;
}) =>
    ({
        userId,
        rawDisplayName: `${userId} name`,
        isKicked: jest.fn().mockReturnValue(!!isKicked),
        getContent: jest.fn().mockReturnValue(content || {}),
        getPrevContent: jest.fn().mockReturnValue(content || {}),
        membership,
        events: {
            member: {
                getSender: jest.fn().mockReturnValue("@kicker:test.com"),
                getContent: jest.fn().mockReturnValue({ reason: "test reason", ...memberContent }),
                getPrevContent: jest.fn().mockReturnValue({ membership: oldMembership, ...memberContent }),
            },
        },
    }) as unknown as RoomMember;

describe("<RoomPreviewBar />", () => {
    const roomId = "RoomPreviewBar-test-room";
    const userId = "@tester:test.com";
    const inviterUserId = "@inviter:test.com";
    const otherUserId = "@othertester:test.com";

    const getComponent = (props: ComponentProps<typeof RoomPreviewBar> = {}) => {
        const defaultProps = {
            roomId,
            room: createRoom(roomId, userId),
        };
        return render(
            <RoomPreviewBar {...defaultProps} {...props} />,
            withClientContextRenderOptions(MatrixClientPeg.safeGet()),
        );
    };

    const isSpinnerRendered = (wrapper: RenderResult) => !!wrapper.container.querySelector(".mx_Spinner");
    const getMessage = (wrapper: RenderResult) =>
        wrapper.container.querySelector<HTMLDivElement>(".mx_RoomPreviewBar_message");
    const getActions = (wrapper: RenderResult) =>
        wrapper.container.querySelector<HTMLDivElement>(".mx_RoomPreviewBar_actions");
    const getPrimaryActionButton = (wrapper: RenderResult) =>
        getActions(wrapper)?.querySelector(".mx_AccessibleButton_kind_primary");
    const getSecondaryActionButton = (wrapper: RenderResult) =>
        getActions(wrapper)?.querySelector(".mx_AccessibleButton_kind_secondary");

    beforeEach(() => {
        stubClient();
        MatrixClientPeg.get()!.getUserId = jest.fn().mockReturnValue(userId);
        MatrixClientPeg.get()!.getSafeUserId = jest.fn().mockReturnValue(userId);
        MatrixClientPeg.safeGet().getUserId = jest.fn().mockReturnValue(userId);
        MatrixClientPeg.safeGet().getSafeUserId = jest.fn().mockReturnValue(userId);
    });

    afterEach(() => {
        const container = document.body.firstChild;
        if (container) document.body.removeChild(container);
    });

    it("renders joining message", () => {
        const component = getComponent({ joining: true });

        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component)?.textContent).toEqual("Joining…");
    });
    it("renders rejecting message", () => {
        const component = getComponent({ rejecting: true });
        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component)?.textContent).toEqual("Rejecting invite…");
    });
    it("renders loading message", () => {
        const component = getComponent({ loading: true });
        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component)?.textContent).toEqual("Loading…");
    });

    it("renders not logged in message", () => {
        MatrixClientPeg.safeGet().isGuest = jest.fn().mockReturnValue(true);
        const component = getComponent({ loading: true });

        expect(isSpinnerRendered(component)).toBeFalsy();
        expect(getMessage(component)?.textContent).toEqual("Join the conversation with an account");
    });

    it("should send room oob data to start login", async () => {
        MatrixClientPeg.safeGet().isGuest = jest.fn().mockReturnValue(true);
        const component = getComponent({
            oobData: {
                name: "Room Name",
                avatarUrl: "mxc://foo/bar",
                inviterName: "Charlie",
            },
        });

        const dispatcherSpy = jest.fn();
        const dispatcherRef = defaultDispatcher.register(dispatcherSpy);

        expect(getMessage(component)?.textContent).toEqual("Join the conversation with an account");
        fireEvent.click(getPrimaryActionButton(component)!);

        await waitFor(() =>
            expect(dispatcherSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    screenAfterLogin: {
                        screen: "room",
                        params: expect.objectContaining({
                            room_name: "Room Name",
                            room_avatar_url: "mxc://foo/bar",
                            inviter_name: "Charlie",
                        }),
                    },
                }),
            ),
        );

        defaultDispatcher.unregister(dispatcherRef);
    });

    it("renders kicked message", () => {
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, "getMember").mockReturnValue(makeMockRoomMember({ isKicked: true }));
        const component = getComponent({ room, canAskToJoinAndMembershipIsLeave: true, promptAskToJoin: false });

        expect(getMessage(component)).toMatchSnapshot();
    });

    it("renders denied request message", () => {
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, "getMember").mockReturnValue(
            makeMockRoomMember({
                isKicked: true,
                membership: KnownMembership.Leave,
                oldMembership: KnownMembership.Knock,
            }),
        );
        const component = getComponent({ room, promptAskToJoin: true });

        expect(getMessage(component)).toMatchSnapshot();
    });

    it("triggers the primary action callback for denied request", () => {
        const onForgetClick = jest.fn();
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, "getMember").mockReturnValue(
            makeMockRoomMember({
                isKicked: true,
                membership: KnownMembership.Leave,
                oldMembership: KnownMembership.Knock,
            }),
        );
        const component = getComponent({ room, promptAskToJoin: true, onForgetClick });

        fireEvent.click(getPrimaryActionButton(component)!);
        expect(onForgetClick).toHaveBeenCalled();
    });

    it("renders banned message", () => {
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, "getMember").mockReturnValue(makeMockRoomMember({ membership: KnownMembership.Ban }));
        const component = getComponent({ loading: true, room });

        expect(getMessage(component)).toMatchSnapshot();
    });

    describe("with an error", () => {
        it("renders room not found error", () => {
            const error = new MatrixError({
                errcode: "M_NOT_FOUND",
                error: "Room not found",
            });
            const component = getComponent({ error });

            expect(getMessage(component)).toMatchSnapshot();
        });
        it("renders other errors", () => {
            const error = new MatrixError({
                errcode: "Something_else",
            });
            const component = getComponent({ error });

            expect(getMessage(component)).toMatchSnapshot();
        });
    });

    it("renders viewing room message when room an be previewed", () => {
        const component = getComponent({ canPreview: true });

        expect(getMessage(component)).toMatchSnapshot();
    });

    it("renders viewing room message when room can not be previewed", () => {
        const component = getComponent({ canPreview: false });

        expect(getMessage(component)).toMatchSnapshot();
    });

    describe("with an invite", () => {
        const inviterName = inviterUserId;
        const userMember = makeMockRoomMember({ userId });
        const userMemberWithDmInvite = makeMockRoomMember({
            userId,
            membership: KnownMembership.Invite,
            memberContent: { is_direct: true, membership: KnownMembership.Invite },
        });
        const inviterMember = makeMockRoomMember({
            userId: inviterUserId,
            content: {
                "reason": "test",
                "io.element.html_reason": "<h3>hello</h3>",
            },
        });
        describe("without an invited email", () => {
            describe("for a non-dm room", () => {
                const mockGetMember = (id: string) => {
                    if (id === userId) return userMember;
                    return inviterMember;
                };
                const onJoinClick = jest.fn();
                const onRejectClick = jest.fn();
                let room: Room;

                beforeEach(() => {
                    room = createRoom(roomId, userId);
                    jest.spyOn(room, "getMember").mockImplementation(mockGetMember);
                    jest.spyOn(room.currentState, "getMember").mockImplementation(mockGetMember);
                    onJoinClick.mockClear();
                    onRejectClick.mockClear();
                });

                it("renders invite message", () => {
                    const component = getComponent({ inviterName, room });
                    expect(getMessage(component)).toMatchSnapshot();
                });

                it("renders join and reject action buttons correctly", () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onDeclineClick: onRejectClick });
                    expect(getActions(component)).toMatchSnapshot();
                });

                it("renders join and reject action buttons in reverse order when room can previewed", () => {
                    // when room is previewed action buttons are rendered left to right, with primary on the right
                    const component = getComponent({
                        inviterName,
                        room,
                        onJoinClick,
                        onDeclineClick: onRejectClick,
                        canPreview: true,
                    });
                    expect(getActions(component)).toMatchSnapshot();
                });

                it("joins room on primary button click", () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onDeclineClick: onRejectClick });
                    fireEvent.click(getPrimaryActionButton(component)!);

                    expect(onJoinClick).toHaveBeenCalled();
                });

                it("rejects invite on secondary button click", () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onDeclineClick: onRejectClick });
                    fireEvent.click(getSecondaryActionButton(component)!);

                    expect(onRejectClick).toHaveBeenCalled();
                });
            });

            describe("for a dm room", () => {
                const mockGetMember = (id: string) => {
                    if (id === userId) return userMemberWithDmInvite;
                    return inviterMember;
                };
                const onJoinClick = jest.fn();
                const onRejectClick = jest.fn();
                let room: Room;

                beforeEach(() => {
                    room = createRoom(roomId, userId);
                    jest.spyOn(room, "getMember").mockImplementation(mockGetMember);
                    jest.spyOn(room.currentState, "getMember").mockImplementation(mockGetMember);
                    onJoinClick.mockClear();
                    onRejectClick.mockClear();
                });

                it("renders invite message", () => {
                    const component = getComponent({ inviterName, room });
                    expect(getMessage(component)).toMatchSnapshot();
                });
            });
        });

        describe("with an invited email", () => {
            const invitedEmail = "test@test.com";
            const mockThreePids = [
                { medium: "email", address: invitedEmail },
                { medium: "not-email", address: "address 2" },
            ];

            const testJoinButton =
                (props: ComponentProps<typeof RoomPreviewBar>, expectSecondaryButton = false) =>
                async () => {
                    const onJoinClick = jest.fn();
                    const onRejectClick = jest.fn();
                    const component = getComponent({ ...props, onJoinClick, onDeclineClick: onRejectClick });
                    await waitFor(() => expect(getPrimaryActionButton(component)).toBeTruthy());
                    if (expectSecondaryButton) expect(getSecondaryActionButton(component)).toBeFalsy();
                    fireEvent.click(getPrimaryActionButton(component)!);
                    expect(onJoinClick).toHaveBeenCalled();
                };

            describe("when client fails to get 3PIDs", () => {
                beforeEach(() => {
                    MatrixClientPeg.safeGet().getThreePids = jest.fn().mockRejectedValue({ errCode: "TEST_ERROR" });
                });

                it("renders error message", async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await waitForElementToBeRemoved(() => component.queryByRole("progressbar"));

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it("renders join button", testJoinButton({ inviterName, invitedEmail }));
            });

            describe("when invitedEmail is not associated with current account", () => {
                beforeEach(() => {
                    MatrixClientPeg.safeGet().getThreePids = jest
                        .fn()
                        .mockResolvedValue({ threepids: mockThreePids.slice(1) });
                });

                it("renders invite message with invited email", async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await waitForElementToBeRemoved(() => component.queryByRole("progressbar"));

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it("renders join button", testJoinButton({ inviterName, invitedEmail }));
            });

            describe("when client has no identity server connected", () => {
                beforeEach(() => {
                    MatrixClientPeg.safeGet().getThreePids = jest.fn().mockResolvedValue({ threepids: mockThreePids });
                    MatrixClientPeg.safeGet().getIdentityServerUrl = jest.fn().mockReturnValue(false);
                });

                it("renders invite message with invited email", async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await waitForElementToBeRemoved(() => component.queryByRole("progressbar"));

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it("renders join button", testJoinButton({ inviterName, invitedEmail }));
            });

            describe("when client has an identity server connected", () => {
                beforeEach(() => {
                    MatrixClientPeg.safeGet().getThreePids = jest.fn().mockResolvedValue({ threepids: mockThreePids });
                    MatrixClientPeg.safeGet().getIdentityServerUrl = jest.fn().mockReturnValue("identity.test");
                    MatrixClientPeg.safeGet().lookupThreePid = jest.fn().mockResolvedValue("identity.test");
                });

                it("renders email mismatch message when invite email mxid doesnt match", async () => {
                    MatrixClientPeg.safeGet().lookupThreePid = jest.fn().mockReturnValue({ mxid: "not userid" });
                    const component = getComponent({ inviterName, invitedEmail });
                    await waitForElementToBeRemoved(() => component.queryByRole("progressbar"));

                    expect(getMessage(component)).toMatchSnapshot();
                    expect(MatrixClientPeg.safeGet().lookupThreePid).toHaveBeenCalledWith(
                        "email",
                        invitedEmail,
                        "mock-token",
                    );
                    await testJoinButton({ inviterName, invitedEmail })();
                });

                it("renders invite message when invite email mxid match", async () => {
                    MatrixClientPeg.safeGet().lookupThreePid = jest.fn().mockReturnValue({ mxid: userId });
                    const component = getComponent({ inviterName, invitedEmail });
                    await waitForElementToBeRemoved(() => component.queryByRole("progressbar"));

                    expect(getMessage(component)).toMatchSnapshot();
                    await testJoinButton({ inviterName, invitedEmail }, false)();
                });
            });
        });
    });

    describe("message case AskToJoin", () => {
        it("renders the corresponding message", () => {
            const component = getComponent({ promptAskToJoin: true });
            expect(getMessage(component)).toMatchSnapshot();
        });

        it("renders the corresponding message when kicked", () => {
            const room = createRoom(roomId, otherUserId);
            jest.spyOn(room, "getMember").mockReturnValue(makeMockRoomMember({ isKicked: true }));
            const component = getComponent({ room, promptAskToJoin: true });

            expect(getMessage(component)).toMatchSnapshot();
        });

        it("renders the corresponding message with a generic title", () => {
            const component = render(<RoomPreviewBar promptAskToJoin />);
            expect(getMessage(component)).toMatchSnapshot();
        });

        it("renders the corresponding actions", () => {
            const component = getComponent({ promptAskToJoin: true });
            expect(getActions(component)).toMatchSnapshot();
        });

        it("triggers the primary action callback", () => {
            const onSubmitAskToJoin = jest.fn();
            const component = getComponent({ promptAskToJoin: true, onSubmitAskToJoin });

            fireEvent.click(getPrimaryActionButton(component)!);
            expect(onSubmitAskToJoin).toHaveBeenCalled();
        });

        it("triggers the primary action callback with a reason", () => {
            const onSubmitAskToJoin = jest.fn();
            const reason = "some reason";
            const component = getComponent({ promptAskToJoin: true, onSubmitAskToJoin });

            fireEvent.change(component.container.querySelector("textarea")!, { target: { value: reason } });
            fireEvent.click(getPrimaryActionButton(component)!);

            expect(onSubmitAskToJoin).toHaveBeenCalledWith(reason);
        });
    });

    describe("message case Knocked", () => {
        it("renders the corresponding message", () => {
            const component = getComponent({ knocked: true });
            expect(getMessage(component)).toMatchSnapshot();
        });

        it("renders the corresponding actions", () => {
            const component = getComponent({ knocked: true, onCancelAskToJoin: () => {} });
            expect(getActions(component)).toMatchSnapshot();
        });

        it("triggers the secondary action callback", () => {
            const onCancelAskToJoin = jest.fn();
            const component = getComponent({ knocked: true, onCancelAskToJoin });

            fireEvent.click(getSecondaryActionButton(component)!);
            expect(onCancelAskToJoin).toHaveBeenCalled();
        });
    });
});
