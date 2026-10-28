/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import {
    EventType,
    type MatrixClient,
    type MatrixEvent,
    MatrixEventEvent,
    Relations,
    RelationsEvent,
    RelationType,
} from "matrix-js-sdk/src/matrix";
import { type A2UIContainerRenderNode, type A2UITextFieldRenderNode } from "@element-hq/web-shared-components";
import { mkEvent, stubClient } from "test-utils";

import { A2UIBodyViewModel } from "./A2UIBodyViewModel";
import Modal from "../../Modal";
import ImageView from "../../components/views/elements/ImageView";
import { A2UI_ACTION_EVENT_TYPE, A2UI_MSGTYPE, A2UI_UPDATE_EVENT_TYPE } from "../../a2ui/A2UIEvents";
import { type GetRelationsForEvent } from "../room/timeline/event-tile/reactions/EventTileReactionState";

const roomId = "!room:example.org";
const agent = "@agent:example.org";

const surfaceMessages = [
    { version: "v0.9", createSurface: { surfaceId: "main" } },
    {
        version: "v0.9",
        updateComponents: {
            surfaceId: "main",
            components: [
                { id: "root", component: "Column", children: ["name", "pic", "submit"] },
                { id: "name", component: "TextField", label: "Name", value: { path: "/name" } },
                { id: "pic", component: "Image", url: { path: "/pic" } },
                {
                    id: "submit",
                    component: "Button",
                    child: "label",
                    action: { event: { name: "submit", context: { name: { path: "/name" } } } },
                },
                { id: "label", component: "Text", text: "Send" },
            ],
        },
    },
    { version: "v0.9", updateDataModel: { surfaceId: "main", value: { name: "Alice", pic: "mxc://example.org/abc" } } },
];

function mkSurfaceEvent(messages: unknown = surfaceMessages): MatrixEvent {
    return mkEvent({
        event: true,
        type: EventType.RoomMessage,
        room: roomId,
        user: agent,
        content: { msgtype: A2UI_MSGTYPE, body: "fallback", messages },
    });
}

function mkUpdate(surfaceEvent: MatrixEvent, messages: unknown[], user = agent, ts = 1000): MatrixEvent {
    return mkEvent({
        event: true,
        type: A2UI_UPDATE_EVENT_TYPE,
        room: roomId,
        user,
        ts,
        content: {
            "m.relates_to": { rel_type: RelationType.Reference, event_id: surfaceEvent.getId() },
            messages,
        },
    });
}

function nameField(vm: A2UIBodyViewModel): A2UITextFieldRenderNode {
    const root = vm.getSnapshot().surfaces[0].root as A2UIContainerRenderNode;
    return root.children[0] as A2UITextFieldRenderNode;
}

describe("A2UIBodyViewModel", () => {
    let cli: MatrixClient;
    let mediaProps: { mediaVisible: boolean; setMediaVisible: Mock<(visible: boolean) => void> };

    beforeEach(() => {
        cli = stubClient();
        mediaProps = { mediaVisible: true, setMediaVisible: vi.fn() };
        vi.spyOn(cli, "sendEvent").mockResolvedValue({ event_id: "$action" });
        vi.spyOn(cli, "mxcUrlToHttp").mockImplementation((mxc) => `https://hs/media/${mxc}`);
    });

    it("builds the surfaces from the event", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });

        const snapshot = vm.getSnapshot();
        expect(snapshot.sending).toBe(false);
        expect(snapshot.surfaces).toHaveLength(1);
        expect(nameField(vm).value).toBe("Alice");
    });

    it("converts mxc image URLs through the client", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });

        const root = vm.getSnapshot().surfaces[0].root as A2UIContainerRenderNode;
        expect(root.children[1]).toMatchObject({ component: "Image", url: "https://hs/media/mxc://example.org/abc" });
    });

    it("renders an empty surface list for a message without messages", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent("nope"), cli });

        expect(vm.getSnapshot().surfaces).toEqual([]);
    });

    it("records input edits and emits a new snapshot", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });
        const listener = vi.fn();
        vm.subscribe(listener);

        vm.setInputValue("main", "name", "/name", "Bob");

        expect(listener).toHaveBeenCalled();
        expect(nameField(vm).value).toBe("Bob");
    });

    it("sends an action event with the resolved context", async () => {
        vi.useFakeTimers({ now: new Date("2026-10-23T12:00:00.000Z") });
        try {
            const mxEvent = mkSurfaceEvent();
            const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli });
            vm.setInputValue("main", "name", "/name", "Bob");

            vm.triggerAction("main", "submit");
            expect(vm.getSnapshot().sending).toBe(true);

            expect(cli.sendEvent).toHaveBeenCalledWith(roomId, A2UI_ACTION_EVENT_TYPE, {
                "m.relates_to": { rel_type: RelationType.Reference, event_id: mxEvent.getId() },
                "version": "v0.9",
                "action": {
                    name: "submit",
                    surfaceId: "main",
                    sourceComponentId: "submit",
                    timestamp: "2026-10-23T12:00:00.000Z",
                    context: { name: "Bob" },
                },
            });

            await vi.runAllTimersAsync();
            expect(vm.getSnapshot().sending).toBe(false);
            expect(vm.getSnapshot().error).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });

    it("includes the data model when the surface asked for it", () => {
        const messages = [
            { version: "v0.9", createSurface: { surfaceId: "main", sendDataModel: true } },
            ...surfaceMessages.slice(1),
        ];
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(messages), cli });

        vm.triggerAction("main", "submit");

        expect(cli.sendEvent).toHaveBeenCalledWith(
            roomId,
            A2UI_ACTION_EVENT_TYPE,
            expect.objectContaining({ dataModel: { name: "Alice", pic: "mxc://example.org/abc" } }),
        );
    });

    it("reports a send failure", async () => {
        vi.mocked(cli.sendEvent).mockRejectedValue(new Error("nope"));
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });

        vm.triggerAction("main", "submit");
        await vi.waitFor(() => expect(vm.getSnapshot().sending).toBe(false));

        expect(vm.getSnapshot().error).toBe("Your response could not be sent. Please try again.");
    });

    it("ignores actions for nodes without a server event", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });

        vm.triggerAction("main", "name");
        vm.triggerAction("other", "submit");

        expect(cli.sendEvent).not.toHaveBeenCalled();
        expect(vm.getSnapshot().sending).toBe(false);
    });

    describe("updates", () => {
        let mxEvent: MatrixEvent;
        let relations: Relations;
        let getRelationsForEvent: Mock<GetRelationsForEvent>;

        beforeEach(() => {
            mxEvent = mkSurfaceEvent();
            relations = new Relations(RelationType.Reference, A2UI_UPDATE_EVENT_TYPE, cli);
            getRelationsForEvent = vi.fn<GetRelationsForEvent>().mockReturnValue(relations);
        });

        it("applies existing updates from the sender in timestamp order", () => {
            const first = mkUpdate(
                mxEvent,
                [{ updateDataModel: { surfaceId: "main", path: "/name", value: "Carol" } }],
                agent,
                1,
            );
            const second = mkUpdate(
                mxEvent,
                [{ updateDataModel: { surfaceId: "main", path: "/name", value: "Dave" } }],
                agent,
                2,
            );
            const forged = mkUpdate(
                mxEvent,
                [{ updateDataModel: { surfaceId: "main", path: "/name", value: "Mallory" } }],
                "@mallory:example.org",
                3,
            );
            vi.spyOn(relations, "getRelations").mockReturnValue([second, forged, first]);

            const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli, getRelationsForEvent });

            expect(getRelationsForEvent).toHaveBeenCalledWith(
                mxEvent.getId(),
                RelationType.Reference,
                A2UI_UPDATE_EVENT_TYPE,
            );
            expect(nameField(vm).value).toBe("Dave");
        });

        it("applies updates as they arrive without discarding the user's edits", () => {
            const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli, getRelationsForEvent });
            vm.setInputValue("main", "name", "/name", "typed");

            relations.emit(
                RelationsEvent.Add,
                mkUpdate(mxEvent, [
                    {
                        updateComponents: {
                            surfaceId: "main",
                            components: [
                                { id: "name", component: "TextField", label: "Full name", value: { path: "/name" } },
                            ],
                        },
                    },
                ]),
            );

            expect(nameField(vm)).toMatchObject({ label: "Full name", value: "typed" });
        });

        it("starts watching when relations are created later", () => {
            getRelationsForEvent.mockReturnValueOnce(null);
            const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli, getRelationsForEvent });
            vi.spyOn(relations, "getRelations").mockReturnValue([
                mkUpdate(mxEvent, [{ updateDataModel: { surfaceId: "main", path: "/name", value: "Eve" } }]),
            ]);

            mxEvent.emit(MatrixEventEvent.RelationsCreated, RelationType.Reference, A2UI_UPDATE_EVENT_TYPE);

            expect(nameField(vm).value).toBe("Eve");
        });

        it("rebuilds when an update is redacted and stops listening on dispose", () => {
            const update = mkUpdate(mxEvent, [
                { updateDataModel: { surfaceId: "main", path: "/name", value: "Carol" } },
            ]);
            const getRelations = vi.spyOn(relations, "getRelations").mockReturnValue([update]);
            const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli, getRelationsForEvent });
            expect(nameField(vm).value).toBe("Carol");

            getRelations.mockReturnValue([]);
            relations.emit(RelationsEvent.Redaction, update);
            expect(nameField(vm).value).toBe("Alice");

            vm.dispose();
            expect(relations.listenerCount(RelationsEvent.Add)).toBe(0);
            expect(mxEvent.listenerCount(MatrixEventEvent.RelationsCreated)).toBe(0);
        });
    });

    it("rebuilds when the message is edited", () => {
        const mxEvent = mkSurfaceEvent();
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent, cli });
        const edit = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: roomId,
            user: agent,
            content: {
                "msgtype": A2UI_MSGTYPE,
                "body": "* edited",
                "m.new_content": {
                    msgtype: A2UI_MSGTYPE,
                    body: "edited",
                    messages: [
                        ...surfaceMessages.slice(0, 2),
                        { version: "v0.9", updateDataModel: { surfaceId: "main", value: { name: "Edited" } } },
                    ],
                },
                "m.relates_to": { rel_type: RelationType.Replace, event_id: mxEvent.getId() },
            },
        });

        mxEvent.makeReplaced(edit);

        expect(nameField(vm).value).toBe("Edited");
    });

    it("exposes media visibility and asks the host to reveal media", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mediaVisible: false, mxEvent: mkSurfaceEvent(), cli });
        expect(vm.getSnapshot().mediaVisible).toBe(false);

        vm.showMedia();
        expect(mediaProps.setMediaVisible).toHaveBeenCalledWith(true);

        const setter = vi.fn();
        vm.setMediaProps(true, setter);
        expect(vm.getSnapshot().mediaVisible).toBe(true);
        vm.showMedia();
        expect(setter).toHaveBeenCalledWith(true);
    });

    it("opens images in the lightbox", () => {
        const createDialog = vi.spyOn(Modal, "createDialog").mockReturnValue({} as never);
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });

        vm.openImage("https://hs/media/pic", "A picture");

        expect(createDialog).toHaveBeenCalledWith(
            ImageView,
            { src: "https://hs/media/pic", name: "A picture" },
            "mx_Dialog_lightbox",
            undefined,
            true,
        );
    });

    it("rebuilds from a replacement event object", () => {
        const vm = new A2UIBodyViewModel({ ...mediaProps, mxEvent: mkSurfaceEvent(), cli });
        const replacement = mkSurfaceEvent([
            ...surfaceMessages.slice(0, 2),
            { version: "v0.9", updateDataModel: { surfaceId: "main", value: { name: "Replaced" } } },
        ]);

        vm.setEvent(replacement);

        expect(nameField(vm).value).toBe("Replaced");
    });
});
