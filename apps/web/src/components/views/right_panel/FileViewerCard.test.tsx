/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { UploadedMedia } from "@element-hq/element-web-module-api";

import type { RegisteredFileViewer } from "../../../modules/FileViewerApi";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { fileViewerOpenButton } from "./FileViewerCard";

describe("fileViewerOpenButton", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens the selected file in the global right-panel file viewer card", () => {
        const setGlobalCard = vi.spyOn(RightPanelStore.instance, "setGlobalCard").mockImplementation(() => {});
        const media = {
            type: "uploaded",
            mimetype: "application/pdf",
            name: "spec.pdf",
            blob: vi.fn(),
        } satisfies UploadedMedia;
        const viewer = {
            match: vi.fn(),
            render: vi.fn(),
            options: {
                id: "io.element.file_viewer.pdf",
                buttonIcon: <span />,
                buttonText: "Open PDF",
                cardHeader: "PDF",
            },
        } satisfies RegisteredFileViewer;
        const mxEvent = {} as MatrixEvent;

        fileViewerOpenButton({ viewer, media, mxEvent }).onClick();

        expect(setGlobalCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.FileViewer,
            state: {
                fileViewer: viewer,
                fileViewerMedia: media,
                fileViewerSourceEvent: mxEvent,
            },
        });
    });
});
