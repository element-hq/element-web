/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
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
                    aria-label={_t("Back")}
                    onClick={onBack}
                    element="button"
                >
                    <BackIcon className="mx_ShareDialogButtons_button-icon" />
                </AccessibleButton>
            )}
            <AccessibleButton
                className="mx_ShareDialogButtons_button right"
                data-testid="share-dialog-buttons-cancel"
                aria-label={_t("Close")}
                onClick={onCancel}
                element="button"
            >
                <CloseIcon className="mx_ShareDialogButtons_button-icon" />
            </AccessibleButton>
        </div>
    );
};

export default ShareDialogButtons;
