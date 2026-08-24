/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "jest-matrix-react";
import { EventType, MatrixEvent, MsgType, TypedEventEmitter } from "matrix-js-sdk/src/matrix";

import MediaPreviewDialog from "../../../../../../src/components/views/elements/MediaPreview/MediaPreviewDialog";
import { SDKContext } from "../../../../../../src/contexts/SDKContext";
import { UPDATE_EVENT } from "../../../../../../src/stores/AsyncStore";
import { RightPanelPhases } from "../../../../../../src/stores/right-panel/RightPanelStorePhases";
import { stubClient, TestSDKContext } from "../../../../../test-utils";

const mockSourceBlob = { value: Promise.resolve(new Blob(["%PDF-1.4"])) };
const mockDestroy = jest.fn();

jest.mock("../../../../../../src/utils/MediaEventHelper", () => ({
    MediaEventHelper: jest.fn().mockImplementation(() => ({
        get sourceBlob() {
            return mockSourceBlob;
        },
        media: { srcHttp: "https://server/file.pdf", isEncrypted: false },
        fileName: "spec.pdf",
        destroy: mockDestroy,
    })),
}));

// pdf.js and mammoth are far too heavy for a unit test, and have nothing to say about the
// routing and shared chrome this file exercises.
jest.mock("../../../../../../src/components/views/elements/MediaPreview/pdfjs", () => ({
    loadPdfDocument: jest.fn().mockResolvedValue({
        promise: Promise.resolve({
            numPages: 3,
            getPage: jest.fn().mockResolvedValue({
                getViewport: () => ({ width: 100, height: 200 }),
                render: () => ({ promise: Promise.resolve(), cancel: jest.fn() }),
            }),
        }),
        destroy: jest.fn(),
    }),
}));

jest.mock("mammoth", () => ({ convertToHtml: jest.fn().mockResolvedValue({ value: "<p>Hello</p>", messages: [] }) }), {
    virtual: true,
});

describe("<MediaPreviewDialog />", () => {
    let rightPanelStore: TypedEventEmitter<string, any> & {
        isOpenForRoom: jest.Mock;
        currentCardForRoom: jest.Mock;
        showOrHidePhase: jest.Mock;
    };
    let sdkContext: TestSDKContext;

    /** Render inside an SDK context whose right panel and room view stores we control. */
    const renderPreview = (ui: React.ReactElement) =>
        render(<SDKContext.Provider value={sdkContext}>{ui}</SDKContext.Provider>);

    /** Flip the right panel to the given state and let subscribers hear about it. */
    const setChatOpen = (open: boolean): void => {
        rightPanelStore.isOpenForRoom.mockReturnValue(open);
        act(() => {
            rightPanelStore.emit(UPDATE_EVENT);
        });
    };

    const mkEvent = (content: Record<string, unknown> = {}): MatrixEvent =>
        new MatrixEvent({
            event_id: "$file",
            room_id: "!room:server",
            sender: "@alice:server",
            type: EventType.RoomMessage,
            origin_server_ts: new Date(2024, 0, 1, 12, 0, 0).getTime(),
            content: {
                body: "spec.pdf",
                msgtype: MsgType.File,
                url: "mxc://server/file",
                info: { mimetype: "application/pdf", size: 1024 },
                ...content,
            },
        });

    beforeEach(() => {
        stubClient();
        jest.clearAllMocks();
        mockSourceBlob.value = Promise.resolve(new Blob(["%PDF-1.4"]));

        rightPanelStore = Object.assign(new TypedEventEmitter<string, any>(), {
            isOpenForRoom: jest.fn().mockReturnValue(false),
            currentCardForRoom: jest.fn().mockReturnValue({ phase: RightPanelPhases.Timeline }),
            showOrHidePhase: jest.fn(),
        });

        sdkContext = new TestSDKContext();
        sdkContext._RightPanelStore = rightPanelStore as any;
        sdkContext._RoomViewStore = { getRoomId: () => "!room:server" } as any;

        document.body.classList.remove("mx_MediaPreview_withChat");
    });

    it("routes an image to the image previewer, with no sender chrome when there is no event", () => {
        renderPreview(<MediaPreviewDialog src="https://example.com/image.png" onFinished={jest.fn()} />);

        expect(screen.getByRole("dialog", { name: "Image view" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Rotate Left" })).toBeInTheDocument();
        // No event means no message options menu.
        expect(screen.queryByRole("button", { name: "Options" })).not.toBeInTheDocument();
    });

    it("routes a PDF to the document previewer and shows the shared chrome", async () => {
        renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        expect(screen.getByRole("dialog", { name: "File preview" })).toBeInTheDocument();
        expect(screen.getByText("@alice:server")).toBeInTheDocument();
        expect(screen.getByText(/spec\.pdf/)).toBeInTheDocument();
        expect(await screen.findByText("1 of 3")).toBeInTheDocument();
    });

    it("pages through a multi-page document", async () => {
        renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        expect(await screen.findByText("1 of 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Previous page" })).toHaveAttribute("aria-disabled", "true");

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        expect(await screen.findByText("2 of 3")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
        expect(await screen.findByText("1 of 3")).toBeInTheDocument();
    });

    it("routes a docx to the Word previewer, with no page controls", async () => {
        const event = mkEvent({
            body: "notes.docx",
            info: { mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        });
        renderPreview(<MediaPreviewDialog mxEvent={event} onFinished={jest.fn()} />);

        expect(await screen.findByText("Hello")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
    });

    it("closes when the close button is clicked", () => {
        const onFinished = jest.fn();
        renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={onFinished} />);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onFinished).toHaveBeenCalled();
    });

    it("falls back to the download pane for a format we cannot render", () => {
        const event = mkEvent({ body: "archive.zip", info: { mimetype: "application/zip" } });
        renderPreview(<MediaPreviewDialog mxEvent={event} onFinished={jest.fn()} />);

        expect(
            screen.getByText("This file can't be previewed. Download it to open it in another app."),
        ).toBeInTheDocument();
    });

    it("falls back to the download pane when the file cannot be fetched", async () => {
        mockSourceBlob.value = Promise.reject(new Error("nope"));
        renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        await waitFor(() =>
            expect(
                screen.getByText("This file can't be previewed. Download it to open it in another app."),
            ).toBeInTheDocument(),
        );
    });

    describe("chat toggle", () => {
        it("toggles the room's right panel timeline", async () => {
            renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

            const button = await screen.findByRole("button", { name: "Chat" });
            expect(button).toHaveAttribute("aria-pressed", "false");

            fireEvent.click(button);
            expect(rightPanelStore.showOrHidePhase).toHaveBeenCalledWith(RightPanelPhases.Timeline);
        });

        it("insets the overlay while the chat is open", async () => {
            renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);
            await screen.findByRole("button", { name: "Chat" });

            expect(document.body).not.toHaveClass("mx_MediaPreview_withChat");

            setChatOpen(true);

            expect(await screen.findByRole("button", { name: "Chat" })).toHaveAttribute("aria-pressed", "true");
            expect(document.body).toHaveClass("mx_MediaPreview_withChat");
        });

        it("stops insetting the overlay once the preview closes", async () => {
            const { unmount } = renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);
            await screen.findByRole("button", { name: "Chat" });
            setChatOpen(true);
            expect(document.body).toHaveClass("mx_MediaPreview_withChat");

            unmount();
            expect(document.body).not.toHaveClass("mx_MediaPreview_withChat");
        });

        it("offers no chat when the preview is not for the room being viewed", async () => {
            sdkContext._RoomViewStore = { getRoomId: () => "!elsewhere:server" } as any;
            renderPreview(<MediaPreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

            await screen.findByText("1 of 3");
            expect(screen.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
        });

        it("offers no chat on an image preview", () => {
            renderPreview(<MediaPreviewDialog src="https://example.com/image.png" onFinished={jest.fn()} />);

            expect(screen.queryByRole("button", { name: "Chat" })).not.toBeInTheDocument();
        });
    });
});
