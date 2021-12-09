import React from 'react';
import ReactDOM from 'react-dom';
import { Room, PendingEventOrdering, MatrixEvent, MatrixClient } from 'matrix-js-sdk';

import "../../../skinned-sdk";
import * as TestUtils from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import DMRoomMap from '../../../../src/utils/DMRoomMap';
import RoomHeader from '../../../../src/components/views/rooms/RoomHeader';
import { SearchScope } from '../../../../src/components/views/rooms/SearchBar';
import { E2EStatus } from '../../../../src/utils/ShieldUtils';
import { PlaceCallType } from '../../../../src/CallHandler';
import { mkEvent } from '../../../test-utils';

describe('RoomHeader', () => {
    it('shows the room avatar in a room with only ourselves', () => {
        // When we render a non-DM room with 1 person in it
        const room = createRoom({ name: "X Room", isDm: false, userIds: [] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.innerHTML).toEqual("X");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a room with 2 people', () => {
        // When we render a non-DM room with 2 people in it
        const room = createRoom(
            { name: "Y Room", isDm: false, userIds: ["other"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.innerHTML).toEqual("Y");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a room with >2 people', () => {
        // When we render a non-DM room with 3 people in it
        const room = createRoom(
            { name: "Z Room", isDm: false, userIds: ["other1", "other2"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.innerHTML).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a DM with only ourselves', () => {
        // When we render a non-DM room with 1 person in it
        const room = createRoom({ name: "Z Room", isDm: true, userIds: [] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.innerHTML).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual("data:image/png;base64,00");
    });

    it('shows the user avatar in a DM with 2 people', () => {
        // Note: this is the interesting case - this is the ONLY
        //       time we should use the user's avatar.

        // When we render a DM room with only 2 people in it
        const room = createRoom({ name: "Y Room", isDm: true, userIds: ["other"] });
        const rendered = render(room);

        // Then we use the other user's avatar as our room's image avatar
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual(
            "http://this.is.a.url/example.org/other");

        // And there is no initial avatar
        expect(
            rendered.querySelectorAll(".mx_BaseAvatar_initial"),
        ).toHaveLength(0);
    });

    it('shows the room avatar in a DM with >2 people', () => {
        // When we render a DM room with 3 people in it
        const room = createRoom({
            name: "Z Room", isDm: true, userIds: ["other1", "other2"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.innerHTML).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.src).toEqual("data:image/png;base64,00");
    });
});

interface IRoomCreationInfo {
    name: string;
    isDm: boolean;
    userIds: string[];
}

function createRoom(info: IRoomCreationInfo) {
    TestUtils.stubClient();
    const client: MatrixClient = MatrixClientPeg.get();

    const roomId = '!1234567890:domain';
    const userId = client.getUserId();
    if (info.isDm) {
        client.getAccountData = (eventType) => {
            expect(eventType).toEqual("m.direct");
            return mkDirectEvent(roomId, userId, info.userIds);
        };
    }

    DMRoomMap.makeShared().start();

    const room = new Room(roomId, client, userId, {
        pendingEventOrdering: PendingEventOrdering.Detached,
    });

    const otherJoinEvents = [];
    for (const otherUserId of info.userIds) {
        otherJoinEvents.push(mkJoinEvent(roomId, otherUserId));
    }

    room.currentState.setStateEvents([
        mkCreationEvent(roomId, userId),
        mkNameEvent(roomId, userId, info.name),
        mkJoinEvent(roomId, userId),
        ...otherJoinEvents,
    ]);
    room.recalculate();

    return room;
}

function render(room: Room): HTMLDivElement {
    const parentDiv = document.createElement('div');
    document.body.appendChild(parentDiv);
    ReactDOM.render(
        (
            <RoomHeader
                room={room}
                inRoom={true}
                onSearchClick={() => {}}
                onForgetClick={() => {}}
                onCallPlaced={(_type: PlaceCallType) => {}}
                onAppsClick={() => {}}
                e2eStatus={E2EStatus.Normal}
                appsShown={true}
                searchInfo={{
                    searchTerm: "",
                    searchScope: SearchScope.Room,
                    searchCount: 0,
                }}
            />
        ),
        parentDiv,
    );
    return parentDiv;
}

function mkCreationEvent(roomId: string, userId: string): MatrixEvent {
    return mkEvent({
        event: true,
        type: "m.room.create",
        room: roomId,
        user: userId,
        content: {
            creator: userId,
            room_version: "5",
            predecessor: {
                room_id: "!prevroom",
                event_id: "$someevent",
            },
        },
    });
}

function mkNameEvent(
    roomId: string, userId: string, name: string,
): MatrixEvent {
    return mkEvent({
        event: true,
        type: "m.room.name",
        room: roomId,
        user: userId,
        content: { name },
    });
}

function mkJoinEvent(roomId: string, userId: string) {
    const ret = mkEvent({
        event: true,
        type: "m.room.member",
        room: roomId,
        user: userId,
        content: {
            "membership": "join",
            "avatar_url": "mxc://example.org/" + userId,
        },
    });
    ret.event.state_key = userId;
    return ret;
}

function mkDirectEvent(
    roomId: string, userId: string, otherUsers: string[],
): MatrixEvent {
    const content = {};
    for (const otherUserId of otherUsers) {
        content[otherUserId] = [roomId];
    }
    return mkEvent({
        event: true,
        type: "m.direct",
        room: roomId,
        user: userId,
        content,
    });
}

function findSpan(parent: HTMLElement, selector: string): HTMLSpanElement {
    const els = parent.querySelectorAll(selector);
    expect(els.length).toEqual(1);
    return els[0] as HTMLSpanElement;
}

function findImg(parent: HTMLElement, selector: string): HTMLImageElement {
    const els = parent.querySelectorAll(selector);
    expect(els.length).toEqual(1);
    return els[0] as HTMLImageElement;
}
