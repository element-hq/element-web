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

import {
    Room,
    Beacon,
    BeaconEvent,
    MatrixEvent,
    RoomStateEvent,
    RoomMember,
} from "matrix-js-sdk/src/matrix";
import { makeBeaconContent } from "matrix-js-sdk/src/content-helpers";
import { M_BEACON, M_BEACON_INFO } from "matrix-js-sdk/src/@types/beacon";
import { logger } from "matrix-js-sdk/src/logger";

import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../src/stores/OwnBeaconStore";
import {
    advanceDateAndTime,
    flushPromisesWithFakeTimers,
    makeMembershipEvent,
    resetAsyncStoreWithClient,
    setupAsyncStoreWithClient,
} from "../test-utils";
import {
    makeBeaconInfoEvent,
    makeGeolocationPosition,
    mockGeolocation,
    watchPositionMockImplementation,
} from "../test-utils/beacon";
import { getMockClientWithEventEmitter } from "../test-utils/client";

// modern fake timers and lodash.debounce are a faff
// short circuit it
jest.mock("lodash", () => ({
    debounce: jest.fn().mockImplementation(callback => callback),
}));

jest.useFakeTimers();

describe('OwnBeaconStore', () => {
    let geolocation;
    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;

    const aliceId = '@alice:server.org';
    const bobId = '@bob:server.org';
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        unstable_setLiveBeacon: jest.fn().mockResolvedValue({ event_id: '1' }),
        sendEvent: jest.fn().mockResolvedValue({ event_id: '1' }),
    });
    const room1Id = '$room1:server.org';
    const room2Id = '$room2:server.org';

    // returned by default geolocation mocks
    const defaultLocation = makeGeolocationPosition({});
    const defaultLocationUri = 'geo:54.001927,-8.253491;u=1';

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

    const makeOwnBeaconStore = async () => {
        const store = OwnBeaconStore.instance;

        await setupAsyncStoreWithClient(store, mockClient);
        return store;
    };

    const expireBeaconAndEmit = (store, beaconInfoEvent: MatrixEvent): void => {
        const beacon = store.getBeaconById(beaconInfoEvent.getType());
        // time travel until beacon is expired
        advanceDateAndTime(beacon.beaconInfo.timeout + 100);

        // force an update on the beacon
        // @ts-ignore
        beacon.setBeaconInfo(beaconInfoEvent);

        mockClient.emit(BeaconEvent.LivenessChange, false, beacon);
    };

    const updateBeaconLivenessAndEmit = (store, beaconInfoEvent: MatrixEvent, isLive: boolean): void => {
        const beacon = store.getBeaconById(beaconInfoEvent.getType());
        // matches original state of event content
        // except for live property
        const updateEvent = makeBeaconInfoEvent(
            beaconInfoEvent.getSender(),
            beaconInfoEvent.getRoomId(),
            { isLive, timeout: beacon.beaconInfo.timeout },
            undefined,
        );
        updateEvent.event.type = beaconInfoEvent.getType();
        beacon.update(updateEvent);

        mockClient.emit(BeaconEvent.Update, beaconInfoEvent, beacon);
        mockClient.emit(BeaconEvent.LivenessChange, false, beacon);
    };

    const addNewBeaconAndEmit = (beaconInfoEvent: MatrixEvent): void => {
        const beacon = new Beacon(beaconInfoEvent);
        mockClient.emit(BeaconEvent.New, beaconInfoEvent, beacon);
    };

    beforeEach(() => {
        geolocation = mockGeolocation();
        mockClient.getVisibleRooms.mockReturnValue([]);
        mockClient.unstable_setLiveBeacon.mockClear().mockResolvedValue({ event_id: '1' });
        mockClient.sendEvent.mockReset().mockResolvedValue({ event_id: '1' });
        jest.spyOn(global.Date, 'now').mockReturnValue(now);
        jest.spyOn(OwnBeaconStore.instance, 'emit').mockRestore();
        jest.spyOn(logger, 'error').mockRestore();
    });

    afterEach(async () => {
        await resetAsyncStoreWithClient(OwnBeaconStore.instance);

        jest.clearAllTimers();
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

        it('does not do any geolocation when user has no live beacons', async () => {
            makeRoomsWithStateEvents([bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);

            await flushPromisesWithFakeTimers();

            expect(geolocation.watchPosition).not.toHaveBeenCalled();
            expect(mockClient.sendEvent).not.toHaveBeenCalled();
        });

        it('does geolocation and sends location immediatley when user has live beacons', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
            ]);
            await makeOwnBeaconStore();
            await flushPromisesWithFakeTimers();

            expect(geolocation.watchPosition).toHaveBeenCalled();
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                room1Id,
                M_BEACON.name,
                makeBeaconContent(defaultLocationUri, defaultLocation.timestamp, alicesRoom1BeaconInfo.getId()),
            );
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                room2Id,
                M_BEACON.name,
                makeBeaconContent(defaultLocationUri, defaultLocation.timestamp, alicesRoom2BeaconInfo.getId()),
            );
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
            expect(removeSpy.mock.calls[2]).toEqual(expect.arrayContaining([RoomStateEvent.Members]));
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

            await expireBeaconAndEmit(store, alicesRoom1BeaconInfo);

            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.hasLiveBeacons(room1Id)).toBe(false);
            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, []);
        });

        it('stops beacon when liveness changes from true to false and beacon is expired', async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            await expireBeaconAndEmit(store, alicesRoom1BeaconInfo);

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

            updateBeaconLivenessAndEmit(store, alicesOldRoomIdBeaconInfo, true);

            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.LivenessChange,
                [alicesOldRoomIdBeaconInfo.getType()],
            );
        });
    });

    describe('on room membership changes', () => {
        it('ignores events for rooms without beacons', async () => {
            const membershipEvent = makeMembershipEvent(room2Id, aliceId);
            // no beacons for room2
            const [, room2] = makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, 'emit');
            const oldLiveBeaconIds = store.getLiveBeaconIds();

            mockClient.emit(
                RoomStateEvent.Members,
                membershipEvent,
                room2.currentState,
                new RoomMember(room2Id, aliceId),
            );

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it('ignores events for membership changes that are not current user', async () => {
            // bob joins room1
            const membershipEvent = makeMembershipEvent(room1Id, bobId);
            const member = new RoomMember(room1Id, bobId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, 'emit');
            const oldLiveBeaconIds = store.getLiveBeaconIds();

            mockClient.emit(
                RoomStateEvent.Members,
                membershipEvent,
                room1.currentState,
                member,
            );

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it('ignores events for membership changes that are not leave/ban', async () => {
            // alice joins room1
            const membershipEvent = makeMembershipEvent(room1Id, aliceId);
            const member = new RoomMember(room1Id, aliceId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, 'emit');
            const oldLiveBeaconIds = store.getLiveBeaconIds();

            mockClient.emit(
                RoomStateEvent.Members,
                membershipEvent,
                room1.currentState,
                member,
            );

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it('destroys and removes beacons when current user leaves room', async () => {
            // alice leaves room1
            const membershipEvent = makeMembershipEvent(room1Id, aliceId, 'leave');
            const member = new RoomMember(room1Id, aliceId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            const room1BeaconInstance = store.beacons.get(alicesRoom1BeaconInfo.getType());
            const beaconDestroySpy = jest.spyOn(room1BeaconInstance, 'destroy');
            const emitSpy = jest.spyOn(store, 'emit');

            mockClient.emit(
                RoomStateEvent.Members,
                membershipEvent,
                room1.currentState,
                member,
            );

            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.LivenessChange,
                // other rooms beacons still live
                [alicesRoom2BeaconInfo.getType()],
            );
            expect(beaconDestroySpy).toHaveBeenCalledTimes(1);
            expect(store.getLiveBeaconIds(room1Id)).toEqual([]);
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

    describe('publishing positions', () => {
        it('stops watching position when user has no more live beacons', async () => {
            // geolocation is only going to emit 1 position
            geolocation.watchPosition.mockImplementation(
                watchPositionMockImplementation([0]),
            );
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();
            // two locations were published
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(1);

            // expire the beacon
            // user now has no live beacons
            await expireBeaconAndEmit(store, alicesRoom1BeaconInfo);

            // stop watching location
            expect(geolocation.clearWatch).toHaveBeenCalled();
            expect(store.isMonitoringLiveLocation).toEqual(false);
        });

        describe('when store is initialised with live beacons', () => {
            it('starts watching position', async () => {
                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(geolocation.watchPosition).toHaveBeenCalled();
                expect(store.isMonitoringLiveLocation).toEqual(true);
            });

            it('kills live beacon when geolocation is unavailable', async () => {
                const errorLogSpy = jest.spyOn(logger, 'error').mockImplementation(() => { });
                // remove the mock we set
                // @ts-ignore
                navigator.geolocation = undefined;

                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(store.isMonitoringLiveLocation).toEqual(false);
                expect(errorLogSpy).toHaveBeenCalledWith('Geolocation failed', "Unavailable");
            });

            it('kills live beacon when geolocation permissions are not granted', async () => {
                // similar case to the test above
                // but these errors are handled differently
                // above is thrown by element, this passed to error callback by geolocation
                // return only a permission denied error
                geolocation.watchPosition.mockImplementation(watchPositionMockImplementation(
                    [0], [1]),
                );

                const errorLogSpy = jest.spyOn(logger, 'error').mockImplementation(() => { });

                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(store.isMonitoringLiveLocation).toEqual(false);
                expect(errorLogSpy).toHaveBeenCalledWith('Geolocation failed', "PermissionDenied");
            });
        });

        describe('adding a new beacon', () => {
            it('publishes position for new beacon immediately', async () => {
                makeRoomsWithStateEvents([]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                addNewBeaconAndEmit(alicesRoom1BeaconInfo);
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(mockClient.sendEvent).toHaveBeenCalled();
                expect(store.isMonitoringLiveLocation).toEqual(true);
            });

            it('kills live beacons when geolocation is unavailable', async () => {
                jest.spyOn(logger, 'error').mockImplementation(() => { });
                // @ts-ignore
                navigator.geolocation = undefined;
                makeRoomsWithStateEvents([]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                addNewBeaconAndEmit(alicesRoom1BeaconInfo);
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // stop beacon
                expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalled();
                expect(store.isMonitoringLiveLocation).toEqual(false);
            });

            it('publishes position for new beacon immediately when there were already live beacons', async () => {
                makeRoomsWithStateEvents([alicesRoom2BeaconInfo]);
                await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(1);

                addNewBeaconAndEmit(alicesRoom1BeaconInfo);
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(geolocation.getCurrentPosition).toHaveBeenCalled();
                // once for original event,
                // then both live beacons get current position published
                // after new beacon is added
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
            });
        });

        describe('when publishing position fails', () => {
            beforeEach(() => {
                geolocation.watchPosition.mockImplementation(
                    watchPositionMockImplementation([0, 1000, 3000, 3000, 3000]),
                );

                // eat expected console error logs
                jest.spyOn(logger, 'error').mockImplementation(() => { });
            });

            // we need to advance time and then flush promises
            // individually for each call to sendEvent
            // otherwise the sendEvent doesn't reject/resolve and update state
            // before the next call
            // advance and flush every 1000ms
            // until given ms is 'elapsed'
            const advanceAndFlushPromises = async (timeMs: number) => {
                while (timeMs > 0) {
                    jest.advanceTimersByTime(1000);
                    await flushPromisesWithFakeTimers();
                    timeMs -= 1000;
                }
            };

            it('continues publishing positions after one publish error', async () => {
                // fail to send first event, then succeed
                mockClient.sendEvent.mockRejectedValueOnce(new Error('oups')).mockResolvedValue({ event_id: '1' });
                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                await advanceAndFlushPromises(50000);

                // called for each position from watchPosition
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(5);
                expect(store.beaconHasWireError(alicesRoom1BeaconInfo.getType())).toBe(false);
                expect(store.hasWireErrors()).toBe(false);
            });

            it('continues publishing positions when a beacon fails intermittently', async () => {
                // every second event rejects
                // meaning this beacon has more errors than the threshold
                // but they are not consecutive
                mockClient.sendEvent
                    .mockRejectedValueOnce(new Error('oups'))
                    .mockResolvedValueOnce({ event_id: '1' })
                    .mockRejectedValueOnce(new Error('oups'))
                    .mockResolvedValueOnce({ event_id: '1' })
                    .mockRejectedValueOnce(new Error('oups'));

                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, 'emit');
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                await advanceAndFlushPromises(50000);

                // called for each position from watchPosition
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(5);
                expect(store.beaconHasWireError(alicesRoom1BeaconInfo.getType())).toBe(false);
                expect(store.hasWireErrors()).toBe(false);
                expect(emitSpy).not.toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.WireError, alicesRoom1BeaconInfo.getType(),
                );
            });

            it('stops publishing positions when a beacon fails consistently', async () => {
                // always fails to send events
                mockClient.sendEvent.mockRejectedValue(new Error('oups'));
                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, 'emit');
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // 5 positions from watchPosition in this period
                await advanceAndFlushPromises(50000);

                // only two allowed failures
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);
                expect(store.beaconHasWireError(alicesRoom1BeaconInfo.getType())).toBe(true);
                expect(store.hasWireErrors()).toBe(true);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.WireError, alicesRoom1BeaconInfo.getType(),
                );
            });

            it('restarts publishing a beacon after resetting wire error', async () => {
                // always fails to send events
                mockClient.sendEvent.mockRejectedValue(new Error('oups'));
                makeRoomsWithStateEvents([
                    alicesRoom1BeaconInfo,
                ]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, 'emit');
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // 3 positions from watchPosition in this period
                await advanceAndFlushPromises(4000);

                // only two allowed failures
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);
                expect(store.beaconHasWireError(alicesRoom1BeaconInfo.getType())).toBe(true);
                expect(store.hasWireErrors()).toBe(true);
                expect(store.hasWireErrors(room1Id)).toBe(true);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.WireError, alicesRoom1BeaconInfo.getType(),
                );

                // reset emitSpy mock counts to asser on wireError again
                emitSpy.mockClear();
                store.resetWireError(alicesRoom1BeaconInfo.getType());

                expect(store.beaconHasWireError(alicesRoom1BeaconInfo.getType())).toBe(false);

                // 2 more positions from watchPosition in this period
                await advanceAndFlushPromises(10000);

                // 2 from before, 2 new ones
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(4);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.WireError, alicesRoom1BeaconInfo.getType(),
                );
            });
        });

        it('publishes subsequent positions', async () => {
            // modern fake timers + debounce + promises are not friends
            // just testing that positions are published
            // not that the debounce works

            geolocation.watchPosition.mockImplementation(
                watchPositionMockImplementation([0, 1000, 3000]),
            );

            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(0);
            await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            jest.advanceTimersByTime(5000);

            expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
        });

        it('stops live beacons when geolocation permissions are revoked', async () => {
            jest.spyOn(logger, 'error').mockImplementation(() => { });
            // return two good positions, then a permission denied error
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation(
                [0, 1000, 3000], [0, 0, 1]),
            );

            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(0);
            const store = await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            jest.advanceTimersByTime(5000);

            // first two events were sent successfully
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);

            // stop beacon
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalled();
            expect(store.isMonitoringLiveLocation).toEqual(false);
        });

        it('keeps sharing positions when geolocation has a non fatal error', async () => {
            const errorLogSpy = jest.spyOn(logger, 'error').mockImplementation(() => { });
            // return good position, timeout error, good position
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation(
                [0, 1000, 3000], [0, 3, 0]),
            );

            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(0);
            const store = await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            jest.advanceTimersByTime(5000);

            // two good locations were sent
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);

            // still sharing
            expect(mockClient.unstable_setLiveBeacon).not.toHaveBeenCalled();
            expect(store.isMonitoringLiveLocation).toEqual(true);
            expect(errorLogSpy).toHaveBeenCalledWith('Geolocation failed', 'error message');
        });

        it('publishes last known position after 30s of inactivity', async () => {
            geolocation.watchPosition.mockImplementation(
                watchPositionMockImplementation([0]),
            );

            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();
            // published first location
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(1);

            advanceDateAndTime(31000);
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            // republished latest location
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);
        });

        it('does not try to publish anything if there is no known position after 30s of inactivity', async () => {
            // no position ever returned from geolocation
            geolocation.watchPosition.mockImplementation(
                watchPositionMockImplementation([]),
            );
            geolocation.getCurrentPosition.mockImplementation(
                watchPositionMockImplementation([]),
            );

            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
            ]);
            await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            advanceDateAndTime(31000);

            // no locations published
            expect(mockClient.sendEvent).not.toHaveBeenCalled();
        });
    });
});
