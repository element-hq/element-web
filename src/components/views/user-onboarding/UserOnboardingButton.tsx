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
import React, { useCallback } from "react";

import { Action } from "../../../dispatcher/actions";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import { useSettingValue } from "../../../hooks/useSettings";
import { _t } from "../../../languageHandler";
import PosthogTrackers from "../../../PosthogTrackers";
import { UseCase } from "../../../settings/enums/UseCase";
import { SettingLevel } from "../../../settings/SettingLevel";
import SettingsStore from "../../../settings/SettingsStore";
import AccessibleButton, { ButtonEvent } from "../../views/elements/AccessibleButton";
import Heading from "../../views/typography/Heading";
import { showUserOnboardingPage } from "./UserOnboardingPage";

interface Props {
    selected: boolean;
    minimized: boolean;
}

export function UserOnboardingButton({ selected, minimized }: Props): JSX.Element {
    const useCase = useSettingValue<UseCase | null>("FTUE.useCaseSelection");
    const visible = useSettingValue<boolean>("FTUE.userOnboardingButton");

    if (!visible || minimized || !showUserOnboardingPage(useCase)) {
        return <></>;
    }

    return <UserOnboardingButtonInternal selected={selected} minimized={minimized} />;
}

function UserOnboardingButtonInternal({ selected, minimized }: Props): JSX.Element {
    const onDismiss = useCallback((ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        PosthogTrackers.trackInteraction("WebRoomListUserOnboardingIgnoreButton", ev);
        SettingsStore.setValue("FTUE.userOnboardingButton", null, SettingLevel.ACCOUNT, false);
    }, []);

    const onClick = useCallback((ev: ButtonEvent) => {
        ev.preventDefault();
        ev.stopPropagation();

        PosthogTrackers.trackInteraction("WebRoomListUserOnboardingButton", ev);
        defaultDispatcher.fire(Action.ViewHomePage);
    }, []);

    return (
        <AccessibleButton
            className={classNames("mx_UserOnboardingButton", {
                mx_UserOnboardingButton_selected: selected,
                mx_UserOnboardingButton_minimized: minimized,
            })}
            onClick={onClick}
        >
            {!minimized && (
                <>
                    <div className="mx_UserOnboardingButton_content">
                        <Heading size="h4" className="mx_Heading_h4">
                            {_t("Welcome")}
                        </Heading>
                        <AccessibleButton className="mx_UserOnboardingButton_close" onClick={onDismiss} />
                    </div>
                </>
            )}
        </AccessibleButton>
    );
}
