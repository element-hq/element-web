/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@test-utils";

import { ViewportList } from "./ViewportList";

const makeItems = (count: number): string[] => Array.from({ length: count }, (_, index) => `Row ${index + 1}`);

describe("ViewportList", () => {
    it("renders with the default overflow values and updates when the list size changes", () => {
        const items = makeItems(50);
        const { container, rerender } = render(
            <ViewportList
                itemHeight={10}
                items={items}
                scrollTop={0}
                height={20}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        const list = container.firstElementChild as HTMLElement;
        expect(list.children).toHaveLength(22);
        expect(list.getAttribute("style")).toContain("padding-bottom: 280px;");

        rerender(
            <ViewportList
                itemHeight={10}
                items={makeItems(60)}
                scrollTop={0}
                height={20}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        expect(list.children).toHaveLength(22);
        expect(list.getAttribute("style")).toContain("padding-bottom: 380px;");
    });

    it("forwards DOM props to the rendered element", () => {
        const { container } = render(
            <ViewportList
                as="section"
                itemHeight={10}
                items={["A"]}
                scrollTop={0}
                height={10}
                className="custom-viewport-list"
                role="grid"
                aria-label="Viewport list"
                data-testid="viewport-list"
                style={{ backgroundColor: "rgb(1, 2, 3)" }}
                renderItem={(item) => <div key={item}>{item}</div>}
            />,
        );

        const list = container.firstElementChild as HTMLElement;
        expect(list.tagName).toBe("SECTION");
        expect(list.className).toContain("custom-viewport-list");
        expect(list.getAttribute("role")).toBe("grid");
        expect(list.getAttribute("aria-label")).toBe("Viewport list");
        expect(list.getAttribute("data-testid")).toBe("viewport-list");
        expect(list.getAttribute("style")).toContain("background-color: rgb(1, 2, 3);");
        expect(list.getAttribute("style")).toContain("padding-top: 0px;");
    });

    it("keeps the same window when scrolling within the buffered range", () => {
        const items = makeItems(50);
        const { container, rerender } = render(
            <ViewportList
                itemHeight={10}
                items={items}
                scrollTop={0}
                height={20}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        const list = container.firstElementChild as HTMLElement;
        expect(Array.from(list.children)).toHaveLength(22);
        expect(list.firstElementChild?.textContent).toBe("Row 1");
        expect(list.lastElementChild?.textContent).toBe("Row 22");

        rerender(
            <ViewportList
                itemHeight={10}
                items={items}
                scrollTop={10}
                height={20}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        expect(Array.from(list.children)).toHaveLength(22);
        expect(list.firstElementChild?.textContent).toBe("Row 1");
        expect(list.lastElementChild?.textContent).toBe("Row 22");
        expect(list.getAttribute("style")).toContain("padding-bottom: 280px;");
    });

    it("collapses to an empty window when the viewport height becomes zero", () => {
        const items = makeItems(50);
        const { container, rerender } = render(
            <ViewportList
                itemHeight={10}
                items={items}
                scrollTop={0}
                height={20}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        rerender(
            <ViewportList
                itemHeight={10}
                items={items}
                scrollTop={0}
                height={0}
                renderItem={(item) => <li key={item}>{item}</li>}
            />,
        );

        const list = container.firstElementChild as HTMLElement;
        expect(list.children).toHaveLength(0);
        expect(list.getAttribute("style")).toContain("padding-bottom: 500px;");
    });

    it("renders nothing when no items are provided", () => {
        const { container } = render(
            <ViewportList
                itemHeight={10}
                scrollTop={0}
                height={20}
                renderItem={(item: string) => <li key={item}>{item}</li>}
            />,
        );

        const list = container.firstElementChild as HTMLElement;
        expect(list.children).toHaveLength(0);
        expect(list.getAttribute("style")).toContain("padding-bottom: 0px;");
    });
});
