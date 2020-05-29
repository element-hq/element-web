/*
Copyright 2020 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, {useState} from "react";

import {UpdateCheckStatus} from "../../../BasePlatform";
import PlatformPeg from "../../../PlatformPeg";
import {useDispatcher} from "../../../hooks/useDispatcher";
import dis from "../../../dispatcher/dispatcher";
import {Action} from "../../../dispatcher/actions";
import {_t} from "../../../languageHandler";
import InlineSpinner from "../../../components/views/elements/InlineSpinner";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";
import {CheckUpdatesPayload} from "../../../dispatcher/payloads/CheckUpdatesPayload";

function installUpdate() {
    PlatformPeg.get().installUpdate();
}

function getStatusText(status: UpdateCheckStatus, errorDetail?: string) {
    switch (status) {
        case UpdateCheckStatus.Error:
            return _t('Error encountered (%(errorDetail)s).', { errorDetail });
        case UpdateCheckStatus.Checking:
            return _t('Checking for an update...');
        case UpdateCheckStatus.NotAvailable:
            return _t('No update available.');
        case UpdateCheckStatus.Downloading:
            return _t('Downloading update...');
        case UpdateCheckStatus.Ready:
            return _t("New version available. <a>Update now.</a>", {}, {
                a: sub => <AccessibleButton kind="link" onClick={installUpdate}>{sub}</AccessibleButton>
            });
    }
}

const doneStatuses = [
    UpdateCheckStatus.Ready,
    UpdateCheckStatus.Error,
    UpdateCheckStatus.NotAvailable,
];

const UpdateCheckButton = () => {
    const [state, setState] = useState<CheckUpdatesPayload>(null);

    const onCheckForUpdateClick = () => {
        setState(null);
        PlatformPeg.get().startUpdateCheck();
    };

    useDispatcher(dis, ({action, ...params}) => {
        if (action === Action.CheckUpdates) {
            setState(params as CheckUpdatesPayload);
        }
    });

    const busy = state && !doneStatuses.includes(state.status);

    let suffix;
    if (state) {
        suffix = <span className="mx_UpdateCheckButton_summary">
            {getStatusText(state.status, state.detail)}
            {busy && <InlineSpinner />}
        </span>;
    }

    return <React.Fragment>
        <AccessibleButton onClick={onCheckForUpdateClick} kind="primary" disabled={busy}>
            {_t("Check for update")}
        </AccessibleButton>
        { suffix }
    </React.Fragment>;
};

export default UpdateCheckButton;
