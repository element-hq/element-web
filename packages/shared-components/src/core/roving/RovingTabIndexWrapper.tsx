/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type ReactElement, type RefCallback, type RefObject } from "react";

import type React from "react";
import { useRovingTabIndex } from "./RovingTabIndex";

interface IProps {
    inputRef?: RefObject<HTMLElement | null>;
    children(
        this: void,
        renderProps: {
            onFocus: () => void;
            isActive: boolean;
            ref: RefCallback<HTMLElement>;
        },
    ): ReactElement;
}

// Wrapper to allow use of useRovingTabIndex outside of React Functional Components.
export const RovingTabIndexWrapper: React.FC<IProps> = ({ children, inputRef }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return children({ onFocus, isActive, ref });
};
