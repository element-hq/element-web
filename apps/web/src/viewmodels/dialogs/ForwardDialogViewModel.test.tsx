// @vitest-environment happy-dom

/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient, type Room } from "matrix-js-sdk/src/matrix";
import { type MockedObject, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitFor } from "test-utils-rtl";
import { getMockClientWithEventEmitter, mkMessage, mkStubRoom } from "test-utils";

import { ForwardDialogViewModel } from "./ForwardDialogViewModel";
import DMRoomMap from "../../utils/DMRoomMap";
import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import SettingsStore from "../../settings/SettingsStore";

vi.mock("../../utils/i18n-helpers", () => ({
    roomContextDetails: (room: Room) => (room.roomId === "!b:example.org" ? { details: "Some space" } : null),
}));

describe("ForwardDialogViewModel", () => {
    const userId = "@bob:example.org";
    const sourceRoomId = "!source:example.org";
    let client: MockedObject<MatrixClient>;
    let rooms: Room[];
    let event: ReturnType<typeof mkMessage>;
    let onFinished: () => void;

    const makeVm = (): ForwardDialogViewModel => new ForwardDialogViewModel({ matrixClient: client, event, onFinished });

    beforeEach(() => {
        client = getMockClientWithEventEmitter({
            getUserId: vi.fn().mockReturnValue(userId),
            getSafeUserId: vi.fn().mockReturnValue(userId),
            getVisibleRooms: vi.fn(),
            getRoom: vi.fn(),
            getAccountData: vi.fn(),
            sendEvent: vi.fn(),
        });
        DMRoomMap.makeShared(client);

        rooms = [
            mkStubRoom("!a:example.org", "Alpha", client),
            mkStubRoom("!b:example.org", "Bravo", client),
            mkStubRoom("!c:example.org", "Charlie", client),
        ];
        client.getVisibleRooms.mockReturnValue(rooms);
        client.getRoom.mockImplementation((roomId) => rooms.find((r) => r.roomId === roomId) ?? null);

        event = mkMessage({ room: sourceRoomId, user: "@alice:example.org", msg: "Hello world!", event: true });
        onFinished = vi.fn();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("lists joined, non-space rooms with their context details", () => {
        const spaceRoom = mkStubRoom("!space:example.org", "Space", client);
        spaceRoom.isSpaceRoom = vi.fn().mockReturnValue(true);
        const leftRoom = mkStubRoom("!left:example.org", "Left", client);
        leftRoom.getMyMembership = vi.fn().mockReturnValue("leave");
        client.getVisibleRooms.mockReturnValue([...rooms, spaceRoom, leftRoom]);

        const vm = makeVm();

        expect(vm.getSnapshot().rooms.map((r) => r.id)).toEqual(["!a:example.org", "!b:example.org", "!c:example.org"]);
        expect(vm.getSnapshot().rooms[1]).toEqual({
            id: "!b:example.org",
            name: "Bravo",
            description: "Some space",
            canSend: true,
            sendState: "can_send",
        });
        expect(vm.getSnapshot().rooms[0].description).toBe("");
    });

    it("reports rooms the user cannot send to", () => {
        rooms[0].maySendMessage = vi.fn().mockReturnValue(false);

        const vm = makeVm();

        expect(vm.getSnapshot().rooms[0].canSend).toBe(false);
        expect(vm.getSnapshot().rooms[1].canSend).toBe(true);
    });

    it("filters rooms by name, case-insensitively", () => {
        const vm = makeVm();

        vm.search("BRA");
        expect(vm.getSnapshot().rooms.map((r) => r.name)).toEqual(["Bravo"]);

        vm.search("");
        expect(vm.getSnapshot().rooms).toHaveLength(3);
    });

    it("strips relations and recalculates mentions before forwarding", () => {
        const vm = makeVm();

        expect(vm.type).toBe("m.room.message");
        expect(vm.content).toEqual({ "body": "Hello world!", "msgtype": "m.text", "m.mentions": {} });
    });

    it("tracks the send state of each room independently", async () => {
        let resolveSend!: () => void;
        let rejectSend!: () => void;
        client.sendEvent
            .mockImplementationOnce(() => new Promise<any>((_, reject) => (rejectSend = reject)))
            .mockImplementationOnce(() => new Promise<any>((resolve) => (resolveSend = resolve)));

        const vm = makeVm();
        const stateOf = (roomId: string) => vm.getSnapshot().rooms.find((r) => r.id === roomId)!.sendState;

        void vm.send("!a:example.org");
        expect(client.sendEvent).toHaveBeenCalledWith("!a:example.org", "m.room.message", vm.content);
        expect(stateOf("!a:example.org")).toBe("sending");
        expect(stateOf("!b:example.org")).toBe("can_send");

        rejectSend();
        await waitFor(() => expect(stateOf("!a:example.org")).toBe("failed"));

        void vm.send("!b:example.org");
        expect(stateOf("!b:example.org")).toBe("sending");
        resolveSend();
        await waitFor(() => expect(stateOf("!b:example.org")).toBe("sent"));
        expect(stateOf("!a:example.org")).toBe("failed");
    });

    it("keeps send state across searches", async () => {
        client.sendEvent.mockResolvedValue({ event_id: "$sent" });
        const vm = makeVm();

        await vm.send("!a:example.org");
        vm.search("alpha");

        expect(vm.getSnapshot().rooms).toEqual([expect.objectContaining({ id: "!a:example.org", sendState: "sent" })]);
    });

    it("opens a room and closes the dialog", () => {
        const dispatchSpy = vi.spyOn(dis, "dispatch");
        const vm = makeVm();

        vm.openRoom("!b:example.org", true);

        expect(dispatchSpy).toHaveBeenCalledWith({
            action: Action.ViewRoom,
            room_id: "!b:example.org",
            metricsTrigger: "WebForwardShortcut",
            metricsViaKeyboard: true,
        });
        expect(onFinished).toHaveBeenCalled();
    });

    it("reveals all rooms when asked", () => {
        const vm = makeVm();
        expect(vm.getSnapshot().truncateAt).toBe(20);

        vm.showAllRooms();

        expect(vm.getSnapshot().truncateAt).toBe(3);
    });

    it("renders an avatar for known rooms only", () => {
        const vm = makeVm();

        expect(vm.renderRoomAvatar("!a:example.org", "32px")).not.toBeNull();
        expect(vm.renderRoomAvatar("!unknown:example.org", "32px")).toBeNull();
    });

    it.each([true, false])("passes the dynamic room predecessors setting (%s) through", (enabled) => {
        vi.spyOn(SettingsStore, "getValue").mockImplementation(
            (name) => name === "feature_dynamic_room_predecessors" && enabled,
        );

        makeVm();

        expect(client.getVisibleRooms).toHaveBeenCalledWith(enabled);
    });
});
