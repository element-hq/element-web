window.addEventListener(
    "message",
    async (event) => {
        if (event.source !== window || event.data !== "screen-share-audio-port" || !event.ports[0]) return;
        const port = event.ports[0];
        const stage = (code) => port.postMessage({ type: "stage", code });
        const failed = (code) => port.postMessage({ type: "failed", code });
        stage("port-received");
        let context;
        try {
            context = new AudioContext({ sampleRate: 48000 });
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
        let node;
        try {
            node = new AudioWorkletNode(context, "pcm-bridge", { outputChannelCount: [2] });
            node.connect(context.destination);
            node.onprocessorerror = () => failed("renderer-worklet-node");
            node.port.onmessage = ({ data }) => stage(data);
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
    },
    { once: true },
);
