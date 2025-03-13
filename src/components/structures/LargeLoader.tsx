/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import Spinner from "../views/elements/Spinner";

interface LargeLoaderProps {
    text: string;
}

/**
 * Loader component that displays a (almost centered) spinner and loading message.
 */
export const LargeLoader: React.FC<LargeLoaderProps> = ({ text }) => {
    return (
        <div className="mx_LargeLoader">
            <Spinner w={45} h={45} />
            <div className="mx_LargeLoader_text">{text}</div>
        </div>
    );
};
