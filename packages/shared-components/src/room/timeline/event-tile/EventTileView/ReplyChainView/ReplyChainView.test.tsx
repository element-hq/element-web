/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it, vi } from "vitest";

import { fireEvent, render, screen, waitFor } from "@test-utils";
import { I18nContext } from "../../../../../core/i18n/i18nContext";
import { type I18nApi } from "../../../../../core/i18n/I18nApi";

import { ReplyChainView, type ReplyChainViewModel, type ReplyChainViewSnapshot } from "./ReplyChainView";
import styles from "./ReplyChainView.module.css";

function createViewModel(
    snapshot: ReplyChainViewSnapshot,
    actions: Pick<ReplyChainViewModel, "onQuoteClick" | "setQuoteExpanded"> = {
        onQuoteClick: vi.fn(),
        setQuoteExpanded: vi.fn(),
    },
): ReplyChainViewModel {
    return {
        getSnapshot: () => snapshot,
        subscribe: () => () => undefined,
        ...actions,
    };
}

const testI18n = {
    translate: (
        key: string,
        _variables?: unknown,
        tags?: Record<string, (sub: string) => React.ReactNode>,
    ): React.ReactNode => {
        if (key === "timeline|reply|in_reply_to") {
            return (
                <>
                    {tags?.a?.("In reply to")} {tags?.pill?.("Taylor")}
                </>
            );
        }
        if (key === "timeline|reply|in_reply_to_for_export") {
            return tags?.a?.("In reply to this message") ?? "In reply to this message";
        }
        return key;
    },
} as unknown as I18nApi;

const renderReplyChain = (ui: React.ReactElement): ReturnType<typeof render> =>
    render(ui, {
        wrapper: ({ children }) => <I18nContext.Provider value={testI18n}>{children}</I18nContext.Provider>,
    });

describe("ReplyChainView", () => {
    it("renders the loaded reply header, reply tiles, and expansion state", () => {
        const onQuoteClick = vi.fn();
        const setQuoteExpanded = vi.fn();
        const vm = createViewModel(
            {
                status: "ready",
                events: [
                    { id: "$event-1", color: 2 },
                    { id: "$event-2", color: 4 },
                ],
                headerEventId: "$event-1",
                isQuoteExpanded: true,
            },
            { onQuoteClick, setQuoteExpanded },
        );

        const { container } = renderReplyChain(
            <ReplyChainView
                vm={vm}
                renderHeaderPill={(eventId) => <span data-testid="reply-pill">Pill for {eventId}</span>}
                renderReplyTile={(event) => <span data-testid={`reply-tile-${event.id}`}>{event.id}</span>}
            />,
        );

        const root = container.querySelector("[data-reply-chain-wrapper]")!;
        expect(root).toHaveClass(styles.root);
        expect(root).toHaveAttribute("data-reply-chain-wrapper");
        expect(screen.getByTestId("reply-pill")).toHaveTextContent("Pill for $event-1");
        expect(screen.getByTestId("reply-tile-$event-1")).toBeInTheDocument();
        expect(screen.getByTestId("reply-tile-$event-2")).toBeInTheDocument();
        expect(root.querySelectorAll("[data-reply-chain]")).toHaveLength(3);
        expect(root.querySelector(`.${styles.quote}`)).toHaveClass(styles.color2, styles.expanded);
        expect(root.querySelectorAll(`.${styles.quote}`)[1]).toHaveClass(styles.color4, styles.expanded);

        fireEvent.click(screen.getByRole("button", { name: /in reply to/i }));
        expect(onQuoteClick).toHaveBeenCalledOnce();
    });

    it("renders loading, error, and export states", () => {
        const { rerender } = renderReplyChain(
            <ReplyChainView vm={createViewModel({ status: "loading", events: [] })} renderReplyTile={() => null} />,
        );
        expect(screen.getByRole("progressbar")).toBeInTheDocument();

        rerender(<ReplyChainView vm={createViewModel({ status: "error", events: [] })} renderReplyTile={() => null} />);
        expect(screen.getByText("timeline|reply|error_loading")).toBeInTheDocument();

        rerender(
            <ReplyChainView
                vm={createViewModel({ status: "export", events: [], parentEventId: "$parent" })}
                renderReplyTile={() => null}
            />,
        );
        expect(screen.getByRole("link")).toHaveAttribute("href", "#$parent");
        expect(screen.getByRole("link")).toHaveAttribute("data-scroll-to", "$parent");
    });

    it("collapses overflowing reply content when no explicit state is provided", async () => {
        vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);
        vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(150);
        const setQuoteExpanded = vi.fn();

        renderReplyChain(
            <ReplyChainView
                vm={createViewModel(
                    {
                        status: "ready",
                        events: [{ id: "$event-1", color: 1 }],
                        isQuoteExpanded: undefined,
                    },
                    { onQuoteClick: vi.fn(), setQuoteExpanded },
                )}
                renderReplyTile={() => <div className="mx_EventTile_body">Long reply</div>}
            />,
        );

        await waitFor(() => expect(setQuoteExpanded).toHaveBeenCalledWith(false));
    });
});
