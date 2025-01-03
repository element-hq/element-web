/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
*/

import classNames from "classnames";
import React, { useEffect, useState } from "react";

import { _t } from "../../../languageHandler";
import { UseCase } from "../../../settings/enums/UseCase";
import SplashPage from "../../structures/SplashPage";
import AccessibleButton from "../elements/AccessibleButton";
import { UseCaseSelectionButton } from "./UseCaseSelectionButton";

interface Props {
    onFinished: (useCase: UseCase) => void;
}

const TIMEOUT = 1500;

export function UseCaseSelection({ onFinished }: Props): JSX.Element {
    const [selection, setSelected] = useState<UseCase | null>(null);

    // Call onFinished 1.5s after `selection` becomes truthy, to give time for the animation to run
    useEffect(() => {
        if (selection) {
            let handler: number | null = window.setTimeout(() => {
                handler = null;
                onFinished(selection);
            }, TIMEOUT);
            return () => {
                if (handler !== null) clearTimeout(handler);
                handler = null;
            };
        }
    }, [selection, onFinished]);

    return (
        <SplashPage
            className={classNames("mx_UseCaseSelection", {
                mx_UseCaseSelection_selected: selection !== null,
            })}
        >
            <div className="mx_UseCaseSelection_title mx_UseCaseSelection_slideIn">
                <h1>{_t("onboarding|use_case_heading1")}</h1>
            </div>
            <div className="mx_UseCaseSelection_info mx_UseCaseSelection_slideInDelayed">
                <h2>{_t("onboarding|use_case_heading2")}</h2>
                <h3>{_t("onboarding|use_case_heading3")}</h3>
            </div>
            <div className="mx_UseCaseSelection_options mx_UseCaseSelection_slideInDelayed">
                <UseCaseSelectionButton
                    useCase={UseCase.PersonalMessaging}
                    selected={selection === UseCase.PersonalMessaging}
                    onClick={setSelected}
                />
                <UseCaseSelectionButton
                    useCase={UseCase.WorkMessaging}
                    selected={selection === UseCase.WorkMessaging}
                    onClick={setSelected}
                />
                <UseCaseSelectionButton
                    useCase={UseCase.CommunityMessaging}
                    selected={selection === UseCase.CommunityMessaging}
                    onClick={setSelected}
                />
            </div>
            <div className="mx_UseCaseSelection_skip mx_UseCaseSelection_slideInDelayed">
                <AccessibleButton kind="link" onClick={async () => setSelected(UseCase.Skip)}>
                    {_t("action|skip")}
                </AccessibleButton>
            </div>
        </SplashPage>
    );
}
