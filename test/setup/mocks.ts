/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

export const mocks = {
    AudioBufferSourceNode: {
        connect: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
    } as unknown as AudioBufferSourceNode,
    AudioContext: {
        close: jest.fn(),
        createMediaElementSource: jest.fn(),
        createMediaStreamDestination: jest.fn(),
        createMediaStreamSource: jest.fn(),
        createStreamTrackSource: jest.fn(),
        createBufferSource: jest.fn((): AudioBufferSourceNode => ({ ...mocks.AudioBufferSourceNode })),
        getOutputTimestamp: jest.fn(),
        resume: jest.fn(),
        setSinkId: jest.fn(),
        suspend: jest.fn(),
        decodeAudioData: jest.fn(),
    },
};
