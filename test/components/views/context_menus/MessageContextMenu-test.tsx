/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
import { mount, ReactWrapper } from 'enzyme';
import { EventStatus, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import {
    PendingEventOrdering,
    BeaconIdentifier,
    Beacon,
    getBeaconInfoIdentifier,
} from 'matrix-js-sdk/src/matrix';
import { ExtensibleEvent, MessageEvent, M_POLL_KIND_DISCLOSED, PollStartEvent } from 'matrix-events-sdk';
import { Thread } from "matrix-js-sdk/src/models/thread";
import { mocked } from "jest-mock";
import { act } from '@testing-library/react';

import * as TestUtils from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { canEditContent, isContentActionable } from "../../../../src/utils/EventUtils";
import { copyPlaintext, getSelectedText } from "../../../../src/utils/strings";
import MessageContextMenu from "../../../../src/components/views/context_menus/MessageContextMenu";
import { makeBeaconEvent, makeBeaconInfoEvent } from '../../../test-utils';
import dispatcher from '../../../../src/dispatcher/dispatcher';

jest.mock("../../../../src/utils/strings", () => ({
    copyPlaintext: jest.fn(),
    getSelectedText: jest.fn(),
}));
jest.mock("../../../../src/utils/EventUtils", () => ({
    canEditContent: jest.fn(),
    isContentActionable: jest.fn(),
    isLocationEvent: jest.fn(),
}));

const roomId = 'roomid';

describe('MessageContextMenu', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    it('does show copy link button when supplied a link', () => {
        const eventContent = MessageEvent.from("hello");
        const props = {
            link: "https://google.com/",
        };
        const menu = createMenuWithContent(eventContent, props);
        const copyLinkButton = menu.find('a[aria-label="Copy link"]');
        expect(copyLinkButton).toHaveLength(1);
        expect(copyLinkButton.props().href).toBe(props.link);
    });

    it('does not show copy link button when not supplied a link', () => {
        const eventContent = MessageEvent.from("hello");
        const menu = createMenuWithContent(eventContent);
        const copyLinkButton = menu.find('a[aria-label="Copy link"]');
        expect(copyLinkButton).toHaveLength(0);
    });

    describe('message forwarding', () => {
        it('allows forwarding a room message', () => {
            mocked(isContentActionable).mockReturnValue(true);

            const eventContent = MessageEvent.from("hello");
            const menu = createMenuWithContent(eventContent);
            expect(menu.find('div[aria-label="Forward"]')).toHaveLength(1);
        });

        it('does not allow forwarding a poll', () => {
            const eventContent = PollStartEvent.from("why?", ["42"], M_POLL_KIND_DISCLOSED);
            const menu = createMenuWithContent(eventContent);
            expect(menu.find('div[aria-label="Forward"]')).toHaveLength(0);
        });

        describe('forwarding beacons', () => {
            const aliceId = "@alice:server.org";
            beforeEach(() => {
                mocked(isContentActionable).mockReturnValue(true);
            });

            it('does not allow forwarding a beacon that is not live', () => {
                const deadBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false });
                const beacon = new Beacon(deadBeaconEvent);
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
                const menu = createMenu(deadBeaconEvent, {}, {}, beacons);
                expect(menu.find('div[aria-label="Forward"]')).toHaveLength(0);
            });

            it('does not allow forwarding a beacon that is not live but has a latestLocation', () => {
                const deadBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: false });
                const beaconLocation = makeBeaconEvent(
                    aliceId, { beaconInfoId: deadBeaconEvent.getId(), geoUri: 'geo:51,41' },
                );
                const beacon = new Beacon(deadBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
                const menu = createMenu(deadBeaconEvent, {}, {}, beacons);
                expect(menu.find('div[aria-label="Forward"]')).toHaveLength(0);
            });

            it('does not allow forwarding a live beacon that does not have a latestLocation', () => {
                const beaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });

                const beacon = new Beacon(beaconEvent);
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(beaconEvent), beacon);
                const menu = createMenu(beaconEvent, {}, {}, beacons);
                expect(menu.find('div[aria-label="Forward"]')).toHaveLength(0);
            });

            it('allows forwarding a live beacon that has a location', () => {
                const liveBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });
                const beaconLocation = makeBeaconEvent(
                    aliceId, { beaconInfoId: liveBeaconEvent.getId(), geoUri: 'geo:51,41' },
                );
                const beacon = new Beacon(liveBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
                const menu = createMenu(liveBeaconEvent, {}, {}, beacons);
                expect(menu.find('div[aria-label="Forward"]')).toHaveLength(1);
            });

            it('opens forward dialog with correct event', () => {
                const dispatchSpy = jest.spyOn(dispatcher, 'dispatch');
                const liveBeaconEvent = makeBeaconInfoEvent(aliceId, roomId, { isLive: true });
                const beaconLocation = makeBeaconEvent(
                    aliceId, { beaconInfoId: liveBeaconEvent.getId(), geoUri: 'geo:51,41' },
                );
                const beacon = new Beacon(liveBeaconEvent);
                // @ts-ignore illegally set private prop
                beacon._latestLocationEvent = beaconLocation;
                const beacons = new Map<BeaconIdentifier, Beacon>();
                beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
                const menu = createMenu(liveBeaconEvent, {}, {}, beacons);

                act(() => {
                    menu.find('div[aria-label="Forward"]').simulate('click');
                });

                // called with forwardableEvent, not beaconInfo event
                expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
                    event: beaconLocation,
                }));
            });
        });
    });

    describe("right click", () => {
        it('copy button does work as expected', () => {
            const text = "hello";
            const eventContent = MessageEvent.from(text);
            mocked(getSelectedText).mockReturnValue(text);

            const menu = createRightClickMenuWithContent(eventContent);
            const copyButton = menu.find('div[aria-label="Copy"]');
            copyButton.simulate("mousedown");
            expect(copyPlaintext).toHaveBeenCalledWith(text);
        });

        it('copy button is not shown when there is nothing to copy', () => {
            const text = "hello";
            const eventContent = MessageEvent.from(text);
            mocked(getSelectedText).mockReturnValue("");

            const menu = createRightClickMenuWithContent(eventContent);
            const copyButton = menu.find('div[aria-label="Copy"]');
            expect(copyButton).toHaveLength(0);
        });

        it('shows edit button when we can edit', () => {
            const eventContent = MessageEvent.from("hello");
            mocked(canEditContent).mockReturnValue(true);

            const menu = createRightClickMenuWithContent(eventContent);
            const editButton = menu.find('div[aria-label="Edit"]');
            expect(editButton).toHaveLength(1);
        });

        it('does not show edit button when we cannot edit', () => {
            const eventContent = MessageEvent.from("hello");
            mocked(canEditContent).mockReturnValue(false);

            const menu = createRightClickMenuWithContent(eventContent);
            const editButton = menu.find('div[aria-label="Edit"]');
            expect(editButton).toHaveLength(0);
        });

        it('shows reply button when we can reply', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canSendMessages: true,
            };
            mocked(isContentActionable).mockReturnValue(true);

            const menu = createRightClickMenuWithContent(eventContent, context);
            const replyButton = menu.find('div[aria-label="Reply"]');
            expect(replyButton).toHaveLength(1);
        });

        it('does not show reply button when we cannot reply', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canSendMessages: true,
            };
            mocked(isContentActionable).mockReturnValue(false);

            const menu = createRightClickMenuWithContent(eventContent, context);
            const replyButton = menu.find('div[aria-label="Reply"]');
            expect(replyButton).toHaveLength(0);
        });

        it('shows react button when we can react', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canReact: true,
            };
            mocked(isContentActionable).mockReturnValue(true);

            const menu = createRightClickMenuWithContent(eventContent, context);
            const reactButton = menu.find('div[aria-label="React"]');
            expect(reactButton).toHaveLength(1);
        });

        it('does not show react button when we cannot react', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canReact: false,
            };

            const menu = createRightClickMenuWithContent(eventContent, context);
            const reactButton = menu.find('div[aria-label="React"]');
            expect(reactButton).toHaveLength(0);
        });

        it('shows view in room button when the event is a thread root', () => {
            const eventContent = MessageEvent.from("hello");
            const mxEvent = new MatrixEvent(eventContent.serialize());
            mxEvent.getThread = () => ({ rootEvent: mxEvent }) as Thread;
            const props = {
                rightClick: true,
            };
            const context = {
                timelineRenderingType: TimelineRenderingType.Thread,
            };

            const menu = createMenu(mxEvent, props, context);
            const reactButton = menu.find('div[aria-label="View in room"]');
            expect(reactButton).toHaveLength(1);
        });

        it('does not show view in room button when the event is not a thread root', () => {
            const eventContent = MessageEvent.from("hello");

            const menu = createRightClickMenuWithContent(eventContent);
            const reactButton = menu.find('div[aria-label="View in room"]');
            expect(reactButton).toHaveLength(0);
        });
    });
});

function createRightClickMenuWithContent(
    eventContent: ExtensibleEvent,
    context?: Partial<IRoomState>,
): ReactWrapper {
    return createMenuWithContent(eventContent, { rightClick: true }, context);
}

function createMenuWithContent(
    eventContent: ExtensibleEvent,
    props?: Partial<React.ComponentProps<typeof MessageContextMenu>>,
    context?: Partial<IRoomState>,
): ReactWrapper {
    const mxEvent = new MatrixEvent(eventContent.serialize());
    return createMenu(mxEvent, props, context);
}

function createMenu(
    mxEvent: MatrixEvent,
    props?: Partial<React.ComponentProps<typeof MessageContextMenu>>,
    context: Partial<IRoomState> = {},
    beacons: Map<BeaconIdentifier, Beacon> = new Map(),
): ReactWrapper {
    TestUtils.stubClient();
    const client = MatrixClientPeg.get();

    const room = new Room(
        roomId,
        client,
        "@user:example.com",
        {
            pendingEventOrdering: PendingEventOrdering.Detached,
        },
    );

    // @ts-ignore illegally set private prop
    room.currentState.beacons = beacons;

    mxEvent.setStatus(EventStatus.SENT);

    client.getUserId = jest.fn().mockReturnValue("@user:example.com");
    client.getRoom = jest.fn().mockReturnValue(room);

    return mount(
        <RoomContext.Provider value={context as IRoomState}>
            <MessageContextMenu
                chevronFace={null}
                mxEvent={mxEvent}
                onFinished={jest.fn()}
                {...props}
            />
        </RoomContext.Provider>,
    );
}
