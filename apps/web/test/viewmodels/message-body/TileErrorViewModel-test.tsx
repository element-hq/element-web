/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { mocked } from "jest-mock";
import { MatrixEvent, type MatrixEventEventContent } from "matrix-js-sdk/src/matrix";

import Modal from "../../../src/Modal";
import SdkConfig from "../../../src/SdkConfig";
import { BugReportEndpointURLLocal } from "../../../src/IConfigOptions";
import ViewSource from "../../../src/components/structures/ViewSource";
import BugReportDialog from "../../../src/components/views/dialogs/BugReportDialog";
import { TileErrorViewModel } from "../../../src/viewmodels/message-body/TileErrorViewModel";

describe("TileErrorViewModel", () => {
    const createEvent = (type = "m.room.message"): MatrixEvent =>
        new MatrixEvent({
            content: {} as MatrixEventEventContent,
            event_id: `$${type}`,
            origin_server_ts: Date.now(),
            room_id: "!room:example.org",
            sender: "@alice:example.org",
            type,
        });

    const createVm = (
        overrides: Partial<ConstructorParameters<typeof TileErrorViewModel>[0]> = {},
    ): TileErrorViewModel => {
        const error = overrides.error ?? new Error("Boom");
        const mxEvent = overrides.mxEvent ?? createEvent();

        return new TileErrorViewModel({
            developerMode: true,
            error,
            mxEvent,
            ...overrides,
        });
    };

    beforeEach(() => {
        SdkConfig.reset();
        jest.spyOn(Modal, "createDialog").mockImplementation(() => ({ close: jest.fn() }) as any);
    });

    afterEach(() => {
        SdkConfig.reset();
        jest.restoreAllMocks();
    });

    it("computes the initial snapshot from app state", () => {
        SdkConfig.add({ bug_report_endpoint_url: "https://example.org" });
        const vm = createVm();

        expect(vm.getSnapshot()).toEqual({
            message: "Can't load this message",
            eventType: "m.room.message",
            bugReportCtaLabel: "Submit debug logs",
            viewSourceCtaLabel: "View Source",
        });
    });

    it("uses the download logs label for local bug reports", () => {
        SdkConfig.add({ bug_report_endpoint_url: BugReportEndpointURLLocal });
        const vm = createVm();

        expect(vm.getSnapshot().bugReportCtaLabel).toBe("Download logs");
    });

    it("hides optional actions when unavailable", () => {
        const vm = createVm({ developerMode: false });

        expect(vm.getSnapshot().bugReportCtaLabel).toBeUndefined();
        expect(vm.getSnapshot().viewSourceCtaLabel).toBeUndefined();
    });

    it("updates the event type when the event changes", () => {
        const vm = createVm();
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setMxEvent(createEvent("m.room.redaction"));

        expect(vm.getSnapshot().eventType).toBe("m.room.redaction");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("guards setters against unchanged values", () => {
        const error = new Error("Boom");
        const mxEvent = createEvent();
        const vm = createVm({ developerMode: true, error, mxEvent });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setDeveloperMode(true);
        vm.setError(error);
        vm.setMxEvent(mxEvent);

        expect(listener).not.toHaveBeenCalled();
    });

    it("opens the bug report dialog with the current error", () => {
        SdkConfig.add({ bug_report_endpoint_url: "https://example.org" });
        const originalError = new Error("Boom");
        const updatedError = new Error("Updated boom");
        const vm = createVm({ error: originalError });

        vm.setError(updatedError);
        vm.onBugReportClick({} as any);

        expect(Modal.createDialog).toHaveBeenCalledWith(BugReportDialog, {
            label: "react-tile-soft-crash",
            error: updatedError,
        });
    });

    it("opens the view source dialog with the current event", () => {
        const originalEvent = createEvent();
        const updatedEvent = createEvent("m.room.redaction");
        const vm = createVm({ mxEvent: originalEvent });

        vm.setMxEvent(updatedEvent);
        vm.onViewSourceClick({} as any);

        expect(Modal.createDialog).toHaveBeenCalledWith(
            ViewSource,
            {
                mxEvent: updatedEvent,
            },
            "mx_Dialog_viewsource",
        );
    });

    it("does not open view source when developer mode is disabled", () => {
        const vm = createVm({ developerMode: false });

        vm.onViewSourceClick({} as any);

        expect(mocked(Modal.createDialog)).not.toHaveBeenCalled();
    });
});
