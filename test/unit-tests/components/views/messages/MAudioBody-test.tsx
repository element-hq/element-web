/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { EventType, MatrixEvent } from "matrix-js-sdk/src/matrix";
import { render, screen, act } from "jest-matrix-react";

import { MockedPlayback } from "../../../audio/MockedPlayback";
import { type Playback, PlaybackState } from "../../../../../src/audio/Playback";
import MAudioBody from "../../../../../src/components/views/messages/MAudioBody";
import { PlaybackManager } from "../../../../../src/audio/PlaybackManager";
import { type MediaEventHelper } from "../../../../../src/utils/MediaEventHelper";

describe("<MAudioBody />", () => {
    let event: MatrixEvent;
    beforeEach(() => {
        const playback = new MockedPlayback(PlaybackState.Decoding, 50, 10) as unknown as Playback;
        jest.spyOn(PlaybackManager.instance, "createPlaybackInstance").mockReturnValue(playback);

        event = new MatrixEvent({
            room_id: "!room:server",
            sender: "@alice.example.org",
            type: EventType.RoomMessage,
            content: {
                body: "audio name ",
                msgtype: "m.audio",
                url: "mxc://server/audio",
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

        await act(() => render(<MAudioBody mxEvent={event} mediaEventHelper={mediaEventHelper} />));
        expect(await screen.findByRole("region", { name: "Audio player" })).toBeInTheDocument();
    });
});
