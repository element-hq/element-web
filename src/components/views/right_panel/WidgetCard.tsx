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
import AccessibleButton from "../elements/AccessibleButton";
import AppTile from "../elements/AppTile";
import {_t} from "../../../languageHandler";
import {useWidgets} from "./RoomSummaryCard";
import {RightPanelPhases} from "../../../stores/RightPanelStorePhases";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {SetRightPanelPhasePayload} from "../../../dispatcher/payloads/SetRightPanelPhasePayload";
import {Action} from "../../../dispatcher/actions";
import WidgetStore from "../../../stores/WidgetStore";
import ActiveWidgetStore from "../../../stores/ActiveWidgetStore";
import {ChevronFace, ContextMenuButton, useContextMenu} from "../../structures/ContextMenu";
import IconizedContextMenu, {
    IconizedContextMenuOption,
    IconizedContextMenuOptionList,
} from "../context_menus/IconizedContextMenu";
import {AppTileActionPayload} from "../../../dispatcher/payloads/AppTileActionPayload";
import {Capability} from "../../../widgets/WidgetApi";
import AccessibleTooltipButton from "../elements/AccessibleTooltipButton";
import classNames from "classnames";

interface IProps {
    room: Room;
    widgetId: string;
    onClose(): void;
}

const WidgetCard: React.FC<IProps> = ({ room, widgetId, onClose }) => {
    const cli = useContext(MatrixClientContext);

    const apps = useWidgets(room);
    const app = apps.find(a => a.id === widgetId);
    const isPinned = app && WidgetStore.instance.isPinned(app.id);

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

    const header = <React.Fragment>
        <h2>{ WidgetUtils.getWidgetName(app) }</h2>
    </React.Fragment>;

    const canModify = WidgetUtils.canUserModifyWidgets(room.roomId);

    let contextMenu;
    if (menuDisplayed) {
        let snapshotButton;
        if (ActiveWidgetStore.widgetHasCapability(app.id, Capability.Screenshot)) {
            const onSnapshotClick = () => {
                WidgetUtils.snapshotWidget(app);
                closeMenu();
            };

            snapshotButton = <IconizedContextMenuOption onClick={onSnapshotClick} label={_t("Take a picture")} />;
        }

        let deleteButton;
        if (canModify) {
            const onDeleteClick = () => {
                defaultDispatcher.dispatch<AppTileActionPayload>({
                    action: Action.AppTileDelete,
                    widgetId: app.id,
                });
                closeMenu();
            };

            deleteButton = <IconizedContextMenuOption onClick={onDeleteClick} label={_t("Remove for everyone")} />;
        }

        const onRevokeClick = () => {
            defaultDispatcher.dispatch<AppTileActionPayload>({
                action: Action.AppTileRevoke,
                widgetId: app.id,
            });
            closeMenu();
        };

        const rect = handle.current.getBoundingClientRect();
        contextMenu = (
            <IconizedContextMenu
                chevronFace={ChevronFace.None}
                right={window.innerWidth - rect.right}
                bottom={window.innerHeight - rect.top}
                onFinished={closeMenu}
            >
                <IconizedContextMenuOptionList>
                    { snapshotButton }
                    { deleteButton }
                    <IconizedContextMenuOption onClick={onRevokeClick} label={_t("Remove for me")} />
                </IconizedContextMenuOptionList>
            </IconizedContextMenu>
        );
    }

    const onPinClick = () => {
        WidgetStore.instance.pinWidget(app.id);
    };

    const onEditClick = () => {
        WidgetUtils.editWidget(room, app);
    };

    let editButton;
    if (canModify) {
        editButton = <AccessibleButton kind="secondary" onClick={onEditClick}>
            { _t("Edit") }
        </AccessibleButton>;
    }

    const pinButtonClasses = canModify ? "" : "mx_WidgetCard_widePinButton";

    let pinButton;
    if (WidgetStore.instance.canPin(app.id)) {
        pinButton = <AccessibleButton
            kind="secondary"
            onClick={onPinClick}
            className={pinButtonClasses}
        >
            { _t("Pin to room") }
        </AccessibleButton>;
    } else {
        pinButton = <AccessibleTooltipButton
            title={_t("You can only pin 2 apps at a time")}
            tooltipClassName="mx_WidgetCard_maxPinnedTooltip"
            kind="secondary"
            className={pinButtonClasses}
            disabled
        >
            { _t("Pin to room") }
        </AccessibleTooltipButton>;
    }

    const footer = <React.Fragment>
        { editButton }
        { pinButton }
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
        footer={footer}
        className={classNames("mx_WidgetCard", {
            mx_WidgetCard_noEdit: !canModify,
        })}
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
            whitelistCapabilities={WidgetUtils.getCapWhitelistForAppTypeInRoomId(app.type, room.roomId)}
        />
    </BaseCard>;
};

export default WidgetCard;
