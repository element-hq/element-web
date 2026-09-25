/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

// @vitest-environment happy-dom

import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";

import { MarkdownViewer } from "./MarkdownViewer";
import { type MarkdownMedia } from "../../../@types/markdown-viewer";
import { stubClient } from "../../../test/test-utils";

function media(body = "# Hello\n\nSome text.\n", name = "README.md", size?: number): MarkdownMedia {
    return {
        uri: `mxc://example.org/${name}`,
        name,
        size,
        blob: vi.fn(async () => new Blob([body], { type: "text/markdown" })),
    };
}

describe("MarkdownViewer", () => {
    beforeEach(() => {
        stubClient();
        window.location.hash = "";
    });

    it("renders the document once it has loaded", async () => {
        render(<MarkdownViewer media={media()} />);

        expect(screen.getByRole("status")).toHaveTextContent("Loading document");

        expect(await screen.findByRole("heading", { name: "Hello" })).toBeInTheDocument();
        expect(screen.getByText("Some text.")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("strips scripts before the document reaches the DOM", async () => {
        render(<MarkdownViewer media={media("# Safe\n\n<script>window.pwned = true</script>\n")} />);

        await screen.findByRole("heading", { name: "Safe" });

        expect(screen.getByTestId("markdown-content").innerHTML).not.toContain("<script");
        expect(screen.getByTestId("markdown-content").innerHTML).not.toContain("pwned");
    });

    it("refuses a file the sender declares as too large without downloading it", async () => {
        const tooLarge = media("# Hi\n", "huge.md", 3 * 1024 * 1024);

        render(<MarkdownViewer media={tooLarge} />);

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Unable to load this file."));
        expect(tooLarge.blob).not.toHaveBeenCalled();
    });

    it("refuses a file that turns out to be too large once downloaded", async () => {
        const claimedSmall = media("# Hi\n", "huge.md", 1024);
        vi.mocked(claimedSmall.blob).mockResolvedValue({
            size: 3 * 1024 * 1024,
            arrayBuffer: vi.fn(),
        } as unknown as Blob);

        render(<MarkdownViewer media={claimedSmall} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this file.");
    });

    it("shows a clear error when the attachment is empty", async () => {
        render(<MarkdownViewer media={media("", "empty.md")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this file.");
    });

    it("shows a clear error when the attachment is not text", async () => {
        render(<MarkdownViewer media={media("\u0000\u0001\u0002 not text", "binary.md")} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this file.");
    });

    it("shows a clear error when the file cannot be fetched", async () => {
        const broken = media();
        vi.mocked(broken.blob).mockRejectedValue(new Error("download failed"));

        render(<MarkdownViewer media={broken} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this file.");
    });

    it("follows permalinks within the app", async () => {
        const user = userEvent.setup();
        render(<MarkdownViewer media={media("[our room](https://matrix.to/#/#room:example.org)\n")} />);

        await user.click(await screen.findByRole("link", { name: "our room" }));

        expect(window.location.hash).toBe("#/room/#room:example.org");
    });

    it("leaves other links to the browser", async () => {
        const user = userEvent.setup();
        render(<MarkdownViewer media={media("[docs](https://example.org/docs)\n")} />);

        const link = await screen.findByRole("link", { name: "docs" });
        // The sanitizer makes external links open in a new tab, so clicking one here does not navigate.
        expect(link).toHaveAttribute("target", "_blank");

        await user.click(link);

        expect(window.location.hash).toBe("");
    });

    it("loads the new file when handed different media", async () => {
        const { rerender } = render(<MarkdownViewer media={media("# First\n", "first.md")} />);
        await screen.findByRole("heading", { name: "First" });

        rerender(<MarkdownViewer media={media("# Second\n", "second.md")} />);

        expect(await screen.findByRole("heading", { name: "Second" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "First" })).not.toBeInTheDocument();
    });
});
