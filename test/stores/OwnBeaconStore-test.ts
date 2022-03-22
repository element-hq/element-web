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

import { Room, Beacon, BeaconEvent } from "matrix-js-sdk/src/matrix";
import { M_BEACON_INFO } from "matrix-js-sdk/src/@types/beacon";

import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../src/stores/OwnBeaconStore";
import { resetAsyncStoreWithClient, setupAsyncStoreWithClient } from "../test-utils";
import { makeBeaconInfoEvent } from "../test-utils/beacon";
import { getMockClientWithEventEmitter } from "../test-utils/client";

jest.useFakeTimers();

describe('OwnBeaconStore', () => {
    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;

    const aliceId = '@alice:server.org';
    const bobId = '@bob:server.org';
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        unstable_setLiveBeacon: jest.fn().mockResolvedValue({ event_id: '1' }),
    });
    const room1Id = '$room1:server.org';
    const room2Id = '$room2:server.org';

    // beacon_info events
    // created 'an hour ago'
    // with timeout of 3 hours

    // event creation sets timestamp to Date.now()
    jest.spyOn(global.Date, 'now').mockReturnValue(now - HOUR_MS);
    const alicesRoom1BeaconInfo = makeBeaconInfoEvent(aliceId,
        room1Id,
        { isLive: true },
        '$alice-room1-1'
        , '$alice-room1-1',
    );
    const alicesRoom2BeaconInfo = makeBeaconInfoEvent(aliceId,
        room2Id,
        { isLive: true },
        '$alice-room2-1'
        , '$alice-room2-1',
    );
    const alicesOldRoomIdBeaconInfo = makeBeaconInfoEvent(aliceId,
        room1Id,
        { isLive: false },
        '$alice-room1-2'
        , '$alice-room1-2',
    );
    const bobsRoom1BeaconInfo = makeBeaconInfoEvent(bobId,
        room1Id,
        { isLive: true },
        '$bob-room1-1'
        , '$bob-room1-1',
    );
    const bobsOldRoom1BeaconInfo = makeBeaconInfoEvent(bobId,
        room1Id,
        { isLive: false },
        '$bob-room1-2'
        , '$bob-room1-2',
    );

    // make fresh rooms every time
    // as we update room state
    const makeRoomsWithStateEvents = (stateEvents = []): [Room, Room] => {
        const room1 = new Room(room1Id, mockClient, aliceId);
        const room2 = new Room(room2Id, mockClient, aliceId);

        room1.currentState.setStateEvents(stateEvents);
        room2.currentState.setStateEvents(stateEvents);
        mockClient.getVisibleRooms.mockReturnValue([room1, room2]);

        return [room1, room2];
    };

    const advanceDateAndTime = (ms: number) => {
        // bc liveness check uses Date.now we have to advance this mock
        jest.spyOn(global.Date, 'now').mockReturnValue(now + ms);
        // then advance time for the interval by the same amount
        jest.advanceTimersByTime(ms);
    };

    const makeOwnBeaconStore = async () => {
        const store = OwnBeaconStore.instance;

        await setupAsyncStoreWithClient(store, mockClient);
        return store;
    };

    beforeEach(() => {
        mockClient.getVisibleRooms.mockReturnValue([]);
        mockClient.unstable_setLiveBeacon.mockClear().mockResolvedValue({ event_id: '1' });
        jest.spyOn(global.Date, 'now').mockReturnValue(now);
        jest.spyOn(OwnBeaconStore.instance, 'emit').mockRestore();
    });

    afterEach(async () => {
        await resetAsyncStoreWithClient(OwnBeaconStore.instance);
    });

    it('works', async () => {
        const store = await makeOwnBeaconStore();
        expect(store.hasLiveBeacons()).toBe(false);
    });

    describe('onReady()', () => {
        it('initialises correctly with no beacons', async () => {
            makeRoomsWithStateEvents();
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it('does not add other users beacons to beacon state', async () => {
            makeRoomsWithStateEvents([bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it('adds own users beacons to state', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.getLiveBeaconIds()).toEqual([
                alicesRoom1BeaconInfo.getType(),
                alicesRoom2BeaconInfo.getType(),
            ]);
        });
    });

    describe('onNotReady()', () => {
        it('removes listeners', async () => {
            const store = await makeOwnBeaconStore();
            const removeSpy = jest.spyOn(mockClient, 'removeListener');
            // @ts-ignore
            store.onNotReady();

            expect(removeSpy.mock.calls[0]).toEqual(expect.arrayContaining([BeaconEvent.LivenessChange]));
            expect(removeSpy.mock.calls[1]).toEqual(expect.arrayContaining([BeaconEvent.New]));
        });

        it('destroys beacons', async () => {
            const [room1] = makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const beacon = room1.currentState.beacons.get(alicesRoom1BeaconInfo.getType());
            const destroySpy = jest.spyOn(beacon, 'destroy');
            // @ts-ignore
            store.onNotReady();

            expect(destroySpy).toHaveBeenCalled();
        });
    });

    describe('hasLiveBeacons()', () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
        });

        it('returns true when user has live beacons', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(true);
        });

        it('returns false when user does not have live beacons', async () => {
            makeRoomsWithStateEvents([
                alicesOldRoomIdBeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
        });

        it('returns true when user has live beacons for roomId', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
        });

        it('returns false when user does not have live beacons for roomId', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons(room2Id)).toBe(false);
        });
    });

    describe('getLiveBeaconIds()', () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
        });

        it('returns live beacons when user has live beacons', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds()).toEqual([
                alicesRoom1BeaconInfo.getType(),
            ]);
        });

        it('returns empty array when user does not have live beacons', async () => {
            makeRoomsWithStateEvents([
                alicesOldRoomIdBeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it('returns beacon ids for room when user has live beacons for roomId', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds(room1Id)).toEqual([
                alicesRoom1BeaconInfo.getType(),
            ]);
            expect(store.getLiveBeaconIds(room2Id)).toEqual([
                alicesRoom2BeaconInfo.getType(),
            ]);
        });

        it('returns empty array when user does not have live beacons for roomId', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds(room2Id)).toEqual([]);
        });
    });

    describe('on new beacon event', () => {
        it('ignores events for irrelevant beacons', async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const bobsLiveBeacon = new Beacon(bobsRoom1BeaconInfo);
            const monitorSpy = jest.spyOn(bobsLiveBeacon, 'monitorLiveness');

            mockClient.emit(BeaconEvent.New, bobsRoom1BeaconInfo, bobsLiveBeacon);

            // we dont care about bob
            expect(monitorSpy).not.toHaveBeenCalled();
            expect(store.hasLiveBeacons()).toBe(false);
        });

        it('adds users beacons to state and monitors liveness', async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);
            const monitorSpy = jest.spyOn(alicesLiveBeacon, 'monitorLiveness');

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(monitorSpy).toHaveBeenCalled();
            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
        });

        it('emits a liveness change event when new beacons change live state', async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, 'emit');
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, [alicesRoom1BeaconInfo.getType()]);
        });

        it('emits a liveness change event when new beacons do not change live state', async () => {
            makeRoomsWithStateEvents([
                alicesRoom2BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            // already live
            expect(store.hasLiveBeacons()).toBe(true);
            const emitSpy = jest.spyOn(store, 'emit');
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(emitSpy).toHaveBeenCalled();
        });
    });

    describe('on liveness change event', () => {
        it('ignores events for irrelevant beacons', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, 'emit');
            const oldLiveBeaconIds = store.getLiveBeaconIds();
            const bobsLiveBeacon = new Beacon(bobsRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.LivenessChange, true, bobsLiveBeacon);

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it('updates state and emits beacon liveness changes from true to false', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();

            // live before
            expect(store.hasLiveBeacons()).toBe(true);
            const emitSpy = jest.spyOn(store, 'emit');
            const alicesBeacon = new Beacon(alicesRoom1BeaconInfo);

            // time travel until beacon is expired
            advanceDateAndTime(HOUR_MS * 3);

            mockClient.emit(BeaconEvent.LivenessChange, false, alicesBeacon);

            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.hasLiveBeacons(room1Id)).toBe(false);
            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, []);
        });

        it('stops beacon when liveness changes from true to false and beacon is expired', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            await makeOwnBeaconStore();
            const alicesBeacon = new Beacon(alicesRoom1BeaconInfo);
            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            // time travel until beacon is expired
            advanceDateAndTime(HOUR_MS * 3);

            mockClient.emit(BeaconEvent.LivenessChange, false, alicesBeacon);

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                [M_BEACON_INFO.name]: {
                    ...prevEventContent[M_BEACON_INFO.name],
                    live: false,
                },
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(
                room1Id,
                alicesRoom1BeaconInfo.getType(),
                expectedUpdateContent,
            );
        });

        it('updates state and when beacon liveness changes from false to true', async () => {
            makeRoomsWithStateEvents([
                alicesOldRoomIdBeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();

            // not live before
            expect(store.hasLiveBeacons()).toBe(false);
            const emitSpy = jest.spyOn(store, 'emit');
            const alicesBeacon = new Beacon(alicesOldRoomIdBeaconInfo);
            const liveUpdate = makeBeaconInfoEvent(
                aliceId, room1Id, { isLive: true }, alicesOldRoomIdBeaconInfo.getId(), '$alice-room1-2',
            );

            // bring the beacon back to life
            alicesBeacon.update(liveUpdate);

            mockClient.emit(BeaconEvent.LivenessChange, true, alicesBeacon);

            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.LivenessChange,
                [alicesOldRoomIdBeaconInfo.getType()],
            );
        });
    });

    describe('stopBeacon()', () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesOldRoomIdBeaconInfo,
            ]);
        });

        it('does nothing for an unknown beacon id', async () => {
            const store = await makeOwnBeaconStore();
            await store.stopBeacon('randomBeaconId');
            expect(mockClient.unstable_setLiveBeacon).not.toHaveBeenCalled();
        });

        it('does nothing for a beacon that is already not live', async () => {
            const store = await makeOwnBeaconStore();
            await store.stopBeacon(alicesOldRoomIdBeaconInfo.getId());
            expect(mockClient.unstable_setLiveBeacon).not.toHaveBeenCalled();
        });

        it('updates beacon to live:false when it is unexpired', async () => {
            const store = await makeOwnBeaconStore();

            await store.stopBeacon(alicesOldRoomIdBeaconInfo.getType());
            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            await store.stopBeacon(alicesRoom1BeaconInfo.getType());

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                [M_BEACON_INFO.name]: {
                    ...prevEventContent[M_BEACON_INFO.name],
                    live: false,
                },
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(
                room1Id,
                alicesRoom1BeaconInfo.getType(),
                expectedUpdateContent,
            );
        });

        it('updates beacon to live:false when it is expired but live property is true', async () => {
            const store = await makeOwnBeaconStore();

            await store.stopBeacon(alicesOldRoomIdBeaconInfo.getType());
            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            // time travel until beacon is expired
            advanceDateAndTime(HOUR_MS * 3);

            await store.stopBeacon(alicesRoom1BeaconInfo.getType());

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                [M_BEACON_INFO.name]: {
                    ...prevEventContent[M_BEACON_INFO.name],
                    live: false,
                },
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(
                room1Id,
                alicesRoom1BeaconInfo.getType(),
                expectedUpdateContent,
            );
        });
    });
});
