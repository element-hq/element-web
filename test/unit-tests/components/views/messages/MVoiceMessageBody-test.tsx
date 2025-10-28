/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { act, render, screen } from "jest-matrix-react";
import React from "react";

import { MockedPlayback } from "../../../audio/MockedPlayback";
import { type Playback, PlaybackState } from "../../../../../src/audio/Playback";
import { PlaybackManager } from "../../../../../src/audio/PlaybackManager";
import type { MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";
import MVoiceMessageBody from "../../../../../src/components/views/messages/MVoiceMessageBody";
import { PlaybackQueue } from "../../../../../src/audio/PlaybackQueue";
import { createTestClient } from "../../../../test-utils";

describe("<MVvoiceMessageBody />", () => {
    let event: MatrixEvent;
    beforeEach(() => {
        const playback = new MockedPlayback(PlaybackState.Decoding, 50, 10) as unknown as Playback;
        jest.spyOn(PlaybackManager.instance, "createPlaybackInstance").mockReturnValue(playback);

        const matrixClient = createTestClient();
        const room = new Room("!TESTROOM", matrixClient, "@alice:example.org");
        const playbackQueue = new PlaybackQueue(room);

        jest.spyOn(PlaybackQueue, "forRoom").mockReturnValue(playbackQueue);
        jest.spyOn(playbackQueue, "unsortedEnqueue").mockReturnValue(undefined);

        event = new MatrixEvent({
            room_id: "!room:server",
            sender: "@alice.example.org",
            type: EventType.RoomMessage,
            content: {
                "body": "audio name ",
                "msgtype": "m.audio",
                "url": "mxc://server/audio",
                "org.matrix.msc3946.voice": true,
            },
        });
    });

    it("should render", async () => {
        const mediaEventHelper = {
            sourceBlob: {
                value: {
                    arrayBuffer: () => new ArrayBuffer(8),
                },
            },
        } as unknown as MediaEventHelper;

        await act(() => render(<MVoiceMessageBody mxEvent={event} mediaEventHelper={mediaEventHelper} />));
        expect(await screen.findByTestId("recording-playback")).toBeInTheDocument();
    });
});
