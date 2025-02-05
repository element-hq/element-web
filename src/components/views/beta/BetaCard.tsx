/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, useState } from "react";
import { sleep } from "matrix-js-sdk/src/utils";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import Modal from "../../../Modal";
import BetaFeedbackDialog from "../dialogs/BetaFeedbackDialog";
import SdkConfig from "../../../SdkConfig";
import SettingsFlag from "../elements/SettingsFlag";
import { useFeatureEnabled } from "../../../hooks/useSettings";
import InlineSpinner from "../elements/InlineSpinner";
import { shouldShowFeedback } from "../../../utils/Feedback";
import { type FeatureSettingKey } from "../../../settings/Settings.tsx";

// XXX: Keep this around for re-use in future Betas

interface IProps {
    title?: string;
    featureId: FeatureSettingKey;
}

interface IBetaPillProps {
    onClick?: () => void;
    tooltipTitle?: string;
    tooltipCaption?: string;
}

export const BetaPill: React.FC<IBetaPillProps> = ({
    onClick,
    tooltipTitle = _t("labs|beta_feature"),
    tooltipCaption = _t("labs|click_for_info"),
}) => {
    if (onClick) {
        return (
            <AccessibleButton
                className="mx_BetaCard_betaPill"
                aria-label={`${tooltipTitle} ${tooltipCaption}`}
                title={tooltipTitle}
                caption={tooltipCaption}
                onClick={onClick}
            >
                {_t("common|beta")}
            </AccessibleButton>
        );
    }

    return <span className="mx_BetaCard_betaPill">{_t("common|beta")}</span>;
};

const BetaCard: React.FC<IProps> = ({ title: titleOverride, featureId }) => {
    const info = SettingsStore.getBetaInfo(featureId);
    const value = useFeatureEnabled(featureId);
    const [busy, setBusy] = useState(false);
    if (!info) return null; // Beta is invalid/disabled

    const { title, caption, faq, image, feedbackLabel, feedbackSubheading, extraSettings, requiresRefresh } = info;

    let feedbackButton;
    if (value && feedbackLabel && feedbackSubheading && shouldShowFeedback()) {
        feedbackButton = (
            <AccessibleButton
                onClick={() => {
                    Modal.createDialog(BetaFeedbackDialog, { featureId });
                }}
                kind="primary"
            >
                {_t("common|feedback")}
            </AccessibleButton>
        );
    }

    let refreshWarning: string | undefined;
    if (requiresRefresh) {
        const brand = SdkConfig.get().brand;
        refreshWarning = value ? _t("labs|leave_beta_reload", { brand }) : _t("labs|join_beta_reload", { brand });
    }

    let content: ReactNode;
    if (busy) {
        content = <InlineSpinner />;
    } else if (value) {
        content = _t("labs|leave_beta");
    } else {
        content = _t("labs|join_beta");
    }

    return (
        <div className="mx_BetaCard">
            <div className="mx_BetaCard_columns">
                <div className="mx_BetaCard_columns_description">
                    <h3 className="mx_BetaCard_title">
                        <span>{titleOverride || _t(title)}</span>
                        <BetaPill />
                    </h3>
                    <div className="mx_BetaCard_caption">{caption()}</div>
                    <div className="mx_BetaCard_buttons">
                        {feedbackButton}
                        <AccessibleButton
                            onClick={async (): Promise<void> => {
                                setBusy(true);
                                // make it look like we're doing something for two seconds,
                                // otherwise users think clicking did nothing
                                if (!requiresRefresh) {
                                    await sleep(2000);
                                }
                                await SettingsStore.setValue(featureId, null, SettingLevel.DEVICE, !value);
                                if (!requiresRefresh) {
                                    setBusy(false);
                                }
                            }}
                            kind={feedbackButton ? "primary_outline" : "primary"}
                            disabled={busy}
                        >
                            {content}
                        </AccessibleButton>
                    </div>
                    {refreshWarning && <div className="mx_BetaCard_refreshWarning">{refreshWarning}</div>}
                    {faq && <div className="mx_BetaCard_faq">{faq(value)}</div>}
                </div>
                <div className="mx_BetaCard_columns_image_wrapper">
                    <img className="mx_BetaCard_columns_image" src={image} alt="" />
                </div>
            </div>
            {extraSettings && value && (
                <div className="mx_BetaCard_relatedSettings">
                    {extraSettings.map((key) => (
                        <SettingsFlag key={key} name={key} level={SettingLevel.DEVICE} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default BetaCard;
