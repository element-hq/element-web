/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React from "react";

import { _t } from "../../../languageHandler";
import { UseCase } from "../../../settings/enums/UseCase";
import AccessibleButton from "./AccessibleButton";

interface Props {
    useCase: UseCase;
    selected: boolean;
    onClick: (useCase: UseCase) => void;
}

export function UseCaseSelectionButton({ useCase, onClick, selected }: Props): JSX.Element {
    let label: string | undefined;
    switch (useCase) {
        case UseCase.PersonalMessaging:
            label = _t("onboarding|use_case_personal_messaging");
            break;
        case UseCase.WorkMessaging:
            label = _t("onboarding|use_case_work_messaging");
            break;
        case UseCase.CommunityMessaging:
            label = _t("onboarding|use_case_community_messaging");
            break;
    }

    return (
        <AccessibleButton
            className={classNames("mx_UseCaseSelectionButton", {
                mx_UseCaseSelectionButton_selected: selected,
            })}
            onClick={async () => onClick(useCase)}
        >
            <div
                className={classNames("mx_UseCaseSelectionButton_icon", {
                    mx_UseCaseSelectionButton_messaging: useCase === UseCase.PersonalMessaging,
                    mx_UseCaseSelectionButton_work: useCase === UseCase.WorkMessaging,
                    mx_UseCaseSelectionButton_community: useCase === UseCase.CommunityMessaging,
                })}
            />
            <span>{label}</span>
            <div className="mx_UseCaseSelectionButton_selectedIcon" />
        </AccessibleButton>
    );
}
