/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { createContext, useContext } from "react";

import type { LinkEventListener, LinkifyMatrixOpaqueIdType } from "../linkify";

export interface LinkedTextConfiguration {
    /**
     * Event handlers for URL links.
     */
    urlListener?: (href: string) => LinkEventListener;
    /**
     * Event handlers for room alias links.
     */
    roomAliasListener?: (href: string) => LinkEventListener;
    /**
     * Event handlers for user ID links.
     */
    userIdListener?: (href: string) => LinkEventListener;
    /**
     * Function that can be used to transform the `target` attribute on links, depending on the `href`.
     */
    urlTargetTransformer?: (href: string) => string;
    /**
     * Function that can be used to transform the `href` attribute on links, depending on the current href and target type.
     */
    hrefTransformer?: (href: string, target: LinkifyMatrixOpaqueIdType) => string;
}

export const LinkedTextContext = createContext<LinkedTextConfiguration | null>(null);
LinkedTextContext.displayName = "LinkedTextContext";

/**
 * A hook to get the linked text configuration from the context. Will throw if no LinkedTextContext is found.
 * @throws If no LinkedTextContext context is found
 * @returns The linked text configuration from the context
 */
export function useLinkedTextContext(): LinkedTextConfiguration {
    const config = useContext(LinkedTextContext);

    if (!config) {
        throw new Error("useLinkedTextContextOpts must be used within an LinkedTextContext.Provider");
    }
    return config;
}
