/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import BaseCard from "../../../components/views/right_panel/BaseCard";
import AppTile from "../../../components/views/elements/AppTile";
import { _t } from "../../../languageHandler";
import { ChevronFace, ContextMenuButton, useContextMenu } from "../../../components/structures/ContextMenu";
import { WidgetContextMenu } from "../../../components/views/context_menus/WidgetContextMenu";
import UIStore from "../../../stores/UIStore";
import Heading from "../../../components/views/typography/Heading";
import { type ViewModel } from "../../ViewModel";
import { type IApp } from "../../../utils/WidgetUtils-types";
import { useViewModel } from "../../useViewModel";


export interface WidgetCardViewSnapshot {
    room: Room;
    app: IApp | undefined;
    userId: string;
    widgetPageTitle: string;
    widgetName: string;
    shouldEmptyWidgetCard: boolean;
    creatorUserId: string | undefined;
}

interface WidgetCardViewActions {
    onClose: () => void;
}
/**
 * The view model for the widget card
 */
export type WidgetCardViewModel = ViewModel<WidgetCardViewSnapshot> & WidgetCardViewActions;

interface WidgetCardViewProps {
    vm: WidgetCardViewModel;
}

export const WidgetCardView: React.FC<WidgetCardViewProps> = ({ vm }: Readonly<WidgetCardViewProps>) => {
    const { room, app, userId, widgetPageTitle, widgetName, shouldEmptyWidgetCard } = useViewModel(vm);

    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed && app) {
        const rect = handle.current?.getBoundingClientRect();
        const rightMargin = rect ? rect.right : 0;
        const bottomMargin = rect ? rect.bottom : 0;
        contextMenu = (
            <WidgetContextMenu
                chevronFace={ChevronFace.None}
                right={UIStore.instance.windowWidth - rightMargin - 12}
                top={bottomMargin + 12}
                onFinished={closeMenu}
                app={app}
            />
        );
    }

    const header = (
        <div className="mx_BaseCard_header_title">
            <Heading size="4" className="mx_BaseCard_header_title_heading" as="h1">
                {widgetName}
            </Heading>
            <ContextMenuButton
                className="mx_BaseCard_header_title_button--option"
                ref={handle}
                onClick={openMenu}
                isExpanded={menuDisplayed}
                label={_t("common|options")}
            />
            {contextMenu}
        </div>
    );

    if (shouldEmptyWidgetCard || !app) return null;

    return (
        <BaseCard header={header} className="mx_WidgetCard" onClose={vm.onClose} withoutScrollContainer>
            <AppTile
                app={app}
                fullWidth
                showMenubar={false}
                room={room}
                userId={userId}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={widgetPageTitle}
                waitForIframeLoad={app.waitForIframeLoad}
            />
        </BaseCard>
    );
};
