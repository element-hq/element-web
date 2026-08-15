/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    bridgePreparationFailures,
    bridgePreparationStages,
    isBridgePreparationFailure,
    isBridgePreparationStage,
    latchBridgePreparationFailure,
    portCloseFailure,
    validatePcmPacket,
} from "./bridge.js";

const assetsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), "assets");

describe("screen-share audio bridge transport", () => {
    afterEach(() => vi.useRealTimers());

    it("accepts only the fixed sanitized preparation stage and failure codes", () => {
        expect(bridgePreparationStages).toEqual([
            "window-created",
            "document-loaded",
            "port-posted",
            "port-received",
            "audio-context-created",
            "worklet-loaded",
            "worklet-node-created",
            "context-running",
            "capture-started",
            "prebuffer-ready",
            "active",
        ]);
        expect(bridgePreparationFailures).toEqual([
            "document-load",
            "port-ready-timeout",
            "renderer-audio-context",
            "renderer-worklet-load",
            "renderer-worklet-node",
            "renderer-context-resume",
            "renderer-protocol",
            "port-closed",
            "renderer-gone",
            "capture-start",
            "capture-terminal",
            "prebuffer-timeout",
            "aborted",
        ]);
        expect(bridgePreparationStages.every(isBridgePreparationStage)).toBe(true);
        expect(bridgePreparationFailures.every(isBridgePreparationFailure)).toBe(true);
        expect(isBridgePreparationStage("unknown")).toBe(false);
        expect(isBridgePreparationFailure({ code: "document-load" })).toBe(false);
        expect(isBridgePreparationFailure("renderer-protocol")).toBe(true);
    });

    it("latches the first causal failure and ignores a deliberate port close", () => {
        const first = latchBridgePreparationFailure(null, "renderer-worklet-load");
        expect(latchBridgePreparationFailure(first, "port-closed")).toBe("renderer-worklet-load");
        expect(portCloseFailure(false)).toBe("port-closed");
        expect(portCloseFailure(true)).toBeNull();
    });

    it("accepts only aligned, continuous stereo PCM16 packets", () => {
        expect(validatePcmPacket({ sequence: 0, startFrame: 0, data: new ArrayBuffer(1_920) }, 0, 0)).toBe(480);
        expect(validatePcmPacket({ sequence: 2, startFrame: 0, data: new ArrayBuffer(1_920) }, 0, 0)).toBe(0);
        expect(validatePcmPacket({ sequence: 0, startFrame: 2, data: new ArrayBuffer(1_920) }, 0, 0)).toBe(0);
        expect(validatePcmPacket({ sequence: 0, startFrame: 0, data: new ArrayBuffer(7) }, 0, 0)).toBe(0);
    });

    it("uses the fixed 9,600-frame stereo ring without shifting or allocating in process", () => {
        const workletSource = fs.readFileSync(path.join(assetsDirectory, "worklet.js"), "utf8");
        expect(workletSource).toContain("new Float32Array(9600 * 2)");
        expect(workletSource).not.toContain(".shift(");
        const processBody = workletSource.slice(workletSource.indexOf("process(inputs"));
        expect(processBody).not.toMatch(/\bnew\s/);
    });

    it("uses file-backed bridge assets with an external script and worklet", () => {
        const documentSource = fs.readFileSync(path.join(assetsDirectory, "bridge.html"), "utf8");
        const rendererSource = fs.readFileSync(path.join(assetsDirectory, "bridge.js"), "utf8");
        expect(documentSource).toContain("Content-Security-Policy");
        expect(documentSource).toContain('src="bridge.js"');
        expect(documentSource).not.toMatch(/<script(?![^>]*\bsrc=)/);
        expect(rendererSource).toContain('audioWorklet.addModule("./worklet.js")');
        expect(`${documentSource}\n${rendererSource}`).not.toMatch(/\b(?:data:|Blob\b)/);
    });

    it("keeps every supported active bridge failure connected to the terminal signal", () => {
        const bridgeSource = fs.readFileSync(fileURLToPath(new URL("./bridge.ts", import.meta.url)), "utf8");
        expect(bridgeSource).toContain('this.port.once("close"');
        expect(bridgeSource).toContain('this.window.once("closed", this.bridgeGoneListener)');
        expect(bridgeSource).toContain('this.window.webContents.once("render-process-gone", this.bridgeGoneListener)');
        expect(bridgeSource).toContain('this.capture.onTerminal(() => failPreparation("capture-terminal"))');
        expect(bridgeSource).toContain("this.terminal.resolve()");
        expect(bridgeSource).toContain('data.type === "failed"');
    });
});
