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
import {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../views/context_menus/IconizedContextMenu";
import { _t } from "../../languageHandler";
import { HostSignupStore } from "../../stores/HostSignupStore";
import SdkConfig from "../../SdkConfig";
import {replaceableComponent} from "../../utils/replaceableComponent";

interface IProps {}

interface IState {}

@replaceableComponent("structures.HostSignupAction")
export default class HostSignupAction extends React.PureComponent<IProps, IState> {
    private openDialog = async () => {
        await HostSignupStore.instance.setHostSignupActive(true);
    }

    public render(): React.ReactNode {
        const hostSignupConfig = SdkConfig.get().hostSignup;
        if (!hostSignupConfig?.brand) {
            return null;
        }

        return (
            <IconizedContextMenuOptionList>
                <IconizedContextMenuOption
                    iconClassName="mx_UserMenu_iconHosting"
                    label={_t(
                        "Upgrade to %(hostSignupBrand)s",
                        {
                            hostSignupBrand: hostSignupConfig.brand,
                        },
                    )}
                    onClick={this.openDialog}
                />
            </IconizedContextMenuOptionList>
        );
    }
}
