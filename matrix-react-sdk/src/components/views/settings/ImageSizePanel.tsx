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

import SettingsStore from "../../../settings/SettingsStore";
import StyledRadioButton from "../elements/StyledRadioButton";
import { _t } from "../../../languageHandler";
import { SettingLevel } from "../../../settings/SettingLevel";
import { ImageSize } from "../../../settings/enums/ImageSize";
import SettingsSubsection from "./shared/SettingsSubsection";

interface IProps {
    // none
}

interface IState {
    size: ImageSize;
}

export default class ImageSizePanel extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            size: SettingsStore.getValue("Images.size"),
        };
    }

    private onSizeChange = (ev: React.ChangeEvent<HTMLInputElement>): void => {
        const newSize = ev.target.value as ImageSize;
        this.setState({ size: newSize });

        // noinspection JSIgnoredPromiseFromCall
        SettingsStore.setValue("Images.size", null, SettingLevel.ACCOUNT, newSize);
    };

    public render(): React.ReactNode {
        return (
            <SettingsSubsection heading={_t("Image size in the timeline")}>
                <div className="mx_ImageSizePanel_radios">
                    <label>
                        <div className="mx_ImageSizePanel_size mx_ImageSizePanel_sizeDefault" />
                        <StyledRadioButton
                            name="image_size"
                            value={ImageSize.Normal}
                            checked={this.state.size === ImageSize.Normal}
                            onChange={this.onSizeChange}
                        >
                            {_t("Default")}
                        </StyledRadioButton>
                    </label>
                    <label>
                        <div className="mx_ImageSizePanel_size mx_ImageSizePanel_sizeLarge" />
                        <StyledRadioButton
                            name="image_size"
                            value={ImageSize.Large}
                            checked={this.state.size === ImageSize.Large}
                            onChange={this.onSizeChange}
                        >
                            {_t("Large")}
                        </StyledRadioButton>
                    </label>
                </div>
            </SettingsSubsection>
        );
    }
}
