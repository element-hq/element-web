/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import AccessibleButton from "../elements/AccessibleButton";
import { Icon as BackIcon } from "../../../../res/img/element-icons/caret-left.svg";
import { Icon as CloseIcon } from "../../../../res/img/element-icons/cancel-rounded.svg";
import { _t } from "../../../languageHandler";

interface Props {
    onCancel: () => void;
    onBack: () => void;
    displayBack?: boolean;
}

const ShareDialogButtons: React.FC<Props> = ({ onBack, onCancel, displayBack }) => {
    return (
        <div className="mx_ShareDialogButtons">
            {displayBack && (
                <AccessibleButton
                    className="mx_ShareDialogButtons_button left"
                    data-testid="share-dialog-buttons-back"
                    aria-label={_t("action|back")}
                    onClick={onBack}
                    element="button"
                >
                    <BackIcon className="mx_ShareDialogButtons_button-icon" />
                </AccessibleButton>
            )}
            <AccessibleButton
                className="mx_ShareDialogButtons_button right"
                data-testid="share-dialog-buttons-cancel"
                aria-label={_t("action|close")}
                onClick={onCancel}
                element="button"
            >
                <CloseIcon className="mx_ShareDialogButtons_button-icon" />
            </AccessibleButton>
        </div>
    );
};

export default ShareDialogButtons;
