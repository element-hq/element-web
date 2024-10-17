/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, RenderResult, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mocked } from "jest-mock";
import { MatrixClient, RelationType } from "matrix-js-sdk/src/matrix";

import { textForVoiceBroadcastStoppedEvent, VoiceBroadcastInfoState } from "../../../src/voice-broadcast";
import { stubClient } from "../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "./test-utils";
import dis from "../../../src/dispatcher/dispatcher";
import { Action } from "../../../src/dispatcher/actions";

jest.mock("../../../src/dispatcher/dispatcher");

describe("textForVoiceBroadcastStoppedEvent", () => {
    const otherUserId = "@other:example.com";
    const roomId = "!room:example.com";
    let client: MatrixClient;

    const renderText = (senderId: string, startEventId?: string) => {
        const event = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Stopped,
            senderId,
            client.deviceId!,
        );

        if (startEventId) {
            event.getContent()["m.relates_to"] = {
                rel_type: RelationType.Reference,
                event_id: startEventId,
            };
        }

        return render(<div>{textForVoiceBroadcastStoppedEvent(event, client)()}</div>);
    };

    beforeEach(() => {
        client = stubClient();
    });

    it("should render own broadcast as expected", () => {
        expect(renderText(client.getUserId()!).container).toMatchSnapshot();
    });

    it("should render other users broadcast as expected", () => {
        expect(renderText(otherUserId).container).toMatchSnapshot();
    });

    it("should render without login as expected", () => {
        mocked(client.getUserId).mockReturnValue(null);
        expect(renderText(otherUserId).container).toMatchSnapshot();
    });

    describe("when rendering an event with relation to the start event", () => {
        let result: RenderResult;

        beforeEach(() => {
            result = renderText(client.getUserId()!, "$start-id");
        });

        it("should render events with relation to the start event", () => {
            expect(result.container).toMatchSnapshot();
        });

        describe("and clicking the link", () => {
            beforeEach(async () => {
                await userEvent.click(screen.getByRole("button"));
            });

            it("should dispatch an action to highlight the event", () => {
                expect(dis.dispatch).toHaveBeenCalledWith({
                    action: Action.ViewRoom,
                    event_id: "$start-id",
                    highlighted: true,
                    room_id: roomId,
                    metricsTrigger: undefined, // room doesn't change
                });
            });
        });
    });
});
