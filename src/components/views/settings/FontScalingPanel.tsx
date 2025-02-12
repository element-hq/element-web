/*
Copyright 2024 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type EmptyObject } from "matrix-js-sdk/src/matrix";

import EventTilePreview from "../elements/EventTilePreview";
import SettingsStore from "../../../settings/SettingsStore";
import { type Layout } from "../../../settings/enums/Layout";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { SettingLevel } from "../../../settings/SettingLevel";
import { _t } from "../../../languageHandler";
import { SettingsSubsection } from "./shared/SettingsSubsection";
import Field from "../elements/Field";
import { FontWatcher } from "../../../settings/watchers/FontWatcher";

interface IState {
    browserFontSize: number;
    // String displaying the current selected fontSize.
    // Needs to be string for things like '1.' without
    // trailing 0s.
    fontSizeDelta: number;
    useCustomFontSize: boolean;
    layout: Layout;
    // User profile data for the message preview
    userId?: string;
    displayName?: string;
    avatarUrl?: string;
}

export default class FontScalingPanel extends React.Component<EmptyObject, IState> {
    private readonly MESSAGE_PREVIEW_TEXT = _t("common|preview_message");
    /**
     * Font sizes available (in px)
     */
    private readonly sizes = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36];
    private layoutWatcherRef?: string;
    private unmounted = false;

    public constructor(props: EmptyObject) {
        super(props);

        this.state = {
            fontSizeDelta: SettingsStore.getValue("fontSizeDelta", null),
            browserFontSize: FontWatcher.getBrowserDefaultFontSize(),
            useCustomFontSize: SettingsStore.getValue("useCustomFontSize"),
            layout: SettingsStore.getValue("layout"),
        };
    }

    public async componentDidMount(): Promise<void> {
        this.unmounted = false;
        // Fetch the current user profile for the message preview
        const client = MatrixClientPeg.safeGet();
        const userId = client.getSafeUserId();
        const profileInfo = await client.getProfileInfo(userId);
        this.layoutWatcherRef = SettingsStore.watchSetting("layout", null, () => {
            // Update the layout for the preview window according to the user selection
            const value = SettingsStore.getValue("layout");
            if (this.state.layout !== value) {
                this.setState({
                    layout: value,
                });
            }
        });
        if (this.unmounted) return;

        this.setState({
            userId,
            displayName: profileInfo.displayname,
            avatarUrl: profileInfo.avatar_url,
        });
    }

    public componentWillUnmount(): void {
        this.unmounted = true;
        SettingsStore.unwatchSetting(this.layoutWatcherRef);
    }

    /**
     * Save the new font size
     * @param delta
     */
    private onFontSizeChanged = async (delta: string): Promise<void> => {
        const parsedDelta = parseInt(delta, 10) || 0;
        this.setState({ fontSizeDelta: parsedDelta });
        await SettingsStore.setValue("fontSizeDelta", null, SettingLevel.DEVICE, parsedDelta);
    };

    /**
     * Compute the difference between the selected font size and the browser font size
     * @param fontSize
     */
    private computeDeltaFontSize = (fontSize: number): number => {
        return fontSize - this.state.browserFontSize;
    };

    public render(): React.ReactNode {
        return (
            <SettingsSubsection
                heading={_t("settings|appearance|font_size")}
                stretchContent
                data-testid="mx_FontScalingPanel"
            >
                <Field
                    element="select"
                    className="mx_FontScalingPanel_Dropdown"
                    label={_t("settings|appearance|font_size")}
                    value={this.state.fontSizeDelta.toString()}
                    onChange={(e) => this.onFontSizeChanged(e.target.value)}
                >
                    {this.sizes.map((size) => (
                        <option key={size} value={this.computeDeltaFontSize(size)}>
                            {size === this.state.browserFontSize
                                ? _t("settings|appearance|font_size_default", { fontSize: size })
                                : size}
                        </option>
                    ))}
                </Field>
                <EventTilePreview
                    className="mx_FontScalingPanel_preview"
                    message={this.MESSAGE_PREVIEW_TEXT}
                    layout={this.state.layout}
                    userId={this.state.userId}
                    displayName={this.state.displayName}
                    avatarUrl={this.state.avatarUrl}
                />
            </SettingsSubsection>
        );
    }
}
