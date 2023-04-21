/*
Copyright 2023 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";
import { render, RenderResult } from "@testing-library/react";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";

import type { MatrixClient } from "matrix-js-sdk/src/matrix";
import { flushPromises, mkMessage, stubClient } from "../../../test-utils";
import MessageEditHistoryDialog from "../../../../src/components/views/dialogs/MessageEditHistoryDialog";

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
                            origin_server_ts: e.ts,
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
