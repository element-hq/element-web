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

import React, { useRef } from "react";

import { BreadcrumbsStore } from "../../../stores/BreadcrumbsStore";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";
import { MenuItem } from "../../structures/ContextMenu";
import { useEventEmitterState } from "../../../hooks/useEventEmitter";
import { _t } from "../../../languageHandler";
import dis from "../../../dispatcher/dispatcher";
import { RoomContextDetails } from "./RoomContextDetails";
import InteractiveTooltip, { Direction } from "../elements/InteractiveTooltip";
import { Action } from "../../../dispatcher/actions";
import DecoratedRoomAvatar from "../avatars/DecoratedRoomAvatar";
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import RoomAvatar from "../avatars/RoomAvatar";

const RecentlyViewedButton: React.FC = () => {
    const tooltipRef = useRef<InteractiveTooltip>(null);
    const crumbs = useEventEmitterState(BreadcrumbsStore.instance, UPDATE_EVENT, () => BreadcrumbsStore.instance.rooms);

    const content = (
        <div className="mx_RecentlyViewedButton_ContextMenu">
            <h4>{_t("Recently viewed")}</h4>
            <div>
                {crumbs.map((crumb) => {
                    return (
                        <MenuItem
                            key={crumb.roomId}
                            onClick={(ev) => {
                                dis.dispatch<ViewRoomPayload>({
                                    action: Action.ViewRoom,
                                    room_id: crumb.roomId,
                                    metricsTrigger: "WebVerticalBreadcrumbs",
                                    metricsViaKeyboard: ev.type !== "click",
                                });
                                tooltipRef.current?.hideTooltip();
                            }}
                        >
                            {crumb.isSpaceRoom() ? (
                                <RoomAvatar room={crumb} width={24} height={24} />
                            ) : (
                                <DecoratedRoomAvatar room={crumb} avatarSize={24} tooltipProps={{ tabIndex: -1 }} />
                            )}
                            <span className="mx_RecentlyViewedButton_entry_label">
                                <div>{crumb.name}</div>
                                <RoomContextDetails className="mx_RecentlyViewedButton_entry_spaces" room={crumb} />
                            </span>
                        </MenuItem>
                    );
                })}
            </div>
        </div>
    );

    return (
        <InteractiveTooltip content={content} direction={Direction.Right} ref={tooltipRef}>
            {({ ref, onMouseOver }) => (
                <span
                    className="mx_LeftPanel_recentsButton"
                    title={_t("Recently viewed")}
                    ref={ref}
                    onMouseOver={onMouseOver}
                />
            )}
        </InteractiveTooltip>
    );
};

export default RecentlyViewedButton;
