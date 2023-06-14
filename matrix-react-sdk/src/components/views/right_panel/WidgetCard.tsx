/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import React, { useContext, useEffect } from "react";
import { Room } from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseCard from "./BaseCard";
import WidgetUtils from "../../../utils/WidgetUtils";
import AppTile from "../elements/AppTile";
import { _t } from "../../../languageHandler";
import { useWidgets } from "./RoomSummaryCard";
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
            <Heading size="h4" className="mx_BaseCard_header_title_heading">
                {WidgetUtils.getWidgetName(app)}
            </Heading>
            <ContextMenuButton
                className="mx_BaseCard_header_title_button--option"
                inputRef={handle}
                onClick={openMenu}
                isExpanded={menuDisplayed}
                label={_t("Options")}
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
