/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { render } from "jest-matrix-react";
import userEvent from "@testing-library/user-event";

import { FileBody, type FileBodyViewSnapshot, type FileBodyActions } from "./FileBody";
import { MockViewModel } from "../../viewmodel/MockViewModel";

describe("FileBody", () => {
    const defaultFileInfo = {
        filename: "test-file.pdf",
        tooltip: "test-file.pdf",
        mimeType: "application/pdf",
    };

    const defaultSnapshot: FileBodyViewSnapshot = {
        fileInfo: defaultFileInfo,
        downloadLabel: "Download",
        showGenericPlaceholder: true,
        showDownloadLink: true,
        isEncrypted: false,
        isDecrypted: false,
        forExport: false,
    };

    function createViewModel(snapshot: FileBodyViewSnapshot, actions: FileBodyActions = {}) {
        const vm = new MockViewModel(snapshot);
        return Object.assign(vm, actions);
    }

    it("renders with placeholder and download button for unencrypted file", () => {
        const onDownloadClick = jest.fn();
        const vm = createViewModel(defaultSnapshot, { onDownloadClick });
        const { container } = render(<FileBody vm={vm} />);

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.querySelector(".mx_MFileBody_download")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("renders without placeholder when showGenericPlaceholder is false", () => {
        const vm = createViewModel({ ...defaultSnapshot, showGenericPlaceholder: false });
        const { container } = render(<FileBody vm={vm} />);

        expect(container.querySelector(".mx_MFileBody_info")).toBeFalsy();
        expect(container.querySelector(".mx_MFileBody_download")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("renders without download link when showDownloadLink is false", () => {
        const vm = createViewModel({ ...defaultSnapshot, showDownloadLink: false });
        const { container } = render(<FileBody vm={vm} />);

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.querySelector(".mx_MFileBody_download")).toBeFalsy();
        expect(container).toMatchSnapshot();
    });

    it("calls onPlaceholderClick when placeholder is clicked", async () => {
        const user = userEvent.setup();
        const onPlaceholderClick = jest.fn();
        const vm = createViewModel(defaultSnapshot, { onPlaceholderClick });
        const { container } = render(<FileBody vm={vm} />);

        const placeholder = container.querySelector(".mx_MFileBody_info");
        await user.click(placeholder!);
        expect(onPlaceholderClick).toHaveBeenCalledTimes(1);
    });

    it("calls onDownloadClick when download button is clicked for unencrypted file", async () => {
        const user = userEvent.setup();
        const onDownloadClick = jest.fn((e: React.MouseEvent) => e.preventDefault());
        const vm = createViewModel(defaultSnapshot, { onDownloadClick });
        const { container } = render(<FileBody vm={vm} />);

        const downloadLink = container.querySelector(".mx_MFileBody_download a");
        await user.click(downloadLink!);
        expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });

    it("renders decrypt button for encrypted file that hasn't been decrypted", () => {
        const onDecryptClick = jest.fn();
        const vm = createViewModel(
            {
                ...defaultSnapshot,
                isEncrypted: true,
                isDecrypted: false,
            },
            { onDecryptClick },
        );
        const { container } = render(<FileBody vm={vm} />);

        expect(container.querySelector(".mx_MFileBody_download button")).toBeTruthy();
        expect(container).toMatchSnapshot();
    });

    it("calls onDecryptClick when decrypt button is clicked", async () => {
        const user = userEvent.setup();
        const onDecryptClick = jest.fn();
        const vm = createViewModel(
            {
                ...defaultSnapshot,
                isEncrypted: true,
                isDecrypted: false,
            },
            { onDecryptClick },
        );
        const { container } = render(<FileBody vm={vm} />);

        const downloadBtn = container.querySelector(".mx_MFileBody_download button");
        await user.click(downloadBtn!);
        expect(onDecryptClick).toHaveBeenCalledTimes(1);
    });

    it("renders iframe for encrypted file that has been decrypted", () => {
        const iframeRef = createRef<HTMLIFrameElement>();
        const dummyLinkRef = createRef<HTMLAnchorElement>();
        const onIframeLoad = jest.fn();
        const vm = createViewModel(
            {
                ...defaultSnapshot,
                isEncrypted: true,
                isDecrypted: true,
                iframeSrc: "usercontent/",
                iframeRef,
                dummyLinkRef,
            },
            { onIframeLoad },
        );
        const { container } = render(<FileBody vm={vm} />);

        const iframe = container.querySelector("iframe");
        expect(iframe).toBeTruthy();
        expect(iframe?.getAttribute("src")).toBe("usercontent/");
        expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts allow-downloads");
        expect(container).toMatchSnapshot();
    });

    it("renders export mode with link", () => {
        const vm = createViewModel({
            ...defaultSnapshot,
            forExport: true,
            exportUrl: "mxc://server/file",
        });
        const { container } = render(<FileBody vm={vm} />);

        const link = container.querySelector("a");
        expect(link?.getAttribute("href")).toBe("mxc://server/file");
        expect(link?.textContent).toContain("test-file.pdf");
        expect(container).toMatchSnapshot();
    });

    it("renders error message", () => {
        const vm = createViewModel({
            ...defaultSnapshot,
            error: "Invalid file",
        });
        const { container } = render(<FileBody vm={vm} />);

        expect(container.textContent).toContain("test-file.pdf");
        expect(container.textContent).toContain("Invalid file");
        expect(container.querySelector(".mx_MFileBody_download")).toBeFalsy();
        expect(container).toMatchSnapshot();
    });

    it("applies custom className", () => {
        const vm = createViewModel({
            ...defaultSnapshot,
            className: "custom-class",
        });
        const { container } = render(<FileBody vm={vm} />);

        expect(container.querySelector(".custom-class")).toBeTruthy();
    });

    it("shows tooltip on filename", () => {
        const vm = createViewModel({
            ...defaultSnapshot,
            fileInfo: { ...defaultFileInfo, tooltip: "Full filename with path" },
        });
        const { container } = render(<FileBody vm={vm} />);

        const filenameElement = container.querySelector(".mx_MFileBody_info_filename");
        expect(filenameElement?.getAttribute("title")).toBe("Full filename with path");
    });
});
