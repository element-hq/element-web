/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { Feature, ServerSupport } from "matrix-js-sdk/src/feature";
import { MatrixClient, MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { flushPromises, mkEvent, stubClient } from "../../../test-utils";
import { mkVoiceBroadcastInfoStateEvent } from "../../../voice-broadcast/utils/test-utils";
import { VoiceBroadcastInfoState } from "../../../../src/voice-broadcast";
import { createRedactEventDialog } from "../../../../src/components/views/dialogs/ConfirmRedactDialog";

describe("ConfirmRedactDialog", () => {
    const roomId = "!room:example.com";
    let client: MatrixClient;
    let mxEvent: MatrixEvent;

    const setUpVoiceBroadcastStartedEvent = () => {
        mxEvent = mkVoiceBroadcastInfoStateEvent(
            roomId,
            VoiceBroadcastInfoState.Started,
            client.getUserId()!,
            client.deviceId!,
        );
    };

    const confirmDeleteVoiceBroadcastStartedEvent = async () => {
        createRedactEventDialog({ mxEvent });
        // double-flush promises required for the dialog to show up
        await flushPromises();
        await flushPromises();

        await userEvent.click(screen.getByTestId("dialog-primary-button"));
    };

    beforeEach(() => {
        client = stubClient();
    });

    it("should raise an error for an event without ID", async () => {
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: roomId,
            content: {},
            user: client.getSafeUserId(),
        });
        jest.spyOn(mxEvent, "getId").mockReturnValue(undefined);
        expect(async () => {
            await confirmDeleteVoiceBroadcastStartedEvent();
        }).rejects.toThrow("cannot redact event without ID");
    });

    it("should raise an error for an event without room-ID", async () => {
        mxEvent = mkEvent({
            event: true,
            type: "m.room.message",
            room: roomId,
            content: {},
            user: client.getSafeUserId(),
        });
        jest.spyOn(mxEvent, "getRoomId").mockReturnValue(undefined);
        expect(async () => {
            await confirmDeleteVoiceBroadcastStartedEvent();
        }).rejects.toThrow(`cannot redact event ${mxEvent.getId()} without room ID`);
    });

    describe("when redacting a voice broadcast started event", () => {
        beforeEach(() => {
            setUpVoiceBroadcastStartedEvent();
        });

        describe("and the server does not support relation based redactions", () => {
            beforeEach(() => {
                client.canSupport.set(Feature.RelationBasedRedactions, ServerSupport.Unsupported);
            });

            describe("and displaying and confirm the dialog for a voice broadcast", () => {
                beforeEach(async () => {
                    await confirmDeleteVoiceBroadcastStartedEvent();
                });

                it("should call redact without `with_rel_types`", () => {
                    expect(client.redactEvent).toHaveBeenCalledWith(roomId, mxEvent.getId(), undefined, {});
                });
            });
        });

        describe("and the server supports relation based redactions", () => {
            beforeEach(() => {
                client.canSupport.set(Feature.RelationBasedRedactions, ServerSupport.Unstable);
            });

            describe("and displaying and confirm the dialog for a voice broadcast", () => {
                beforeEach(async () => {
                    await confirmDeleteVoiceBroadcastStartedEvent();
                });

                it("should call redact with `with_rel_types`", () => {
                    expect(client.redactEvent).toHaveBeenCalledWith(roomId, mxEvent.getId(), undefined, {
                        with_rel_types: [RelationType.Reference],
                    });
                });
            });
        });
    });
});
