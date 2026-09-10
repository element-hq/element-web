/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { Room } from "matrix-js-sdk/src/matrix";
import { fireEvent, render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { LinkedTextContext } from "@element-hq/web-shared-components";
import { mkEvent, stubClient } from "test-utils";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import RoomTopic from "./RoomTopic";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import Modal from "../../../Modal";
import { type ActionPayload } from "../../../dispatcher/payloads";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

vi.mock("../../../dispatcher/dispatcher");

describe("<RoomTopic/>", () => {
    const originalHref = window.location.href;

    afterEach(() => {
        window.location.href = originalHref;
    });

    /**
     * Create a room with the given topic
     * @param topic
     */
    function createRoom(topic: string) {
        stubClient();
        const room = new Room("!pMBteVpcoJRdCJxDmn:matrix.org", MatrixClientPeg.safeGet(), "@alice:example.org");
        const topicEvent = mkEvent({
            type: "m.room.topic",
            room: "!pMBteVpcoJRdCJxDmn:matrix.org",
            user: "@alice:example.org",
            content: { topic },
            ts: 123,
            event: true,
        });
        room.addLiveEvents([topicEvent], { addToState: true });

        return room;
    }

    /**
     * Create a room and render it
     * @param topic
     */
    const renderRoom = (topic: string) => {
        const room = createRoom(topic);
        render(<RoomTopic room={room} />, {
            wrapper: ({ children }) => <LinkedTextContext.Provider value={{}}>{children}</LinkedTextContext.Provider>,
        });
    };

    /**
     * Create a room and click on the given text
     * @param topic
     * @param clickText
     */
    function runClickTest(topic: string, clickText: string) {
        renderRoom(topic);
        fireEvent.click(screen.getByText(clickText));
    }

    it("should capture permalink clicks", () => {
        const permalink =
            "https://matrix.to/#/!pMBteVpcoJRdCJxDmn:matrix.org/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=matrix.org";
        const expectedHref =
            "http://localhost/#/room/!pMBteVpcoJRdCJxDmn:matrix.org/$K4Kg0fL-GKpW1EQ6lS36bP4eUXadWJFkdK_FH73Df8A?via=matrix.org";
        runClickTest(`... ${permalink} ...`, permalink);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledTimes(0);
    });

    it("should not capture non-permalink clicks", () => {
        const link = "https://matrix.org";
        const expectedHref = originalHref;
        runClickTest(`... ${link} ...`, link);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledTimes(0);
    });

    it("should open topic dialog when not clicking a link", () => {
        const topic = "foobar";
        const expectedHref = originalHref;
        runClickTest(topic, topic);
        expect(window.location.href).toEqual(expectedHref);
        expect(dis.fire).toHaveBeenCalledWith(Action.ShowRoomTopic);
    });

    describe("the edit topic button in the topic dialog", () => {
        /**
         * Render the topic, open the topic dialog and render its contents, so the
         * "Edit topic" button can be clicked.
         * @param isSpaceRoom whether the room should report itself as a space
         */
        function renderTopicDialog(isSpaceRoom: boolean) {
            const room = createRoom("a topic");
            vi.spyOn(room, "isSpaceRoom").mockReturnValue(isSpaceRoom);
            vi.spyOn(room.currentState, "maySendStateEvent").mockReturnValue(true);

            const createDialog = vi
                .spyOn(Modal, "createDialog")
                .mockReturnValue({ close: vi.fn() } as unknown as ReturnType<typeof Modal.createDialog>);

            render(<RoomTopic room={room} />, {
                wrapper: ({ children }) => (
                    <MatrixClientContext.Provider value={MatrixClientPeg.safeGet()}>
                        <LinkedTextContext.Provider value={{}}>{children}</LinkedTextContext.Provider>
                    </MatrixClientContext.Provider>
                ),
            });

            // The dispatcher is mocked for this suite, so drive the registered handler directly
            // instead of firing Action.ShowRoomTopic through it.
            const handler = vi.mocked(dis.register).mock.calls.at(-1)![0] as (payload: ActionPayload) => void;
            handler({ action: Action.ShowRoomTopic });

            const { description } = createDialog.mock.calls.at(-1)![1] as { description: React.ReactNode };
            render(
                <LinkedTextContext.Provider value={{}}>
                    <>{description}</>
                </LinkedTextContext.Provider>,
            );

            return room;
        }

        it("opens space settings for a space", () => {
            const room = renderTopicDialog(true);

            fireEvent.click(screen.getByRole("button", { name: "Edit topic" }));

            expect(dis.dispatch).toHaveBeenCalledWith({ action: Action.OpenSpaceSettings, space: room });
            expect(dis.dispatch).not.toHaveBeenCalledWith({ action: "open_room_settings" });
        });

        it("opens room settings for a room", () => {
            renderTopicDialog(false);

            fireEvent.click(screen.getByRole("button", { name: "Edit topic" }));

            expect(dis.dispatch).toHaveBeenCalledWith({ action: "open_room_settings" });
        });
    });

    it("should open the tooltip when hovering a text", async () => {
        const topic = "room topic";
        renderRoom(topic);
        await userEvent.hover(screen.getByText(topic));
        await waitFor(() => expect(screen.getByRole("tooltip", { name: "Click to read topic" })).toBeInTheDocument());
    });

    it("should not open the tooltip when hovering a link", async () => {
        const topic = "https://matrix.org";
        renderRoom(topic);
        await userEvent.hover(screen.getByText(topic));
        await waitFor(() => expect(screen.queryByRole("tooltip", { name: "Click to read topic" })).toBeNull());
    });
});
