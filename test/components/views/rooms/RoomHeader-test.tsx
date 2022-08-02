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
import { Room, PendingEventOrdering, MatrixEvent, MatrixClient } from 'matrix-js-sdk/src/matrix';

import * as TestUtils from '../../../test-utils';
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import DMRoomMap from '../../../../src/utils/DMRoomMap';
import RoomHeader from '../../../../src/components/views/rooms/RoomHeader';
import { SearchScope } from '../../../../src/components/views/rooms/SearchBar';
import { E2EStatus } from '../../../../src/utils/ShieldUtils';
import { mkEvent } from '../../../test-utils';
import { IRoomState } from "../../../../src/components/structures/RoomView";
import RoomContext from '../../../../src/contexts/RoomContext';

describe('RoomHeader', () => {
    it('shows the room avatar in a room with only ourselves', () => {
        // When we render a non-DM room with 1 person in it
        const room = createRoom({ name: "X Room", isDm: false, userIds: [] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("X");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a room with 2 people', () => {
        // When we render a non-DM room with 2 people in it
        const room = createRoom(
            { name: "Y Room", isDm: false, userIds: ["other"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("Y");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a room with >2 people', () => {
        // When we render a non-DM room with 3 people in it
        const room = createRoom({ name: "Z Room", isDm: false, userIds: ["other1", "other2"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it('shows the room avatar in a DM with only ourselves', () => {
        // When we render a non-DM room with 1 person in it
        const room = createRoom({ name: "Z Room", isDm: true, userIds: [] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it('shows the user avatar in a DM with 2 people', () => {
        // Note: this is the interesting case - this is the ONLY
        //       time we should use the user's avatar.

        // When we render a DM room with only 2 people in it
        const room = createRoom({ name: "Y Room", isDm: true, userIds: ["other"] });
        const rendered = render(room);

        // Then we use the other user's avatar as our room's image avatar
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("http://this.is.a.url/example.org/other");

        // And there is no initial avatar
        expect(rendered.find(".mx_BaseAvatar_initial")).toHaveLength(0);
    });

    it('shows the room avatar in a DM with >2 people', () => {
        // When we render a DM room with 3 people in it
        const room = createRoom({
            name: "Z Room", isDm: true, userIds: ["other1", "other2"] });
        const rendered = render(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it("renders call buttons normally", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room);

        expect(wrapper.find('[aria-label="Voice call"]').hostNodes()).toHaveLength(1);
        expect(wrapper.find('[aria-label="Video call"]').hostNodes()).toHaveLength(1);
    });

    it("hides call buttons when the room is tombstoned", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room, {}, {
            tombstone: mkEvent({
                event: true,
                type: "m.room.tombstone",
                room: room.roomId,
                user: "@user1:server",
                skey: "",
                content: {},
                ts: Date.now(),
            }),
        });

        expect(wrapper.find('[aria-label="Voice call"]').hostNodes()).toHaveLength(0);
        expect(wrapper.find('[aria-label="Video call"]').hostNodes()).toHaveLength(0);
    });

    it("should render buttons if not passing showButtons (default true)", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room);
        expect(wrapper.find(".mx_RoomHeader_buttons")).toHaveLength(1);
    });

    it("should not render buttons if passing showButtons = false", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room, { showButtons: false });
        expect(wrapper.find(".mx_RoomHeader_buttons")).toHaveLength(0);
    });

    it("should render the room options context menu if not passing enableRoomOptionsMenu (default true)", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room);
        expect(wrapper.find(".mx_RoomHeader_name.mx_AccessibleButton")).toHaveLength(1);
    });

    it("should not render the room options context menu if passing enableRoomOptionsMenu = false", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = render(room, { enableRoomOptionsMenu: false });
        expect(wrapper.find(".mx_RoomHeader_name.mx_AccessibleButton")).toHaveLength(0);
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

function render(room: Room, propsOverride = {}, roomContext?: Partial<IRoomState>): ReactWrapper {
    const props = {
        room,
        inRoom: true,
        onSearchClick: () => {},
        onInviteClick: null,
        onForgetClick: () => {},
        onCallPlaced: (_type) => { },
        onAppsClick: () => {},
        e2eStatus: E2EStatus.Normal,
        appsShown: true,
        searchInfo: {
            searchTerm: "",
            searchScope: SearchScope.Room,
            searchCount: 0,
        },
        ...propsOverride,
    };

    return mount((
        <RoomContext.Provider value={{ ...roomContext, room } as IRoomState}>
            <RoomHeader {...props} />
        </RoomContext.Provider>
    ));
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

function findSpan(wrapper: ReactWrapper, selector: string): ReactWrapper {
    const els = wrapper.find(selector).hostNodes();
    expect(els).toHaveLength(1);
    return els.at(0);
}

function findImg(wrapper: ReactWrapper, selector: string): ReactWrapper {
    const els = wrapper.find(selector).hostNodes();
    expect(els).toHaveLength(1);
    return els.at(0);
}
