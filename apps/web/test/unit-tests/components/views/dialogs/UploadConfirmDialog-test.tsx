/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "jest-matrix-react";
import { secureRandomString } from "matrix-js-sdk/src/randomstring";

import UploadConfirmDialog from "../../../../../src/components/views/dialogs/UploadConfirmDialog.tsx";

function makeFile(name = "image.png", type = "image/png"): File {
    return new File([secureRandomString(1024)], name, { type });
}

describe("<UploadConfirmDialog />", () => {
    beforeEach(() => {
        jest.spyOn(URL, "createObjectURL").mockReturnValue("blob:null/1234-5678-9101-1121");
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it("should display image preview without a caption field by default", () => {
        const file = new File([secureRandomString(1024 * 124)], "image.png", { type: "image/png" });
        const { asFragment } = render(
            <UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={jest.fn()} />,
        );

        expect(screen.getByRole("img")).toHaveAttribute("src", "blob:null/1234-5678-9101-1121");
        expect(screen.queryByLabelText("Caption")).not.toBeInTheDocument();
        expect(asFragment()).toMatchSnapshot();
    });

    it("focuses the upload button when the caption field is not shown", async () => {
        const file = makeFile();
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} onFinished={jest.fn()} />);

        await waitFor(() => expect(screen.getByRole("button", { name: "Upload" })).toHaveFocus());
    });

    it("shows and focuses a caption field for a single image when captions are allowed", async () => {
        const file = makeFile();
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={jest.fn()} />);

        const captionInput = screen.getByLabelText("Caption");
        expect(captionInput).toHaveAttribute("placeholder", "Add a caption or context");
        await waitFor(() => expect(captionInput).toHaveFocus());
        expect(screen.getByRole("button", { name: "Upload" })).not.toHaveFocus();
    });

    it("shows a shared caption field and thumbnail tray for multiple image uploads", async () => {
        const files = [makeFile("first.png"), makeFile("second.png")];
        render(
            <UploadConfirmDialog
                file={files[0]}
                files={files}
                currentIndex={0}
                totalFiles={2}
                allowCaption
                onFinished={jest.fn()}
            />,
        );

        expect(screen.getByText("first.png")).toBeInTheDocument();
        expect(screen.getByText("second.png")).toBeInTheDocument();
        expect(screen.getAllByRole("img")).toHaveLength(2);
        const captionInput = screen.getByLabelText("Caption");
        expect(captionInput).toHaveAttribute("placeholder", "Add a caption or context");
        await waitFor(() => expect(captionInput).toHaveFocus());
    });

    it("allows removing images from a multi-image upload before sending", async () => {
        const files = [makeFile("first.png"), makeFile("second.png")];
        render(
            <UploadConfirmDialog
                file={files[0]}
                files={files}
                currentIndex={0}
                totalFiles={2}
                allowCaption
                onFinished={jest.fn()}
            />,
        );

        await userEvent.click(screen.getByRole("button", { name: "Remove second.png" }));

        expect(screen.getByRole("img", { name: /first\.png/ })).toBeInTheDocument();
        expect(screen.queryByText("second.png")).not.toBeInTheDocument();
        expect(screen.getAllByRole("img")).toHaveLength(1);
    });

    it("does not show a caption field for non-image uploads", () => {
        const file = makeFile("notes.txt", "text/plain");
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={jest.fn()} />);

        expect(screen.queryByLabelText("Caption")).not.toBeInTheDocument();
    });

    it("returns a trimmed caption when uploading one captioned image", async () => {
        const onFinished = jest.fn();
        const file = makeFile();
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={onFinished} />);

        await userEvent.type(screen.getByLabelText("Caption"), "  Bug: the dashboard chart is blank  ");
        await userEvent.click(screen.getByRole("button", { name: "Upload" }));

        expect(onFinished).toHaveBeenCalledWith(true, false, "Bug: the dashboard chart is blank");
    });

    it("returns a trimmed shared caption and selected files when uploading multiple images", async () => {
        const onFinished = jest.fn();
        const files = [makeFile("first.png"), makeFile("second.png")];
        render(
            <UploadConfirmDialog
                file={files[0]}
                files={files}
                currentIndex={0}
                totalFiles={2}
                allowCaption
                onFinished={onFinished}
            />,
        );

        await userEvent.type(screen.getByLabelText("Caption"), "  Compare these two screens  ");
        await userEvent.click(screen.getByRole("button", { name: "Upload" }));

        expect(onFinished).toHaveBeenCalledWith(true, true, "Compare these two screens", files);
    });

    it("does not upload when pressing Enter inside the caption field", async () => {
        const onFinished = jest.fn();
        const file = makeFile();
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={onFinished} />);

        await userEvent.type(screen.getByLabelText("Caption"), "Line one{enter}Line two");

        expect(screen.getByLabelText("Caption")).toHaveValue("Line one\nLine two");
        expect(onFinished).not.toHaveBeenCalled();
    });

    it("cancels without uploading when Escape is pressed", async () => {
        const onFinished = jest.fn();
        const file = makeFile();
        render(<UploadConfirmDialog file={file} currentIndex={0} totalFiles={1} allowCaption onFinished={onFinished} />);

        await userEvent.type(screen.getByLabelText("Caption"), "Do not send this");
        await userEvent.keyboard("{Escape}");

        expect(onFinished).toHaveBeenCalledTimes(1);
        expect(onFinished).toHaveBeenCalledWith(false);
    });
});
