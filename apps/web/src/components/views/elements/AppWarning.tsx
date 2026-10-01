/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { WarningIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

interface IProps {
    errorMsg?: string;
}

const AppWarning: React.FC<IProps> = (props) => {
    return (
        <div className="mx_AppWarning">
            <div>
                <WarningIcon width="24px" height="24px" />
            </div>
            <div>
                <span>{props.errorMsg || "Error"}</span>
            </div>
        </div>
    );
};

export default AppWarning;
