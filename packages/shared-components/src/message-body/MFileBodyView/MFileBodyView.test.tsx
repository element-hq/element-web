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
    MFileBodyViewinfoIcon,
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
    UnencryptedDownload,
    EncryptedIframeDownload,
    HasExtraClassNames,
} = composeStories(stories);

const defaultSnapshot: MFileBodyViewSnapshot = {
    rendering: MFileBodyViewRendering.ENCRYPTED_PENDING,
    filename: "spec.pdf",
    showInfo: true,
    infoTooltip: "spec.pdf (22 KB)",
    infoIcon: MFileBodyViewinfoIcon.ATTACHMENT,
    showDownload: true,
    downloadLabel: "Download",
    downloadHref: "https://example.org/spec.pdf",
    className: "",
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
        ["audio-info", AudioInfo],
        ["video-info", VideoInfo],
        ["unencrypted-download", UnencryptedDownload],
        ["encrypted-iframe-download", EncryptedIframeDownload],
        ["has-extra-class-names", HasExtraClassNames],
    ])("matches snapshot for %s story", (_name, Story) => {
        const { container } = renderWithI18n(<Story />);
        expect(container).toMatchSnapshot();
    });

    it("renders info row and download button in encrypted-pending mode", () => {
        const vm = new TestViewModel(defaultSnapshot);

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.getByRole("button", { name: "spec.pdf" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
    });

    it("invokes onInfoClick when info row is clicked", () => {
        const onInfoClick = vi.fn();
        const vm = new TestViewModel(defaultSnapshot, { onInfoClick });

        renderWithI18n(<MFileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "spec.pdf" }));
        expect(onInfoClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadClick in encrypted-pending mode", () => {
        const onDownloadClick = vi.fn();
        const vm = new TestViewModel(defaultSnapshot, { onDownloadClick });

        renderWithI18n(<MFileBodyView vm={vm} />);

        fireEvent.click(screen.getByRole("button", { name: "Download" }));
        expect(onDownloadClick).toHaveBeenCalledTimes(1);
    });

    it("invokes onDownloadLinkClick in unencrypted-download mode", () => {
        const onDownloadLinkClick = vi.fn((event: MouseEvent<HTMLAnchorElement>) => event.preventDefault());
        const vm = new TestViewModel(
            {
                ...defaultSnapshot,
                rendering: MFileBodyViewRendering.UNENCRYPTED_DOWNLOAD,
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
                rendering: MFileBodyViewRendering.ENCRYPTED_IFRAME_DOWNLOAD,
                showInfo: false,
            },
            { onDownloadIframeLoad },
        );

        renderWithI18n(<MFileBodyView vm={vm} />);

        const iframe = screen.getByTitle("spec.pdf");
        fireEvent.load(iframe);
        expect(onDownloadIframeLoad).toHaveBeenCalledTimes(1);
    });

    it("hides info row when showInfo is false", () => {
        const vm = new TestViewModel({
            ...defaultSnapshot,
            showInfo: false,
        });

        renderWithI18n(<MFileBodyView vm={vm} />);

        expect(screen.queryByRole("button", { name: "spec.pdf" })).not.toBeInTheDocument();
    });
});
