/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { Fragment, type PropsWithChildren, type ReactNode, useContext } from "react";

import { AuthHeaderContext } from "./AuthHeaderContext";

interface Props {
    title: ReactNode;
    icon?: ReactNode;
    serverPicker: ReactNode;
}

export function AuthHeaderDisplay({ title, icon, serverPicker, children }: PropsWithChildren<Props>): JSX.Element {
    const context = useContext(AuthHeaderContext);
    if (!context) {
        return <></>;
    }
    const current = context.state[0] ?? null;
    return (
        <Fragment>
            {current?.icon ?? icon}
            <h1>{current?.title ?? title}</h1>
            {children}
            {current?.hideServerPicker !== true && serverPicker}
        </Fragment>
    );
}
