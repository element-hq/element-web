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

import React, {useContext, useEffect} from "react";
import {Room} from "matrix-js-sdk/src/models/room";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import BaseCard from "./BaseCard";
import WidgetUtils from "../../../utils/WidgetUtils";
import AppTile from "../elements/AppTile";
import {_t} from "../../../languageHandler";
import {useWidgets} from "./RoomSummaryCard";
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {SetRightPanelPhasePayload} from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import {Action} from "../../../dispatcher/actions";
import WidgetStore from "../../../stores/WidgetStore";
import {ChevronFace, ContextMenuButton, useContextMenu} from "../../structures/ContextMenu";
import WidgetContextMenu from "../context_menus/WidgetContextMenu";

interface IProps {
    room: Room;
    widgetId: string;
    onClose(): void;
}

const WidgetCard: React.FC<IProps> = ({ room, widgetId, onClose }) => {
    const cli = useContext(MatrixClientContext);

    const apps = useWidgets(room);
    const app = apps.find(a => a.id === widgetId);
    const isPinned = app && WidgetStore.instance.isPinned(room.roomId, app.id);

    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu();

    useEffect(() => {
        if (!app || isPinned) {
            // stop showing this card
            defaultDispatcher.dispatch<SetRightPanelPhasePayload>({
                action: Action.SetRightPanelPhase,
                phase: RightPanelPhases.RoomSummary,
            });
        }
    }, [app, isPinned]);

    // Don't render anything as we are about to transition
    if (!app || isPinned) return null;

    let contextMenu;
    if (menuDisplayed) {
        const rect = handle.current.getBoundingClientRect();
        contextMenu = (
            <WidgetContextMenu
                chevronFace={ChevronFace.None}
                right={window.innerWidth - rect.right - 12}
                top={rect.bottom + 12}
                onFinished={closeMenu}
                app={app}
            />
        );
    }

    const header = <React.Fragment>
        <h2>{ WidgetUtils.getWidgetName(app) }</h2>
        <ContextMenuButton
            kind="secondary"
            className="mx_WidgetCard_optionsButton"
            inputRef={handle}
            onClick={openMenu}
            isExpanded={menuDisplayed}
            label={_t("Options")}
        />
        { contextMenu }
    </React.Fragment>;

    return <BaseCard
        header={header}
        className="mx_WidgetCard"
        onClose={onClose}
        previousPhase={RightPanelPhases.RoomSummary}
        withoutScrollContainer
    >
        <AppTile
            app={app}
            fullWidth
            show
            showMenubar={false}
            room={room}
            userId={cli.getUserId()}
            creatorUserId={app.creatorUserId}
            widgetPageTitle={WidgetUtils.getWidgetDataTitle(app)}
            waitForIframeLoad={app.waitForIframeLoad}
        />
    </BaseCard>;
};

export default WidgetCard;
