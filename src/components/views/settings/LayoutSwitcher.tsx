/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX, useEffect, useState } from "react";
import { Field, HelpMessage, InlineField, Label, RadioControl, Root, ToggleControl } from "@vector-im/compound-web";

import { SettingsSubsection } from "./shared/SettingsSubsection";
import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import { SettingLevel } from "../../../settings/SettingLevel";
import { useSettingValue } from "../../../hooks/useSettings";
import { Layout } from "../../../settings/enums/Layout";
import EventTilePreview from "../elements/EventTilePreview";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext";

/**
 * A section to switch between different message layouts.
 */
export function LayoutSwitcher(): JSX.Element {
    return (
        <SettingsSubsection heading={_t("common|message_layout")} legacy={false} data-testid="layoutPanel">
            <LayoutSelector />
            <ToggleCompactLayout />
        </SettingsSubsection>
    );
}

/**
 * A selector to choose the layout of the messages.
 */
function LayoutSelector(): JSX.Element {
    return (
        <Root
            className="mx_LayoutSwitcher_LayoutSelector"
            onChange={async (evt) => {
                // We don't have any file in the form, we can cast it as string safely
                const newLayout = new FormData(evt.currentTarget).get("layout") as string | null;
                await SettingsStore.setValue("layout", null, SettingLevel.DEVICE, newLayout);
            }}
        >
            <LayoutRadio layout={Layout.Group} label={_t("common|modern")} />
            <LayoutRadio layout={Layout.Bubble} label={_t("settings|appearance|layout_bubbles")} />
            <LayoutRadio layout={Layout.IRC} label={_t("settings|appearance|layout_irc")} />
        </Root>
    );
}

/**
 * A radio button to select a layout.
 */
interface LayoutRadioProps {
    /**
     * The value of the layout.
     */
    layout: Layout;
    /**
     * The label to display for the layout.
     */
    label: string;
}

/**
 * A radio button to select a layout.
 * @param layout
 * @param label
 */
function LayoutRadio({ layout, label }: LayoutRadioProps): JSX.Element {
    const currentLayout = useSettingValue("layout");
    const eventTileInfo = useEventTileInfo();

    return (
        <Field name="layout" className="mxLayoutSwitcher_LayoutSelector_LayoutRadio">
            <Label aria-label={label}>
                <div className="mxLayoutSwitcher_LayoutSelector_LayoutRadio_inline">
                    <RadioControl name="layout" value={layout} defaultChecked={currentLayout === layout} />
                    <span>{label}</span>
                </div>
                <hr className="mxLayoutSwitcher_LayoutSelector_LayoutRadio_separator" />
                <EventTilePreview
                    message={_t("common|preview_message")}
                    layout={layout}
                    className="mxLayoutSwitcher_LayoutSelector_LayoutRadio_EventTilePreview"
                    {...eventTileInfo}
                />
            </Label>
        </Field>
    );
}

type EventTileInfo = {
    /**
     * The ID of the user to display.
     */
    userId: string;
    /**
     * The display name of the user to display.
     */
    displayName?: string;
    /**
     * The avatar URL of the user to display.
     */
    avatarUrl?: string;
};

/**
 * Fetch the information to display in the event tile preview.
 */
function useEventTileInfo(): EventTileInfo {
    const matrixClient = useMatrixClientContext();
    const userId = matrixClient.getSafeUserId();
    const [eventTileInfo, setEventTileInfo] = useState<EventTileInfo>({ userId });

    useEffect(() => {
        const run = async (): Promise<void> => {
            const profileInfo = await matrixClient.getProfileInfo(userId);
            setEventTileInfo({
                userId,
                displayName: profileInfo.displayname,
                avatarUrl: profileInfo.avatar_url,
            });
        };

        run();
    }, [userId, matrixClient, setEventTileInfo]);
    return eventTileInfo;
}

/**
 * A toggleable setting to enable or disable the compact layout.
 */
function ToggleCompactLayout(): JSX.Element {
    const compactLayoutEnabled = useSettingValue("useCompactLayout");
    const layout = useSettingValue("layout");

    return (
        <Root
            onChange={async (evt) => {
                const checked = new FormData(evt.currentTarget).get("compactLayout") === "on";
                await SettingsStore.setValue("useCompactLayout", null, SettingLevel.DEVICE, checked);
            }}
        >
            <InlineField
                name="compactLayout"
                control={
                    <ToggleControl
                        disabled={layout !== Layout.Group}
                        name="compactLayout"
                        defaultChecked={compactLayoutEnabled}
                    />
                }
            >
                <Label>{_t("settings|appearance|compact_layout")}</Label>
                <HelpMessage>{_t("settings|appearance|compact_layout_description")}</HelpMessage>
            </InlineField>
        </Root>
    );
}
