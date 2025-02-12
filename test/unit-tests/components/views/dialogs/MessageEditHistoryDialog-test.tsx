/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, type RenderResult, waitForElementToBeRemoved } from "jest-matrix-react";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { flushPromises, mkMessage, stubClient } from "../../../../test-utils";
import MessageEditHistoryDialog from "../../../../../src/components/views/dialogs/MessageEditHistoryDialog";

describe("<MessageEditHistory />", () => {
    const roomId = "!aroom:example.com";
    let client: jest.Mocked<MatrixClient>;
    let event: MatrixEvent;

    beforeEach(() => {
        client = stubClient() as jest.Mocked<MatrixClient>;
        event = mkMessage({
            event: true,
            user: "@user:example.com",
            room: "!room:example.com",
            msg: "My Great Message",
        });
    });

    async function renderComponent(): Promise<RenderResult> {
        const result = render(<MessageEditHistoryDialog mxEvent={event} onFinished={jest.fn()} />);
        await waitForElementToBeRemoved(() => result.queryByRole("progressbar"));
        await flushPromises();
        return result;
    }

    function mockEdits(...edits: { msg: string; ts?: number }[]) {
        client.relations.mockImplementation(() =>
            Promise.resolve({
                events: edits.map(
                    (e) =>
                        new MatrixEvent({
                            type: EventType.RoomMessage,
                            room_id: roomId,
                            origin_server_ts: e.ts ?? 0,
                            content: {
                                body: e.msg,
                            },
                        }),
                ),
            }),
        );
    }

    it("should match the snapshot", async () => {
        mockEdits({ msg: "My Great Massage", ts: 1234 });

        const { container } = await renderComponent();

        expect(container).toMatchSnapshot();
    });

    it("should support events with", async () => {
        mockEdits(
            { msg: "My Great Massage", ts: undefined },
            { msg: "My Great Massage?", ts: undefined },
            { msg: "My Great Missage", ts: undefined },
        );

        const { container } = await renderComponent();

        expect(container).toMatchSnapshot();
    });
});
