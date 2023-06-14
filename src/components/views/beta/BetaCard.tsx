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

import React, { ReactNode, useState } from "react";
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
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import { shouldShowFeedback } from "../../../utils/Feedback";

// XXX: Keep this around for re-use in future Betas

interface IProps {
    title?: string;
    featureId: string;
}

interface IBetaPillProps {
    onClick?: () => void;
    tooltipTitle?: string;
    tooltipCaption?: string;
}

export const BetaPill: React.FC<IBetaPillProps> = ({
    onClick,
    tooltipTitle = _t("This is a beta feature"),
    tooltipCaption = _t("Click for more info"),
}) => {
    if (onClick) {
        return (
            <AccessibleTooltipButton
                className="mx_BetaCard_betaPill"
                title={`${tooltipTitle} ${tooltipCaption}`}
                tooltip={
                    <div>
                        <div className="mx_Tooltip_title">{tooltipTitle}</div>
                        <div className="mx_Tooltip_sub">{tooltipCaption}</div>
                    </div>
                }
                onClick={onClick}
            >
                {_t("Beta")}
            </AccessibleTooltipButton>
        );
    }

    return <span className="mx_BetaCard_betaPill">{_t("Beta")}</span>;
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
                {_t("Feedback")}
            </AccessibleButton>
        );
    }

    let refreshWarning: string | undefined;
    if (requiresRefresh) {
        const brand = SdkConfig.get().brand;
        refreshWarning = value
            ? _t("Leaving the beta will reload %(brand)s.", { brand })
            : _t("Joining the beta will reload %(brand)s.", { brand });
    }

    let content: ReactNode;
    if (busy) {
        content = <InlineSpinner />;
    } else if (value) {
        content = _t("Leave the beta");
    } else {
        content = _t("Join the beta");
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
