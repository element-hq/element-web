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

import React from "react";
// eslint-disable-next-line deprecate/import
import { mount, ReactWrapper } from "enzyme";
import { act } from "react-dom/test-utils";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { EventType } from "matrix-js-sdk/src/matrix";
import { MEGOLM_ALGORITHM } from "matrix-js-sdk/src/crypto/olmlib";

import { stubClient, mockPlatformPeg, unmockPlatformPeg, wrapInMatrixClientContext } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { Action } from "../../../src/dispatcher/actions";
import { defaultDispatcher } from "../../../src/dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import { RoomView as _RoomView } from "../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import SettingsStore from "../../../src/settings/SettingsStore";
import { SettingLevel } from "../../../src/settings/SettingLevel";
import DMRoomMap from "../../../src/utils/DMRoomMap";
import { NotificationState } from "../../../src/stores/notifications/NotificationState";
import RightPanelStore from "../../../src/stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../src/stores/right-panel/RightPanelStorePhases";
import { LocalRoom, LocalRoomState } from "../../../src/models/LocalRoom";
import { DirectoryMember } from "../../../src/utils/direct-messages";
import { createDmLocalRoom } from "../../../src/utils/dm/createDmLocalRoom";

const RoomView = wrapInMatrixClientContext(_RoomView);

describe("RoomView", () => {
    let cli: MockedObject<MatrixClient>;
    let room: Room;
    let roomCount = 0;

    beforeEach(async () => {
        mockPlatformPeg({ reload: () => {} });
        stubClient();
        cli = mocked(MatrixClientPeg.get());

        room = new Room(`!${roomCount++}:example.org`, cli, "@alice:example.org");
        room.getPendingEvents = () => [];
        cli.getRoom.mockImplementation(() => room);
        // Re-emit certain events on the mocked client
        room.on(RoomEvent.Timeline, (...args) => cli.emit(RoomEvent.Timeline, ...args));
        room.on(RoomEvent.TimelineReset, (...args) => cli.emit(RoomEvent.TimelineReset, ...args));

        DMRoomMap.makeShared();
        RightPanelStore.instance.useUnitTestClient(cli);
    });

    afterEach(async () => {
        unmockPlatformPeg();
        jest.restoreAllMocks();
    });

    const mountRoomView = async (): Promise<ReactWrapper> => {
        if (RoomViewStore.instance.getRoomId() !== room.roomId) {
            const switchedRoom = new Promise<void>(resolve => {
                const subscription = RoomViewStore.instance.addListener(() => {
                    if (RoomViewStore.instance.getRoomId()) {
                        subscription.remove();
                        resolve();
                    }
                });
            });

            defaultDispatcher.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: null,
            });

            await switchedRoom;
        }

        const roomView = mount(
            <RoomView
                mxClient={cli}
                threepidInvite={null}
                oobData={null}
                resizeNotifier={new ResizeNotifier()}
                justCreatedOpts={null}
                forceTimeline={false}
                onRegistered={null}
            />,
        );
        await act(() => Promise.resolve()); // Allow state to settle
        return roomView;
    };
    const getRoomViewInstance = async (): Promise<_RoomView> =>
        (await mountRoomView()).find(_RoomView).instance() as _RoomView;

    it("updates url preview visibility on encryption state change", async () => {
        // we should be starting unencrypted
        expect(cli.isCryptoEnabled()).toEqual(false);
        expect(cli.isRoomEncrypted(room.roomId)).toEqual(false);

        const roomViewInstance = await getRoomViewInstance();

        // in a default (non-encrypted room, it should start out with url previews enabled)
        // This is a white-box test in that we're asserting things about the state, which
        // is not ideal, but asserting that a URL preview just isn't there could risk the
        // test being invalid because the previews just hasn't rendered yet. This feels
        // like the safest way I think?
        // This also relies on the default settings being URL previews on normally and
        // off for e2e rooms because 1) it's probably useful to assert this and
        // 2) SettingsStore is a static class and so very hard to mock out.
        expect(roomViewInstance.state.showUrlPreview).toBe(true);

        // now enable encryption
        cli.isCryptoEnabled.mockReturnValue(true);
        cli.isRoomEncrypted.mockReturnValue(true);

        // and fake an encryption event into the room to prompt it to re-check
        room.addLiveEvents([new MatrixEvent({
            type: "m.room.encryption",
            sender: cli.getUserId(),
            content: {},
            event_id: "someid",
            room_id: room.roomId,
        })]);

        // URL previews should now be disabled
        expect(roomViewInstance.state.showUrlPreview).toBe(false);
    });

    it("updates live timeline when a timeline reset happens", async () => {
        const roomViewInstance = await getRoomViewInstance();
        const oldTimeline = roomViewInstance.state.liveTimeline;

        room.getUnfilteredTimelineSet().resetLiveTimeline();
        expect(roomViewInstance.state.liveTimeline).not.toEqual(oldTimeline);
    });

    describe("video rooms", () => {
        beforeEach(async () => {
            // Make it a video room
            room.isElementVideoRoom = () => true;
            await SettingsStore.setValue("feature_video_rooms", null, SettingLevel.DEVICE, true);
        });

        it("normally doesn't open the chat panel", async () => {
            jest.spyOn(NotificationState.prototype, "isUnread", "get").mockReturnValue(false);
            await mountRoomView();
            expect(RightPanelStore.instance.isOpen).toEqual(false);
        });

        it("opens the chat panel if there are unread messages", async () => {
            jest.spyOn(NotificationState.prototype, "isUnread", "get").mockReturnValue(true);
            await mountRoomView();
            expect(RightPanelStore.instance.isOpen).toEqual(true);
            expect(RightPanelStore.instance.currentCard.phase).toEqual(RightPanelPhases.Timeline);
        });
    });

    describe("for a local room", () => {
        let localRoom: LocalRoom;
        let roomView: ReactWrapper;

        beforeEach(async () => {
            localRoom = room = await createDmLocalRoom(cli, [new DirectoryMember({ user_id: "@user:example.com" })]);
            cli.store.storeRoom(room);
        });

        it("should remove the room from the store on unmount", async () => {
            roomView = await mountRoomView();
            roomView.unmount();
            expect(cli.store.removeRoom).toHaveBeenCalledWith(room.roomId);
        });

        describe("in state NEW", () => {
            it("should match the snapshot", async () => {
                roomView = await mountRoomView();
                expect(roomView.html()).toMatchSnapshot();
            });

            describe("that is encrypted", () => {
                beforeEach(() => {
                    mocked(cli.isRoomEncrypted).mockReturnValue(true);
                    localRoom.encrypted = true;
                    localRoom.currentState.setStateEvents([
                        new MatrixEvent({
                            event_id: `~${localRoom.roomId}:${cli.makeTxnId()}`,
                            type: EventType.RoomEncryption,
                            content: {
                                algorithm: MEGOLM_ALGORITHM,
                            },
                            user_id: cli.getUserId(),
                            sender: cli.getUserId(),
                            state_key: "",
                            room_id: localRoom.roomId,
                            origin_server_ts: Date.now(),
                        }),
                    ]);
                });

                it("should match the snapshot", async () => {
                    const roomView = await mountRoomView();
                    expect(roomView.html()).toMatchSnapshot();
                });
            });
        });

        it("in state CREATING should match the snapshot", async () => {
            localRoom.state = LocalRoomState.CREATING;
            roomView = await mountRoomView();
            expect(roomView.html()).toMatchSnapshot();
        });

        describe("in state ERROR", () => {
            beforeEach(async () => {
                localRoom.state = LocalRoomState.ERROR;
                roomView = await mountRoomView();
            });

            it("should match the snapshot", async () => {
                expect(roomView.html()).toMatchSnapshot();
            });

            it("clicking retry should set the room state to new dispatch a local room event", () => {
                jest.spyOn(defaultDispatcher, "dispatch");
                roomView.findWhere((w: ReactWrapper) => {
                    return w.hasClass("mx_RoomStatusBar_unsentRetry") && w.text() === "Retry";
                }).first().simulate("click");
                expect(localRoom.state).toBe(LocalRoomState.NEW);
                expect(defaultDispatcher.dispatch).toHaveBeenCalledWith({
                    action: "local_room_event",
                    roomId: room.roomId,
                });
            });
        });
    });
});
