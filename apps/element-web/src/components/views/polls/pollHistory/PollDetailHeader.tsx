/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import LeftCaretIcon from "@vector-im/compound-design-tokens/assets/web/icons/chevron-left";

import { _t } from "../../../../languageHandler";
import AccessibleButton from "../../elements/AccessibleButton";
import { type PollHistoryFilter } from "./types";

interface Props {
    filter: PollHistoryFilter;
    onNavigateBack: () => void;
}

export const PollDetailHeader: React.FC<Props> = ({ filter, onNavigateBack }) => {
    return (
        <AccessibleButton kind="content_inline" onClick={onNavigateBack} className="mx_PollDetailHeader">
            <LeftCaretIcon className="mx_PollDetailHeader_icon" />
            {filter === "ACTIVE" ? _t("right_panel|poll|active_heading") : _t("right_panel|poll|past_heading")}
        </AccessibleButton>
    );
};
