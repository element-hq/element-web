/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

// @vitest-environment happy-dom

import { EventType, MatrixEvent, Room } from "matrix-js-sdk/src/matrix";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen } from "test-utils-rtl";
import React from "react";

import { createTestClient } from "test-utils";
import { MockedPlayback } from "../../../audio/__mocks__";
import { type Playback, PlaybackState } from "../../../audio/Playback";
import { PlaybackManager } from "../../../audio/PlaybackManager";
import type { MediaEventHelper } from "../../../utils/MediaEventHelper";
import MVoiceMessageBody from "./MVoiceMessageBody";
import { PlaybackQueue } from "../../../audio/PlaybackQueue";
import { SDKContextClass } from "../../../contexts/SDKContextClass";

describe("<MVvoiceMessageBody />", () => {
    let event: MatrixEvent;
    beforeEach(() => {
        const playback = new MockedPlayback(PlaybackState.Decoding, 50, 10) as unknown as Playback;
        vi.spyOn(PlaybackManager.instance, "createPlaybackInstance").mockReturnValue(playback);

        const matrixClient = createTestClient();
        const room = new Room("!TESTROOM", matrixClient, "@alice:example.org");
        const playbackQueue = new PlaybackQueue(room, SDKContextClass.instance.roomViewStore);

        vi.spyOn(PlaybackQueue, "forRoom").mockReturnValue(playbackQueue);
        vi.spyOn(playbackQueue, "unsortedEnqueue").mockReturnValue(undefined);

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
