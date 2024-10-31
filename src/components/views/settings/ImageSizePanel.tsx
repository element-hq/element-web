/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only
Please see LICENSE files in the repository root for full details.
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
            <SettingsSubsection heading={_t("settings|appearance|timeline_image_size")}>
                <div className="mx_ImageSizePanel_radios">
                    <label>
                        <div className="mx_ImageSizePanel_size mx_ImageSizePanel_sizeDefault" />
                        <StyledRadioButton
                            name="image_size"
                            value={ImageSize.Normal}
                            checked={this.state.size === ImageSize.Normal}
                            onChange={this.onSizeChange}
                        >
                            {_t("settings|appearance|image_size_default")}
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
                            {_t("settings|appearance|image_size_large")}
                        </StyledRadioButton>
                    </label>
                </div>
            </SettingsSubsection>
        );
    }
}
