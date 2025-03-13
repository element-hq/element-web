/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useEffect } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseCard from "./BaseCard";
import WidgetUtils, { useWidgets } from "../../../utils/WidgetUtils";
import AppTile from "../elements/AppTile";
import { _t } from "../../../languageHandler";
import { ChevronFace, ContextMenuButton, useContextMenu } from "../../structures/ContextMenu";
import { WidgetContextMenu } from "../context_menus/WidgetContextMenu";
import { Container, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import UIStore from "../../../stores/UIStore";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import Heading from "../typography/Heading";

interface IProps {
    room: Room;
    widgetId: string;
    onClose(): void;
}

const WidgetCard: React.FC<IProps> = ({ room, widgetId, onClose }) => {
    const cli = useContext(MatrixClientContext);

    const apps = useWidgets(room);
    const app = apps.find((a) => a.id === widgetId);
    const isRight = app && WidgetLayoutStore.instance.isInContainer(room, app, Container.Right);

    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();

    useEffect(() => {
        if (!app || !isRight) {
            // stop showing this card
            RightPanelStore.instance.popCard();
        }
    }, [app, isRight]);

    // Don't render anything as we are about to transition
    if (!app || !isRight) return null;

    let contextMenu: JSX.Element | undefined;
    if (menuDisplayed) {
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
            <Heading size="4" className="mx_BaseCard_header_title_heading">
                {WidgetUtils.getWidgetName(app)}
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

    return (
        <BaseCard header={header} className="mx_WidgetCard" onClose={onClose} withoutScrollContainer>
            <AppTile
                app={app}
                fullWidth
                showMenubar={false}
                room={room}
                userId={cli.getSafeUserId()}
                creatorUserId={app.creatorUserId}
                widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
                waitForIframeLoad={app.waitForIframeLoad}
            />
        </BaseCard>
    );
};

export default WidgetCard;
