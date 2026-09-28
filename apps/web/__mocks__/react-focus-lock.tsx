/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

// The real `react-focus-lock` auto-focuses a candidate element inside the lock on mount, using CSS
// selectors including `:enabled` - which happy-dom's selector engine does not implement at all, so
// it falls back to focusing a dialog's own close button, which then gets a stray `aria-describedby`
// set on it by compound-web's Tooltip. Tests that don't actually exercise real focus-trap/tab-cycling
// behaviour can `vi.mock("react-focus-lock")` to pick up this passthrough instead of working around
// the underlying engine gap - it keeps only the DOM structure (`className`/`lockProps` become plain
// attributes on a wrapping `<div>`) that dialog snapshots rely on, dropping the focus side effects.
export interface MockFocusLockProps {
    children?: React.ReactNode;
    className?: string;
    lockProps?: Record<string, unknown>;
}

const FocusLock = ({ children, className, lockProps }: MockFocusLockProps): React.ReactElement => (
    <div className={className} {...lockProps}>
        {children}
    </div>
);

export default FocusLock;
