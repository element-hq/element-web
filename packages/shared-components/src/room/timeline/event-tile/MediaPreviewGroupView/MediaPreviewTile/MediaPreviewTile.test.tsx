/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { composeStories } from "@storybook/react-vite";
import { render, screen, waitFor } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
    AudioPreviewTile,
    ImagePreviewTile,
    MediaPreviewTile,
    TextPreviewTile,
    VideoPreviewTile,
} from "./MediaPreviewTile";
import * as textStories from "./TextPreviewTile.stories";
import * as imageStories from "./ImagePreviewTile.stories";
import * as videoStories from "./VideoPreviewTile.stories";
import * as audioStories from "./AudioPreviewTile.stories";
import demoImage from "../../../../../../static/wideImage.png";
import demoVideo from "../../../../../../static/videoPreviewDemo.webm?inline";
import demoAudio from "../../../../../../static/audioDemo.ogg";

const { Default: DefaultText, WithHeaderUrl, NoButtons, SideBySide: SideBySideText } = composeStories(textStories);
const { Default: DefaultImage, SideBySide: SideBySideImage, SideBySideWithButtons } = composeStories(imageStories);
const { Default: DefaultVideo } = composeStories(videoStories);
const { Default: DefaultAudio } = composeStories(audioStories);

const baseProps = {
    id: "annual-report.pdf",
    icon: <span data-testid="icon">icon</span>,
    color: "rgb(66, 0, 166)",
    header: "annual-report.pdf",
    body: "2.3 MB",
};

const textProps = { ...baseProps, type: "text" } as const;
const imageProps = {
    ...baseProps,
    type: "image",
    image: demoImage,
    imageAlt: "A wide demo image",
    imageSize: "full",
} as const;
const videoProps = { ...baseProps, type: "video", video: demoVideo, videoSize: "banner" } as const;
const audioProps = { ...baseProps, type: "audio", audio: demoAudio } as const;

// The demo media is served by the dev server, which can take a while to answer when several suites
// are running at once, so the default one second timeout is not enough.
const MEDIA_TIMEOUT = 15000;

/** Waits for the image inside `container` to have decoded, i.e. for the validity check to pass. */
function waitForImage(container: HTMLElement): Promise<void> {
    return waitFor(() => expect(container.querySelector("img")?.naturalWidth).toBeGreaterThan(0), {
        timeout: MEDIA_TIMEOUT,
    });
}

/** Waits for the video or audio element inside `container` to have loaded its metadata. */
function waitForMedia(container: HTMLElement, selector: "video" | "audio"): Promise<void> {
    return waitFor(
        () =>
            expect(container.querySelector<HTMLMediaElement>(selector)?.readyState).toBeGreaterThanOrEqual(
                HTMLMediaElement.HAVE_METADATA,
            ),
        { timeout: MEDIA_TIMEOUT },
    );
}

describe("MediaPreviewTile", () => {
    it("renders the icon and text content without any media above", () => {
        const { container } = render(<MediaPreviewTile {...baseProps} />);

        expect(screen.getByTestId("icon")).toBeInTheDocument();
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
        expect(screen.getByText("2.3 MB")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the given element above the tile", () => {
        render(
            <MediaPreviewTile {...baseProps}>
                <span data-testid="above">above</span>
            </MediaPreviewTile>,
        );

        expect(screen.getByTestId("above")).toBeInTheDocument();
    });

    it("renders the buttons when there are any", async () => {
        const user = userEvent.setup();
        const onClick = vi.fn();

        render(<MediaPreviewTile {...baseProps} buttons={[{ label: "Download", icon: <span>d</span>, onClick }]} />);

        await user.click(screen.getByRole("button", { name: "Download" }));

        expect(onClick).toHaveBeenCalledTimes(1);
    });

    it.each([
        ["no buttons property", undefined],
        ["an empty buttons list", []],
    ])("renders no button group with %s", (_name, buttons) => {
        render(<MediaPreviewTile {...baseProps} buttons={buttons} />);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("renders no icon when none is given", () => {
        const { icon: _icon, color: _color, ...propsWithoutIcon } = baseProps;
        render(<MediaPreviewTile {...propsWithoutIcon} />);

        expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
    });

    describe("side layout", () => {
        const sideProps = {
            ...baseProps,
            layout: "side",
            header: "Matrix",
            headerUrl: "https://matrix.org/",
            body: "An open network for secure, decentralised communication",
            footer: "matrix.org",
        } as const;

        it("renders the text content with its footer and without the icon", () => {
            const { container } = render(<MediaPreviewTile {...sideProps} />);

            expect(screen.getByRole("link", { name: "Matrix" })).toHaveAttribute("href", "https://matrix.org/");
            expect(screen.getByText("An open network for secure, decentralised communication")).toBeInTheDocument();
            expect(screen.getByText("matrix.org")).toBeInTheDocument();
            expect(screen.queryByTestId("icon")).not.toBeInTheDocument();
            expect(container).toMatchSnapshot();
        });

        it("renders the given media before the text content", () => {
            const { container } = render(
                <MediaPreviewTile {...sideProps}>
                    <span data-testid="media">media</span>
                </MediaPreviewTile>,
            );

            const tile = container.firstElementChild!;
            expect(tile.children[0]).toBe(screen.getByTestId("media"));
            expect(tile.children[1]).toContainElement(screen.getByText("Matrix"));
        });

        it("renders the buttons when there are any", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<MediaPreviewTile {...sideProps} buttons={[{ label: "Expand", icon: <span>e</span>, onClick }]} />);

            await user.click(screen.getByRole("button", { name: "Expand" }));

            expect(onClick).toHaveBeenCalledTimes(1);
        });
    });
});

describe("TextPreviewTile", () => {
    it("renders the default story", () => {
        const { container } = render(<DefaultText />);

        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the header as a link when the story provides a URL", () => {
        render(<WithHeaderUrl />);

        expect(screen.getByRole("link", { name: "annual-report.pdf" })).toBeInTheDocument();
    });

    it("renders no buttons when the story has none", () => {
        render(<NoButtons />);

        expect(screen.queryByRole("button", { name: "Download" })).not.toBeInTheDocument();
    });

    it("renders no media above the tile", () => {
        const { container } = render(<TextPreviewTile {...textProps} buttons={[]} />);

        expect(container.querySelector("img, video, audio")).toBeNull();
    });

    it("renders the side-by-side story with its footer", () => {
        render(<SideBySideText />);

        expect(screen.getByRole("link", { name: /The Future of Artificial Intelligence/ })).toBeInTheDocument();
        expect(screen.getByText("techcrunch.com")).toBeInTheDocument();
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
});

describe("ImagePreviewTile", () => {
    it("renders the default story with its image", async () => {
        const { container } = render(<DefaultImage />);

        await waitForImage(container);
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the image above the text content", async () => {
        const { container } = render(<ImagePreviewTile {...imageProps} />);

        await waitForImage(container);
        expect(container.querySelector("img")).toHaveAttribute("src", demoImage);
    });

    it("renders the side-by-side story with a clickable thumbnail", async () => {
        const { container } = render(<SideBySideImage />);

        await waitForImage(container);
        expect(screen.getByRole("button", { name: "View image" })).toContainElement(container.querySelector("img"));
        expect(screen.getByText("techcrunch.com")).toBeInTheDocument();
        expect(container).toMatchSnapshot();
    });

    it("renders the side-by-side story's buttons after the text", async () => {
        const { container } = render(<SideBySideWithButtons />);

        await waitForImage(container);
        expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
    });
});

describe("VideoPreviewTile", () => {
    it("renders the default story with its video", async () => {
        const { container } = render(<DefaultVideo />);

        await waitForMedia(container, "video");
        expect(screen.getByText("holiday-clip.mp4")).toBeInTheDocument();
    });

    it("renders the video above the text content", async () => {
        const { container } = render(<VideoPreviewTile {...videoProps} />);

        await waitForMedia(container, "video");
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
    });
});

describe("AudioPreviewTile", () => {
    it("renders the default story with its audio", async () => {
        const { container } = render(<DefaultAudio />);

        await waitForMedia(container, "audio");
        expect(screen.getByText("voice-message.mp3")).toBeInTheDocument();
    });

    it("renders the audio above the text content", async () => {
        const { container } = render(<AudioPreviewTile {...audioProps} />);

        await waitForMedia(container, "audio");
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
    });
});
