/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { it, describe, expect, vi } from "vitest";
import { CallDirection, CallType } from "@element-hq/web-shared-components";
import { EventType, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { getMockedRtcDeclineEvent, getMockedRtcNotificationEvent } from "../../call-mocks";
import { formatTime } from "../../../../../../../DateUtils";
import { DmTombstoneCallTileViewModel } from "./DmTombstoneCallTileViewModel";
import { stubClient } from "../../../../../../../../test/test-utils";

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

        // Timestamp should be that of the decline event
        expect(vm.getSnapshot().timestamp).toStrictEqual(formatTime(new Date(924285416000)));
        // Call should be declined
        expect(vm.getSnapshot().isCallDeclined).toStrictEqual(true);
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
