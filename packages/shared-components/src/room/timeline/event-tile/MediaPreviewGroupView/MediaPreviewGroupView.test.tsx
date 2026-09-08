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

import { MockViewModel } from "../../../../core/viewmodel";
import {
    MediaPreviewGroupPreview,
    type MediaPreviewGroupEntry,
    type MediaPreviewGroupSnapshot,
} from "./MediaPreviewGroupView";
import * as stories from "./MediaPreviewGroupView.stories";
import demoImage from "../../../../../static/wideImage.png";
import demoVideo from "../../../../../static/videoPreviewDemo.webm?inline";
import demoAudio from "../../../../../static/audioDemo.ogg";

const { AllTypes, SingleText, Collapsed, Expanded } = composeStories(stories);

const icon = { icon: <span data-testid="icon">icon</span>, color: "rgb(66, 0, 166)" };

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

const textEntry: MediaPreviewGroupEntry = {
    ...icon,
    id: "annual-report.pdf",
    type: "text",
    header: "annual-report.pdf",
    body: "2.3 MB",
};

const secondTextEntry: MediaPreviewGroupEntry = {
    ...textEntry,
    id: "minutes.txt",
    header: "minutes.txt",
    body: "4 KB",
};

function renderGroup(
    entries: Array<MediaPreviewGroupEntry>,
    collapse?: MediaPreviewGroupSnapshot["collapse"],
): ReturnType<typeof render> {
    const vm = new MockViewModel<MediaPreviewGroupSnapshot>({ entries, collapse });
    return render(<MediaPreviewGroupPreview vm={vm} />);
}

describe("MediaPreviewGroupPreview", () => {
    it("renders nothing when there are no entries", () => {
        const { container } = renderGroup([]);

        expect(container).toBeEmptyDOMElement();
    });

    it("renders one tile per entry", () => {
        renderGroup([textEntry, secondTextEntry]);

        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
        expect(screen.getByText("minutes.txt")).toBeInTheDocument();
    });

    it("renders a tile for every entry type", async () => {
        const { container } = renderGroup([
            textEntry,
            {
                ...icon,
                id: "image",
                type: "image",
                image: demoImage,
                imageAlt: "i",
                imageSize: "banner",
                header: "i",
                body: "i",
            },
            { ...icon, id: "video", type: "video", video: demoVideo, videoSize: "banner", header: "v", body: "v" },
            { ...icon, id: "audio", type: "audio", audio: demoAudio, header: "a", body: "a" },
        ]);

        await waitForImage(container);
        await waitForMedia(container, "video");
        await waitForMedia(container, "audio");
        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
    });

    it("renders no collapse toggle when the group is not collapsible", () => {
        renderGroup([textEntry]);

        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    describe("collapse toggle", () => {
        it("offers to show the remaining entries while collapsed", async () => {
            const user = userEvent.setup();
            const onToggle = vi.fn();

            renderGroup([textEntry], { collapsed: true, hiddenCount: 3, onToggle });

            await user.click(screen.getByRole("button", { name: "Show 3 other previews" }));

            expect(onToggle).toHaveBeenCalledTimes(1);
        });

        it("uses the singular label for a single hidden entry", () => {
            renderGroup([textEntry], { collapsed: true, hiddenCount: 1, onToggle: vi.fn() });

            expect(screen.getByRole("button", { name: "Show 1 other preview" })).toBeInTheDocument();
        });

        it("offers to collapse the group again while expanded", async () => {
            const user = userEvent.setup();
            const onToggle = vi.fn();

            renderGroup([textEntry, secondTextEntry], { collapsed: false, hiddenCount: 0, onToggle });

            await user.click(screen.getByRole("button", { name: "Collapse" }));

            expect(onToggle).toHaveBeenCalledTimes(1);
        });
    });

    describe("stories", () => {
        it("renders the single text story", () => {
            const { container } = render(<SingleText />);

            expect(container).toMatchSnapshot();
        });

        it("renders every entry type", async () => {
            const { container } = render(<AllTypes />);

            await waitForImage(container);
            expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
            expect(screen.getByText("screenshot.png")).toBeInTheDocument();
            expect(screen.getByText("holiday-clip.mp4")).toBeInTheDocument();
            expect(screen.getByText("voice-message.mp3")).toBeInTheDocument();
        });

        it("renders the collapsed story", () => {
            render(<Collapsed />);

            expect(screen.getByRole("button", { name: "Show 3 other previews" })).toBeInTheDocument();
        });

        it("renders the expanded story", () => {
            render(<Expanded />);

            expect(screen.getByRole("button", { name: "Collapse" })).toBeInTheDocument();
        });
    });
});
