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

import React from "react";
import { mount } from "enzyme";
import { act } from "react-dom/test-utils";
import { mocked } from "jest-mock";

import { stubClient, mkStubRoom, wrapInMatrixClientContext } from "../../../test-utils";
import { stubVoiceChannelStore } from "../../../test-utils/voice";
import _VoiceChannelRadio from "../../../../src/components/views/voip/VoiceChannelRadio";
import VoiceChannelStore from "../../../../src/stores/VoiceChannelStore";
import DMRoomMap from "../../../../src/utils/DMRoomMap";
import { MatrixClientPeg } from "../../../../src/MatrixClientPeg";

const VoiceChannelRadio = wrapInMatrixClientContext(_VoiceChannelRadio);

describe("VoiceChannelRadio", () => {
    const cli = mocked(MatrixClientPeg.get());
    const room = mkStubRoom("!1:example.org", "voice channel", cli);
    room.isCallRoom = () => true;

    beforeEach(() => {
        stubClient();
        stubVoiceChannelStore();
        DMRoomMap.makeShared();
    });

    it("shows when connecting voice", async () => {
        const radio = mount(<VoiceChannelRadio />);
        expect(radio.children().children().exists()).toEqual(false);

        act(() => { VoiceChannelStore.instance.connect("!1:example.org"); });
        radio.update();
        expect(radio.children().children().exists()).toEqual(true);
    });

    it("hides when disconnecting voice", () => {
        VoiceChannelStore.instance.connect("!1:example.org");
        const radio = mount(<VoiceChannelRadio />);
        expect(radio.children().children().exists()).toEqual(true);

        act(() => { VoiceChannelStore.instance.disconnect(); });
        radio.update();
        expect(radio.children().children().exists()).toEqual(false);
    });

    describe("disconnect button", () => {
        it("works", () => {
            VoiceChannelStore.instance.connect("!1:example.org");
            const radio = mount(<VoiceChannelRadio />);

            act(() => {
                radio.find("AccessibleButton.mx_VoiceChannelRadio_disconnectButton").simulate("click");
            });
            expect(VoiceChannelStore.instance.disconnect).toHaveBeenCalled();
        });
    });

    describe("video button", () => {
        it("works", () => {
            VoiceChannelStore.instance.connect("!1:example.org");
            const radio = mount(<VoiceChannelRadio />);

            act(() => {
                radio.find("AccessibleButton.mx_VoiceChannelRadio_videoButton").simulate("click");
            });
            expect(VoiceChannelStore.instance.unmuteVideo).toHaveBeenCalled();

            act(() => {
                radio.find("AccessibleButton.mx_VoiceChannelRadio_videoButton").simulate("click");
            });
            expect(VoiceChannelStore.instance.muteVideo).toHaveBeenCalled();
        });
    });

    describe("audio button", () => {
        it("works", () => {
            VoiceChannelStore.instance.connect("!1:example.org");
            const radio = mount(<VoiceChannelRadio />);

            act(() => {
                radio.find("AccessibleButton.mx_VoiceChannelRadio_audioButton").simulate("click");
            });
            expect(VoiceChannelStore.instance.unmuteAudio).toHaveBeenCalled();

            act(() => {
                radio.find("AccessibleButton.mx_VoiceChannelRadio_audioButton").simulate("click");
            });
            expect(VoiceChannelStore.instance.muteAudio).toHaveBeenCalled();
        });
    });
});
