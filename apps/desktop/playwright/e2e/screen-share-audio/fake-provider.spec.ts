/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import type { ElectronApplication } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { test, expect } from "../../element-desktop-test.js";

const auditProperty = "__elementScreenShareAudioFakeAudit_9f8c24f1";

async function mainAudit(app: ElectronApplication): Promise<any> {
    return app.evaluate(({ app, BrowserWindow }, property) => {
        const audit = (app as any)[property];
        if (typeof audit !== "function") throw new Error("Screen-share audio fake audit is unavailable");
        return { ...audit(), windows: BrowserWindow.getAllWindows().length };
    }, auditProperty);
}

test.describe("Windows screen-share audio fake provider", () => {
    test.skip(process.platform !== "win32", "The fake product seam is Windows-only");
    test.use({ extraEnv: { ELEMENT_SCREEN_SHARE_AUDIO_FAKE_PROVIDER: "1" } });

    test("returns non-silent ScreenShareAudio and releases all main-owned resources", async ({
        app,
        page,
    }, testInfo) => {
        await page.locator("#matrixchat").waitFor();
        await page.waitForFunction(
            () => (window as any).mxPlatformPeg?.get()?.getHumanReadableName?.() === "Electron Platform",
            undefined,
            { timeout: 5_000 },
        );
        const baseline = await mainAudit(app);
        expect(baseline.controller.state).toBe("Idle");
        const evidence: Record<string, unknown> = { baseline };
        const evidencePath = testInfo.outputPath("screen-share-audio-evidence.json");
        let postCaptureAudit: any = null;

        await page.evaluate(() => {
            const button = document.createElement("button");
            button.id = "screen-share-audio-smoke-trigger";
            button.textContent = "Start screen-share audio smoke";
            button.onclick = (): void => {
                (window as any).screenShareAudioSmokeState = {
                    clickHandled: true,
                    gdmInvoked: false,
                    settled: false,
                    errorName: null,
                };
                (window as any).screenShareAudioSmoke = (async () => {
                    try {
                        (window as any).screenShareAudioSmokeState.gdmInvoked = true;
                        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                        (window as any).screenShareAudioSmokeStream = stream;
                        const audioTrack = stream.getAudioTracks()[0];
                        const videoTrack = stream.getVideoTracks()[0];
                        if (!videoTrack) throw new Error("Display media did not return video");
                        let audioReadyState: string | null = null;
                        let maxRms = 0;
                        if (audioTrack) {
                            audioReadyState = audioTrack.readyState;
                            const context = new AudioContext({ sampleRate: 48_000 });
                            const analyser = context.createAnalyser();
                            analyser.fftSize = 2_048;
                            const source = context.createMediaStreamSource(new MediaStream([audioTrack]));
                            source.connect(analyser);
                            (window as any).screenShareAudioSmokeAudio = { context, source, analyser };
                            await context.resume();
                            const samples = new Float32Array(analyser.fftSize);
                            for (let attempt = 0; attempt < 20; attempt++) {
                                await new Promise((resolve) => setTimeout(resolve, 50));
                                analyser.getFloatTimeDomainData(samples);
                                const rms = Math.sqrt(
                                    samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length,
                                );
                                maxRms = Math.max(maxRms, rms);
                            }
                        }
                        return {
                            audioTracks: stream.getAudioTracks().length,
                            videoTracks: stream.getVideoTracks().length,
                            audioReadyState,
                            maxRms,
                        };
                    } catch (error) {
                        (window as any).screenShareAudioSmokeState.errorName =
                            error instanceof DOMException || error instanceof Error ? error.name : "Unknown";
                        throw error;
                    } finally {
                        (window as any).screenShareAudioSmokeState.settled = true;
                    }
                })();
            };
            document.body.append(button);
        });

        try {
            await page.locator("#screen-share-audio-smoke-trigger").click();
            let requestAudit = baseline;
            await expect
                .poll(
                    async () => {
                        requestAudit = await mainAudit(app);
                        return requestAudit.controller.lastRequestId;
                    },
                    { timeout: 5_000 },
                )
                .toBe(baseline.controller.lastRequestId + 1);
            const rendererAfterClick = await page.evaluate(() => (window as any).screenShareAudioSmokeState);
            evidence.rendererAfterClick = rendererAfterClick;
            evidence.requestAudit = requestAudit;
            await testInfo.attach("screen-share-audio-after-click", {
                body: JSON.stringify({ renderer: rendererAfterClick, main: requestAudit }),
                contentType: "application/json",
            });

            const picker = page.locator(".mx_desktopCapturerSourcePicker");
            await picker.waitFor({ timeout: 5_000 });
            await picker.locator(".mx_desktopCapturerSourcePicker_source").first().click();
            await picker.getByRole("button", { name: "Share", exact: true }).click();

            const media = await page.evaluate(() => (window as any).screenShareAudioSmoke);
            postCaptureAudit = await mainAudit(app);
            evidence.media = media;
            evidence.postCaptureAudit = postCaptureAudit;
            await writeFile(evidencePath, JSON.stringify(evidence));
            await testInfo.attach("screen-share-audio-audit", {
                body: JSON.stringify(postCaptureAudit),
                contentType: "application/json",
            });
            expect(
                media,
                JSON.stringify({
                    media,
                    bridge: postCaptureAudit.bridge,
                    controller: postCaptureAudit.controller,
                    fake: postCaptureAudit.fake,
                }),
            ).toMatchObject({ audioTracks: 1, videoTracks: 1, audioReadyState: "live" });
            expect(media.maxRms).toBeGreaterThan(0.01);

            const stoppedStates = await page.evaluate(async () => {
                const audio = (window as any).screenShareAudioSmokeAudio as
                    | { context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode }
                    | undefined;
                audio?.source.disconnect();
                audio?.analyser.disconnect();
                await audio?.context.close();
                const stream = (window as any).screenShareAudioSmokeStream as MediaStream;
                stream.getTracks().forEach((track) => track.stop());
                const states = stream.getTracks().map((track) => ({ kind: track.kind, readyState: track.readyState }));
                delete (window as any).screenShareAudioSmokeAudio;
                delete (window as any).screenShareAudioSmokeStream;
                delete (window as any).screenShareAudioSmoke;
                document.querySelector("#screen-share-audio-smoke-trigger")?.remove();
                return states;
            });
            evidence.stoppedStates = stoppedStates;
            await writeFile(evidencePath, JSON.stringify(evidence));

            await expect
                .poll(
                    async () => {
                        const current = await mainAudit(app);
                        return {
                            controller: current.controller,
                            bridge: {
                                bridgeWindows: current.bridge.bridgeWindows,
                                messagePorts: current.bridge.messagePorts,
                                timers: current.bridge.timers,
                                lastStage: current.bridge.lastStage,
                                lastFailure: current.bridge.lastFailure,
                            },
                            fake: current.fake,
                            windows: current.windows,
                        };
                    },
                    { timeout: 5_000 },
                )
                .toEqual({
                    controller: {
                        state: "Idle",
                        activeRequests: 0,
                        activeCaptures: 0,
                        activeBridges: 0,
                        completedCallbacks: baseline.controller.completedCallbacks + 1,
                        lastRequestId: baseline.controller.lastRequestId + 1,
                    },
                    bridge: {
                        bridgeWindows: 0,
                        messagePorts: 0,
                        timers: 0,
                        lastStage: "active",
                        lastFailure: null,
                    },
                    fake: { captures: 0, timers: 0 },
                    windows: baseline.windows,
                });
            evidence.stoppedAudit = await mainAudit(app);
            await writeFile(evidencePath, JSON.stringify(evidence));
        } finally {
            const renderer = await page
                .evaluate(async () => {
                    const audio = (window as any).screenShareAudioSmokeAudio as
                        | { context: AudioContext; source: MediaStreamAudioSourceNode; analyser: AnalyserNode }
                        | undefined;
                    audio?.source.disconnect();
                    audio?.analyser.disconnect();
                    await audio?.context.close().catch(() => {});
                    const stream = (window as any).screenShareAudioSmokeStream as MediaStream | undefined;
                    stream?.getTracks().forEach((track) => track.stop());
                    const stoppedStates = stream?.getTracks().map((track) => ({
                        kind: track.kind,
                        readyState: track.readyState,
                    }));
                    delete (window as any).screenShareAudioSmokeAudio;
                    delete (window as any).screenShareAudioSmokeStream;
                    delete (window as any).screenShareAudioSmoke;
                    document.querySelector("#screen-share-audio-smoke-trigger")?.remove();
                    return { state: (window as any).screenShareAudioSmokeState, stoppedStates };
                })
                .catch((): null => null);
            const main = await mainAudit(app).catch((): null => null);
            evidence.final = { renderer, main };
            await writeFile(evidencePath, JSON.stringify(evidence));
            await testInfo.attach("screen-share-audio-final", {
                body: JSON.stringify({ renderer, main }),
                contentType: "application/json",
            });
        }
    });
});
