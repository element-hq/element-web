/*
Copyright 2026 foxberries

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// Uniform render quantum as defined by: https://www.w3.org/TR/webaudio-1.1/#rendering-loop
const RENDER_QUANTUM = 128;

/**
 * A queue-based audio processor to feed chunks into the audio renderer.
 *
 * This is for use with Audiofox, and is a TS variant of the processor
 * implementation it provides. It can handle variable-length chunks
 * efficiently and without unnecessarily copying the audio data.
 *
 * This is important because the system-level audio callback buffer size
 * is not guaranteed to be RENDER_QUANTUM; this is only provied by
 * AudioWorkletProcessor, given the lack of an alternative, heeded-to
 * rendererSizeHint.
 */
class AudioProcessor extends AudioWorkletProcessor {
    private queue: Float32Array[];
    private queueIdx: number;
    private idx: number;

    public constructor() {
        super();
        this.queue = [];
        this.queueIdx = 0;
        this.idx = 0;

        this.port.onmessage = (event) => {
            this.queue.push(event.data);
        };
    }

    public process(
        _inputs: Float32Array[][],
        outputs: Float32Array[][],
        _parameters: Record<string, Float32Array>,
    ): boolean {
        const outputL = outputs[0][0];
        const outputR = outputs[0][1];

        let i = 0;
        while (i < RENDER_QUANTUM && this.queueIdx < this.queue.length) {
            const chunk = this.queue[this.queueIdx];

            while (i < RENDER_QUANTUM && this.idx < chunk.length) {
                outputL[i] = chunk[this.idx++];
                outputR[i] = chunk[this.idx++];
                i++;
            }

            if (this.idx >= chunk.length) {
                this.queueIdx++;
                this.idx = 0;
            }
        }

        return true;
    }
}

registerProcessor("audiofox", AudioProcessor);

export default "";
