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

import { FileBodyView, FileBodyViewState, type FileBodyViewActions, type FileBodyViewSnapshot } from "./FileBodyView";
import { MockViewModel } from "../../../../../core/viewmodel/MockViewModel";
import { I18nApi } from "../../../../../index";
import { I18nContext } from "../../../../../core/i18n/i18nContext";
import * as stories from "./FileBodyView.stories";

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
    DecryptionPendingDownload,
    LongFilenameDownload,
} = composeStories(stories);

const defaultSnapshot: FileBodyViewSnapshot = {
    state: FileBodyViewState.UNENCRYPTED,
    showInfo: true,
};

class TestViewModel extends MockViewModel<FileBodyViewSnapshot> implements FileBodyViewActions {
    public onInfoClick?: () => void;
    public onDownloadClick?: () => void;
    public onDownloadLinkClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
    public onDownloadIframeLoad?: () => void;

    public constructor(snapshot: FileBodyViewSnapshot, actions: FileBodyViewActions = {}) {
        super(snapshot);
        this.onInfoClick = actions.onInfoClick;
        this.onDownloadClick = actions.onDownloadClick;
        this.onDownloadLinkClick = actions.onDownloadLinkClick;
        this.onDownloadIframeLoad = actions.onDownloadIframeLoad;
    }
}

describe("FileBodyView", () => {
    it.each([
        ["default", Default],
        ["export", Export],
        ["invalid", Invalid],
        ["long-filename-info", LongFilenameInfo],
        ["audio-info", AudioInfo],
        ["video-info", VideoInfo],
        ["unencrypted-download", UnencryptedDownload],
        ["encrypted-iframe-download", EncryptedIframeDownload],
        ["decryption-pending-download", DecryptionPendingDownload],
        ["long-filename-download", LongFilenameDownload],
    ])("matches snapshot for %s story", (_name, Story) => {
        const { container } = renderWithI18n(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("renders info row in info-only mode", () => {
        const vm = new TestViewModel(defaultSnapshot);

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Attachment" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    });

    it("renders info row in info-only mode using label and tooltip", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            infoLabel: "spec.pdf",
            infoTooltip: "spec.pdf (22 KB)",
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "spec.pdf" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Attachment" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    });

    it("uses href in export mode", () => {
        const vm = new TestViewModel({
            state: FileBodyViewState.EXPORT,
            showInfo: true,
            infoHref: "https://example.org/export.pdf",
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        const link = screen.getByRole("link");
        expect(link).toHaveAttribute("href", "https://example.org/export.pdf");
    });

    it("uses href in unencrypted download mode", () => {
        const vm = new TestViewModel({
            state: FileBodyViewState.UNENCRYPTED,
            showDownload: true,
            downloadHref: "https://example.org/download.pdf",
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        const link = screen.getByRole("link", { name: "Download" });
        expect(link).toHaveAttribute("href", "https://example.org/download.pdf");
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noreferrer noopener");
    });

    it("renders safely when href is missing in EXPORT mode", () => {
        const vm = new TestViewModel({ state: FileBodyViewState.EXPORT, showInfo: true });

        const { container } = renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Attachment" })).toBeInTheDocument();
        expect(screen.queryByRole("link")).not.toBeInTheDocument();
        expect(container.querySelector("a")).toBeInTheDocument();
    });

    it("renders safely when href is missing in UNENCRYPTED mode", () => {
        const vm = new TestViewModel({ state: FileBodyViewState.UNENCRYPTED, showDownload: true });

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByText("Download")).toBeInTheDocument();
    });

    it("uses label as fallback tooltip content", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            infoLabel: "spec.pdf",
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "spec.pdf" })).toBeInTheDocument();
    });

    it("renders download button in decryption-pending mode", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            state: FileBodyViewState.DECRYPTION_PENDING,
            showDownload: true,
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "spec.pdf" })).not.toBeInTheDocument();
    });

    it("invokes onInfoClick when info row is clicked", () => {
        const onInfoClick = vi.fn();
        const vm = new TestViewModel(defaultSnapshot, { onInfoClick });

        renderWithI18n(<FileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "Attachment" }));
        expect(onInfoClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadClick in encrypted-pending mode", () => {
        const onDownloadClick = vi.fn();
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                state: FileBodyViewState.DECRYPTION_PENDING,
                showDownload: true,
            },
            { onDownloadClick },
        );

        renderWithI18n(<FileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "Download" }));
        expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadLinkClick in unencrypted-download mode", () => {
        const onDownloadLinkClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                state: FileBodyViewState.UNENCRYPTED,
                showDownload: true,
            },
            { onDownloadLinkClick },
        );

        renderWithI18n(<FileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("link", { name: "Download" }));
        expect(onDownloadLinkClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadIframeLoad in encrypted-iframe-download mode", () => {
        const onDownloadIframeLoad = vi.fn();
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                state: FileBodyViewState.ENCRYPTED,
                showDownload: true,
            },
            { onDownloadIframeLoad },
        );

        renderWithI18n(<FileBodyView vm={vm} />);

        const iframe = screen.getByTitle("Download");
        fireEvent.load(iframe);
        expect(onDownloadIframeLoad).toHaveBeenCalledTimes(1);
    });

    it("wires refLink in encrypted-iframe-download mode", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            state: FileBodyViewState.ENCRYPTED,
            showDownload: true,
        });
        const refLink = React.createRef<HTMLAnchorElement>() as React.RefObject<HTMLAnchorElement>;

        renderWithI18n(<FileBodyView vm={vm} refLink={refLink} />);

        expect(refLink.current).toBeInstanceOf(HTMLAnchorElement);
    });

    it("wires refIFrame in encrypted-iframe-download mode", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            state: FileBodyViewState.ENCRYPTED,
            showDownload: true,
        });
        const refIFrame = React.createRef<HTMLIFrameElement>() as React.RefObject<HTMLIFrameElement>;

        renderWithI18n(<FileBodyView vm={vm} refIFrame={refIFrame} />);

        expect(refIFrame.current).toBeInstanceOf(HTMLIFrameElement);
    });

    it.each([FileBodyViewState.UNENCRYPTED, FileBodyViewState.DECRYPTION_PENDING, FileBodyViewState.ENCRYPTED])(
        "hides info row in %s mode",
        (state) => {
            const vm = new TestViewModel({
                ...defaultSnapshot,
                state,
                showInfo: false,
                showDownload: true,
            });

            renderWithI18n(<FileBodyView vm={vm} />);

            expect(screen.queryByRole("button", { name: "Attachment" })).not.toBeInTheDocument();
        },
    );

    it("shows message in invalid mode", () => {
        const vm = new TestViewModel({
            state: FileBodyViewState.INVALID,
        });

        renderWithI18n(<FileBodyView vm={vm} />);

        expect(screen.queryByRole("button", { name: "Attachment" })).not.toBeInTheDocument();
        expect(screen.getByText("Invalid file")).toBeInTheDocument();
    });

    it("applies extra class names to the root element", () => {
        const vm = new TestViewModel(defaultSnapshot);

        const { container } = renderWithI18n(<FileBodyView vm={vm} className="custom-file-body another-class" />);
        expect(container.firstElementChild).toHaveClass("custom-file-body", "another-class");
    });
});
