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
import TestRenderer from "react-test-renderer";
import { Room, RoomEvent } from "matrix-js-sdk/src/models/room";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";

import { MatrixClientPeg } from "../../../src/MatrixClientPeg";
import { stubClient } from "../../test-utils";
import { Action } from "../../../src/dispatcher/actions";
import dis from "../../../src/dispatcher/dispatcher";
import { ViewRoomPayload } from "../../../src/dispatcher/payloads/ViewRoomPayload";
import MatrixClientContext from "../../../src/contexts/MatrixClientContext";
import { RoomView } from "../../../src/components/structures/RoomView";
import ResizeNotifier from "../../../src/utils/ResizeNotifier";
import { RoomViewStore } from "../../../src/stores/RoomViewStore";
import DMRoomMap from "../../../src/utils/DMRoomMap";

describe("RoomView", () => {
    it("updates url preview visibility on encryption state change", async () => {
        stubClient();
        const cli = MatrixClientPeg.get();
        cli.hasLazyLoadMembersEnabled = () => false;
        cli.isInitialSyncComplete = () => true;
        cli.stopPeeking = () => undefined;

        const r1 = new Room("r1", cli, "@name:example.com");
        cli.getRoom = () => r1;
        r1.getPendingEvents = () => [];

        DMRoomMap.makeShared();

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
            room_id: r1.roomId,
            metricsTrigger: null,
        });

        await switchRoomPromise;

        const renderer = TestRenderer.create(<MatrixClientContext.Provider value={cli}>
            <RoomView mxClient={cli}
                threepidInvite={null}
                oobData={null}
                resizeNotifier={new ResizeNotifier()}
                justCreatedOpts={null}
                forceTimeline={false}
                onRegistered={null}
            />
        </MatrixClientContext.Provider>);

        const roomViewInstance = renderer.root.findByType(RoomView).instance;

        // in a default (non-encrypted room, it should start out with url previews enabled)
        // This is a white-box test in that we're asserting things about the state, which
        // is not ideal, but asserting that a URL preview just isn't there could risk the
        // test being invalid because the previews just hasn't rendered yet. This feels
        // like the safest way I think?
        // This also relies on the default settings being URL previews on normally and
        // off for e2e rooms because 1) it's probably useful to assert this and
        // 2) SettingsStore is a static class and so very hard to mock out.
        expect(roomViewInstance.state.showUrlPreview).toBe(true);

        // now enable encryption (by mocking out the tests for whether a room is encrypted)
        cli.isCryptoEnabled = () => true;
        cli.isRoomEncrypted = () => true;

        // and fake an encryption event into the room to prompt it to re-check
        // wait until the event has been added
        const eventAddedPromise = new Promise<void>(resolve => {
            r1.once(RoomEvent.Timeline, (...args) => {
                // we're also using mock client that doesn't re-emit, so
                // we emit the event to client manually
                cli.emit(RoomEvent.Timeline, ...args);
                resolve();
            });
        });

        r1.addLiveEvents([new MatrixEvent({
            type: "m.room.encryption",
            sender: cli.getUserId(),
            content: {},
            event_id: "someid",
            room_id: r1.roomId,
        })]);

        await eventAddedPromise;

        // URL previews should now be disabled
        expect(roomViewInstance.state.showUrlPreview).toBe(false);
    });
});
