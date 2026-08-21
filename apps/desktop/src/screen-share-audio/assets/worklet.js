/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

class PcmBridgeProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.ring = new Float32Array(9600 * 2);
        this.read = 0;
        this.write = 0;
        this.available = 0;
        this.started = false;
        this.activeSent = false;
        this.port.onmessage = ({ data }) => {
            const pcm = new Int16Array(data);
            const frames = pcm.length / 2;
            if (Number.isInteger(frames) && frames <= 9600 - this.available) {
                for (let i = 0; i < frames; i++) {
                    const at = (this.write + i) % 9600;
                    this.ring[at * 2] = pcm[i * 2] / 32768;
                    this.ring[at * 2 + 1] = pcm[i * 2 + 1] / 32768;
                }
                this.write = (this.write + frames) % 9600;
                this.available += frames;
                if (!this.started && this.available >= 5760) {
                    this.started = true;
                    this.port.postMessage("prebuffer-ready");
                }
            }
            this.port.postMessage("context-running");
        };
    }

    process(_inputs, outputs) {
        const out = outputs[0];
        for (let frame = 0; frame < out[0].length; frame++) {
            if (!this.started || !this.available) {
                out[0][frame] = 0;
                out[1][frame] = 0;
                continue;
            }
            out[0][frame] = this.ring[this.read * 2];
            out[1][frame] = this.ring[this.read * 2 + 1];
            this.read = (this.read + 1) % 9600;
            this.available--;
        }
        if (this.started && !this.activeSent) {
            this.activeSent = true;
            this.port.postMessage("active");
        }
        return true;
    }
}

registerProcessor("pcm-bridge", PcmBridgeProcessor);
