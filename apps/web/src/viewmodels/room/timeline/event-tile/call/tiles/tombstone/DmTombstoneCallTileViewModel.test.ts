/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { CallDirection, CallType } from "@element-hq/web-shared-components";
import { EventType, MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import { stubClient } from "test-utils";

import { getMockedRtcDeclineEvent, getMockedRtcNotificationEvent } from "../../call-mocks";
import { DmTombstoneCallTileViewModel } from "./DmTombstoneCallTileViewModel";

describe("DmTombstoneCallTileViewModel", () => {
    it("should compute correct state on decline", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 924285348000, 924285348000, "@alice:m.org");
        const declineEvent = getMockedRtcDeclineEvent(mxEvent, "@alice:m.org");
        const getRelationsForEvent = vi.fn();
        const cli = stubClient();
        const vm = new DmTombstoneCallTileViewModel({ mxEvent, getRelationsForEvent, cli });

        // Without decline event, isCallDeclined = false
        expect(vm.getSnapshot().isCallDeclined).toStrictEqual(false);

        // Decline event comes through
        getRelationsForEvent.mockReturnValue({
            getRelations: () => [declineEvent],
        });
        mxEvent.emit(MatrixEventEvent.RelationsCreated, "m.reference", EventType.RTCDecline);

        // Call should be declined
        expect(vm.getSnapshot().isCallDeclined).toStrictEqual(true);
    });

    it("should report why the call failed from invite progress", () => {
        const mxEvent = getMockedRtcNotificationEvent("audio", 924285348000, 924285348000, "@alice:m.org");
        const progress = new MatrixEvent({
            type: "org.matrix.msc4075.rtc.invite_progress",
            content: { state: "unreachable", reason: "SIP 404" },
            sender: "@_sip_bot:m.org",
            room_id: mxEvent.getRoomId(),
        });
        const getRelationsForEvent = vi.fn();
        getRelationsForEvent.mockImplementation((_id, _rel, type) =>
            type === "org.matrix.msc4075.rtc.invite_progress" ? { getRelations: () => [progress] } : undefined,
        );
        const vm = new DmTombstoneCallTileViewModel({ mxEvent, getRelationsForEvent, cli: stubClient() });
        expect(vm.getSnapshot().failureReason).toStrictEqual("unreachable (SIP 404)");
        expect(vm.getSnapshot().isCallDeclined).toStrictEqual(false);
    });

    it("should compute voice intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365);

        const getRelationsForEvent = vi.fn();
        const cli = stubClient();
        const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Voice);
    });

    it("should compute video intent in state", () => {
        const mxEvent = getMockedRtcNotificationEvent("video", 1752583130365, 1752583130365);
        const getRelationsForEvent = vi.fn();
        const cli = stubClient();
        const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent });
        const { type } = vm.getSnapshot();
        expect(type).toStrictEqual(CallType.Video);
    });

    describe("should tell whether we answered", () => {
        const timelineWith = (cli: ReturnType<typeof stubClient>, mxEvent: MatrixEvent, after: MatrixEvent[]) =>
            vi.spyOn(cli, "getRoom").mockReturnValue({
                getTimelineForEvent: () => ({ getEvents: () => [mxEvent, ...after] }),
            } as any);
        const member = (sender: string, roomId: string, content: object, ts = 0) =>
            new MatrixEvent({
                type: EventType.GroupCallMemberPrefix,
                sender,
                room_id: roomId,
                content,
                origin_server_ts: ts,
            });

        it("yes, when our call membership follows the ring", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@bob:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            timelineWith(cli, mxEvent, [member("@alice:m.org", mxEvent.getRoomId()!, { application: "m.call" })]);
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() });
            expect(vm.getSnapshot().answered).toStrictEqual(true);
        });

        it("and how long the call lasted, from the other side joining to anyone leaving", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@bob:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const roomId = mxEvent.getRoomId()!;
            timelineWith(cli, mxEvent, [
                member("@alice:m.org", roomId, { application: "m.call" }, 10_000),
                member("@bob:m.org", roomId, {}, 95_400),
                member("@alice:m.org", roomId, {}, 96_000),
            ]);
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() });
            expect(vm.getSnapshot()).toMatchObject({ answered: true, durationSeconds: 85 });
        });

        it("timing the call from when the other side reported it connected, if it reports progress", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@alice:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const roomId = mxEvent.getRoomId()!;
            const progress = (state: string, ts: number) =>
                new MatrixEvent({
                    type: "org.matrix.msc4075.rtc.invite_progress",
                    content: { state },
                    sender: "@_sip_bob:m.org",
                    room_id: roomId,
                    origin_server_ts: ts,
                });
            const getRelationsForEvent = vi
                .fn()
                .mockImplementation((_id, _rel, type) =>
                    type === "org.matrix.msc4075.rtc.invite_progress"
                        ? { getRelations: () => [progress("ringing", 1_000), progress("connected", 20_000)] }
                        : undefined,
                );
            // The bridge joins while still ringing; that is not the answer
            timelineWith(cli, mxEvent, [
                member("@_sip_bob:m.org", roomId, { application: "m.call", device_id: "SIPBRIDGE+publish" }, 1_000),
                member("@_sip_bob:m.org", roomId, { application: "m.call", device_id: "SIPBRIDGE" }, 20_500),
                member("@_sip_bob:m.org", roomId, {}, 50_000),
            ]);
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent });
            expect(vm.getSnapshot().durationSeconds).toStrictEqual(30);
        });

        it("or, without a connected report, from the other side's first membership that is not its publisher's", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@alice:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const roomId = mxEvent.getRoomId()!;
            const unanswered = [
                member("@_sip_bob:m.org", roomId, { application: "m.call", device_id: "SIPBRIDGE+publish" }, 1_000),
                member("@_sip_bob:m.org", roomId, {}, 50_000),
            ];
            timelineWith(cli, mxEvent, unanswered);
            expect(
                new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() }).getSnapshot()
                    .durationSeconds,
            ).toBeUndefined();
            timelineWith(cli, mxEvent, [
                unanswered[0],
                member("@_sip_bob:m.org", roomId, { application: "m.call", device_id: "SIPBRIDGE" }, 20_000),
                unanswered[1],
            ]);
            expect(
                new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() }).getSnapshot()
                    .durationSeconds,
            ).toStrictEqual(30);
        });

        it("no, when our membership comes after the ring ended (we placed the next call)", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@bob:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const roomId = mxEvent.getRoomId()!;
            const ts = mxEvent.getTs();
            timelineWith(cli, mxEvent, [
                member("@bob:m.org", roomId, {}, ts + 60_000),
                member("@alice:m.org", roomId, { application: "m.call" }, ts + 600_000),
            ]);
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() });
            expect(vm.getSnapshot()).toMatchObject({ answered: false, durationSeconds: undefined });
        });

        it("no, when only the caller's membership follows, or ours is for a later ring", () => {
            const mxEvent = getMockedRtcNotificationEvent("audio", 1752583130365, 1752583130365, "@bob:m.org");
            const later = getMockedRtcNotificationEvent("audio", 1752583230365, 1752583230365, "@bob:m.org");
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const roomId = mxEvent.getRoomId()!;
            timelineWith(cli, mxEvent, [
                member("@bob:m.org", roomId, { application: "m.call" }),
                member("@alice:m.org", roomId, {}),
                later,
                member("@alice:m.org", roomId, { application: "m.call" }),
            ]);
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent: vi.fn() });
            expect(vm.getSnapshot()).toMatchObject({ answered: false, durationSeconds: undefined });
        });
    });

    describe("should compute callDirection", () => {
        it("for outgoing", () => {
            const mxEvent = getMockedRtcNotificationEvent("video", 1752583130365, 1752583130365, "@alice:m.org");
            const getRelationsForEvent = vi.fn();
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent });
            expect(vm.getSnapshot().callDirection).toStrictEqual(CallDirection.Outgoing);
        });

        it("for incoming", () => {
            const mxEvent = getMockedRtcNotificationEvent("video", 1752583130365, 1752583130365, "@bob:m.org");
            const getRelationsForEvent = vi.fn();
            const cli = stubClient();
            vi.spyOn(cli, "getUserId").mockReturnValue("@alice:m.org");
            const vm = new DmTombstoneCallTileViewModel({ mxEvent, cli, getRelationsForEvent });
            expect(vm.getSnapshot().callDirection).toStrictEqual(CallDirection.Incoming);
        });
    });
});
