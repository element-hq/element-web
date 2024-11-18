/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import { ReactNode } from "react";
import { createRoot, Root } from "react-dom/client";

/**
 * Utility class to render & unmount additional React roots,
 * e.g. for pills, tooltips and other components rendered atop user-generated events.
 */
export class ReactRootManager {
    private roots: Root[] = [];
    private rootElements: Element[] = [];

    public get elements(): Element[] {
        return this.rootElements;
    }

    public render(children: ReactNode, element: Element): void {
        const root = createRoot(element);
        this.roots.push(root);
        this.rootElements.push(element);
        root.render(children);
    }

    public unmount(): void {
        while (this.roots.length) {
            const root = this.roots.pop()!;
            this.rootElements.pop();
            root.unmount();
        }
    }
}
