/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { FileBody, type FileBodyProps } from "./FileBody";

describe("FileBody", () => {
    const defaultFileInfo = {
        filename: "test-file.pdf",
        tooltip: "test-file.pdf",
        mimeType: "application/pdf",
    };

    const defaultProps: FileBodyProps = {
        fileInfo: defaultFileInfo,
        downloadLabel: "Download",
        showGenericPlaceholder: true,
        showDownloadLink: true,
    };

    it("renders with placeholder and download button for unencrypted file", () => {
        const onDownloadClick = jest.fn();
        const { container } = render(
            <FileBody {...defaultProps} onDownloadClick={onDownloadClick} />,
        );

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.querySelector(".mx_MFileBody_download")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("renders without placeholder when showGenericPlaceholder is false", () => {
        const { container } = render(
            <FileBody {...defaultProps} showGenericPlaceholder={false} />,
        );

        expect(container.querySelector(".mx_MFileBody_info")).toBeFalsy();
        expect(container.querySelector(".mx_MFileBody_download")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("renders without download link when showDownloadLink is false", () => {
        const { container } = render(
            <FileBody {...defaultProps} showDownloadLink={false} />,
        );

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.querySelector(".mx_MFileBody_download")).toBeFalsy();
        expect(container).toMatchSnapshot();
    });

    it("calls onPlaceholderClick when placeholder is clicked", async () => {
        const user = userEvent.setup();
        const onPlaceholderClick = jest.fn();
        const { container } = render(<FileBody {...defaultProps} onPlaceholderClick={onPlaceholderClick} />);

        const placeholder = container.querySelector(".mx_MFileBody_info");
        await user.click(placeholder!);
        expect(onPlaceholderClick).toHaveBeenCalledTimes(1);
    });

    it("calls onDownloadClick when download button is clicked for unencrypted file", async () => {
        const user = userEvent.setup();
        const onDownloadClick = jest.fn((e: React.MouseEvent) => e.preventDefault());
        const { container } = render(<FileBody {...defaultProps} onDownloadClick={onDownloadClick} />);

        const downloadLink = container.querySelector(".mx_MFileBody_download a");
        await user.click(downloadLink!);
        expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });

    it("renders decrypt button for encrypted file that hasn't been decrypted", () => {
        const onDecryptClick = jest.fn();
        const { container } = render(
            <FileBody
                {...defaultProps}
                isEncrypted={true}
                isDecrypted={false}
                onDecryptClick={onDecryptClick}
            />,
        );

        expect(container.querySelector(".mx_MFileBody_download button")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("calls onDecryptClick when decrypt button is clicked", async () => {
        const user = userEvent.setup();
        const onDecryptClick = jest.fn();
        const { container } = render(
            <FileBody
                {...defaultProps}
                isEncrypted={true}
                isDecrypted={false}
                onDecryptClick={onDecryptClick}
            />,
        );

        const downloadBtn = container.querySelector(".mx_MFileBody_download button");
        await user.click(downloadBtn!);
        expect(onDecryptClick).toHaveBeenCalledTimes(1);
    });

    it("renders iframe for encrypted file that has been decrypted", () => {
        const iframeRef = createRef<HTMLIFrameElement>();
        const dummyLinkRef = createRef<HTMLAnchorElement>();
        const onIframeLoad = jest.fn();
        const { container } = render(
            <FileBody
                {...defaultProps}
                isEncrypted={true}
                isDecrypted={true}
                iframeSrc="usercontent/"
                iframeRef={iframeRef}
                dummyLinkRef={dummyLinkRef}
                onIframeLoad={onIframeLoad}
            />,
        );

        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
        expect(iframe?.getAttribute("src")).toBe("usercontent/");
        expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-downloads");
        expect(container).toMatchSnapshot();
    });

    it("renders export mode with link", () => {
        const { container } = render(
            <FileBody
                {...defaultProps}
                forExport={true}
                exportUrl="mxc://server/file"
            />,
        );

        const link = container.querySelector("a");
        expect(link?.getAttribute("href")).toBe("mxc://server/file");
        expect(link?.textContent).toContain("test-file.pdf");
        expect(container).toMatchSnapshot();
    });

    it("renders error message", () => {
        const { container } = render(
            <FileBody
                {...defaultProps}
                error="Invalid file"
            />,
        );

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.textContent).toContain("Invalid file");
        expect(container.querySelector(".mx_MFileBody_download")).toBeFalsy();
        expect(container).toMatchSnapshot();
    });

    it("applies custom className", () => {
        const { container } = render(
            <FileBody {...defaultProps} className="custom-class" />,
        );

        expect(container.querySelector(".custom-class")).toBeTruthy();
    });

    it("shows tooltip on filename", () => {
        const { container } = render(
            <FileBody {...defaultProps} fileInfo={{ ...defaultFileInfo, tooltip: "Full filename with path" }} />,
        );

        const filenameElement = container.querySelector(".mx_MFileBody_info_filename");
        expect(filenameElement?.getAttribute("title")).toBe("Full filename with path");
    });
});
