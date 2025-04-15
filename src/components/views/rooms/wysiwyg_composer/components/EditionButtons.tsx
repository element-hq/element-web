/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";

import { _t } from "../../../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../../../elements/AccessibleButton";

interface EditionButtonsProps {
    onCancelClick: (e: ButtonEvent) => void;
    onSaveClick: (e: ButtonEvent) => void;
    isSaveDisabled?: boolean;
}

export function EditionButtons({
    onCancelClick,
    onSaveClick,
    isSaveDisabled = false,
}: EditionButtonsProps): JSX.Element {
    return (
        <div className="mx_EditWysiwygComposer_buttons">
            <AccessibleButton kind="secondary" onClick={onCancelClick}>
                {_t("action|cancel")}
            </AccessibleButton>
            <AccessibleButton kind="primary" onClick={onSaveClick} disabled={isSaveDisabled}>
                {_t("action|save")}
            </AccessibleButton>
        </div>
    );
}
