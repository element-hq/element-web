/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
// eslint-disable-next-line no-restricted-imports
import OverflowHorizontalSvg from "@vector-im/compound-design-tokens/icons/overflow-horizontal.svg";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";

interface Props {
    // The number of remaining items
    remaining: number;
    onClick(): void;
}

const OverflowTileView: React.FC<Props> = ({ remaining, onClick }) => {
    return (
        <AccessibleButton onClick={onClick} className="mx_OverflowTileView">
            <div className="mx_OverflowTileView_icon">
                <img src={OverflowHorizontalSvg} height="36px" width="36px" alt="overflow icon" />
            </div>
            <div className="mx_OverflowTileView_text">{_t("common|and_n_others", { count: remaining })}</div>
        </AccessibleButton>
    );
};

export default OverflowTileView;
