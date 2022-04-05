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

import React from 'react';
import { mount } from 'enzyme';
import { mocked } from 'jest-mock';
import { logger } from 'matrix-js-sdk/src/logger';
import { act } from 'react-dom/test-utils';

import RecordingPlayback from '../../../../src/components/views/audio_messages/RecordingPlayback';
import { Playback } from '../../../../src/audio/Playback';
import RoomContext, { TimelineRenderingType } from '../../../../src/contexts/RoomContext';
import { createAudioContext } from '../../../../src/audio/compat';
import { findByTestId, flushPromises } from '../../../test-utils';
import PlaybackWaveform from '../../../../src/components/views/audio_messages/PlaybackWaveform';
import SeekBar from "../../../../src/components/views/audio_messages/SeekBar";

jest.mock('../../../../src/audio/compat', () => ({
    createAudioContext: jest.fn(),
    decodeOgg: jest.fn().mockResolvedValue({}),
}));

describe('<RecordingPlayback />', () => {
    const mockAudioBufferSourceNode = {
        addEventListener: jest.fn(),
        connect: jest.fn(),
        start: jest.fn(),
    };

    const mockAudioContext = {
        decodeAudioData: jest.fn(),
        suspend: jest.fn(),
        resume: jest.fn(),
        currentTime: 0,
        createBufferSource: jest.fn().mockReturnValue(mockAudioBufferSourceNode),
    };

    const mockAudioBuffer = {
        duration: 99,
        getChannelData: jest.fn(),
    };

    const mockChannelData = new Float32Array();

    const defaultRoom = { roomId: '!room:server.org', timelineRenderingType: TimelineRenderingType.File };
    const getComponent = (props: React.ComponentProps<typeof RecordingPlayback>, room = defaultRoom) =>
        mount(<RecordingPlayback {...props} />, {
            wrappingComponent: RoomContext.Provider,
            wrappingComponentProps: { value: room },
        });

    beforeEach(() => {
        jest.spyOn(logger, 'error').mockRestore();
        mockAudioBuffer.getChannelData.mockClear().mockReturnValue(mockChannelData);
        mockAudioContext.decodeAudioData.mockReset().mockImplementation(
            (_b, callback) => callback(mockAudioBuffer),
        );
        mocked(createAudioContext).mockReturnValue(mockAudioContext as unknown as AudioContext);
    });

    const getPlayButton = component => findByTestId(component, 'play-pause-button').at(0);

    it('renders recording playback', () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        expect(component).toBeTruthy();
    });

    it('disables play button while playback is decoding', async () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        expect(getPlayButton(component).props().disabled).toBeTruthy();
    });

    it('enables play button when playback is finished decoding', async () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        await flushPromises();
        component.setProps({});
        expect(getPlayButton(component).props().disabled).toBeFalsy();
    });

    it('displays error when playback decoding fails', async () => {
        // stub logger to keep console clean from expected error
        jest.spyOn(logger, 'error').mockReturnValue(undefined);
        jest.spyOn(logger, 'warn').mockReturnValue(undefined);
        mockAudioContext.decodeAudioData.mockImplementation(
            (_b, _cb, error) => error(new Error('oh no')),
        );
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });
        await flushPromises();
        expect(component.find('.text-warning').length).toBeFalsy();
    });

    it('displays pre-prepared playback with correct playback phase', async () => {
        const playback = new Playback(new ArrayBuffer(8));
        await playback.prepare();
        const component = getComponent({ playback });
        // playback already decoded, button is not disabled
        expect(getPlayButton(component).props().disabled).toBeFalsy();
        expect(component.find('.text-warning').length).toBeFalsy();
    });

    it('toggles playback on play pause button click', async () => {
        const playback = new Playback(new ArrayBuffer(8));
        jest.spyOn(playback, 'toggle').mockResolvedValue(undefined);
        await playback.prepare();
        const component = getComponent({ playback });

        act(() => {
            getPlayButton(component).simulate('click');
        });

        expect(playback.toggle).toHaveBeenCalled();
    });

    it('should render a seek bar by default', () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback });

        expect(component.find(PlaybackWaveform).length).toBeFalsy();
        expect(component.find(SeekBar).length).toBeTruthy();
    });

    it('should render a waveform when requested', () => {
        const playback = new Playback(new ArrayBuffer(8));
        const component = getComponent({ playback, withWaveform: true });

        expect(component.find(PlaybackWaveform).length).toBeTruthy();
        expect(component.find(SeekBar).length).toBeFalsy();
    });
});
