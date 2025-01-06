/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import Icon from "@vector-im/compound-design-tokens/assets/web/icons/overflow-horizontal";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";

interface Props {
    // The number of remaining items
    remaining: number;
    onClick(): void;
}

/**
 * @deprecated Only used in ForwardDialog component; newer designs have moved away from this.
 */
export const OverflowTileView: React.FC<Props> = ({ remaining, onClick }) => {
    return (
        <AccessibleButton onClick={onClick} className="mx_OverflowTileView">
            <div className="mx_OverflowTileView_icon">
                <Icon height="36px" width="36px" />
            </div>
            <div className="mx_OverflowTileView_text">{_t("common|and_n_others", { count: remaining })}</div>
        </AccessibleButton>
    );
};
