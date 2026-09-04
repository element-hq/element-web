/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "@test-utils";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Audio, Body, Buttons, Header, Icon, Image, LeftGroup, TextContent, Video } from "./MediaPreviewComponents";
import demoImage from "../../../../../../static/wideImage.png";
import demoVideo from "../../../../../../static/videoPreviewDemo.webm?inline";
import demoAudio from "../../../../../../static/audioDemo.ogg";

/** A syntactically valid data URI which does not decode into anything. */
const BROKEN_SRC = "data:application/octet-stream;base64,AAAAAAAA";

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

describe("MediaPreviewComponents", () => {
    it("renders the header children", () => {
        render(<Header>annual-report.pdf</Header>);

        expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
    });

    it("renders the body", () => {
        render(<Body>2.3 MB</Body>);

        expect(screen.getByText("2.3 MB")).toBeInTheDocument();
    });

    describe("TextContent", () => {
        it("renders plain text when there is no headerUrl", () => {
            render(<TextContent header="annual-report.pdf" body="2.3 MB" />);

            expect(screen.getByText("annual-report.pdf")).toBeInTheDocument();
            expect(screen.queryByRole("link")).not.toBeInTheDocument();
        });

        it("renders the header as a link opening in a new tab when there is a headerUrl", () => {
            render(<TextContent header="example.com" headerUrl="https://example.com/page" body="A page" />);

            const link = screen.getByRole("link", { name: "example.com" });
            expect(link).toHaveAttribute("href", "https://example.com/page");
            expect(link).toHaveAttribute("target", "_blank");
        });

        it("renders the header and body together as text content", () => {
            render(<TextContent header="example.com" headerUrl="https://example.com/page" body="A page" />);

            expect(screen.getByRole("link", { name: "example.com" })).toBeInTheDocument();
            expect(screen.getByText("A page")).toBeInTheDocument();
        });
    });

    it("renders its children in a left group", () => {
        render(
            <LeftGroup>
                <span>child</span>
            </LeftGroup>,
        );

        expect(screen.getByText("child")).toBeInTheDocument();
    });

    describe("Icon", () => {
        it("renders a non-interactive icon tinted with the given colour", () => {
            render(<Icon icon={<span data-testid="icon">icon</span>} color="rgb(66, 0, 166)" />);

            expect(screen.getByTestId("icon")).toHaveStyle({ color: "rgb(66, 0, 166)" });
            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });

        it("renders a button which invokes onClick", async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<Icon icon={<span data-testid="icon">icon</span>} color="rgb(66, 0, 166)" onClick={onClick} />);

            await user.click(screen.getByRole("button", { name: "View file" }));

            expect(onClick).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId("icon")).toHaveStyle({ color: "rgb(66, 0, 166)" });
        });
    });

    describe("Buttons", () => {
        it("renders one labelled button per entry and invokes the matching handler", async () => {
            const user = userEvent.setup();
            const onExpand = vi.fn();
            const onDownload = vi.fn();

            render(
                <Buttons
                    buttons={[
                        { label: "Expand", icon: <span>expand</span>, onClick: onExpand },
                        { label: "Download", icon: <span>download</span>, onClick: onDownload },
                    ]}
                />,
            );

            expect(screen.getAllByRole("button")).toHaveLength(2);

            await user.click(screen.getByRole("button", { name: "Download" }));

            expect(onDownload).toHaveBeenCalledTimes(1);
            expect(onExpand).not.toHaveBeenCalled();
        });

        it("renders nothing for an empty list", () => {
            render(<Buttons buttons={[]} />);

            expect(screen.queryByRole("button")).not.toBeInTheDocument();
        });
    });

    describe("media validity", () => {
        // The validity checks log to the console when the media fails to load, which is the
        // expected path for half of these tests.
        beforeEach(() => {
            vi.spyOn(console, "error").mockImplementation(() => {});
        });

        afterEach(() => {
            vi.restoreAllMocks();
        });

        describe("Image", () => {
            it("renders an image which loads", async () => {
                const { container } = render(
                    <Image image={demoImage} imageAlt="A wide demo image" imageSize="banner" />,
                );

                await waitForImage(container);
                expect(container.querySelector("img")).toHaveAttribute("src", demoImage);
                expect(screen.queryByRole("button")).not.toBeInTheDocument();
            });

            it("stops rendering an image which fails to load", async () => {
                const { container } = render(
                    <Image image={BROKEN_SRC} imageAlt="A wide demo image" imageSize="banner" />,
                );

                await waitFor(() => expect(container).toBeEmptyDOMElement());
                expect(console.error).toHaveBeenCalled();
            });

            it("hides the previous image until the new source has been checked", async () => {
                const { container, rerender } = render(
                    <Image image={demoImage} imageAlt="A wide demo image" imageSize="banner" />,
                );
                await waitForImage(container);

                rerender(<Image image={BROKEN_SRC} imageAlt="A wide demo image" imageSize="banner" />);

                // The stale validity state is for the old source, so nothing is shown for the new one.
                expect(container).toBeEmptyDOMElement();
            });

            it("distinguishes banner and full sizes by class", async () => {
                const { container, rerender } = render(
                    <Image image={demoImage} imageAlt="A wide demo image" imageSize="banner" />,
                );
                await waitForImage(container);

                const bannerClass = container.firstElementChild!.className;

                rerender(<Image image={demoImage} imageAlt="A wide demo image" imageSize="full" />);

                expect(container.firstElementChild!.className).not.toEqual(bannerClass);
            });

            it("wraps the image in a button when imageOnClick is given", async () => {
                const user = userEvent.setup();
                const imageOnClick = vi.fn();

                const { container } = render(
                    <Image
                        image={demoImage}
                        imageAlt="A wide demo image"
                        imageSize="full"
                        imageOnClick={imageOnClick}
                    />,
                );
                await waitForImage(container);

                await user.click(screen.getByRole("button", { name: "View image" }));

                expect(imageOnClick).toHaveBeenCalledTimes(1);
            });
        });

        describe("Video", () => {
            it("renders a video which loads, fetching only its metadata", async () => {
                const { container } = render(<Video video={demoVideo} videoSize="banner" />);
                await waitForMedia(container, "video");
                expect(container.querySelector("video")).toHaveAttribute("preload", "metadata");
                expect(screen.queryByRole("button")).not.toBeInTheDocument();
            });

            it("stops rendering a video which fails to load", async () => {
                const { container } = render(<Video video={BROKEN_SRC} videoSize="banner" />);

                await waitFor(() => expect(container).toBeEmptyDOMElement());
                expect(console.error).toHaveBeenCalled();
            });

            it("wraps the video in a button when videoOnClick is given", async () => {
                const user = userEvent.setup();
                const videoOnClick = vi.fn();

                const { container } = render(<Video video={demoVideo} videoSize="full" videoOnClick={videoOnClick} />);
                await waitForMedia(container, "video");

                await user.click(screen.getByRole("button", { name: "View video" }));

                expect(videoOnClick).toHaveBeenCalledTimes(1);
            });
        });

        describe("Audio", () => {
            it("renders audio which loads", async () => {
                const { container } = render(<Audio audio={demoAudio} />);
                await waitForMedia(container, "audio");
                expect(container.querySelector("audio")).toHaveAttribute("controls");
                expect(screen.queryByRole("button")).not.toBeInTheDocument();
            });

            it("stops rendering audio which fails to load", async () => {
                const { container } = render(<Audio audio={BROKEN_SRC} />);

                await waitFor(() => expect(container).toBeEmptyDOMElement());
                expect(console.error).toHaveBeenCalled();
            });

            it("wraps the audio in a button when audioOnClick is given", async () => {
                const user = userEvent.setup();
                const audioOnClick = vi.fn();

                const { container } = render(<Audio audio={demoAudio} audioOnClick={audioOnClick} />);
                await waitForMedia(container, "audio");

                await user.click(screen.getByRole("button", { name: "View audio" }));

                expect(audioOnClick).toHaveBeenCalledTimes(1);
            });
        });
    });
});
