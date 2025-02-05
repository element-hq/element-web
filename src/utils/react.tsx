/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Utility class to render & unmount additional React roots,
 * e.g. for pills, tooltips and other components rendered atop user-generated events.
 */
export class ReactRootManager {
    private roots: Root[] = [];
    private rootElements: Element[] = [];
    private revertElements: Array<Node | null> = [];

    public get elements(): Element[] {
        return this.rootElements;
    }

    /**
     * Render a React component into a new root based on the given root element
     * @param children the React component to render
     * @param rootElement the root element to render the component into
     * @param revertElement the element to replace the root element with when unmounting
     *     needed to support double-rendering in React 18 Strict Dev mode
     */
    public render(children: ReactNode, rootElement: Element, revertElement: Node | null): void {
        const root = createRoot(rootElement);
        this.roots.push(root);
        this.rootElements.push(rootElement);
        this.revertElements.push(revertElement);
        root.render(children);
    }

    /**
     * Unmount all roots and revert the elements they were rendered into
     */
    public unmount(): void {
        while (this.roots.length) {
            const root = this.roots.pop()!;
            const rootElement = this.rootElements.pop();
            const revertElement = this.revertElements.pop();
            root.unmount();
            if (revertElement) {
                rootElement?.replaceWith(revertElement);
            }
        }
    }
}
