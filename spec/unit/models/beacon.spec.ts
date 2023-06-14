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

import { REFERENCE_RELATION } from "../../../src/@types/extensible_events";
import { MatrixEvent } from "../../../src";
import { M_BEACON_INFO } from "../../../src/@types/beacon";
import { isTimestampInDuration, Beacon, BeaconEvent } from "../../../src/models/beacon";
import { makeBeaconEvent, makeBeaconInfoEvent } from "../../test-utils/beacon";

jest.useFakeTimers();

describe("Beacon", () => {
    describe("isTimestampInDuration()", () => {
        const startTs = new Date("2022-03-11T12:07:47.592Z").getTime();
        const HOUR_MS = 3600000;
        it("returns false when timestamp is before start time", () => {
            // day before
            const timestamp = new Date("2022-03-10T12:07:47.592Z").getTime();
            expect(isTimestampInDuration(startTs, HOUR_MS, timestamp)).toBe(false);
        });

        it("returns false when timestamp is after start time + duration", () => {
            // 1 second later
            const timestamp = new Date("2022-03-10T12:07:48.592Z").getTime();
            expect(isTimestampInDuration(startTs, HOUR_MS, timestamp)).toBe(false);
        });

        it("returns true when timestamp is exactly start time", () => {
            expect(isTimestampInDuration(startTs, HOUR_MS, startTs)).toBe(true);
        });

        it("returns true when timestamp is exactly the end of the duration", () => {
            expect(isTimestampInDuration(startTs, HOUR_MS, startTs + HOUR_MS)).toBe(true);
        });

        it("returns true when timestamp is within the duration", () => {
            const twoHourDuration = HOUR_MS * 2;
            const now = startTs + HOUR_MS;
            expect(isTimestampInDuration(startTs, twoHourDuration, now)).toBe(true);
        });
    });

    describe("Beacon", () => {
        const userId = "@user:server.org";
        const userId2 = "@user2:server.org";
        const roomId = "$room:server.org";
        // 14.03.2022 16:15
        const now = 1647270879403;
        const HOUR_MS = 3600000;

        // beacon_info events
        // created 'an hour ago'
        // without timeout of 3 hours
        let liveBeaconEvent: MatrixEvent;
        let notLiveBeaconEvent: MatrixEvent;
        let user2BeaconEvent: MatrixEvent;

        const advanceDateAndTime = (ms: number) => {
            // bc liveness check uses Date.now we have to advance this mock
            jest.spyOn(global.Date, "now").mockReturnValue(Date.now() + ms);
            // then advance time for the interval by the same amount
            jest.advanceTimersByTime(ms);
        };

        beforeEach(() => {
            liveBeaconEvent = makeBeaconInfoEvent(
                userId,
                roomId,
                {
                    timeout: HOUR_MS * 3,
                    isLive: true,
                    timestamp: now - HOUR_MS,
                },
                "$live123",
            );
            notLiveBeaconEvent = makeBeaconInfoEvent(
                userId,
                roomId,
                {
                    timeout: HOUR_MS * 3,
                    isLive: false,
                    timestamp: now - HOUR_MS,
                },
                "$dead123",
            );
            user2BeaconEvent = makeBeaconInfoEvent(
                userId2,
                roomId,
                {
                    timeout: HOUR_MS * 3,
                    isLive: true,
                    timestamp: now - HOUR_MS,
                },
                "$user2live123",
            );

            // back to 'now'
            jest.spyOn(global.Date, "now").mockReturnValue(now);
        });

        afterAll(() => {
            jest.spyOn(global.Date, "now").mockRestore();
        });

        it("creates beacon from event", () => {
            const beacon = new Beacon(liveBeaconEvent);

            expect(beacon.beaconInfoId).toEqual(liveBeaconEvent.getId());
            expect(beacon.roomId).toEqual(roomId);
            expect(beacon.isLive).toEqual(true);
            expect(beacon.beaconInfoOwner).toEqual(userId);
            expect(beacon.beaconInfoEventType).toEqual(liveBeaconEvent.getType());
            expect(beacon.identifier).toEqual(`${roomId}_${userId}`);
            expect(beacon.beaconInfo).toBeTruthy();
        });

        it("creates beacon without error from a malformed event", () => {
            const event = new MatrixEvent({
                type: M_BEACON_INFO.name,
                room_id: roomId,
                state_key: userId,
                content: {},
            });
            const beacon = new Beacon(event);

            expect(beacon.beaconInfoId).toEqual(event.getId());
            expect(beacon.roomId).toEqual(roomId);
            expect(beacon.isLive).toEqual(false);
            expect(beacon.beaconInfoOwner).toEqual(userId);
            expect(beacon.beaconInfoEventType).toEqual(liveBeaconEvent.getType());
            expect(beacon.identifier).toEqual(`${roomId}_${userId}`);
            expect(beacon.beaconInfo).toBeTruthy();
        });

        describe("isLive()", () => {
            it("returns false when beacon is explicitly set to not live", () => {
                const beacon = new Beacon(notLiveBeaconEvent);
                expect(beacon.isLive).toEqual(false);
            });

            it("returns false when beacon is expired", () => {
                const expiredBeaconEvent = makeBeaconInfoEvent(
                    userId2,
                    roomId,
                    {
                        timeout: HOUR_MS,
                        isLive: true,
                        timestamp: now - HOUR_MS * 2,
                    },
                    "$user2live123",
                );
                const beacon = new Beacon(expiredBeaconEvent);
                expect(beacon.isLive).toEqual(false);
            });

            it("returns false when beacon timestamp is in future by an hour", () => {
                const beaconStartsInHour = makeBeaconInfoEvent(
                    userId2,
                    roomId,
                    {
                        timeout: HOUR_MS,
                        isLive: true,
                        timestamp: now + HOUR_MS,
                    },
                    "$user2live123",
                );
                const beacon = new Beacon(beaconStartsInHour);
                expect(beacon.isLive).toEqual(false);
            });

            it("returns true when beacon timestamp is one minute in the future", () => {
                const beaconStartsInOneMin = makeBeaconInfoEvent(
                    userId2,
                    roomId,
                    {
                        timeout: HOUR_MS,
                        isLive: true,
                        timestamp: now + 60000,
                    },
                    "$user2live123",
                );
                const beacon = new Beacon(beaconStartsInOneMin);
                expect(beacon.isLive).toEqual(true);
            });

            it("returns true when beacon timestamp is one minute before expiry", () => {
                // this test case is to check the start time leniency doesn't affect
                // strict expiry time checks
                const expiresInOneMin = makeBeaconInfoEvent(
                    userId2,
                    roomId,
                    {
                        timeout: HOUR_MS,
                        isLive: true,
                        timestamp: now - HOUR_MS + 60000,
                    },
                    "$user2live123",
                );
                const beacon = new Beacon(expiresInOneMin);
                expect(beacon.isLive).toEqual(true);
            });

            it("returns false when beacon timestamp is one minute after expiry", () => {
                // this test case is to check the start time leniency doesn't affect
                // strict expiry time checks
                const expiredOneMinAgo = makeBeaconInfoEvent(
                    userId2,
                    roomId,
                    {
                        timeout: HOUR_MS,
                        isLive: true,
                        timestamp: now - HOUR_MS - 60000,
                    },
                    "$user2live123",
                );
                const beacon = new Beacon(expiredOneMinAgo);
                expect(beacon.isLive).toEqual(false);
            });

            it("returns true when beacon was created in past and not yet expired", () => {
                // liveBeaconEvent was created 1 hour ago
                const beacon = new Beacon(liveBeaconEvent);
                expect(beacon.isLive).toEqual(true);
            });
        });

        describe("update()", () => {
            it("does not update with different event", () => {
                const beacon = new Beacon(liveBeaconEvent);

                expect(beacon.beaconInfoId).toEqual(liveBeaconEvent.getId());

                expect(() => beacon.update(user2BeaconEvent)).toThrow();
                // didnt update
                expect(beacon.identifier).toEqual(`${roomId}_${userId}`);
            });

            it("does not update with an older event", () => {
                const beacon = new Beacon(liveBeaconEvent);
                const emitSpy = jest.spyOn(beacon, "emit").mockClear();
                expect(beacon.beaconInfoId).toEqual(liveBeaconEvent.getId());

                const oldUpdateEvent = makeBeaconInfoEvent(userId, roomId);
                // less than the original event
                oldUpdateEvent.event.origin_server_ts = liveBeaconEvent.event.origin_server_ts! - 1000;

                beacon.update(oldUpdateEvent);
                // didnt update
                expect(emitSpy).not.toHaveBeenCalled();
                expect(beacon.beaconInfoId).toEqual(liveBeaconEvent.getId());
            });

            it("updates event", () => {
                const beacon = new Beacon(liveBeaconEvent);
                const emitSpy = jest.spyOn(beacon, "emit");

                expect(beacon.isLive).toEqual(true);

                const updatedBeaconEvent = makeBeaconInfoEvent(
                    userId,
                    roomId,
                    { timeout: HOUR_MS * 3, isLive: false },
                    "$live123",
                );

                beacon.update(updatedBeaconEvent);
                expect(beacon.isLive).toEqual(false);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.Update, updatedBeaconEvent, beacon);
            });

            it("emits livenesschange event when beacon liveness changes", () => {
                const beacon = new Beacon(liveBeaconEvent);
                const emitSpy = jest.spyOn(beacon, "emit");

                expect(beacon.isLive).toEqual(true);

                const updatedBeaconEvent = makeBeaconInfoEvent(
                    userId,
                    roomId,
                    { timeout: HOUR_MS * 3, isLive: false },
                    beacon.beaconInfoId,
                );

                beacon.update(updatedBeaconEvent);
                expect(beacon.isLive).toEqual(false);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.LivenessChange, false, beacon);
            });
        });

        describe("monitorLiveness()", () => {
            it("does not set a monitor interval when beacon is not live", () => {
                // beacon was created an hour ago
                // and has a 3hr duration
                const beacon = new Beacon(notLiveBeaconEvent);
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.monitorLiveness();

                // @ts-ignore
                expect(beacon.livenessWatchTimeout).toBeFalsy();
                advanceDateAndTime(HOUR_MS * 2 + 1);

                // no emit
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("checks liveness of beacon at expected start time", () => {
                const futureBeaconEvent = makeBeaconInfoEvent(
                    userId,
                    roomId,
                    {
                        timeout: HOUR_MS * 3,
                        isLive: true,
                        // start timestamp hour in future
                        timestamp: now + HOUR_MS,
                    },
                    "$live123",
                );

                const beacon = new Beacon(futureBeaconEvent);
                expect(beacon.isLive).toBeFalsy();
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.monitorLiveness();

                // advance to the start timestamp of the beacon
                advanceDateAndTime(HOUR_MS + 1);

                // beacon is in live period now
                expect(emitSpy).toHaveBeenCalledTimes(1);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.LivenessChange, true, beacon);

                // check the expiry monitor is still setup ok
                // advance to the expiry
                advanceDateAndTime(HOUR_MS * 3 + 100);

                expect(emitSpy).toHaveBeenCalledTimes(2);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.LivenessChange, false, beacon);
            });

            it("checks liveness of beacon at expected expiry time", () => {
                // live beacon was created an hour ago
                // and has a 3hr duration
                const beacon = new Beacon(liveBeaconEvent);
                expect(beacon.isLive).toBeTruthy();
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.monitorLiveness();
                advanceDateAndTime(HOUR_MS * 2 + 1);

                expect(emitSpy).toHaveBeenCalledTimes(1);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.LivenessChange, false, beacon);
            });

            it("clears monitor interval when re-monitoring liveness", () => {
                // live beacon was created an hour ago
                // and has a 3hr duration
                const beacon = new Beacon(liveBeaconEvent);
                expect(beacon.isLive).toBeTruthy();

                beacon.monitorLiveness();
                // @ts-ignore
                const oldMonitor = beacon.livenessWatchTimeout;

                beacon.monitorLiveness();

                // @ts-ignore
                expect(beacon.livenessWatchTimeout).not.toEqual(oldMonitor);
            });

            it("destroy kills liveness monitor and emits", () => {
                // live beacon was created an hour ago
                // and has a 3hr duration
                const beacon = new Beacon(liveBeaconEvent);
                expect(beacon.isLive).toBeTruthy();
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.monitorLiveness();

                // destroy the beacon
                beacon.destroy();
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.Destroy, beacon.identifier);
                // live forced to false
                expect(beacon.isLive).toBe(false);

                advanceDateAndTime(HOUR_MS * 2 + 1);

                // no additional calls
                expect(emitSpy).toHaveBeenCalledTimes(1);
            });
        });

        describe("addLocations", () => {
            it("ignores locations when beacon is not live", () => {
                const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: false }));
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.addLocations([
                    makeBeaconEvent(userId, { beaconInfoId: beacon.beaconInfoId, timestamp: now + 1 }),
                ]);

                expect(beacon.latestLocationState).toBeFalsy();
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("ignores locations outside the beacon live duration", () => {
                const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: true, timeout: 60000 }));
                const emitSpy = jest.spyOn(beacon, "emit");

                beacon.addLocations([
                    // beacon has now + 60000 live period
                    makeBeaconEvent(userId, { beaconInfoId: beacon.beaconInfoId, timestamp: now + 100000 }),
                ]);

                expect(beacon.latestLocationState).toBeFalsy();
                expect(emitSpy).not.toHaveBeenCalled();
            });

            it("should ignore invalid beacon events", () => {
                const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: true, timeout: 60000 }));
                const emitSpy = jest.spyOn(beacon, "emit");

                const ev = new MatrixEvent({
                    type: M_BEACON_INFO.name,
                    sender: userId,
                    room_id: roomId,
                    content: {
                        "m.relates_to": {
                            rel_type: REFERENCE_RELATION.name,
                            event_id: beacon.beaconInfoId,
                        },
                    },
                });
                beacon.addLocations([ev]);

                expect(beacon.latestLocationEvent).toBeFalsy();
                expect(emitSpy).not.toHaveBeenCalled();
            });

            describe("when beacon is live with a start timestamp is in the future", () => {
                it("ignores locations before the beacon start timestamp", () => {
                    const startTimestamp = now + 60000;
                    const beacon = new Beacon(
                        makeBeaconInfoEvent(userId, roomId, {
                            isLive: true,
                            timeout: 60000,
                            timestamp: startTimestamp,
                        }),
                    );
                    const emitSpy = jest.spyOn(beacon, "emit");

                    beacon.addLocations([
                        // beacon has now + 60000 live period
                        makeBeaconEvent(userId, {
                            beaconInfoId: beacon.beaconInfoId,
                            // now < location timestamp < beacon timestamp
                            timestamp: now + 10,
                        }),
                    ]);

                    expect(beacon.latestLocationState).toBeFalsy();
                    expect(emitSpy).not.toHaveBeenCalled();
                });
                it("sets latest location when location timestamp is after startTimestamp", () => {
                    const startTimestamp = now + 60000;
                    const beacon = new Beacon(
                        makeBeaconInfoEvent(userId, roomId, {
                            isLive: true,
                            timeout: 600000,
                            timestamp: startTimestamp,
                        }),
                    );
                    const emitSpy = jest.spyOn(beacon, "emit");

                    beacon.addLocations([
                        // beacon has now + 600000 live period
                        makeBeaconEvent(userId, {
                            beaconInfoId: beacon.beaconInfoId,
                            // now < beacon timestamp < location timestamp
                            timestamp: startTimestamp + 10,
                        }),
                    ]);

                    expect(beacon.latestLocationState).toBeTruthy();
                    expect(emitSpy).toHaveBeenCalled();
                });
            });

            it("sets latest location state to most recent location", () => {
                const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: true, timeout: 60000 }));
                const emitSpy = jest.spyOn(beacon, "emit");

                const locations = [
                    // older
                    makeBeaconEvent(userId, { beaconInfoId: beacon.beaconInfoId, uri: "geo:foo", timestamp: now + 1 }),
                    // newer
                    makeBeaconEvent(userId, {
                        beaconInfoId: beacon.beaconInfoId,
                        uri: "geo:bar",
                        timestamp: now + 10000,
                    }),
                    // not valid
                    makeBeaconEvent(userId, { beaconInfoId: beacon.beaconInfoId, uri: "geo:baz", timestamp: now - 5 }),
                ];

                beacon.addLocations(locations);

                const expectedLatestLocation = {
                    description: undefined,
                    timestamp: now + 10000,
                    uri: "geo:bar",
                };

                // the newest valid location
                expect(beacon.latestLocationState).toEqual(expectedLatestLocation);
                expect(beacon.latestLocationEvent).toEqual(locations[1]);
                expect(emitSpy).toHaveBeenCalledWith(BeaconEvent.LocationUpdate, expectedLatestLocation);
            });

            it("ignores locations that are less recent that the current latest location", () => {
                const beacon = new Beacon(makeBeaconInfoEvent(userId, roomId, { isLive: true, timeout: 60000 }));

                const olderLocation = makeBeaconEvent(userId, {
                    beaconInfoId: beacon.beaconInfoId,
                    uri: "geo:foo",
                    timestamp: now + 1,
                });
                const newerLocation = makeBeaconEvent(userId, {
                    beaconInfoId: beacon.beaconInfoId,
                    uri: "geo:bar",
                    timestamp: now + 10000,
                });

                beacon.addLocations([newerLocation]);
                // latest location set to newerLocation
                expect(beacon.latestLocationState).toEqual(
                    expect.objectContaining({
                        uri: "geo:bar",
                    }),
                );
                expect(beacon.latestLocationEvent).toEqual(newerLocation);

                const emitSpy = jest.spyOn(beacon, "emit").mockClear();

                // add older location
                beacon.addLocations([olderLocation]);

                // no change
                expect(beacon.latestLocationState).toEqual(
                    expect.objectContaining({
                        uri: "geo:bar",
                    }),
                );
                // no emit
                expect(emitSpy).not.toHaveBeenCalled();
            });
        });
    });
});
