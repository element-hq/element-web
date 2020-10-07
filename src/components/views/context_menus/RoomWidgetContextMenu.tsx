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

import React, {useContext} from "react";
import {MatrixCapabilities} from "matrix-widget-api";

import IconizedContextMenu, {IconizedContextMenuOption, IconizedContextMenuOptionList} from "./IconizedContextMenu";
import {ChevronFace} from "../../structures/ContextMenu";
import {_t} from "../../../languageHandler";
import {IApp} from "../../../stores/WidgetStore";
import defaultDispatcher from "../../../dispatcher/dispatcher";
import {AppTileActionPayload} from "../../../dispatcher/payloads/AppTileActionPayload";
import {Action} from "../../../dispatcher/actions";
import WidgetUtils from "../../../utils/WidgetUtils";
import {WidgetMessagingStore} from "../../../stores/widgets/WidgetMessagingStore";
import RoomContext from "../../../contexts/RoomContext";

interface IProps extends React.ComponentProps<typeof IconizedContextMenu> {
    app: IApp;
}

const RoomWidgetContextMenu: React.FC<IProps> = ({ onFinished, app, ...props}) => {
    const {roomId} = useContext(RoomContext);

    const widgetMessaging = WidgetMessagingStore.instance.getMessagingForId(app.id);

    let snapshotButton;
    if (widgetMessaging?.hasCapability(MatrixCapabilities.Screenshots)) {
        const onSnapshotClick = () => {
            WidgetUtils.snapshotWidget(app);
            onFinished();
        };

        snapshotButton = <IconizedContextMenuOption onClick={onSnapshotClick} label={_t("Take a picture")} />;
    }

    let deleteButton;
    if (WidgetUtils.canUserModifyWidgets(roomId)) {
        const onDeleteClick = () => {
            defaultDispatcher.dispatch<AppTileActionPayload>({
                action: Action.AppTileDelete,
                widgetId: app.id,
            });
            onFinished();
        };

        deleteButton = <IconizedContextMenuOption onClick={onDeleteClick} label={_t("Remove for everyone")} />;
    }

    const onRevokeClick = () => {
        defaultDispatcher.dispatch<AppTileActionPayload>({
            action: Action.AppTileRevoke,
            widgetId: app.id,
        });
        onFinished();
    };

    return <IconizedContextMenu {...props} chevronFace={ChevronFace.None} onFinished={onFinished}>
        <IconizedContextMenuOptionList>
            { snapshotButton }
            { deleteButton }
            <IconizedContextMenuOption onClick={onRevokeClick} label={_t("Remove for me")} />
        </IconizedContextMenuOptionList>
    </IconizedContextMenu>;
};

export default RoomWidgetContextMenu;

