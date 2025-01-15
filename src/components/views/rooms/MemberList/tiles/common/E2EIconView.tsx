/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { Tooltip } from "@vector-im/compound-web";
import VerifiedIcon from "@vector-im/compound-design-tokens/assets/web/icons/verified";
import ErrorIcon from "@vector-im/compound-design-tokens/assets/web/icons/error";

import { _t } from "../../../../../../languageHandler";
import { E2EStatus } from "../../../../../../utils/ShieldUtils";
import { crossSigningUserTitles } from "../../../E2EIcon";

function getIconFromStatus(status: E2EStatus): React.JSX.Element | undefined {
    switch (status) {
        case E2EStatus.Normal:
            return undefined;
        case E2EStatus.Verified:
            return <VerifiedIcon height="16px" width="16px" className="mx_E2EIconView_verified" />;
        case E2EStatus.Warning:
            return <ErrorIcon height="16px" width="16px" className="mx_E2EIconView_warning" />;
    }
}

interface Props {
    status: E2EStatus;
}

export const E2EIconView: React.FC<Props> = ({ status }) => {
    const e2eTitle = crossSigningUserTitles[status];
    const label = e2eTitle ? _t(e2eTitle) : "";

    const icon = getIconFromStatus(status);
    if (!icon) return null;

    return (
        <Tooltip label={label}>
            <div className="mx_E2EIconView">{icon}</div>
        </Tooltip>
    );
};
