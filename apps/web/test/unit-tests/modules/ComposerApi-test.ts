/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { TimelineRenderingType } from "../../../src/contexts/RoomContext";
import { Action } from "../../../src/dispatcher/actions";
import { MatrixDispatcher } from "../../../src/dispatcher/dispatcher";
import { type ComposerInsertPayload, ComposerType } from "../../../src/dispatcher/payloads/ComposerInsertPayload";
import { ComposerApi, ModuleComposerApiEvents } from "../../../src/modules/ComposerApi";
import type { ComposerInsertFilesPayload } from "../../../src/dispatcher/payloads/ComposerInsertFilePayload";

describe("ComposerApi", () => {
    describe("insertPlaintextIntoComposer()", () => {
        it("should be able to insert text", () => {
            const dispatcher = {
                dispatch: jest.fn(),
            } as unknown as MatrixDispatcher;
            const api = new ComposerApi(dispatcher);
            api.insertPlaintextIntoComposer("Hello world", { view: "room" });
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ComposerInsert,
                text: "Hello world",
                timelineRenderingType: TimelineRenderingType.Room,
                composerType: ComposerType.Send,
            } satisfies ComposerInsertPayload);
        });
        it("throws if called with an invalid view", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            expect(() => api.insertPlaintextIntoComposer("text", { view: "bleh" as "room" })).toThrow(
                "Invalid view 'bleh'",
            );
        });
    });
    describe("openFileUploadConfirmation()", () => {
        it("should be able to initiate a file upload", () => {
            const dispatcher = {
                dispatch: jest.fn(),
            } as unknown as MatrixDispatcher;
            const api = new ComposerApi(dispatcher);
            const files = [new File(["test"], "test.txt")];
            api.openFileUploadConfirmation(files, { view: "room" });
            expect(dispatcher.dispatch).toHaveBeenCalledWith({
                action: Action.ComposerFileInsert,
                files: files,
                timelineRenderingType: TimelineRenderingType.Room,
            } satisfies ComposerInsertFilesPayload);
        });
        it("throws if called with an invalid view", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const files = [new File(["test"], "test.txt")];
            expect(() => api.openFileUploadConfirmation(files, { view: "bleh" as "room" })).toThrow(
                "Invalid view 'bleh'",
            );
        });
    });
    describe("addFileUploadOption()", () => {
        it("should be able to add a file upload option", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const eventCb = jest.fn();
            api.on(ModuleComposerApiEvents.UploaderOptionsChanged, eventCb);
            const option = { type: "an_option", label: "New option", onSelected: () => {} };
            api.addFileUploadOption(option);
            expect(api.fileUploadOptions).toHaveLength(1);
            expect(api.fileUploadOptions).toContain(option);
            expect(eventCb).toHaveBeenCalledWith(option);
        });
        it("throws if called with the type 'local'", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            expect(() => api.addFileUploadOption({ type: "local", label: "New option", onSelected: () => {} })).toThrow(
                'Option "local" is reserved',
            );
        });
        it("throws if called with a duplicate type", () => {
            const api = new ComposerApi(new MatrixDispatcher());
            const option = { type: "an_option", label: "New option", onSelected: () => {} };
            api.addFileUploadOption(option);
            expect(() => api.addFileUploadOption({ ...option })).toThrow('Option "an_option" already exists');
        });
    });
});
