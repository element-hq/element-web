/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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
            label = _t("Friends and family");
            break;
        case UseCase.WorkMessaging:
            label = _t("Coworkers and teams");
            break;
        case UseCase.CommunityMessaging:
            label = _t("Online community members");
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
