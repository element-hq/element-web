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
                <h1>{_t("You're in")}</h1>
            </div>
            <div className="mx_UseCaseSelection_info mx_UseCaseSelection_slideInDelayed">
                <h2>{_t("Who will you chat to the most?")}</h2>
                <h3>{_t("We'll help you get connected.")}</h3>
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
                    {_t("Skip")}
                </AccessibleButton>
            </div>
        </SplashPage>
    );
}
