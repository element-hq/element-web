/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ipcRenderer } from "electron";

interface BridgeAudioContext {
    audioWorklet: { addModule(url: string): Promise<void> };
    destination: unknown;
    resume(): Promise<void>;
}

interface BridgeAudioWorkletNode {
    connect(destination: unknown): void;
    onprocessorerror: (() => void) | null;
    port: {
        onmessage: ((event: { data: string }) => void) | null;
        postMessage(message: ArrayBuffer, transfer: ArrayBuffer[]): void;
    };
}

const bridgeGlobals = globalThis as unknown as {
    AudioContext: new (options: { sampleRate: number }) => BridgeAudioContext;
    AudioWorkletNode: new (
        context: BridgeAudioContext,
        name: string,
        options: { outputChannelCount: number[] },
    ) => BridgeAudioWorkletNode;
};

ipcRenderer.once("screen-share-audio-port", (event) => {
    const [port] = event.ports;
    if (!port) return;

    const stage = (code: string): void => port.postMessage({ type: "stage", code });
    const failed = (code: string): void => port.postMessage({ type: "failed", code });
    stage("port-received");

    void (async (): Promise<void> => {
        let context: BridgeAudioContext;
        try {
            context = new bridgeGlobals.AudioContext({ sampleRate: 48000 });
            stage("audio-context-created");
        } catch {
            failed("renderer-audio-context");
            return;
        }

        try {
            await context.audioWorklet.addModule("./worklet.js");
            stage("worklet-loaded");
        } catch {
            failed("renderer-worklet-load");
            return;
        }

        let node: BridgeAudioWorkletNode;
        try {
            node = new bridgeGlobals.AudioWorkletNode(context, "pcm-bridge", { outputChannelCount: [2] });
            node.connect(context.destination);
            node.onprocessorerror = () => failed("renderer-worklet-node");
            node.port.onmessage = ({ data }: { data: string }) => stage(data);
            stage("worklet-node-created");
            port.onmessage = ({ data }) => {
                const packet = data?.packet;
                if (
                    data?.type === "pcm" &&
                    Number.isSafeInteger(packet?.sequence) &&
                    Number.isSafeInteger(packet?.startFrame) &&
                    packet.data instanceof ArrayBuffer &&
                    packet.data.byteLength > 0 &&
                    packet.data.byteLength % 4 === 0
                ) {
                    node.port.postMessage(packet.data, [packet.data]);
                } else {
                    failed("renderer-protocol");
                }
            };
        } catch {
            failed("renderer-worklet-node");
            return;
        }

        port.start();
        try {
            await context.resume();
            stage("context-running");
        } catch {
            failed("renderer-context-resume");
        }
    })();
});
