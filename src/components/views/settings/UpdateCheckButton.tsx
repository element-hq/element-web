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

import React, { ReactNode, useState } from "react";

import { UpdateCheckStatus } from "../../../BasePlatform";
import PlatformPeg from "../../../PlatformPeg";
import { useDispatcher } from "../../../hooks/useDispatcher";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { _t } from "../../../languageHandler";
import InlineSpinner from "../../../components/views/elements/InlineSpinner";
import AccessibleButton from "../../../components/views/elements/AccessibleButton";
import { CheckUpdatesPayload } from "../../../dispatcher/payloads/CheckUpdatesPayload";

function installUpdate(): void {
    PlatformPeg.get()?.installUpdate();
}

function getStatusText(status: UpdateCheckStatus, errorDetail?: string): ReactNode {
    switch (status) {
        case UpdateCheckStatus.Error:
            return _t("update|error_encountered", { errorDetail });
        case UpdateCheckStatus.Checking:
            return _t("update|checking");
        case UpdateCheckStatus.NotAvailable:
            return _t("update|no_update");
        case UpdateCheckStatus.Downloading:
            return _t("update|downloading");
        case UpdateCheckStatus.Ready:
            return _t(
                "update|new_version_available",
                {},
                {
                    a: (sub) => (
                        <AccessibleButton kind="link_inline" onClick={installUpdate}>
                            {sub}
                        </AccessibleButton>
                    ),
                },
            );
    }
}

const doneStatuses = [UpdateCheckStatus.Ready, UpdateCheckStatus.Error, UpdateCheckStatus.NotAvailable];

const UpdateCheckButton: React.FC = () => {
    const [state, setState] = useState<CheckUpdatesPayload | null>(null);

    const onCheckForUpdateClick = (): void => {
        setState(null);
        PlatformPeg.get()?.startUpdateCheck();
    };

    useDispatcher(dis, ({ action, ...params }) => {
        if (action === Action.CheckUpdates) {
            setState(params as CheckUpdatesPayload);
        }
    });

    const busy = !!state && !doneStatuses.includes(state.status);

    let suffix: JSX.Element | undefined;
    if (state) {
        suffix = (
            <span className="mx_UpdateCheckButton_summary">
                {getStatusText(state.status, state.detail)}
                {busy && <InlineSpinner />}
            </span>
        );
    }

    return (
        <React.Fragment>
            <AccessibleButton onClick={onCheckForUpdateClick} kind="primary_outline" disabled={busy}>
                {_t("update|check_action")}
            </AccessibleButton>
            {suffix}
        </React.Fragment>
    );
};

export default UpdateCheckButton;
