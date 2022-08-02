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
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from 'enzyme';
import { EventStatus, MatrixEvent } from 'matrix-js-sdk/src/models/event';
import { Room } from 'matrix-js-sdk/src/models/room';
import {
    PendingEventOrdering,
    BeaconIdentifier,
    Beacon,
    getBeaconInfoIdentifier,
    EventType,
} from 'matrix-js-sdk/src/matrix';
import { ExtensibleEvent, MessageEvent, M_POLL_KIND_DISCLOSED, PollStartEvent } from 'matrix-events-sdk';
import { Thread } from "matrix-js-sdk/src/models/thread";
import { mocked } from "jest-mock";
import { act } from '@testing-library/react';

import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import RoomContext, { TimelineRenderingType } from "../../../../src/contexts/RoomContext";
import { IRoomState } from "../../../../src/components/structures/RoomView";
import { canEditContent } from "../../../../src/utils/EventUtils";
import { copyPlaintext, getSelectedText } from "../../../../src/utils/strings";
import MessageContextMenu from "../../../../src/components/views/context_menus/MessageContextMenu";
import { makeBeaconEvent, makeBeaconInfoEvent, makeLocationEvent, stubClient } from '../../../test-utils';
import dispatcher from '../../../../src/dispatcher/dispatcher';
import SettingsStore from '../../../../src/settings/SettingsStore';
import { ReadPinsEventId } from '../../../../src/components/views/right_panel/types';
import { Action } from "../../../../src/dispatcher/actions";

jest.mock("../../../../src/utils/strings", () => ({
    copyPlaintext: jest.fn(),
    getSelectedText: jest.fn(),
}));
jest.mock("../../../../src/utils/EventUtils", () => ({
    // @ts-ignore don't mock everything
    ...jest.requireActual("../../../../src/utils/EventUtils"),
    canEditContent: jest.fn(),
}));
jest.mock('../../../../src/dispatcher/dispatcher');

const roomId = 'roomid';

describe('MessageContextMenu', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        stubClient();
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

    describe('message pinning', () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, 'getValue').mockReturnValue(true);
        });

        afterAll(() => {
            jest.spyOn(SettingsStore, 'getValue').mockRestore();
        });

        it('does not show pin option when user does not have rights to pin', () => {
            const eventContent = MessageEvent.from("hello");
            const event = new MatrixEvent(eventContent.serialize());

            const room = makeDefaultRoom();
            // mock permission to disallow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(false);

            const menu = createMenu(event, {}, {}, undefined, room);

            expect(menu.find('div[aria-label="Pin"]')).toHaveLength(0);
        });

        it('does not show pin option for beacon_info event', () => {
            const deadBeaconEvent = makeBeaconInfoEvent('@alice:server.org', roomId, { isLive: false });

            const room = makeDefaultRoom();
            // mock permission to allow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(true);

            const menu = createMenu(deadBeaconEvent, {}, {}, undefined, room);

            expect(menu.find('div[aria-label="Pin"]')).toHaveLength(0);
        });

        it('does not show pin option when pinning feature is disabled', () => {
            const eventContent = MessageEvent.from("hello");
            const pinnableEvent = new MatrixEvent({ ...eventContent.serialize(), room_id: roomId });

            const room = makeDefaultRoom();
            // mock permission to allow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(true);
            // disable pinning feature
            jest.spyOn(SettingsStore, 'getValue').mockReturnValue(false);

            const menu = createMenu(pinnableEvent, {}, {}, undefined, room);

            expect(menu.find('div[aria-label="Pin"]')).toHaveLength(0);
        });

        it('shows pin option when pinning feature is enabled', () => {
            const eventContent = MessageEvent.from("hello");
            const pinnableEvent = new MatrixEvent({ ...eventContent.serialize(), room_id: roomId });

            const room = makeDefaultRoom();
            // mock permission to allow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(true);

            const menu = createMenu(pinnableEvent, {}, {}, undefined, room);

            expect(menu.find('div[aria-label="Pin"]')).toHaveLength(1);
        });

        it('pins event on pin option click', () => {
            const onFinished = jest.fn();
            const eventContent = MessageEvent.from("hello");
            const pinnableEvent = new MatrixEvent({ ...eventContent.serialize(), room_id: roomId });
            pinnableEvent.event.event_id = '!3';
            const client = MatrixClientPeg.get();
            const room = makeDefaultRoom();

            // mock permission to allow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(true);

            // mock read pins account data
            const pinsAccountData = new MatrixEvent({ content: { event_ids: ['!1', '!2'] } });
            jest.spyOn(room, 'getAccountData').mockReturnValue(pinsAccountData);

            const menu = createMenu(pinnableEvent, { onFinished }, {}, undefined, room);

            act(() => {
                menu.find('div[aria-label="Pin"]').simulate('click');
            });

            // added to account data
            expect(client.setRoomAccountData).toHaveBeenCalledWith(
                roomId,
                ReadPinsEventId,
                { event_ids: [
                    // from account data
                    '!1', '!2',
                    pinnableEvent.getId(),
                ],
                },
            );

            // add to room's pins
            expect(client.sendStateEvent).toHaveBeenCalledWith(roomId, EventType.RoomPinnedEvents, {
                pinned: [pinnableEvent.getId()] }, "");

            expect(onFinished).toHaveBeenCalled();
        });

        it('unpins event on pin option click when event is pinned', () => {
            const eventContent = MessageEvent.from("hello");
            const pinnableEvent = new MatrixEvent({ ...eventContent.serialize(), room_id: roomId });
            pinnableEvent.event.event_id = '!3';
            const client = MatrixClientPeg.get();
            const room = makeDefaultRoom();

            // make the event already pinned in the room
            const pinEvent = new MatrixEvent({
                type: EventType.RoomPinnedEvents,
                room_id: roomId,
                state_key: "",
                content: { pinned: [pinnableEvent.getId(), '!another-event'] },
            });
            room.currentState.setStateEvents([pinEvent]);

            // mock permission to allow adding pinned messages to room
            jest.spyOn(room.currentState, 'mayClientSendStateEvent').mockReturnValue(true);

            // mock read pins account data
            const pinsAccountData = new MatrixEvent({ content: { event_ids: ['!1', '!2'] } });
            jest.spyOn(room, 'getAccountData').mockReturnValue(pinsAccountData);

            const menu = createMenu(pinnableEvent, {}, {}, undefined, room);

            act(() => {
                menu.find('div[aria-label="Unpin"]').simulate('click');
            });

            expect(client.setRoomAccountData).not.toHaveBeenCalled();

            // add to room's pins
            expect(client.sendStateEvent).toHaveBeenCalledWith(
                roomId, EventType.RoomPinnedEvents,
                // pinnableEvent's id removed, other pins intact
                { pinned: ['!another-event'] },
                "",
            );
        });
    });

    describe('message forwarding', () => {
        it('allows forwarding a room message', () => {
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

    describe('open as map link', () => {
        it('does not allow opening a plain message in open street maps', () => {
            const eventContent = MessageEvent.from("hello");
            const menu = createMenuWithContent(eventContent);
            expect(menu.find('a[aria-label="Open in OpenStreetMap"]')).toHaveLength(0);
        });

        it('does not allow opening a beacon that does not have a shareable location event', () => {
            const deadBeaconEvent = makeBeaconInfoEvent('@alice', roomId, { isLive: false });
            const beacon = new Beacon(deadBeaconEvent);
            const beacons = new Map<BeaconIdentifier, Beacon>();
            beacons.set(getBeaconInfoIdentifier(deadBeaconEvent), beacon);
            const menu = createMenu(deadBeaconEvent, {}, {}, beacons);
            expect(menu.find('a[aria-label="Open in OpenStreetMap"]')).toHaveLength(0);
        });

        it('allows opening a location event in open street map', () => {
            const locationEvent = makeLocationEvent('geo:50,50');
            const menu = createMenu(locationEvent);
            // exists with a href with the lat/lon from the location event
            expect(
                menu.find('a[aria-label="Open in OpenStreetMap"]').at(0).props().href,
            ).toEqual('https://www.openstreetmap.org/?mlat=50&mlon=50#map=16/50/50');
        });

        it('allows opening a beacon that has a shareable location event', () => {
            const liveBeaconEvent = makeBeaconInfoEvent('@alice', roomId, { isLive: true });
            const beaconLocation = makeBeaconEvent(
                '@alice', { beaconInfoId: liveBeaconEvent.getId(), geoUri: 'geo:51,41' },
            );
            const beacon = new Beacon(liveBeaconEvent);
            // @ts-ignore illegally set private prop
            beacon._latestLocationEvent = beaconLocation;
            const beacons = new Map<BeaconIdentifier, Beacon>();
            beacons.set(getBeaconInfoIdentifier(liveBeaconEvent), beacon);
            const menu = createMenu(liveBeaconEvent, {}, {}, beacons);
            // exists with a href with the lat/lon from the location event
            expect(
                menu.find('a[aria-label="Open in OpenStreetMap"]').at(0).props().href,
            ).toEqual('https://www.openstreetmap.org/?mlat=51&mlon=41#map=16/51/41');
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

            const menu = createRightClickMenuWithContent(eventContent, context);
            const replyButton = menu.find('div[aria-label="Reply"]');
            expect(replyButton).toHaveLength(1);
        });

        it('does not show reply button when we cannot reply', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canSendMessages: true,
            };
            const unsentMessage = new MatrixEvent(eventContent.serialize());
            // queued messages are not actionable
            unsentMessage.setStatus(EventStatus.QUEUED);

            const menu = createMenu(unsentMessage, {}, context);
            const replyButton = menu.find('div[aria-label="Reply"]');
            expect(replyButton).toHaveLength(0);
        });

        it('shows react button when we can react', () => {
            const eventContent = MessageEvent.from("hello");
            const context = {
                canReact: true,
            };

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

        it('creates a new thread on reply in thread click', () => {
            const eventContent = MessageEvent.from("hello");
            const mxEvent = new MatrixEvent(eventContent.serialize());

            Thread.hasServerSideSupport = true;
            const context = {
                canSendMessages: true,
            };
            jest.spyOn(SettingsStore, 'getValue').mockReturnValue(true);

            const menu = createRightClickMenu(mxEvent, context);

            const replyInThreadButton = menu.find('div[aria-label="Reply in thread"]');
            expect(replyInThreadButton).toHaveLength(1);
            replyInThreadButton.simulate("click");

            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ShowThread,
                rootEvent: mxEvent,
                push: false,
            });
        });
    });
});

function createRightClickMenuWithContent(
    eventContent: ExtensibleEvent,
    context?: Partial<IRoomState>,
): ReactWrapper {
    return createMenuWithContent(eventContent, { rightClick: true }, context);
}

function createRightClickMenu(mxEvent: MatrixEvent, context?: Partial<IRoomState>): ReactWrapper {
    return createMenu(mxEvent, { rightClick: true }, context);
}

function createMenuWithContent(
    eventContent: ExtensibleEvent,
    props?: Partial<React.ComponentProps<typeof MessageContextMenu>>,
    context?: Partial<IRoomState>,
): ReactWrapper {
    const mxEvent = new MatrixEvent(eventContent.serialize());
    return createMenu(mxEvent, props, context);
}

function makeDefaultRoom(): Room {
    return new Room(
        roomId,
        MatrixClientPeg.get(),
        "@user:example.com",
        {
            pendingEventOrdering: PendingEventOrdering.Detached,
        },
    );
}

function createMenu(
    mxEvent: MatrixEvent,
    props?: Partial<React.ComponentProps<typeof MessageContextMenu>>,
    context: Partial<IRoomState> = {},
    beacons: Map<BeaconIdentifier, Beacon> = new Map(),
    room: Room = makeDefaultRoom(),
): ReactWrapper {
    const client = MatrixClientPeg.get();

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
