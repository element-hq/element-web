/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React from "react";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "./UserTab";
import GenericFeatureFeedbackDialog from "./GenericFeatureFeedbackDialog";

// XXX: Keep this around for re-use in future Betas

interface IProps {
    featureId: string;
    onFinished(sendFeedback?: boolean): void;
}

const BetaFeedbackDialog: React.FC<IProps> = ({ featureId, onFinished }) => {
    const info = SettingsStore.getBetaInfo(featureId);
    if (!info) return null;

    return (
        <GenericFeatureFeedbackDialog
            title={_t("%(featureName)s Beta feedback", { featureName: info.title })}
            subheading={info.feedbackSubheading ? _t(info.feedbackSubheading) : undefined}
            onFinished={onFinished}
            rageshakeLabel={info.feedbackLabel}
            rageshakeData={Object.fromEntries(
                (SettingsStore.getBetaInfo(featureId)?.extraSettings || []).map((k) => {
                    return SettingsStore.getValue(k);
                }),
            )}
        >
            <AccessibleButton
                kind="link_inline"
                onClick={() => {
                    onFinished();
                    defaultDispatcher.dispatch({
                        action: Action.ViewUserSettings,
                        initialTabId: UserTab.Labs,
                    });
                }}
            >
                {_t("To leave the beta, visit your settings.")}
            </AccessibleButton>
        </GenericFeatureFeedbackDialog>
    );
};

export default BetaFeedbackDialog;
