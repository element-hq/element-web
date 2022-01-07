/*
Copyright 2021 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from 'react';
import {
    renderIntoDocument,
    Simulate,
    findRenderedDOMComponentWithClass,
    act,
} from 'react-dom/test-utils';
import { Room, RoomMember, MatrixError, IContent } from 'matrix-js-sdk';

import "../../../skinned-sdk";
import { stubClient } from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import DMRoomMap from '../../../../src/utils/DMRoomMap';
import RoomPreviewBar from '../../../../src/components/views/rooms/RoomPreviewBar';

jest.mock('../../../../src/IdentityAuthClient', () => {
    return jest.fn().mockImplementation(() => {
        return { getAccessToken: jest.fn().mockResolvedValue('mock-token') };
    });
});

jest.useFakeTimers();

const createRoom = (roomId: string, userId: string): Room => {
    const newRoom = new Room(
        roomId,
        MatrixClientPeg.get(),
        userId,
        {},
    );
    DMRoomMap.makeShared().start();
    return newRoom;
};

const makeMockRoomMember = (
    { userId, isKicked, membership, content, memberContent }:
    {userId?: string;
        isKicked?: boolean;
        membership?: 'invite' | 'ban';
        content?: Partial<IContent>;
        memberContent?: Partial<IContent>;
    },
) => ({
    userId,
    rawDisplayName: `${userId} name`,
    isKicked: jest.fn().mockReturnValue(!!isKicked),
    getContent: jest.fn().mockReturnValue(content || {}),
    membership,
    events: {
        member: {
            getSender: jest.fn().mockReturnValue('@kicker:test.com'),
            getContent: jest.fn().mockReturnValue({ reason: 'test reason', ...memberContent }),
        },
    },
}) as unknown as RoomMember;

describe('<RoomPreviewBar />', () => {
    const roomId = 'RoomPreviewBar-test-room';
    const userId = '@tester:test.com';
    const inviterUserId = '@inviter:test.com';
    const otherUserId = '@othertester:test.com';

    const getComponent = (props = {}) => {
        const defaultProps = {
            room: createRoom(roomId, userId),
        };
        const wrapper = renderIntoDocument<React.Component>(
            <RoomPreviewBar {...defaultProps} {...props} />,
        ) as React.Component;
        return findRenderedDOMComponentWithClass(wrapper, 'mx_RoomPreviewBar') as HTMLDivElement;
    };

    const isSpinnerRendered = (element: Element) => !!element.querySelector('.mx_Spinner');
    const getMessage = (element: Element) => element.querySelector<HTMLDivElement>('.mx_RoomPreviewBar_message');
    const getActions = (element: Element) => element.querySelector<HTMLDivElement>('.mx_RoomPreviewBar_actions');
    const getPrimaryActionButton = (element: Element) =>
        getActions(element).querySelector('.mx_AccessibleButton_kind_primary');
    const getSecondaryActionButton = (element: Element) =>
        getActions(element).querySelector('.mx_AccessibleButton_kind_secondary');

    beforeEach(() => {
        stubClient();
        MatrixClientPeg.get().getUserId = jest.fn().mockReturnValue(userId);
    });

    afterEach(() => {
        const container = document.body.firstChild;
        container && document.body.removeChild(container);
    });

    it('renders joining message', () => {
        const component = getComponent({ joining: true });

        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component).textContent).toEqual('Joining room …');
    });
    it('renders rejecting message', () => {
        const component = getComponent({ rejecting: true });
        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component).textContent).toEqual('Rejecting invite …');
    });
    it('renders loading message', () => {
        const component = getComponent({ loading: true });
        expect(isSpinnerRendered(component)).toBeTruthy();
        expect(getMessage(component).textContent).toEqual('Loading …');
    });

    it('renders not logged in message', () => {
        MatrixClientPeg.get().isGuest = jest.fn().mockReturnValue(true);
        const component = getComponent({ loading: true });

        expect(isSpinnerRendered(component)).toBeFalsy();
        expect(getMessage(component).textContent).toEqual('Join the conversation with an account');
    });

    it('renders kicked message', () => {
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, 'getMember').mockReturnValue(makeMockRoomMember({ isKicked: true }));
        const component = getComponent({ loading: true, room });

        expect(getMessage(component)).toMatchSnapshot();
    });

    it('renders banned message', () => {
        const room = createRoom(roomId, otherUserId);
        jest.spyOn(room, 'getMember').mockReturnValue(makeMockRoomMember({ membership: 'ban' }));
        const component = getComponent({ loading: true, room });

        expect(getMessage(component)).toMatchSnapshot();
    });

    describe('with an error', () => {
        it('renders room not found error', () => {
            const error = new MatrixError({
                errcode: 'M_NOT_FOUND',
                error: "Room not found",
            });
            const component = getComponent({ error });

            expect(getMessage(component)).toMatchSnapshot();
        });
        it('renders other errors', () => {
            const error = new MatrixError({
                errcode: 'Something_else',
            });
            const component = getComponent({ error });

            expect(getMessage(component)).toMatchSnapshot();
        });
    });

    it('renders viewing room message when room an be previewed', () => {
        const component = getComponent({ canPreview: true });

        expect(getMessage(component)).toMatchSnapshot();
    });

    it('renders viewing room message when room can not be previewed', () => {
        const component = getComponent({ canPreview: false });

        expect(getMessage(component)).toMatchSnapshot();
    });

    describe('with an invite', () => {
        const inviterName = inviterUserId;
        const userMember = makeMockRoomMember({ userId });
        const userMemberWithDmInvite = makeMockRoomMember({
            userId, membership: 'invite', memberContent: { is_direct: true },
        });
        const inviterMember = makeMockRoomMember({
            userId: inviterUserId,
            content: {
                "reason": 'test',
                'io.element.html_reason': '<h3>hello</h3>',
            },
        });
        describe('without an invited email', () => {
            describe('for a non-dm room', () => {
                const mockGetMember = (id) => {
                    if (id === userId) return userMember;
                    return inviterMember;
                };
                const onJoinClick = jest.fn();
                const onRejectClick = jest.fn();
                let room;

                beforeEach(() => {
                    room = createRoom(roomId, userId);
                    jest.spyOn(room, 'getMember').mockImplementation(mockGetMember);
                    jest.spyOn(room.currentState, 'getMember').mockImplementation(mockGetMember);
                    onJoinClick.mockClear();
                    onRejectClick.mockClear();
                });

                it('renders invite message', () => {
                    const component = getComponent({ inviterName, room });
                    expect(getMessage(component)).toMatchSnapshot();
                });

                it('renders join and reject action buttons correctly', () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onRejectClick });
                    expect(getActions(component)).toMatchSnapshot();
                });

                it('renders reject and ignore action buttons when handler is provided', () => {
                    const onRejectAndIgnoreClick = jest.fn();
                    const component = getComponent({
                        inviterName, room, onJoinClick, onRejectClick, onRejectAndIgnoreClick,
                    });
                    expect(getActions(component)).toMatchSnapshot();
                });

                it('renders join and reject action buttons in reverse order when room can previewed', () => {
                    // when room is previewed action buttons are rendered left to right, with primary on the right
                    const component = getComponent({ inviterName, room, onJoinClick, onRejectClick, canPreview: true });
                    expect(getActions(component)).toMatchSnapshot();
                });

                it('joins room on primary button click', () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onRejectClick });
                    act(() => {
                        Simulate.click(getPrimaryActionButton(component));
                    });

                    expect(onJoinClick).toHaveBeenCalled();
                });

                it('rejects invite on secondary button click', () => {
                    const component = getComponent({ inviterName, room, onJoinClick, onRejectClick });
                    act(() => {
                        Simulate.click(getSecondaryActionButton(component));
                    });

                    expect(onRejectClick).toHaveBeenCalled();
                });
            });

            describe('for a dm room', () => {
                const mockGetMember = (id) => {
                    if (id === userId) return userMemberWithDmInvite;
                    return inviterMember;
                };
                const onJoinClick = jest.fn();
                const onRejectClick = jest.fn();
                let room;

                beforeEach(() => {
                    room = createRoom(roomId, userId);
                    jest.spyOn(room, 'getMember').mockImplementation(mockGetMember);
                    jest.spyOn(room.currentState, 'getMember').mockImplementation(mockGetMember);
                    onJoinClick.mockClear();
                    onRejectClick.mockClear();
                });

                it('renders invite message to a non-dm room', () => {
                    const component = getComponent({ inviterName, room });
                    expect(getMessage(component)).toMatchSnapshot();
                });

                it('renders join and reject action buttons with correct labels', () => {
                    const onRejectAndIgnoreClick = jest.fn();
                    const component = getComponent({
                        inviterName, room, onJoinClick, onRejectAndIgnoreClick, onRejectClick,
                    });
                    expect(getActions(component)).toMatchSnapshot();
                });
            });
        });

        describe('with an invited email', () => {
            const invitedEmail = 'test@test.com';
            const mockThreePids = [
                { medium: 'email', address: invitedEmail },
                { medium: 'not-email', address: 'address 2' },
            ];

            const testJoinButton = (props) => async () => {
                const onJoinClick = jest.fn();
                const onRejectClick = jest.fn();
                const component = getComponent({ ...props, onJoinClick, onRejectClick });
                await new Promise(setImmediate);
                expect(getPrimaryActionButton(component)).toBeTruthy();
                expect(getSecondaryActionButton(component)).toBeFalsy();
                act(() => {
                    Simulate.click(getPrimaryActionButton(component));
                });
                expect(onJoinClick).toHaveBeenCalled();
            };

            describe('when client fails to get 3PIDs', () => {
                beforeEach(() => {
                    MatrixClientPeg.get().getThreePids = jest.fn().mockRejectedValue({ errCode: 'TEST_ERROR' });
                });

                it('renders error message', async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await new Promise(setImmediate);

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it('renders join button', testJoinButton({ inviterName, invitedEmail }));
            });

            describe('when invitedEmail is not associated with current account', () => {
                beforeEach(() => {
                    MatrixClientPeg.get().getThreePids = jest.fn().mockResolvedValue(
                        { threepids: mockThreePids.slice(1) },
                    );
                });

                it('renders invite message with invited email', async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await new Promise(setImmediate);

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it('renders join button', testJoinButton({ inviterName, invitedEmail }));
            });

            describe('when client has no identity server connected', () => {
                beforeEach(() => {
                    MatrixClientPeg.get().getThreePids = jest.fn().mockResolvedValue({ threepids: mockThreePids });
                    MatrixClientPeg.get().getIdentityServerUrl = jest.fn().mockReturnValue(false);
                });

                it('renders invite message with invited email', async () => {
                    const component = getComponent({ inviterName, invitedEmail });
                    await new Promise(setImmediate);

                    expect(getMessage(component)).toMatchSnapshot();
                });

                it('renders join button', testJoinButton({ inviterName, invitedEmail }));
            });

            describe('when client has an identity server connected', () => {
                beforeEach(() => {
                    MatrixClientPeg.get().getThreePids = jest.fn().mockResolvedValue({ threepids: mockThreePids });
                    MatrixClientPeg.get().getIdentityServerUrl = jest.fn().mockReturnValue('identity.test');
                    MatrixClientPeg.get().lookupThreePid = jest.fn().mockResolvedValue('identity.test');
                });

                it('renders email mismatch message when invite email mxid doesnt match', async () => {
                    MatrixClientPeg.get().lookupThreePid = jest.fn().mockReturnValue('not userid');
                    const component = getComponent({ inviterName, invitedEmail });
                    await new Promise(setImmediate);

                    expect(getMessage(component)).toMatchSnapshot();
                    expect(MatrixClientPeg.get().lookupThreePid).toHaveBeenCalledWith(
                        'email', invitedEmail, undefined, 'mock-token',
                    );
                    await testJoinButton({ inviterName, invitedEmail })();
                });

                it('renders invite message when invite email mxid match', async () => {
                    MatrixClientPeg.get().lookupThreePid = jest.fn().mockReturnValue(userId);
                    const component = getComponent({ inviterName, invitedEmail });
                    await new Promise(setImmediate);

                    expect(getMessage(component)).toMatchSnapshot();
                    await testJoinButton({ inviterName, invitedEmail })();
                });
            });
        });
    });
});
