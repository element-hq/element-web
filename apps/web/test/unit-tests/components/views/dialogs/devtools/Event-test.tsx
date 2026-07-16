/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render } from "jest-matrix-react";
import { Room, PendingEventOrdering, EventType, MsgType, MatrixClient, MatrixEvent } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../../../../src/contexts/MatrixClientContext";
import { createTestClient, mkEvent, stubClient } from "../../../../../test-utils";
import { DevtoolsContext } from "../../../../../../src/components/views/dialogs/devtools/BaseTool";
import { TimelineEventEditor } from "../../../../../../src/components/views/dialogs/devtools/Event";

function renderTimelineEventEditor(
    cli: MatrixClient,
    { mxEvent, threadRootId }: { mxEvent?: MatrixEvent; threadRootId?: string } = {},
): ReturnType<typeof render> {
    function Wrapper({ children }: { children: React.ReactNode }): React.ReactNode {
        return (
            <MatrixClientContext.Provider value={cli}>
                <DevtoolsContext.Provider
                    value={{
                        room: new Room("!roomId", cli, "@alice:example.com", {
                            pendingEventOrdering: PendingEventOrdering.Detached,
                        }),
                        threadRootId,
                    }}
                >
                    {children}
                </DevtoolsContext.Provider>
            </MatrixClientContext.Provider>
        );
    }

    return render(<TimelineEventEditor mxEvent={mxEvent} onBack={() => {}} />, { wrapper: Wrapper });
}

describe("<EventEditor />", () => {
    beforeEach(() => {
        stubClient();
    });

    it("should render", () => {
        const cli = createTestClient();
        const { asFragment } = renderTimelineEventEditor(cli);
        expect(asFragment()).toMatchSnapshot();
    });

    it("should preserve the com.beeper.linkpreviews field when editing an event", () => {
        const cli = createTestClient();
        const linkPreviews = [{ "og:title": "Example", "matrix:image:size": 1234, "og:url": "https://example.com" }];
        const mxEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: "!roomId",
            user: "@alice:example.com",
            content: {
                "body": "https://example.com",
                "msgtype": MsgType.Text,
                "com.beeper.linkpreviews": linkPreviews,
            },
        });

        const { getByLabelText } = renderTimelineEventEditor(cli, { mxEvent });
        const content = getByLabelText("Event Content") as HTMLTextAreaElement;
        expect(JSON.parse(content.value)["com.beeper.linkpreviews"]).toEqual(linkPreviews);
    });

    it("should omit the com.beeper.linkpreviews field when the edited event has none", () => {
        const cli = createTestClient();
        const mxEvent = mkEvent({
            event: true,
            type: EventType.RoomMessage,
            room: "!roomId",
            user: "@alice:example.com",
            content: {
                body: "hello world",
                msgtype: MsgType.Text,
            },
        });

        const { getByLabelText } = renderTimelineEventEditor(cli, { mxEvent });
        const content = getByLabelText("Event Content") as HTMLTextAreaElement;
        expect(JSON.parse(content.value)).not.toHaveProperty("com.beeper.linkpreviews");
    });

    describe("thread context", () => {
        it("should pre-populate a thread relationship", () => {
            const cli = createTestClient();
            const { asFragment } = renderTimelineEventEditor(cli, {
                threadRootId: "$this_is_a_thread_id",
            });
            expect(asFragment()).toMatchSnapshot();
        });
    });
});
