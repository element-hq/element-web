/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import type { FileViewerProps, MediaHandle } from "@element-hq/element-web-module-api";

import { FileViewerCard, fileViewerButtonsFor, fileViewerOpenButton } from "./FileViewerCard";
import { type RegisteredFileViewer } from "../../../modules/FileViewerApi";
import { ModuleApi } from "../../../modules/Api";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import type RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { clientAndSDKContextRenderOptions, stubClient, TestSDKContext } from "../../../test/test-utils";

const MEDIA: MediaHandle = { type: "uploaded", name: "spec.pdf", mimetype: "application/pdf", blob: vi.fn() };
const OTHER_MEDIA: MediaHandle = { type: "uploaded", name: "notes.pdf", mimetype: "application/pdf", blob: vi.fn() };

function mkEvent(eventId: string): MatrixEvent {
    return { getId: () => eventId } as unknown as MatrixEvent;
}

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
            <FileViewerCard viewer={viewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={onClose} />,
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
            <FileViewerCard viewer={viewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );

        expect(screen.getByRole("heading", { name: "Viewing spec.pdf" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Something went wrong!" })).toBeInTheDocument();
    });

    it("resets the viewer's state when another file is opened", async () => {
        const user = userEvent.setup();
        const viewer = mkViewer(function PagedViewer() {
            const [page, setPage] = useState(1);
            return <button onClick={() => setPage(page + 1)}>{`Page ${page}`}</button>;
        });

        const { rerender } = render(
            <FileViewerCard viewer={viewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        await user.click(screen.getByRole("button", { name: "Page 1" }));
        expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();

        rerender(<FileViewerCard viewer={viewer} media={OTHER_MEDIA} mxEvent={mkEvent("$other")} onClose={vi.fn()} />);

        expect(screen.getByRole("heading", { name: "Viewing notes.pdf" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Page 1" })).toBeInTheDocument();
    });

    it("switches between viewers that use different hooks", () => {
        const oneHookViewer = mkViewer(function OneHookViewer() {
            const [label] = useState("One hook");
            return <p>{label}</p>;
        });
        const twoHookViewer = mkViewer(function TwoHookViewer() {
            const [first] = useState("Two");
            const [second] = useState("hooks");
            return <p>{`${first} ${second}`}</p>;
        });

        const { rerender } = render(
            <FileViewerCard viewer={oneHookViewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(screen.getByText("One hook")).toBeInTheDocument();

        rerender(<FileViewerCard viewer={twoHookViewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={vi.fn()} />);

        expect(screen.getByText("Two hooks")).toBeInTheDocument();
    });

    it("recovers from a crashed viewer when another file is opened", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        const viewer = mkViewer(({ media }) => {
            if (media.type === "uploaded" && media.name === "spec.pdf") throw new Error("viewer crashed");
            return <p>Viewer working</p>;
        });

        const { rerender } = render(
            <FileViewerCard viewer={viewer} media={MEDIA} mxEvent={mkEvent("$file")} onClose={vi.fn()} />,
            clientAndSDKContextRenderOptions(client, sdkContext),
        );
        expect(screen.getByRole("heading", { name: "Something went wrong!" })).toBeInTheDocument();

        rerender(<FileViewerCard viewer={viewer} media={OTHER_MEDIA} mxEvent={mkEvent("$other")} onClose={vi.fn()} />);

        expect(screen.getByText("Viewer working")).toBeInTheDocument();
    });
});

describe("fileViewerButtonsFor", () => {
    const mxEvent = mkEvent("$file");
    const rightPanelStore = { setCard: vi.fn() } as unknown as RightPanelStore;

    const namedViewer = (buttonText: string): RegisteredFileViewer => {
        const viewer = mkViewer(() => <></>);
        return { ...viewer, options: { ...viewer.options, buttonText } };
    };

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("offers no buttons when there is no media", () => {
        const getViewersFor = vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor");

        expect(fileViewerButtonsFor(undefined, mxEvent, rightPanelStore)).toEqual([]);
        expect(getViewersFor).not.toHaveBeenCalled();
    });

    it("offers one button per viewer that matches the media", () => {
        const first = namedViewer("First");
        const second = namedViewer("Second");
        const getViewersFor = vi.spyOn(ModuleApi.instance.fileViewer, "getViewersFor").mockReturnValue([first, second]);

        const buttons = fileViewerButtonsFor(MEDIA, mxEvent, rightPanelStore);

        expect(getViewersFor).toHaveBeenCalledWith(MEDIA);
        expect(buttons.map((button) => button.label)).toEqual(["First", "Second"]);

        buttons[1].onClick();
        expect(rightPanelStore.setCard).toHaveBeenCalledWith({
            phase: RightPanelPhases.FileViewer,
            state: { fileViewer: { viewer: second, media: MEDIA, mxEvent } },
        });
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
            state: { fileViewer: { viewer, media: MEDIA, mxEvent } },
        });
    });
});
