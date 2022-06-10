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
import { mount, ReactWrapper } from "enzyme";
import { mocked, MockedObject } from "jest-mock";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { stubClient, wrapInMatrixClientContext } from "../../test-utils";
import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import { RoomView as _RoomView } from "../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";

const RoomView = wrapInMatrixClientContext(_RoomView);

describe("RoomView", () => {
    let cli: MockedObject<MatrixClient>;
    let room: Room;
    beforeEach(() => {
        stubClient();
        cli = mocked(MatrixClientPeg.get());

        room = new Room("r1", cli, "@alice:example.com");
        room.getPendingEvents = () => [];
        cli.getRoom.mockReturnValue(room);
        // Re-emit certain events on the mocked client
        room.on(RoomEvent.Timeline, (...args) => cli.emit(RoomEvent.Timeline, ...args));
        room.on(RoomEvent.TimelineReset, (...args) => cli.emit(RoomEvent.TimelineReset, ...args));

        DMRoomMap.makeShared();
    });

    const mountRoomView = async (): Promise<ReactWrapper> => {
        if (RoomViewStore.instance.getRoomId() !== room.roomId) {
            const switchRoomPromise = new Promise<void>(resolve => {
                const subscription = RoomViewStore.instance.addListener(() => {
                    if (RoomViewStore.instance.getRoomId()) {
                        subscription.remove();
                        resolve();
                    }
                });
            });

            dis.dispatch<ViewRoomPayload>({
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: null,
            });

            await switchRoomPromise;
        }

        return mount(
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
});
