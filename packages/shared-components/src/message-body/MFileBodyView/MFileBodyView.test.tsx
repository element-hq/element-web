/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type MouseEvent } from "react";
import { composeStories } from "@storybook/react-vite";
import { fireEvent, render, screen } from "@test-utils";
import { describe, it, expect, vi } from "vitest";

import {
    MFileBodyView,
    MFileBodyViewRendering,
    type MFileBodyViewActions,
    type MFileBodyViewSnapshot,
} from "./MFileBodyView";
import { MockViewModel } from "../../viewmodel/MockViewModel";
import { I18nApi } from "../../index";
import { I18nContext } from "../../utils/i18nContext";
import * as stories from "./MFileBodyView.stories";

const renderWithI18n = (ui: React.ReactElement): ReturnType<typeof render> =>
    render(ui, {
        wrapper: ({ children }) => <I18nContext.Provider value={new I18nApi()}>{children}</I18nContext.Provider>,
    });

const {
    Default,
    Export,
    Invalid,
    AudioInfo,
    VideoInfo,
    LongFilenameInfo,
    UnencryptedDownload,
    EncryptedIframeDownload,
    EncryptedPendingDownload,
    LongFilenameDownload,
} = composeStories(stories);

const defaultSnapshot: MFileBodyViewSnapshot = {
    rendering: MFileBodyViewRendering.INFO,
};

class TestViewModel extends MockViewModel<MFileBodyViewSnapshot> implements MFileBodyViewActions {
    public onInfoClick?: () => void;
    public onDownloadClick?: () => void;
    public onDownloadLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    public onDownloadIframeLoad?: () => void;

    public constructor(snapshot: MFileBodyViewSnapshot, actions: MFileBodyViewActions = {}) {
        super(snapshot);
        this.onInfoClick = actions.onInfoClick;
        this.onDownloadClick = actions.onDownloadClick;
        this.onDownloadLinkClick = actions.onDownloadLinkClick;
        this.onDownloadIframeLoad = actions.onDownloadIframeLoad;
    }
}

describe("MFileBodyView", () => {
    it.each([
        ["default", Default],
        ["export", Export],
        ["invalid", Invalid],
        ["long-filename-info", LongFilenameInfo],
        ["audio-info", AudioInfo],
        ["video-info", VideoInfo],
        ["unencrypted-download", UnencryptedDownload],
        ["encrypted-iframe-download", EncryptedIframeDownload],
        ["encrypted-pending-download", EncryptedPendingDownload],
        ["long-filename-download", LongFilenameDownload],
    ])("matches snapshot for %s story", (_name, Story) => {
        const { container } = renderWithI18n(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("renders info row in info-only mode", () => {
        const vm = new TestViewModel(defaultSnapshot);

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Attachment" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    });

    it("renders info row in info-only mode using label and tooltip", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            label: "spec.pdf",
            tooltip: "spec.pdf (22 KB)",
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "spec.pdf" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Attachment" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    });

    it("uses href in export mode", () => {
        const vm = new TestViewModel({
            rendering: MFileBodyViewRendering.EXPORT,
            href: "https://example.org/export.pdf",
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://example.org/export.pdf");
    });

    it("uses href in unencrypted download mode", () => {
        const vm = new TestViewModel({
            rendering: MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
            href: "https://example.org/download.pdf",
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        const link = screen.getByRole("link", { name: "Download" });
        expect(link).toHaveAttribute("href", "https://example.org/download.pdf");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer noopener");
    });

    it("renders safely when href is missing in EXPORT mode", () => {
        const vm = new TestViewModel({ rendering: MFileBodyViewRendering.EXPORT });

        const { container } = renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Attachment" })).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(container.querySelector("a")).toBeInTheDocument();
    });

    it("renders safely when href is missing in DOWNLOAD_UNENCRYPTED mode", () => {
        const vm = new TestViewModel({ rendering: MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByText("Download")).toBeInTheDocument();
    });

    it("uses label as fallback tooltip content", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            label: "spec.pdf",
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "spec.pdf" })).toBeInTheDocument();
    });

    it("renders download button in encrypted-pending mode", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING,
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "spec.pdf" })).not.toBeInTheDocument();
    });

    it("invokes onInfoClick when info row is clicked", () => {
        const onInfoClick = vi.fn();
        const vm = new TestViewModel(defaultSnapshot, { onInfoClick });

        renderWithI18n(<MFileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "Attachment" }));
        expect(onInfoClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadClick in encrypted-pending mode", () => {
        const onDownloadClick = vi.fn();
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING,
            },
            { onDownloadClick },
        );

        renderWithI18n(<MFileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "Download" }));
        expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadLinkClick in unencrypted-download mode", () => {
        const onDownloadLinkClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                rendering: MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
            },
            { onDownloadLinkClick },
        );

        renderWithI18n(<MFileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("link", { name: "Download" }));
        expect(onDownloadLinkClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadIframeLoad in encrypted-iframe-download mode", () => {
        const onDownloadIframeLoad = vi.fn();
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME,
            },
            { onDownloadIframeLoad },
        );

        renderWithI18n(<MFileBodyView vm={vm} />);

        const iframe = screen.getByTitle("Download");
        fireEvent.load(iframe);
        expect(onDownloadIframeLoad).toHaveBeenCalledTimes(1);
    });

    it("wires refLink in encrypted-iframe-download mode", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            rendering: MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME,
        });
        const refLink = React.createRef<HTMLAnchorElement>() as React.RefObject<HTMLAnchorElement>;

        renderWithI18n(<MFileBodyView vm={vm} refLink={refLink} />);

        expect(refLink.current).toBeInstanceOf(HTMLAnchorElement);
    });

    it.each([
        MFileBodyViewRendering.DOWNLOAD_UNENCRYPTED,
        MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_PENDING,
        MFileBodyViewRendering.DOWNLOAD_ENCRYPTED_IFRAME,
    ])("hides info row in %s mode", (rendering) => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            rendering,
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.queryByRole("button", { name: "Attachment" })).not.toBeInTheDocument();
    });

    it("shows invalid message and info row in invalid mode", () => {
        const vm = new TestViewModel({
            rendering: MFileBodyViewRendering.INVALID,
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Attachment" })).toBeInTheDocument();
        expect(screen.getByText("Invalid file")).toBeInTheDocument();
    });

    it("applies extra class names to the root element", () => {
        const vm = new TestViewModel(defaultSnapshot);

        const { container } = renderWithI18n(<MFileBodyView vm={vm} className="custom-file-body another-class" />);
        expect(container.firstElementChild).toHaveClass("custom-file-body", "another-class");
    });
});
