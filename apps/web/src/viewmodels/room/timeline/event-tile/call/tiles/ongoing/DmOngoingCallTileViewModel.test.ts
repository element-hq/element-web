/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { CallType } from "@element-hq/web-shared-components";
import { stubClient, TestSDKContext } from "test-utils";

import { getMockedMember, getMockedRtcNotificationEvent, MockedCall, MockedCallStore } from "../../call-mocks";
import { CallEvent } from "../../../../../../../models/Call";
import { DmOngoingCallTileViewModel } from "./DmOngoingCallTileViewModel";

const roomId = "!my-room:m.org";

describe("DmOngoingCallTileViewModel", () => {
    const sdkContext = new TestSDKContext();
    const legacyCallHandler = sdkContext.legacyCallHandler;

    describe("should compute the correct snapshot", () => {
        it("starts the timer when the other side picks up, not while ringing", () => {
            const cli = stubClient();
            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100, "@alice:m.org");
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");
            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");

            // The caller joins twice (a SIP bridge's user and its widget do): still ringing
            const call = MockedCall.create()
                .withParticipants([mxEvent.sender])
                .withMemberships(["@alice:m.org", 1000], ["@alice:m.org", 2000]);
            const callStore = MockedCallStore.create(call);
            const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });
            expect(vm.getSnapshot().durationViewModel).toBeUndefined();

            vi.useFakeTimers();
            vi.setSystemTime(12_000);
            call.withParticipants([bob]).withMemberships(
                ["@alice:m.org", 1000],
                ["@alice:m.org", 2000],
                ["@bob:m.org", 5000],
            );
            call.emit(CallEvent.Participants, call.participants, new Map());
            // Counted from Bob's join at 5 s, not Alice's at 1 s
            expect(vm.getSnapshot().durationViewModel?.getSnapshot().duration).toStrictEqual(7);
            expect(vm.getSnapshot().callHasOtherParticipants).toBe(true);
            vi.useRealTimers();
        });

        it("takes a side that reports its progress to be in the call only once it reports connected", () => {
            const cli = stubClient();
            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100, "@alice:m.org");
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");
            const bridge = getMockedMember(roomId, "@_sip_bob:m.org", "Bob (SIP)");
            const progress: { getContent: () => { state: string }; getTs: () => number; getSender: () => string }[] =
                [];
            const report = (state: string, ts: number) => ({
                getContent: () => ({ state }),
                getTs: () => ts,
                getSender: () => "@_sip_bob:m.org",
            });
            const getRelationsForEvent = vi
                .fn()
                .mockImplementation((_id, _rel, type) =>
                    type === "org.matrix.msc4075.rtc.invite_progress" ? { getRelations: () => progress } : undefined,
                );
            // The bridge joins as soon as it dials, and says so: still ringing
            const call = MockedCall.create()
                .withParticipants([mxEvent.sender, bridge])
                .withMemberships(["@alice:m.org", 1000], ["@_sip_bob:m.org", 2000]);
            const callStore = MockedCallStore.create(call);
            const vm = new DmOngoingCallTileViewModel({
                mxEvent,
                cli,
                callStore,
                roomId,
                legacyCallHandler,
                getRelationsForEvent,
            });
            // Its membership arrived before its first report: the timer started, and stops again
            expect(vm.getSnapshot().callHasOtherParticipants).toBe(true);
            progress.push(report("ringing", 2500));
            call.emit(CallEvent.Participants, call.participants, new Map());
            expect(vm.getSnapshot().durationViewModel).toBeUndefined();
            expect(vm.getSnapshot().callHasOtherParticipants).toBe(false);

            vi.useFakeTimers();
            vi.setSystemTime(12_000);
            progress.push(report("connected", 5000));
            call.emit(CallEvent.Participants, call.participants, new Map());
            // Counted from the connected report at 5 s, not the bridge's join at 2 s
            expect(vm.getSnapshot().durationViewModel?.getSnapshot().duration).toStrictEqual(7);
            expect(vm.getSnapshot().callHasOtherParticipants).toBe(true);
            vi.useRealTimers();
        });

        it("still takes anyone else's join as the answer while a reporting side only rings", () => {
            const cli = stubClient();
            const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100, "@alice:m.org");
            mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");
            const bridge = getMockedMember(roomId, "@_sip_bob:m.org", "Bob (SIP)");
            const bob = getMockedMember(roomId, "@bob:m.org", "Bob");
            const getRelationsForEvent = vi.fn().mockImplementation((_id, _rel, type) =>
                type === "org.matrix.msc4075.rtc.invite_progress"
                    ? {
                          getRelations: () => [
                              {
                                  getContent: () => ({ state: "ringing" }),
                                  getTs: () => 2500,
                                  getSender: () => "@_sip_bob:m.org",
                              },
                          ],
                      }
                    : undefined,
            );
            const call = MockedCall.create()
                .withParticipants([mxEvent.sender, bridge, bob])
                .withMemberships(["@alice:m.org", 1000], ["@_sip_bob:m.org", 2000], ["@bob:m.org", 5000]);
            const callStore = MockedCallStore.create(call);
            vi.useFakeTimers();
            vi.setSystemTime(12_000);
            const vm = new DmOngoingCallTileViewModel({
                mxEvent,
                cli,
                callStore,
                roomId,
                legacyCallHandler,
                getRelationsForEvent,
            });
            // Bob's phone picked up at 5 s: the bridge's ringing says nothing about Bob
            expect(vm.getSnapshot().durationViewModel?.getSnapshot().duration).toStrictEqual(7);
            vi.useRealTimers();
        });

        describe("callType", () => {
            it("voice", () => {
                const cli = stubClient();

                const mxEvent = getMockedRtcNotificationEvent("audio", 100, 100);
                mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

                const call = MockedCall.create().withParticipants([mxEvent.sender]);
                const callStore = MockedCallStore.create(call);
                const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });

                expect(vm.getSnapshot().callType).toStrictEqual(CallType.Voice);
            });

            it("video", () => {
                const cli = stubClient();

                const mxEvent = getMockedRtcNotificationEvent("video", 100, 100);
                mxEvent.sender = getMockedMember(roomId, "@alice:m.org", "Alice");

                const call = MockedCall.create().withParticipants([mxEvent.sender]);
                const callStore = MockedCallStore.create(call);
                const vm = new DmOngoingCallTileViewModel({ mxEvent, cli, callStore, roomId, legacyCallHandler });

                expect(vm.getSnapshot().callType).toStrictEqual(CallType.Video);
            });
        });
    });
});
