/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import InlineSpinner from "../elements/InlineSpinner";
import { _t } from "../../../languageHandler";

/** The common body of components that show the progress of sending room invites. */
const InviteProgressBody: React.FC = () => {
    return (
        <div className="mx_InviteProgressBody">
            <InlineSpinner w={32} h={32} />
            <h1>{_t("invite|progress|preparing")}</h1>
            {_t("invite|progress|dont_close")}
        </div>
    );
};

export default InviteProgressBody;
