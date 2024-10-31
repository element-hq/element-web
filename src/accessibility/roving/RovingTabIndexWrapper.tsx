/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React, { ReactElement } from "react";

import { useRovingTabIndex } from "../RovingTabIndex";
import { FocusHandler, Ref } from "./types";

interface IProps {
    inputRef?: Ref;
    children(renderProps: { onFocus: FocusHandler; isActive: boolean; ref: Ref }): ReactElement<any, any>;
}

// Wrapper to allow use of useRovingTabIndex outside of React Functional Components.
export const RovingTabIndexWrapper: React.FC<IProps> = ({ children, inputRef }) => {
    const [onFocus, isActive, ref] = useRovingTabIndex(inputRef);
    return children({ onFocus, isActive, ref });
};
