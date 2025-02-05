/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode } from "react";

export default class CompleteSecurityBody extends React.PureComponent<{ children: ReactNode }> {
    public render(): React.ReactNode {
        return <div className="mx_CompleteSecurityBody">{this.props.children}</div>;
    }
}
