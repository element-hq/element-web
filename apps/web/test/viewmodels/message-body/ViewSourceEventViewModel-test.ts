/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MouseEvent } from "react";
import { type MatrixClient, MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";

import { ViewSourceEventViewModel } from "../../../src/viewmodels/room/timeline/event-tile/body/ViewSourceEventViewModel";

describe("ViewSourceEventViewModel", () => {
    const createClient = (): MatrixClient =>
        ({
            decryptEventIfNeeded: jest.fn().mockResolvedValue(undefined),
        }) as unknown as MatrixClient;

    const createEvent = (type = "m.room.message", content: Record<string, unknown> = {}): MatrixEvent =>
        new MatrixEvent({
            type,
            event_id: "$event:example.org",
            sender: "@alice:example.org",
            content,
        });

    const createClickEvent = (): MouseEvent<HTMLButtonElement> =>
        ({
            preventDefault: jest.fn(),
        }) as unknown as MouseEvent<HTMLButtonElement>;

    it("creates a collapsed event source snapshot and requests decryption", () => {
        const cli = createClient();
        const mxEvent = createEvent("m.room.member");
        const vm = new ViewSourceEventViewModel({ cli, mxEvent });

        expect(cli.decryptEventIfNeeded).toHaveBeenCalledWith(mxEvent);
        expect(vm.getSnapshot()).toEqual({
            expanded: false,
            preview: '{ "type": m.room.member }',
            source: "",
        });
    });

    it("toggles expanded state", () => {
        const mxEvent = createEvent();
        const vm = new ViewSourceEventViewModel({ cli: createClient(), mxEvent });
        const event = createClickEvent();

        vm.onToggle(event);

        expect(event.preventDefault).toHaveBeenCalled();
        expect(vm.getSnapshot().expanded).toBe(true);
        expect(vm.getSnapshot().source).toBe(JSON.stringify(mxEvent, null, 4));

        vm.onToggle(createClickEvent());

        expect(vm.getSnapshot().expanded).toBe(false);
        expect(vm.getSnapshot().source).toBe("");
    });

    it("updates the event source when the event changes", () => {
        const cli = createClient();
        const oldEvent = createEvent("m.room.message");
        const newEvent = createEvent("m.room.topic", { topic: "New topic" });
        const vm = new ViewSourceEventViewModel({ cli, mxEvent: oldEvent });

        vm.onToggle(createClickEvent());
        vm.setProps({ mxEvent: newEvent });

        expect(cli.decryptEventIfNeeded).toHaveBeenCalledWith(newEvent);
        expect(vm.getSnapshot()).toEqual({
            expanded: true,
            preview: '{ "type": m.room.topic }',
            source: JSON.stringify(newEvent, null, 4),
        });
    });

    it("removes the previous decryption listener when the event changes", () => {
        const oldEvent = createEvent("m.room.encrypted");
        jest.spyOn(oldEvent, "isBeingDecrypted").mockReturnValue(true);
        const offSpy = jest.spyOn(oldEvent, "off");
        const vm = new ViewSourceEventViewModel({ cli: createClient(), mxEvent: oldEvent });

        vm.setProps({ mxEvent: createEvent("m.room.message") });

        expect(offSpy).toHaveBeenCalledWith(MatrixEventEvent.Decrypted, expect.any(Function));
    });

    it("updates the decryption request when the client changes", () => {
        const oldClient = createClient();
        const newClient = createClient();
        const mxEvent = createEvent();
        const vm = new ViewSourceEventViewModel({ cli: oldClient, mxEvent });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setProps({ cli: newClient });

        expect(newClient.decryptEventIfNeeded).toHaveBeenCalledWith(mxEvent);
        expect(listener).not.toHaveBeenCalled();
    });

    it("does not emit when setProps receives unchanged props", () => {
        const cli = createClient();
        const mxEvent = createEvent();
        const vm = new ViewSourceEventViewModel({ cli, mxEvent });
        const listener = jest.fn();
        vm.subscribe(listener);

        vm.setProps({ cli, mxEvent });

        expect(listener).not.toHaveBeenCalled();
    });

    it("updates the source after decryption completes", () => {
        const mxEvent = createEvent("m.room.encrypted", { ciphertext: "encrypted" });
        jest.spyOn(mxEvent, "isBeingDecrypted").mockReturnValue(true);
        const vm = new ViewSourceEventViewModel({ cli: createClient(), mxEvent });
        vm.onToggle(createClickEvent());
        const listener = jest.fn();
        vm.subscribe(listener);

        mxEvent.getContent().body = "decrypted";
        mxEvent.emit(MatrixEventEvent.Decrypted, mxEvent);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(vm.getSnapshot().source).toContain("decrypted");
    });

    it("removes decryption listeners on dispose", () => {
        const mxEvent = createEvent("m.room.encrypted");
        jest.spyOn(mxEvent, "isBeingDecrypted").mockReturnValue(true);
        const offSpy = jest.spyOn(mxEvent, "off");
        const vm = new ViewSourceEventViewModel({ cli: createClient(), mxEvent });

        vm.dispose();

        expect(offSpy).toHaveBeenCalledWith(MatrixEventEvent.Decrypted, expect.any(Function));
    });
});
