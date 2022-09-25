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
import { render, screen, act, fireEvent, waitFor, getByRole } from "@testing-library/react";
import "@testing-library/jest-dom";
import { mocked, Mocked } from "jest-mock";
import { EventType, RoomType } from "matrix-js-sdk/src/@types/event";
import { Room } from "matrix-js-sdk/src/models/room";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { PendingEventOrdering } from "matrix-js-sdk/src/client";
import { CallType } from "matrix-js-sdk/src/webrtc/call";

import type { MatrixClient } from "matrix-js-sdk/src/client";
import type { MatrixEvent } from "matrix-js-sdk/src/models/event";
import type { RoomMember } from "matrix-js-sdk/src/models/room-member";
import type { MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import {
    stubClient,
    mkRoomMember,
    setupAsyncStoreWithClient,
    resetAsyncStoreWithClient,
    mockPlatformPeg,
} from "../../../test-utils";
import { MatrixClientPeg } from '../../../../src/MatrixClientPeg';
import DMRoomMap from '../../../../src/utils/DMRoomMap';
import RoomHeader, { IProps as RoomHeaderProps } from "../../../../src/components/views/rooms/RoomHeader";
import { SearchScope } from '../../../../src/components/views/rooms/SearchBar';
import { E2EStatus } from '../../../../src/utils/ShieldUtils';
import { mkEvent } from '../../../test-utils';
import { IRoomState } from "../../../../src/components/structures/RoomView";
import RoomContext from '../../../../src/contexts/RoomContext';
import SdkConfig from "../../../../src/SdkConfig";
import SettingsStore from "../../../../src/settings/SettingsStore";
import { ElementCall, JitsiCall } from "../../../../src/models/Call";
import { CallStore } from "../../../../src/stores/CallStore";
import LegacyCallHandler from "../../../../src/LegacyCallHandler";
import defaultDispatcher from "../../../../src/dispatcher/dispatcher";
import { Action } from "../../../../src/dispatcher/actions";
import WidgetStore from "../../../../src/stores/WidgetStore";

describe('RoomHeader (Enzyme)', () => {
    it('shows the room avatar in a room with only ourselves', () => {
        // When we render a non-DM room with 1 person in it
        const room = createRoom({ name: "X Room", isDm: false, userIds: [] });
        const rendered = mountHeader(room);

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
        const rendered = mountHeader(room);

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
        const rendered = mountHeader(room);

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
        const rendered = mountHeader(room);

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
        const rendered = mountHeader(room);

        // Then we use the other user's avatar as our room's image avatar
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("http://this.is.a.url/example.org/other");

        // And there is no initial avatar
        expect(rendered.find(".mx_BaseAvatar_initial")).toHaveLength(0);
    });

    it('shows the room avatar in a DM with >2 people', () => {
        // When we render a DM room with 3 people in it
        const room = createRoom({
            name: "Z Room", isDm: true, userIds: ["other1", "other2"],
        });
        const rendered = mountHeader(room);

        // Then the room's avatar is the initial of its name
        const initial = findSpan(rendered, ".mx_BaseAvatar_initial");
        expect(initial.text()).toEqual("Z");

        // And there is no image avatar (because it's not set on this room)
        const image = findImg(rendered, ".mx_BaseAvatar_image");
        expect(image.prop("src")).toEqual("data:image/png;base64,00");
    });

    it("renders call buttons normally", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: ["other"] });
        const wrapper = mountHeader(room);

        expect(wrapper.find('[aria-label="Voice call"]').hostNodes()).toHaveLength(1);
        expect(wrapper.find('[aria-label="Video call"]').hostNodes()).toHaveLength(1);
    });

    it("hides call buttons when the room is tombstoned", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = mountHeader(room, {}, {
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
        const wrapper = mountHeader(room);
        expect(wrapper.find(".mx_RoomHeader_buttons")).toHaveLength(1);
    });

    it("should not render buttons if passing showButtons = false", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = mountHeader(room, { showButtons: false });
        expect(wrapper.find(".mx_RoomHeader_buttons")).toHaveLength(0);
    });

    it("should render the room options context menu if not passing enableRoomOptionsMenu (default true)", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = mountHeader(room);
        expect(wrapper.find(".mx_RoomHeader_name.mx_AccessibleButton")).toHaveLength(1);
    });

    it("should not render the room options context menu if passing enableRoomOptionsMenu = false", () => {
        const room = createRoom({ name: "Room", isDm: false, userIds: [] });
        const wrapper = mountHeader(room, { enableRoomOptionsMenu: false });
        expect(wrapper.find(".mx_RoomHeader_name.mx_AccessibleButton")).toHaveLength(0);
    });
});

interface IRoomCreationInfo {
    name: string;
    isDm: boolean;
    userIds: string[];
}

function createRoom(info: IRoomCreationInfo) {
    stubClient();
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

function mountHeader(room: Room, propsOverride = {}, roomContext?: Partial<IRoomState>): ReactWrapper {
    const props = {
        room,
        inRoom: true,
        onSearchClick: () => { },
        onInviteClick: null,
        onForgetClick: () => { },
        onCallPlaced: (_type) => { },
        onAppsClick: () => { },
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

describe("RoomHeader (React Testing Library)", () => {
    let client: Mocked<MatrixClient>;
    let room: Room;
    let alice: RoomMember;
    let bob: RoomMember;
    let carol: RoomMember;

    beforeEach(async () => {
        mockPlatformPeg({ supportsJitsiScreensharing: () => true });

        stubClient();
        client = mocked(MatrixClientPeg.get());
        client.getUserId.mockReturnValue("@alice:example.org");

        room = new Room("!1:example.org", client, "@alice:example.org", {
            pendingEventOrdering: PendingEventOrdering.Detached,
        });
        room.currentState.setStateEvents([mkCreationEvent(room.roomId, "@alice:example.org")]);

        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);
        client.sendStateEvent.mockImplementation(async (roomId, eventType, content, stateKey = "") => {
            if (roomId !== room.roomId) throw new Error("Unknown room");
            const event = mkEvent({
                event: true,
                type: eventType,
                room: roomId,
                user: alice.userId,
                skey: stateKey,
                content,
            });
            room.addLiveEvents([event]);
            return { event_id: event.getId() };
        });

        alice = mkRoomMember(room.roomId, "@alice:example.org");
        bob = mkRoomMember(room.roomId, "@bob:example.org");
        carol = mkRoomMember(room.roomId, "@carol:example.org");

        client.getRoom.mockImplementation(roomId => roomId === room.roomId ? room : null);
        client.getRooms.mockReturnValue([room]);
        client.reEmitter.reEmit(room, [RoomStateEvent.Events]);

        await Promise.all([CallStore.instance, WidgetStore.instance].map(
            store => setupAsyncStoreWithClient(store, client),
        ));
    });

    afterEach(async () => {
        await Promise.all([CallStore.instance, WidgetStore.instance].map(resetAsyncStoreWithClient));
        client.reEmitter.stopReEmitting(room, [RoomStateEvent.Events]);
        jest.restoreAllMocks();
        SdkConfig.put({});
    });

    const mockRoomType = (type: string) => {
        jest.spyOn(room, "getType").mockReturnValue(type);
    };
    const mockRoomMembers = (members: RoomMember[]) => {
        jest.spyOn(room, "getJoinedMembers").mockReturnValue(members);
        jest.spyOn(room, "getMember").mockImplementation(
            userId => members.find(member => member.userId === userId) ?? null,
        );
    };
    const mockEnabledSettings = (settings: string[]) => {
        jest.spyOn(SettingsStore, "getValue").mockImplementation(
            settingName => settings.includes(settingName),
        );
    };
    const mockEventPowerLevels = (events: { [eventType: string]: number }) => {
        room.currentState.setStateEvents([
            mkEvent({
                event: true,
                type: EventType.RoomPowerLevels,
                room: room.roomId,
                user: alice.userId,
                skey: "",
                content: { events, state_default: 0 },
            }),
        ]);
    };
    const mockLegacyCall = () => {
        jest.spyOn(LegacyCallHandler.instance, "getCallForRoom").mockReturnValue({} as unknown as MatrixCall);
    };

    const renderHeader = (props: Partial<RoomHeaderProps> = {}, roomContext: Partial<IRoomState> = {}) => {
        render(
            <RoomContext.Provider value={{ ...roomContext, room } as IRoomState}>
                <RoomHeader
                    room={room}
                    inRoom={true}
                    onSearchClick={() => { }}
                    onInviteClick={null}
                    onForgetClick={() => { }}
                    onAppsClick={() => { }}
                    e2eStatus={E2EStatus.Normal}
                    appsShown={true}
                    searchInfo={{
                        searchTerm: "",
                        searchScope: SearchScope.Room,
                        searchCount: 0,
                    }}
                    {...props}
                />
            </RoomContext.Provider>,
        );
    };

    it("hides call buttons in video rooms", () => {
        mockRoomType(RoomType.UnstableCall);
        mockEnabledSettings(["showCallButtonsInComposer", "feature_video_rooms", "feature_element_call_video_rooms"]);

        renderHeader();
        expect(screen.queryByRole("button", { name: /call/i })).toBeNull();
    });

    it("hides call buttons if showCallButtonsInComposer is disabled", () => {
        mockEnabledSettings([]);

        renderHeader();
        expect(screen.queryByRole("button", { name: /call/i })).toBeNull();
    });

    it(
        "hides the voice call button and disables the video call button if configured to use Element Call exclusively "
        + "and there's an ongoing call",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            SdkConfig.put({ element_call: { url: "https://call.element.io", use_exclusively: true } });
            await ElementCall.create(room);

            renderHeader();
            expect(screen.queryByRole("button", { name: "Voice call" })).toBeNull();
            expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
        },
    );

    it(
        "hides the voice call button and starts an Element call when the video call button is pressed if configured to "
        + "use Element Call exclusively",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            SdkConfig.put({ element_call: { url: "https://call.element.io", use_exclusively: true } });

            renderHeader();
            expect(screen.queryByRole("button", { name: "Voice call" })).toBeNull();

            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            await waitFor(() => expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
            }));
            defaultDispatcher.unregister(dispatcherRef);
        },
    );

    it(
        "hides the voice call button and disables the video call button if configured to use Element Call exclusively "
        + "and the user lacks permission",
        () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            SdkConfig.put({ element_call: { url: "https://call.element.io", use_exclusively: true } });
            mockEventPowerLevels({ [ElementCall.CALL_EVENT_TYPE.name]: 100 });

            renderHeader();
            expect(screen.queryByRole("button", { name: "Voice call" })).toBeNull();
            expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
        },
    );

    it("disables call buttons in the new group call experience if there's an ongoing Element call", async () => {
        mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
        await ElementCall.create(room);

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons in the new group call experience if there's an ongoing legacy 1:1 call", () => {
        mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
        mockLegacyCall();

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons in the new group call experience if there's an existing Jitsi widget", async () => {
        mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
        await JitsiCall.create(room);

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons in the new group call experience if there's no other members", () => {
        mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it(
        "starts a legacy 1:1 call when call buttons are pressed in the new group call experience if there's 1 other "
        + "member",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            mockRoomMembers([alice, bob]);

            renderHeader();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall").mockResolvedValue(undefined);
            fireEvent.click(screen.getByRole("button", { name: "Voice call" }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Voice);

            placeCallSpy.mockClear();
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Video);
        },
    );

    it(
        "creates a Jitsi widget when call buttons are pressed in the new group call experience if the user lacks "
        + "permission to start Element calls",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            mockRoomMembers([alice, bob, carol]);
            mockEventPowerLevels({ [ElementCall.CALL_EVENT_TYPE.name]: 100 });

            renderHeader();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall").mockResolvedValue(undefined);
            fireEvent.click(screen.getByRole("button", { name: "Voice call" }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Voice);

            placeCallSpy.mockClear();
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Video);
        },
    );

    it(
        "creates a Jitsi widget when the voice call button is pressed and shows a menu when the video call button is "
        + "pressed in the new group call experience",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            mockRoomMembers([alice, bob, carol]);

            renderHeader();

            const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall").mockResolvedValue(undefined);
            fireEvent.click(screen.getByRole("button", { name: "Voice call" }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Voice);

            // First try creating a Jitsi widget from the menu
            placeCallSpy.mockClear();
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            fireEvent.click(getByRole(screen.getByRole("menu"), "menuitem", { name: /jitsi/i }));
            await act(() => Promise.resolve()); // Allow effects to settle
            expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Video);

            // Then try starting an Element call from the menu
            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            fireEvent.click(getByRole(screen.getByRole("menu"), "menuitem", { name: /element/i }));
            await waitFor(() => expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
            }));
            defaultDispatcher.unregister(dispatcherRef);
        },
    );

    it(
        "disables the voice call button and starts an Element call when the video call button is pressed in the new "
        + "group call experience if the user lacks permission to edit widgets",
        async () => {
            mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
            mockRoomMembers([alice, bob, carol]);
            mockEventPowerLevels({ "im.vector.modular.widgets": 100 });

            renderHeader();
            expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");

            const dispatcherSpy = jest.fn();
            const dispatcherRef = defaultDispatcher.register(dispatcherSpy);
            fireEvent.click(screen.getByRole("button", { name: "Video call" }));
            await waitFor(() => expect(dispatcherSpy).toHaveBeenCalledWith({
                action: Action.ViewRoom,
                room_id: room.roomId,
                view_call: true,
            }));
            defaultDispatcher.unregister(dispatcherRef);
        },
    );

    it("disables call buttons in the new group call experience if the user lacks permission", () => {
        mockEnabledSettings(["showCallButtonsInComposer", "feature_group_calls"]);
        mockRoomMembers([alice, bob, carol]);
        mockEventPowerLevels({ [ElementCall.CALL_EVENT_TYPE.name]: 100, "im.vector.modular.widgets": 100 });

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons if there's an ongoing legacy 1:1 call", () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);
        mockLegacyCall();

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons if there's an existing Jitsi widget", async () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);
        await JitsiCall.create(room);

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("disables call buttons if there's no other members", () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });

    it("starts a legacy 1:1 call when call buttons are pressed if there's 1 other member", async () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);
        mockRoomMembers([alice, bob]);
        mockEventPowerLevels({ "im.vector.modular.widgets": 100 }); // Just to verify that it doesn't try to use Jitsi

        renderHeader();

        const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall").mockResolvedValue(undefined);
        fireEvent.click(screen.getByRole("button", { name: "Voice call" }));
        await act(() => Promise.resolve()); // Allow effects to settle
        expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Voice);

        placeCallSpy.mockClear();
        fireEvent.click(screen.getByRole("button", { name: "Video call" }));
        await act(() => Promise.resolve()); // Allow effects to settle
        expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Video);
    });

    it("creates a Jitsi widget when call buttons are pressed", async () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);
        mockRoomMembers([alice, bob, carol]);

        renderHeader();

        const placeCallSpy = jest.spyOn(LegacyCallHandler.instance, "placeCall").mockResolvedValue(undefined);
        fireEvent.click(screen.getByRole("button", { name: "Voice call" }));
        await act(() => Promise.resolve()); // Allow effects to settle
        expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Voice);

        placeCallSpy.mockClear();
        fireEvent.click(screen.getByRole("button", { name: "Video call" }));
        await act(() => Promise.resolve()); // Allow effects to settle
        expect(placeCallSpy).toHaveBeenCalledWith(room.roomId, CallType.Video);
    });

    it("disables call buttons if the user lacks permission", () => {
        mockEnabledSettings(["showCallButtonsInComposer"]);
        mockRoomMembers([alice, bob, carol]);
        mockEventPowerLevels({ "im.vector.modular.widgets": 100 });

        renderHeader();
        expect(screen.getByRole("button", { name: "Voice call" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Video call" })).toHaveAttribute("aria-disabled", "true");
    });
});
