/*
Copyright 2026 bondessonr

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

// @vitest-environment happy-dom

import React, { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "test-utils-rtl";

import ScrollPanel from "./ScrollPanel";

describe("ScrollPanel", () => {
    afterEach(() => vi.restoreAllMocks());

    it("keeps a linked event in place when older events are prepended", () => {
        let heightAbove = 0;
        vi.spyOn(HTMLElement.prototype, "offsetTop", "get").mockImplementation(function (this: HTMLElement) {
            if (!this.dataset.scrollTokens) return 0;
            const index = Array.from(this.parentElement!.children).indexOf(this);
            return index * 80 + (index > 0 ? heightAbove : 0);
        });
        vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
            return this.dataset.scrollTokens ? 80 : 0;
        });

        const ref = createRef<ScrollPanel>();
        const events = (start: number): React.ReactNode =>
            Array.from({ length: 20 - start }, (_, i) => start + i).map((id) => (
                <li key={id} data-scroll-tokens={`event-${id}`}>
                    Event {id}
                </li>
            ));
        const { rerender, container } = render(
            <ScrollPanel ref={ref} stickyBottom={false} onFillRequest={async () => false}>
                {events(0)}
            </ScrollPanel>,
        );
        const scrollNode = ref.current!.divScroll!;
        const itemlist = container.querySelector("ol")!;
        Object.defineProperty(scrollNode, "clientHeight", { configurable: true, value: 300 });
        Object.defineProperty(scrollNode, "scrollHeight", {
            configurable: true,
            get: () => itemlist.children.length * 80 + heightAbove,
        });
        Object.defineProperty(itemlist, "clientHeight", {
            configurable: true,
            get: () => itemlist.children.length * 80 + heightAbove,
        });
        scrollNode.scrollBy = (_x?: number | ScrollToOptions, y?: number) => {
            scrollNode.scrollTop += y ?? 0;
        };
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
            const top = this === scrollNode ? 0 : this.offsetTop - scrollNode.scrollTop;
            return { top, bottom: top + this.clientHeight } as DOMRect;
        });

        ref.current!.scrollToToken("event-10", 0, 0.5);
        const target = container.querySelector<HTMLElement>('[data-scroll-tokens="event-10"]')!;
        const before = target.getBoundingClientRect().top;

        rerender(
            <ScrollPanel ref={ref} stickyBottom={false} onFillRequest={async () => false}>
                {events(-5)}
            </ScrollPanel>,
        );

        expect(target.getBoundingClientRect().top).toBe(before);

        // A newly loaded older tile can grow after the React update, when its content finishes rendering.
        heightAbove = 400;
        ref.current!.checkScroll();
        expect(target.getBoundingClientRect().top).toBe(before);
    });
});
