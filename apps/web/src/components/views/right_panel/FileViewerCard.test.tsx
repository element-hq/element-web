/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { FileViewerProps, MediaHandle } from "@element-hq/element-web-module-api";

import { FileViewerCard, fileViewerOpenButton } from "./FileViewerCard";
import { type RegisteredFileViewer } from "../../../modules/FileViewerApi";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import type RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { clientAndSDKContextRenderOptions, stubClient, TestSDKContext } from "../../../test/test-utils";

const MEDIA: MediaHandle = { type: "uploaded", name: "spec.pdf", mimetype: "application/pdf", blob: vi.fn() };

function mkViewer(render: (props: FileViewerProps) => React.JSX.Element): RegisteredFileViewer {
    return {
        match: () => true,
        render,
        options: {
            id: "test-viewer",
            cardHeader: (media) => (media.type === "uploaded" ? `Viewing ${media.name}` : "Viewing link"),
            buttonText: "Open in test viewer",
            buttonIcon: <span />,
        },
    };
}

describe("FileViewerCard", () => {
    let client: MatrixClient;
    let sdkContext: TestSDKContext;

    beforeEach(() => {
        client = stubClient();
        sdkContext = new TestSDKContext();
        sdkContext._client = client;
    });

    it("titles the card from the viewer and renders the viewer for the media", async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();
        const viewer = mkViewer(({ media, onClose }) => (
            <button onClick={onClose}>{media.type === "uploaded" ? `Rendering ${media.name}` : ""}</button>
        ));

        render(
            <FileViewerCard viewer={viewer} media={MEDIA} onClose={onClose} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(screen.getByRole("heading", { name: "Viewing spec.pdf" })).toBeInTheDocument();

        // The viewer is handed a callback that closes its own card.
        await user.click(screen.getByRole("button", { name: "Rendering spec.pdf" }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("keeps the card usable when the viewer fails to render", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const CrashingViewer = (): React.JSX.Element => {
            throw new Error("viewer crashed");
        };
        const viewer = mkViewer(() => <CrashingViewer />);

        render(
            <FileViewerCard viewer={viewer} media={MEDIA} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(screen.getByRole("heading", { name: "Viewing spec.pdf" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Something went wrong!" })).toBeInTheDocument();
    });
});

describe("fileViewerOpenButton", () => {
    it("labels the button from the viewer and opens the viewer card when clicked", () => {
        const viewer = mkViewer(() => <></>);
        const mxEvent = { getId: () => "$file" } as unknown as MatrixEvent;
        const rightPanelStore = { setCard: vi.fn() } as unknown as RightPanelStore;

        const button = fileViewerOpenButton({ viewer, media: MEDIA, mxEvent, rightPanelStore });

        expect(button.label).toBe("Open in test viewer");
        expect(button.icon).toBe(viewer.options.buttonIcon);

        button.onClick();

        expect(rightPanelStore.setCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.FileViewer,
            state: { fileViewer: viewer, fileViewerMedia: MEDIA, fileViewerSourceEvent: mxEvent },
        });
    });
});
