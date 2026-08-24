/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { render, screen, fireEvent, waitFor } from "jest-matrix-react";
import { EventType, MatrixEvent, MsgType } from "matrix-js-sdk/src/matrix";

import FilePreviewDialog from "../../../../../../src/components/views/elements/FilePreview/FilePreviewDialog";
import { stubClient } from "../../../../../test-utils";

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

// The real previewers pull in pdf.js and mammoth, which are far too heavy for a unit test and
// have nothing to say about the dialog chrome we are exercising here.
jest.mock("../../../../../../src/components/views/elements/FilePreview/PdfPreview", () => ({
    PdfPreview: ({ page, onLoaded }: { page: number; onLoaded: (n: number) => void }) => {
        const react = require("react");
        react.useEffect(() => onLoaded(3), [onLoaded]);
        return react.createElement("div", { "data-testid": "pdf-preview" }, `page ${page}`);
    },
}));

jest.mock("../../../../../../src/components/views/elements/FilePreview/DocxPreview", () => ({
    DocxPreview: () => {
        const react = require("react");
        return react.createElement("div", { "data-testid": "docx-preview" });
    },
}));

describe("<FilePreviewDialog />", () => {
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
    });

    it("shows the sender, the filename and the previewer", async () => {
        render(<FilePreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        expect(screen.getByText("@alice:server")).toBeInTheDocument();
        expect(screen.getByText(/spec\.pdf/)).toBeInTheDocument();
        expect(await screen.findByTestId("pdf-preview")).toBeInTheDocument();
    });

    it("pages through a multi-page document", async () => {
        render(<FilePreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        expect(await screen.findByText("1 of 3")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Previous page" })).toHaveAttribute("aria-disabled", "true");

        fireEvent.click(screen.getByRole("button", { name: "Next page" }));
        expect(await screen.findByText("2 of 3")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
        expect(await screen.findByText("1 of 3")).toBeInTheDocument();
    });

    it("closes when the close button is clicked", async () => {
        const onFinished = jest.fn();
        render(<FilePreviewDialog mxEvent={mkEvent()} onFinished={onFinished} />);

        fireEvent.click(screen.getByRole("button", { name: "Close" }));
        expect(onFinished).toHaveBeenCalled();
    });

    it("renders a docx with no page controls", async () => {
        const event = mkEvent({
            body: "notes.docx",
            info: { mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
        });
        render(<FilePreviewDialog mxEvent={event} onFinished={jest.fn()} />);

        expect(await screen.findByTestId("docx-preview")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
    });

    it("shows a fallback when the format cannot be previewed", async () => {
        const event = mkEvent({ body: "archive.zip", info: { mimetype: "application/zip" } });
        render(<FilePreviewDialog mxEvent={event} onFinished={jest.fn()} />);

        expect(
            await screen.findByText("This file can't be previewed. Download it to open it in another app."),
        ).toBeInTheDocument();
    });

    it("shows a fallback when the file cannot be fetched", async () => {
        mockSourceBlob.value = Promise.reject(new Error("nope"));
        render(<FilePreviewDialog mxEvent={mkEvent()} onFinished={jest.fn()} />);

        await waitFor(() =>
            expect(
                screen.getByText("This file can't be previewed. Download it to open it in another app."),
            ).toBeInTheDocument(),
        );
    });
});
