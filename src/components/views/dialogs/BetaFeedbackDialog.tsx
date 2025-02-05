/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton from "../elements/AccessibleButton";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { UserTab } from "./UserTab";
import GenericFeatureFeedbackDialog from "./GenericFeatureFeedbackDialog";
import { type SettingKey } from "../../../settings/Settings.tsx";

// XXX: Keep this around for re-use in future Betas

interface IProps {
    featureId: SettingKey;
    onFinished(sendFeedback?: boolean): void;
}

const BetaFeedbackDialog: React.FC<IProps> = ({ featureId, onFinished }) => {
    const info = SettingsStore.getBetaInfo(featureId);
    if (!info) return null;

    return (
        <GenericFeatureFeedbackDialog
            title={_t("labs|beta_feedback_title", { featureName: info.title })}
            subheading={info.feedbackSubheading ? _t(info.feedbackSubheading) : undefined}
            onFinished={onFinished}
            rageshakeLabel={info.feedbackLabel}
            rageshakeData={Object.fromEntries(
                (SettingsStore.getBetaInfo(featureId)?.extraSettings || []).map((k) => {
                    return [k, SettingsStore.getValue(k)];
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
                {_t("labs|beta_feedback_leave_button")}
            </AccessibleButton>
        </GenericFeatureFeedbackDialog>
    );
};

export default BetaFeedbackDialog;
