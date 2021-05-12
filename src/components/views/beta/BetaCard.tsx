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
import classNames from "classnames";

import {_t} from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import SettingsStore from "../../../settings/SettingsStore";
import {SettingLevel} from "../../../settings/SettingLevel";
import TextWithTooltip from "../elements/TextWithTooltip";
import Modal from "../../../Modal";
import BetaFeedbackDialog from "../dialogs/BetaFeedbackDialog";
import SdkConfig from "../../../SdkConfig";

interface IProps {
    title?: string;
    featureId: string;
}

export const BetaPill = ({ onClick }: { onClick?: () => void }) => {
    if (onClick) {
        return <TextWithTooltip
            class={classNames("mx_BetaCard_betaPill", {
                mx_BetaCard_betaPill_clickable: !!onClick,
            })}
            tooltip={<div>
                <div className="mx_Tooltip_title">
                    { _t("Spaces is a beta feature") }
                </div>
                <div className="mx_Tooltip_sub">
                    { _t("Tap for more info") }
                </div>
            </div>}
            onClick={onClick}
            tooltipProps={{ yOffset: -10 }}
        >
            { _t("Beta") }
        </TextWithTooltip>;
    }

    return <span
        className={classNames("mx_BetaCard_betaPill", {
            mx_BetaCard_betaPill_clickable: !!onClick,
        })}
        onClick={onClick}
    >
        { _t("Beta") }
    </span>;
};

const BetaCard = ({ title: titleOverride, featureId }: IProps) => {
    const info = SettingsStore.getBetaInfo(featureId);
    if (!info) return null; // Beta is invalid/disabled

    const { title, caption, disclaimer, image, feedbackLabel, feedbackSubheading } = info;
    const value = SettingsStore.getValue(featureId);

    let feedbackButton;
    if (value && feedbackLabel && feedbackSubheading && SdkConfig.get().bug_report_endpoint_url) {
        feedbackButton = <AccessibleButton
            onClick={() => {
                Modal.createTrackedDialog("Beta Feedback", featureId, BetaFeedbackDialog, { featureId });
            }}
            kind="primary"
        >
            { _t("Feedback") }
        </AccessibleButton>;
    }

    return <div className="mx_BetaCard">
        <div>
            <h3 className="mx_BetaCard_title">
                { titleOverride || _t(title) }
                <BetaPill />
            </h3>
            <span className="mx_BetaCard_caption">{ _t(caption) }</span>
            <div>
                { feedbackButton }
                <AccessibleButton
                    onClick={() => SettingsStore.setValue(featureId, null, SettingLevel.DEVICE, !value)}
                    kind={feedbackButton ? "primary_outline" : "primary"}
                >
                    { value ? _t("Leave the beta") : _t("Join the beta") }
                </AccessibleButton>
            </div>
            { disclaimer && <div className="mx_BetaCard_disclaimer">
                { disclaimer(value) }
            </div> }
        </div>
        <img src={image} alt="" />
    </div>;
};

export default BetaCard;
