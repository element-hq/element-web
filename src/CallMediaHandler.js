/*
 Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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

import SettingsStore from "./settings/SettingsStore";
import {SettingLevel} from "./settings/SettingLevel";
import {setMatrixCallAudioInput, setMatrixCallVideoInput} from "matrix-js-sdk/src/matrix";

export default {
    hasAnyLabeledDevices: async function() {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.some(d => !!d.label);
    },

    getDevices: function() {
        // Only needed for Electron atm, though should work in modern browsers
        // once permission has been granted to the webapp
        return navigator.mediaDevices.enumerateDevices().then(function(devices) {
            const audiooutput = [];
            const audioinput = [];
            const videoinput = [];

            devices.forEach((device) => {
                switch (device.kind) {
                    case 'audiooutput': audiooutput.push(device); break;
                    case 'audioinput': audioinput.push(device); break;
                    case 'videoinput': videoinput.push(device); break;
                }
            });

            // console.log("Loaded WebRTC Devices", mediaDevices);
            return {
                audiooutput,
                audioinput,
                videoinput,
            };
        }, (error) => { console.log('Unable to refresh WebRTC Devices: ', error); });
    },

    loadDevices: function() {
        const audioDeviceId = SettingsStore.getValue("webrtc_audioinput");
        const videoDeviceId = SettingsStore.getValue("webrtc_videoinput");

        setMatrixCallAudioInput(audioDeviceId);
        setMatrixCallVideoInput(videoDeviceId);
    },

    setAudioOutput: function(deviceId) {
        SettingsStore.setValue("webrtc_audiooutput", null, SettingLevel.DEVICE, deviceId);
    },

    setAudioInput: function(deviceId) {
        SettingsStore.setValue("webrtc_audioinput", null, SettingLevel.DEVICE, deviceId);
        setMatrixCallAudioInput(deviceId);
    },

    setVideoInput: function(deviceId) {
        SettingsStore.setValue("webrtc_videoinput", null, SettingLevel.DEVICE, deviceId);
        setMatrixCallVideoInput(deviceId);
    },

    getAudioOutput: function() {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audiooutput");
    },

    getAudioInput: function() {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_audioinput");
    },

    getVideoInput: function() {
        return SettingsStore.getValueAt(SettingLevel.DEVICE, "webrtc_videoinput");
    },
};
