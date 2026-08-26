/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { vi } from "./adapter.ts";

export const mocks = {
    AudioBufferSourceNode: {
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
    } as unknown as AudioBufferSourceNode,
    AudioContext: {
        close: vi.fn(),
        createMediaElementSource: vi.fn(),
        createMediaStreamDestination: vi.fn(),
        createMediaStreamSource: vi.fn(),
        createStreamTrackSource: vi.fn(),
        createBufferSource: vi.fn((): AudioBufferSourceNode => ({ ...mocks.AudioBufferSourceNode })),
        getOutputTimestamp: vi.fn(),
        resume: vi.fn(),
        setSinkId: vi.fn(),
        suspend: vi.fn(),
        decodeAudioData: vi.fn(),
    } as unknown as AudioContext,
};
