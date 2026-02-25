/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    Room,
    Beacon,
    BeaconEvent,
    getBeaconInfoIdentifier,
    type MatrixEvent,
    RoomStateEvent,
    RoomMember,
    ContentHelpers,
    M_BEACON,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";
import { type Mocked } from "jest-mock";

import { OwnBeaconStore, OwnBeaconStoreEvent } from "../../../src/stores/OwnBeaconStore";
import {
    advanceDateAndTime,
    flushPromisesWithFakeTimers,
    makeMembershipEvent,
    resetAsyncStoreWithClient,
    setupAsyncStoreWithClient,
} from "../../test-utils";
import { makeBeaconInfoEvent, mockGeolocation, watchPositionMockImplementation } from "../../test-utils/beacon";
import { getMockClientWithEventEmitter } from "../../test-utils/client";
import SettingsStore from "../../../src/settings/SettingsStore";

// modern fake timers and lodash.debounce are a faff
// short circuit it
jest.mock("lodash", () => ({
    ...(jest.requireActual("lodash") as object),
    debounce: jest.fn().mockImplementation((callback) => callback),
}));

jest.useFakeTimers();

describe("OwnBeaconStore", () => {
    let geolocation: Mocked<Geolocation>;
    // 14.03.2022 16:15
    const now = 1647270879403;
    const HOUR_MS = 3600000;

    const aliceId = "@alice:server.org";
    const bobId = "@bob:server.org";
    const mockClient = getMockClientWithEventEmitter({
        getUserId: jest.fn().mockReturnValue(aliceId),
        getSafeUserId: jest.fn().mockReturnValue(aliceId),
        getVisibleRooms: jest.fn().mockReturnValue([]),
        unstable_setLiveBeacon: jest.fn().mockResolvedValue({ event_id: "1" }),
        sendEvent: jest.fn().mockResolvedValue({ event_id: "1" }),
        unstable_createLiveBeacon: jest.fn().mockResolvedValue({ event_id: "1" }),
        isGuest: jest.fn().mockReturnValue(false),
    });
    const room1Id = "$room1:server.org";
    const room2Id = "$room2:server.org";

    // returned by default geolocation mocks
    const defaultLocationUri = "geo:54.001927,-8.253491;u=1";

    // beacon_info events
    // created 'an hour ago'
    // with timeout of 3 hours

    // event creation sets timestamp to Date.now()
    jest.spyOn(global.Date, "now").mockReturnValue(now - HOUR_MS);
    const alicesRoom1BeaconInfo = makeBeaconInfoEvent(aliceId, room1Id, { isLive: true }, "$alice-room1-1");
    const alicesRoom2BeaconInfo = makeBeaconInfoEvent(aliceId, room2Id, { isLive: true }, "$alice-room2-1");
    const alicesOldRoomIdBeaconInfo = makeBeaconInfoEvent(aliceId, room1Id, { isLive: false }, "$alice-room1-2");
    const bobsRoom1BeaconInfo = makeBeaconInfoEvent(bobId, room1Id, { isLive: true }, "$bob-room1-1");
    const bobsOldRoom1BeaconInfo = makeBeaconInfoEvent(bobId, room1Id, { isLive: false }, "$bob-room1-2");

    // make fresh rooms every time
    // as we update room state
    const makeRoomsWithStateEvents = (stateEvents: MatrixEvent[] = []): [Room, Room] => {
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

    const expireBeaconAndEmit = (store: OwnBeaconStore, beaconInfoEvent: MatrixEvent): void => {
        const beacon = store.getBeaconById(getBeaconInfoIdentifier(beaconInfoEvent))!;
        // time travel until beacon is expired
        advanceDateAndTime(beacon.beaconInfo!.timeout + 100);

        // force an update on the beacon
        // @ts-ignore
        beacon.setBeaconInfo(beaconInfoEvent);

        mockClient.emit(BeaconEvent.LivenessChange, false, beacon);
    };

    const updateBeaconLivenessAndEmit = (
        store: OwnBeaconStore,
        beaconInfoEvent: MatrixEvent,
        isLive: boolean,
    ): void => {
        const beacon = store.getBeaconById(getBeaconInfoIdentifier(beaconInfoEvent))!;
        // matches original state of event content
        // except for live property
        const updateEvent = makeBeaconInfoEvent(
            beaconInfoEvent.getSender()!,
            beaconInfoEvent.getRoomId()!,
            { isLive, timeout: beacon.beaconInfo!.timeout },
            "update-event-id",
        );
        beacon.update(updateEvent);

        mockClient.emit(BeaconEvent.Update, beaconInfoEvent, beacon);
        mockClient.emit(BeaconEvent.LivenessChange, false, beacon);
    };

    const addNewBeaconAndEmit = (beaconInfoEvent: MatrixEvent): void => {
        const beacon = new Beacon(beaconInfoEvent);
        mockClient.emit(BeaconEvent.New, beaconInfoEvent, beacon);
    };

    const localStorageGetSpy = jest.spyOn(localStorage.__proto__, "getItem").mockReturnValue(undefined);
    const localStorageSetSpy = jest.spyOn(localStorage.__proto__, "setItem").mockImplementation(() => {});

    beforeEach(() => {
        geolocation = mockGeolocation();
        mockClient.getVisibleRooms.mockReturnValue([]);
        mockClient.unstable_setLiveBeacon.mockClear().mockResolvedValue({ event_id: "1" });
        mockClient.sendEvent.mockReset().mockResolvedValue({ event_id: "1" });
        jest.spyOn(global.Date, "now").mockReturnValue(now);
        jest.spyOn(OwnBeaconStore.instance, "emit").mockRestore();
        jest.spyOn(logger, "error").mockRestore();

        localStorageGetSpy.mockClear().mockReturnValue(undefined);
        localStorageSetSpy.mockClear();
    });

    afterEach(async () => {
        await resetAsyncStoreWithClient(OwnBeaconStore.instance);

        jest.clearAllTimers();
    });

    afterAll(() => {
        localStorageGetSpy.mockRestore();
    });

    describe("onReady()", () => {
        it("initialises correctly with no beacons", async () => {
            makeRoomsWithStateEvents();
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it("does not add other users beacons to beacon state", async () => {
            makeRoomsWithStateEvents([bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it("adds own users beacons to state", async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.beaconsByRoomId.get(room1Id)).toEqual(
                new Set([getBeaconInfoIdentifier(alicesRoom1BeaconInfo)]),
            );
            expect(store.beaconsByRoomId.get(room2Id)).toEqual(
                new Set([getBeaconInfoIdentifier(alicesRoom2BeaconInfo)]),
            );
        });

        it("updates live beacon ids when users own beacons were created on device", async () => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons(room1Id)).toBeTruthy();
            expect(store.getLiveBeaconIds()).toEqual([
                getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                getBeaconInfoIdentifier(alicesRoom2BeaconInfo),
            ]);
        });

        it("does not do any geolocation when user has no live beacons", async () => {
            makeRoomsWithStateEvents([bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);

            await flushPromisesWithFakeTimers();

            expect(geolocation.watchPosition).not.toHaveBeenCalled();
            expect(mockClient.sendEvent).not.toHaveBeenCalled();
        });

        it("does geolocation and sends location immediately when user has live beacons", async () => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, alicesRoom2BeaconInfo]);
            await makeOwnBeaconStore();
            await flushPromisesWithFakeTimers();

            expect(geolocation.watchPosition).toHaveBeenCalled();
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                room1Id,
                M_BEACON.name,
                ContentHelpers.makeBeaconContent(defaultLocationUri, now, alicesRoom1BeaconInfo.getId()!),
            );
            expect(mockClient.sendEvent).toHaveBeenCalledWith(
                room2Id,
                M_BEACON.name,
                ContentHelpers.makeBeaconContent(defaultLocationUri, now, alicesRoom2BeaconInfo.getId()!),
            );
        });
    });

    describe("onNotReady()", () => {
        it("removes listeners", async () => {
            const store = await makeOwnBeaconStore();
            const removeSpy = jest.spyOn(mockClient, "removeListener");
            // @ts-ignore
            store.onNotReady();

            expect(removeSpy.mock.calls[0]).toEqual(expect.arrayContaining([BeaconEvent.LivenessChange]));
            expect(removeSpy.mock.calls[1]).toEqual(expect.arrayContaining([BeaconEvent.New]));
            expect(removeSpy.mock.calls[2]).toEqual(expect.arrayContaining([BeaconEvent.Update]));
            expect(removeSpy.mock.calls[3]).toEqual(expect.arrayContaining([BeaconEvent.Destroy]));
            expect(removeSpy.mock.calls[4]).toEqual(expect.arrayContaining([RoomStateEvent.Members]));
        });

        it("destroys beacons", async () => {
            const [room1] = makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const beacon = room1.currentState.beacons.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))!;
            const destroySpy = jest.spyOn(beacon, "destroy");
            // @ts-ignore
            store.onNotReady();

            expect(destroySpy).toHaveBeenCalled();
        });
    });

    describe("hasLiveBeacons()", () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
        });

        it("returns true when user has live beacons", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(true);
        });

        it("returns false when user does not have live beacons", async () => {
            makeRoomsWithStateEvents([alicesOldRoomIdBeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons()).toBe(false);
        });

        it("returns true when user has live beacons for roomId", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
        });

        it("returns false when user does not have live beacons for roomId", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.hasLiveBeacons(room2Id)).toBe(false);
        });
    });

    describe("getLiveBeaconIds()", () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
        });

        it("returns live beacons when user has live beacons", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds()).toEqual([getBeaconInfoIdentifier(alicesRoom1BeaconInfo)]);
        });

        it("returns empty array when user does not have live beacons", async () => {
            makeRoomsWithStateEvents([alicesOldRoomIdBeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds()).toEqual([]);
        });

        it("returns beacon ids for room when user has live beacons for roomId", async () => {
            makeRoomsWithStateEvents([
                alicesRoom1BeaconInfo,
                alicesRoom2BeaconInfo,
                bobsRoom1BeaconInfo,
                bobsOldRoom1BeaconInfo,
            ]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds(room1Id)).toEqual([getBeaconInfoIdentifier(alicesRoom1BeaconInfo)]);
            expect(store.getLiveBeaconIds(room2Id)).toEqual([getBeaconInfoIdentifier(alicesRoom2BeaconInfo)]);
        });

        it("returns empty array when user does not have live beacons for roomId", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, bobsRoom1BeaconInfo, bobsOldRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            expect(store.getLiveBeaconIds(room2Id)).toEqual([]);
        });
    });

    describe("on new beacon event", () => {
        // assume all beacons were created on this device
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
        });
        it("ignores events for irrelevant beacons", async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const bobsLiveBeacon = new Beacon(bobsRoom1BeaconInfo);
            const monitorSpy = jest.spyOn(bobsLiveBeacon, "monitorLiveness");

            mockClient.emit(BeaconEvent.New, bobsRoom1BeaconInfo, bobsLiveBeacon);

            // we dont care about bob
            expect(monitorSpy).not.toHaveBeenCalled();
            expect(store.hasLiveBeacons()).toBe(false);
        });

        it("adds users beacons to state and monitors liveness", async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);
            const monitorSpy = jest.spyOn(alicesLiveBeacon, "monitorLiveness");

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(monitorSpy).toHaveBeenCalled();
            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
        });

        it("emits a liveness change event when new beacons change live state", async () => {
            makeRoomsWithStateEvents([]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, [alicesLiveBeacon.identifier]);
        });

        it("emits a liveness change event when new beacons do not change live state", async () => {
            makeRoomsWithStateEvents([alicesRoom2BeaconInfo]);
            const store = await makeOwnBeaconStore();
            // already live
            expect(store.hasLiveBeacons()).toBe(true);
            const emitSpy = jest.spyOn(store, "emit");
            const alicesLiveBeacon = new Beacon(alicesRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.New, alicesRoom1BeaconInfo, alicesLiveBeacon);

            expect(emitSpy).toHaveBeenCalled();
        });
    });

    describe("on liveness change event", () => {
        // assume all beacons were created on this device
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([
                    alicesRoom1BeaconInfo.getId(),
                    alicesRoom2BeaconInfo.getId(),
                    alicesOldRoomIdBeaconInfo.getId(),
                    "update-event-id",
                ]),
            );
        });

        it("ignores events for irrelevant beacons", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const oldLiveBeaconIds = store.getLiveBeaconIds();
            const bobsLiveBeacon = new Beacon(bobsRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.LivenessChange, true, bobsLiveBeacon);

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it("updates state and emits beacon liveness changes from true to false", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();

            // live before
            expect(store.hasLiveBeacons()).toBe(true);
            const emitSpy = jest.spyOn(store, "emit");

            await expireBeaconAndEmit(store, alicesRoom1BeaconInfo);

            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.hasLiveBeacons(room1Id)).toBe(false);
            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, []);
        });

        it("stops beacon when liveness changes from true to false and beacon is expired", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            await expireBeaconAndEmit(store, alicesRoom1BeaconInfo);

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                live: false,
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(room1Id, expectedUpdateContent);
        });

        it("updates state and when beacon liveness changes from false to true", async () => {
            makeRoomsWithStateEvents([alicesOldRoomIdBeaconInfo]);
            const store = await makeOwnBeaconStore();

            // not live before
            expect(store.hasLiveBeacons()).toBe(false);
            const emitSpy = jest.spyOn(store, "emit");

            updateBeaconLivenessAndEmit(store, alicesOldRoomIdBeaconInfo, true);

            expect(store.hasLiveBeacons()).toBe(true);
            expect(store.hasLiveBeacons(room1Id)).toBe(true);
            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, [
                getBeaconInfoIdentifier(alicesOldRoomIdBeaconInfo),
            ]);
        });
    });

    describe("on room membership changes", () => {
        // assume all beacons were created on this device
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
        });
        it("ignores events for rooms without beacons", async () => {
            const membershipEvent = makeMembershipEvent(room2Id, aliceId);
            // no beacons for room2
            const [, room2] = makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
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

        it("ignores events for membership changes that are not current user", async () => {
            // bob joins room1
            const membershipEvent = makeMembershipEvent(room1Id, bobId);
            const member = new RoomMember(room1Id, bobId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const oldLiveBeaconIds = store.getLiveBeaconIds();

            mockClient.emit(RoomStateEvent.Members, membershipEvent, room1.currentState, member);

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it("ignores events for membership changes that are not leave/ban", async () => {
            // alice joins room1
            const membershipEvent = makeMembershipEvent(room1Id, aliceId);
            const member = new RoomMember(room1Id, aliceId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([alicesRoom1BeaconInfo, alicesRoom2BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const oldLiveBeaconIds = store.getLiveBeaconIds();

            mockClient.emit(RoomStateEvent.Members, membershipEvent, room1.currentState, member);

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it("destroys and removes beacons when current user leaves room", async () => {
            // alice leaves room1
            const membershipEvent = makeMembershipEvent(room1Id, aliceId, KnownMembership.Leave);
            const member = new RoomMember(room1Id, aliceId);
            member.setMembershipEvent(membershipEvent);

            const [room1] = makeRoomsWithStateEvents([alicesRoom1BeaconInfo, alicesRoom2BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const room1BeaconInstance = store.beacons.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))!;
            const beaconDestroySpy = jest.spyOn(room1BeaconInstance, "destroy");
            const emitSpy = jest.spyOn(store, "emit");

            mockClient.emit(RoomStateEvent.Members, membershipEvent, room1.currentState, member);

            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.LivenessChange,
                // other rooms beacons still live
                [getBeaconInfoIdentifier(alicesRoom2BeaconInfo)],
            );
            expect(beaconDestroySpy).toHaveBeenCalledTimes(1);
            expect(store.getLiveBeaconIds(room1Id)).toEqual([]);
        });
    });

    describe("on destroy event", () => {
        // assume all beacons were created on this device
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([
                    alicesRoom1BeaconInfo.getId(),
                    alicesRoom2BeaconInfo.getId(),
                    alicesOldRoomIdBeaconInfo.getId(),
                    "update-event-id",
                ]),
            );
        });

        it("ignores events for irrelevant beacons", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const oldLiveBeaconIds = store.getLiveBeaconIds();
            const bobsLiveBeacon = new Beacon(bobsRoom1BeaconInfo);

            mockClient.emit(BeaconEvent.Destroy, bobsLiveBeacon.identifier);

            expect(emitSpy).not.toHaveBeenCalled();
            // strictly equal
            expect(store.getLiveBeaconIds()).toBe(oldLiveBeaconIds);
        });

        it("updates state and emits beacon liveness changes from true to false", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();

            // live before
            expect(store.hasLiveBeacons()).toBe(true);
            const emitSpy = jest.spyOn(store, "emit");

            const beacon = store.getBeaconById(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))!;

            beacon.destroy();
            mockClient.emit(BeaconEvent.Destroy, beacon.identifier);

            expect(store.hasLiveBeacons()).toBe(false);
            expect(store.hasLiveBeacons(room1Id)).toBe(false);
            expect(emitSpy).toHaveBeenCalledWith(OwnBeaconStoreEvent.LivenessChange, []);
        });
    });

    describe("stopBeacon()", () => {
        beforeEach(() => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, alicesOldRoomIdBeaconInfo]);
        });

        it("does nothing for an unknown beacon id", async () => {
            const store = await makeOwnBeaconStore();
            await store.stopBeacon("randomBeaconId");
            expect(mockClient.unstable_setLiveBeacon).not.toHaveBeenCalled();
        });

        it("does nothing for a beacon that is already not live", async () => {
            const store = await makeOwnBeaconStore();
            await store.stopBeacon(getBeaconInfoIdentifier(alicesOldRoomIdBeaconInfo));
            expect(mockClient.unstable_setLiveBeacon).not.toHaveBeenCalled();
        });

        it("updates beacon to live:false when it is unexpired", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();

            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            await store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo));

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                live: false,
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(room1Id, expectedUpdateContent);
        });

        it("records error when stopping beacon event fails to send", async () => {
            jest.spyOn(logger, "error").mockImplementation(() => {});
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const error = new Error("oups");
            mockClient.unstable_setLiveBeacon.mockRejectedValue(error);

            await expect(store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).rejects.toEqual(error);

            expect(store.beaconUpdateErrors.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toEqual(error);
            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.BeaconUpdateError,
                getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                true,
            );
        });

        it("clears previous error and emits when stopping beacon works on retry", async () => {
            jest.spyOn(logger, "error").mockImplementation(() => {});
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            const error = new Error("oups");
            mockClient.unstable_setLiveBeacon.mockRejectedValueOnce(error);

            await expect(store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).rejects.toEqual(error);
            expect(store.beaconUpdateErrors.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toEqual(error);

            await store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo));

            // error cleared
            expect(store.beaconUpdateErrors.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBeFalsy();

            // emit called for error clearing
            expect(emitSpy).toHaveBeenCalledWith(
                OwnBeaconStoreEvent.BeaconUpdateError,
                getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                false,
            );
        });

        it("does not emit BeaconUpdateError when stopping succeeds and beacon did not have errors", async () => {
            jest.spyOn(logger, "error").mockImplementation(() => {});
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();
            const emitSpy = jest.spyOn(store, "emit");
            // error cleared
            expect(store.beaconUpdateErrors.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBeFalsy();

            // emit called for error clearing
            expect(emitSpy).not.toHaveBeenCalledWith(
                OwnBeaconStoreEvent.BeaconUpdateError,
                getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                false,
            );
        });

        it("updates beacon to live:false when it is expired but live property is true", async () => {
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();

            const prevEventContent = alicesRoom1BeaconInfo.getContent();

            // time travel until beacon is expired
            advanceDateAndTime(HOUR_MS * 3);

            await store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo));

            // matches original state of event content
            // except for live property
            const expectedUpdateContent = {
                ...prevEventContent,
                live: false,
            };
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(room1Id, expectedUpdateContent);
        });

        it("removes beacon event id from local store", async () => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([alicesRoom1BeaconInfo.getId(), alicesRoom2BeaconInfo.getId()]),
            );
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            const store = await makeOwnBeaconStore();

            await store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo));

            expect(localStorageSetSpy).toHaveBeenCalledWith(
                "mx_live_beacon_created_id",
                // stopped beacon's event_id was removed
                JSON.stringify([alicesRoom2BeaconInfo.getId()]),
            );
        });
    });

    describe("publishing positions", () => {
        // assume all beacons were created on this device
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(
                JSON.stringify([
                    alicesRoom1BeaconInfo.getId(),
                    alicesRoom2BeaconInfo.getId(),
                    alicesOldRoomIdBeaconInfo.getId(),
                    "update-event-id",
                ]),
            );
        });

        it("stops watching position when user has no more live beacons", async () => {
            // geolocation is only going to emit 1 position
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0]));
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
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

        describe("when store is initialised with live beacons", () => {
            it("starts watching position", async () => {
                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(geolocation.watchPosition).toHaveBeenCalled();
                expect(store.isMonitoringLiveLocation).toEqual(true);
            });

            it("kills live beacon when geolocation is unavailable", async () => {
                const errorLogSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
                // remove the mock we set
                // @ts-ignore
                navigator.geolocation = undefined;

                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(store.isMonitoringLiveLocation).toEqual(false);
                expect(errorLogSpy).toHaveBeenCalledWith("Geolocation failed", "Unavailable");
            });

            it("kills live beacon when geolocation permissions are not granted", async () => {
                // similar case to the test above
                // but these errors are handled differently
                // above is thrown by element, this passed to error callback by geolocation
                // return only a permission denied error
                geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0], [1]));

                const errorLogSpy = jest.spyOn(logger, "error").mockImplementation(() => {});

                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                expect(store.isMonitoringLiveLocation).toEqual(false);
                expect(errorLogSpy).toHaveBeenCalledWith("Geolocation failed", "PermissionDenied");
            });
        });

        describe("adding a new beacon", () => {
            it("publishes position for new beacon immediately", async () => {
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

            it("kills live beacons when geolocation is unavailable", async () => {
                jest.spyOn(logger, "error").mockImplementation(() => {});
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

            it("publishes position for new beacon immediately when there were already live beacons", async () => {
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

        describe("when publishing position fails", () => {
            beforeEach(() => {
                geolocation.watchPosition.mockImplementation(
                    watchPositionMockImplementation([0, 1000, 3000, 3000, 3000]),
                );

                // eat expected console error logs
                jest.spyOn(logger, "error").mockImplementation(() => {});
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

            it("continues publishing positions after one publish error", async () => {
                // fail to send first event, then succeed
                mockClient.sendEvent.mockRejectedValueOnce(new Error("oups")).mockResolvedValue({ event_id: "1" });
                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                await advanceAndFlushPromises(50000);

                // called for each position from watchPosition
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(5);
                expect(store.beaconHasLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBe(false);
                expect(store.getLiveBeaconIdsWithLocationPublishError()).toEqual([]);
                expect(store.hasLocationPublishErrors()).toBe(false);
            });

            it("continues publishing positions when a beacon fails intermittently", async () => {
                // every second event rejects
                // meaning this beacon has more errors than the threshold
                // but they are not consecutive
                mockClient.sendEvent
                    .mockRejectedValueOnce(new Error("oups"))
                    .mockResolvedValueOnce({ event_id: "1" })
                    .mockRejectedValueOnce(new Error("oups"))
                    .mockResolvedValueOnce({ event_id: "1" })
                    .mockRejectedValueOnce(new Error("oups"));

                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, "emit");
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                await advanceAndFlushPromises(50000);

                // called for each position from watchPosition
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(5);
                expect(store.beaconHasLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBe(false);
                expect(store.hasLocationPublishErrors()).toBe(false);
                expect(emitSpy).not.toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.LocationPublishError,
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                );
            });

            it("stops publishing positions when a beacon fails consistently", async () => {
                // always fails to send events
                mockClient.sendEvent.mockRejectedValue(new Error("oups"));
                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, "emit");
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // 5 positions from watchPosition in this period
                await advanceAndFlushPromises(50000);

                // only two allowed failures
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);
                expect(store.beaconHasLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBe(true);
                expect(store.getLiveBeaconIdsWithLocationPublishError()).toEqual([
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                ]);
                expect(store.getLiveBeaconIdsWithLocationPublishError(room1Id)).toEqual([
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                ]);
                expect(store.hasLocationPublishErrors()).toBe(true);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.LocationPublishError,
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                );
            });

            it("stops publishing positions when a beacon has a stopping error", async () => {
                // reject stopping beacon
                const error = new Error("oups");
                mockClient.unstable_setLiveBeacon.mockRejectedValue(error);
                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // 2 positions from watchPosition in this period
                await advanceAndFlushPromises(5000);

                // attempt to stop the beacon
                await expect(store.stopBeacon(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).rejects.toEqual(error);
                expect(store.beaconUpdateErrors.get(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toEqual(error);

                // 2 more positions in this period
                await advanceAndFlushPromises(50000);

                // only two positions pre-stopping were sent
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
            });

            it("restarts publishing a beacon after resetting location publish error", async () => {
                // always fails to send events
                mockClient.sendEvent.mockRejectedValue(new Error("oups"));
                makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
                const store = await makeOwnBeaconStore();
                const emitSpy = jest.spyOn(store, "emit");
                // wait for store to settle
                await flushPromisesWithFakeTimers();

                // 3 positions from watchPosition in this period
                await advanceAndFlushPromises(4000);

                // only two allowed failures
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(2);
                expect(store.beaconHasLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBe(true);
                expect(store.hasLocationPublishErrors()).toBe(true);
                expect(store.hasLocationPublishErrors(room1Id)).toBe(true);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.LocationPublishError,
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                );

                // reset emitSpy mock counts to assert on locationPublishError again
                emitSpy.mockClear();
                store.resetLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo));

                expect(store.beaconHasLocationPublishError(getBeaconInfoIdentifier(alicesRoom1BeaconInfo))).toBe(false);

                // 2 more positions from watchPosition in this period
                await advanceAndFlushPromises(10000);

                // 2 from before, 2 new ones
                expect(mockClient.sendEvent).toHaveBeenCalledTimes(4);
                expect(emitSpy).toHaveBeenCalledWith(
                    OwnBeaconStoreEvent.LocationPublishError,
                    getBeaconInfoIdentifier(alicesRoom1BeaconInfo),
                );
            });
        });

        it("publishes subsequent positions", async () => {
            // modern fake timers + debounce + promises are not friends
            // just testing that positions are published
            // not that the debounce works

            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0, 1000, 3000]));

            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            expect(mockClient.sendEvent).toHaveBeenCalledTimes(0);
            await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            jest.advanceTimersByTime(5000);

            expect(mockClient.sendEvent).toHaveBeenCalledTimes(3);
        });

        it("stops live beacons when geolocation permissions are revoked", async () => {
            jest.spyOn(logger, "error").mockImplementation(() => {});
            // return two good positions, then a permission denied error
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0, 1000, 3000], [0, 0, 1]));

            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
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

        it("keeps sharing positions when geolocation has a non fatal error", async () => {
            const errorLogSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
            // return good position, timeout error, good position
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0, 1000, 3000], [0, 3, 0]));

            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
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
            expect(errorLogSpy).toHaveBeenCalledWith(
                "Geolocation failed",
                expect.objectContaining({ message: "error message" }),
            );
        });

        it("publishes last known position after 30s of inactivity", async () => {
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([0]));

            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
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

        it("does not try to publish anything if there is no known position after 30s of inactivity", async () => {
            // no position ever returned from geolocation
            geolocation.watchPosition.mockImplementation(watchPositionMockImplementation([]));
            geolocation.getCurrentPosition.mockImplementation(watchPositionMockImplementation([]));

            makeRoomsWithStateEvents([alicesRoom1BeaconInfo]);
            await makeOwnBeaconStore();
            // wait for store to settle
            await flushPromisesWithFakeTimers();

            advanceDateAndTime(31000);

            // no locations published
            expect(mockClient.sendEvent).not.toHaveBeenCalled();
        });
    });

    describe("createLiveBeacon", () => {
        const newEventId = "new-beacon-event-id";
        const loggerErrorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
        beforeEach(() => {
            localStorageGetSpy.mockReturnValue(JSON.stringify([alicesRoom1BeaconInfo.getId()]));

            localStorageSetSpy.mockClear();

            mockClient.unstable_createLiveBeacon.mockResolvedValue({ event_id: newEventId });
        });

        it("creates a live beacon", async () => {
            const store = await makeOwnBeaconStore();
            const content = ContentHelpers.makeBeaconInfoContent(100);
            await store.createLiveBeacon(room1Id, content);
            expect(mockClient.unstable_createLiveBeacon).toHaveBeenCalledWith(room1Id, content);
        });

        it("sets new beacon event id in local storage", async () => {
            const store = await makeOwnBeaconStore();
            const content = ContentHelpers.makeBeaconInfoContent(100);
            await store.createLiveBeacon(room1Id, content);

            expect(localStorageSetSpy).toHaveBeenCalledWith(
                "mx_live_beacon_created_id",
                JSON.stringify([alicesRoom1BeaconInfo.getId(), newEventId]),
            );
        });

        it("handles saving beacon event id when local storage has bad value", async () => {
            localStorageGetSpy.mockReturnValue(JSON.stringify({ id: "1" }));
            const store = await makeOwnBeaconStore();
            const content = ContentHelpers.makeBeaconInfoContent(100);
            await store.createLiveBeacon(room1Id, content);

            // stored successfully
            expect(localStorageSetSpy).toHaveBeenCalledWith("mx_live_beacon_created_id", JSON.stringify([newEventId]));
        });

        it("creates a live beacon without error when no beacons exist for room", async () => {
            const store = await makeOwnBeaconStore();
            const content = ContentHelpers.makeBeaconInfoContent(100);
            await store.createLiveBeacon(room1Id, content);

            // didn't throw, no error log
            expect(loggerErrorSpy).not.toHaveBeenCalled();
        });

        it("stops existing live beacon for room before creates new beacon", async () => {
            // room1 already has a live beacon for alice
            makeRoomsWithStateEvents([alicesRoom1BeaconInfo, alicesRoom2BeaconInfo]);
            const store = await makeOwnBeaconStore();

            const content = ContentHelpers.makeBeaconInfoContent(100);
            await store.createLiveBeacon(room1Id, content);

            // stop alicesRoom1BeaconInfo
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledWith(
                room1Id,
                expect.objectContaining({ live: false }),
            );
            // only called for beacons in room1, room2 beacon is not stopped
            expect(mockClient.unstable_setLiveBeacon).toHaveBeenCalledTimes(1);

            // new beacon created
            expect(mockClient.unstable_createLiveBeacon).toHaveBeenCalledWith(room1Id, content);
        });
    });

    describe("If the feature_dynamic_room_predecessors is not enabled", () => {
        beforeEach(() => {
            jest.spyOn(SettingsStore, "getValue").mockReturnValue(false);
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockReset();
            mockClient.getVisibleRooms.mockReturnValue([]);
            await makeOwnBeaconStore();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(false);
        });
    });

    describe("If the feature_dynamic_room_predecessors is enabled", () => {
        beforeEach(() => {
            // Turn on feature_dynamic_room_predecessors setting
            jest.spyOn(SettingsStore, "getValue").mockImplementation(
                (settingName) => settingName === "feature_dynamic_room_predecessors",
            );
        });

        it("Passes through the dynamic predecessor setting", async () => {
            mockClient.getVisibleRooms.mockReset();
            mockClient.getVisibleRooms.mockReturnValue([]);
            await makeOwnBeaconStore();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });

        it("Passes through the dynamic predecessor when reinitialised", async () => {
            const store = await makeOwnBeaconStore();
            mockClient.getVisibleRooms.mockReset();
            mockClient.getVisibleRooms.mockReturnValue([]);
            store.reinitialiseBeaconState();
            expect(mockClient.getVisibleRooms).toHaveBeenCalledWith(true);
        });
    });
});
