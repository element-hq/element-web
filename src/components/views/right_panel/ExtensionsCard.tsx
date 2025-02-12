/*
Copyright 2024 New Vector Ltd.
Copyright 2024 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useEffect, useMemo, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { Button, Link, Separator, Text } from "@vector-im/compound-web";
import PlusIcon from "@vector-im/compound-design-tokens/assets/web/icons/plus";
import ExtensionsIcon from "@vector-im/compound-design-tokens/assets/web/icons/extensions";

import BaseCard from "./BaseCard";
import WidgetUtils, { useWidgets } from "../../../utils/WidgetUtils";
import { _t } from "../../../languageHandler";
import { ChevronFace, ContextMenuTooltipButton, useContextMenu } from "../../structures/ContextMenu";
import { WidgetContextMenu } from "../context_menus/WidgetContextMenu";
import UIStore from "../../../stores/UIStore";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type IApp } from "../../../stores/WidgetStore";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { Container, MAX_PINNED, WidgetLayoutStore } from "../../../stores/widgets/WidgetLayoutStore";
import AccessibleButton from "../elements/AccessibleButton";
import WidgetAvatar from "../avatars/WidgetAvatar";
import { IntegrationManagers } from "../../../integrations/IntegrationManagers";
import EmptyState from "./EmptyState";

interface Props {
    room: Room;
    onClose(): void;
}

interface IAppRowProps {
    app: IApp;
    room: Room;
}

const AppRow: React.FC<IAppRowProps> = ({ app, room }) => {
    const name = WidgetUtils.getWidgetName(app);
    const [canModifyWidget, setCanModifyWidget] = useState<boolean>();

    useEffect(() => {
        setCanModifyWidget(WidgetUtils.canUserModifyWidgets(room.client, room.roomId));
    }, [room.client, room.roomId]);

    const onOpenWidgetClick = (): void => {
        RightPanelStore.instance.pushCard({
            phase: RightPanelPhases.Widget,
            state: { widgetId: app.id },
        });
    };

    const isPinned = WidgetLayoutStore.instance.isInContainer(room, app, Container.Top);
    const togglePin = isPinned
        ? () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Right);
          }
        : () => {
              WidgetLayoutStore.instance.moveToContainer(room, app, Container.Top);
          };

    const [menuDisplayed, handle, openMenu, closeMenu] = useContextMenu<HTMLDivElement>();
    let contextMenu;
    if (menuDisplayed) {
        const rect = handle.current?.getBoundingClientRect();
        const rightMargin = rect?.right ?? 0;
        const topMargin = rect?.top ?? 0;
        contextMenu = (
            <WidgetContextMenu
                chevronFace={ChevronFace.None}
                right={UIStore.instance.windowWidth - rightMargin}
                bottom={UIStore.instance.windowHeight - topMargin}
                onFinished={closeMenu}
                app={app}
            />
        );
    }

    const cannotPin = !isPinned && !WidgetLayoutStore.instance.canAddToContainer(room, Container.Top);

    let pinTitle: string;
    if (cannotPin) {
        pinTitle = _t("right_panel|pinned_messages|limits", { count: MAX_PINNED });
    } else {
        pinTitle = isPinned ? _t("action|unpin") : _t("action|pin");
    }

    const isMaximised = WidgetLayoutStore.instance.isInContainer(room, app, Container.Center);

    let openTitle = "";
    if (isPinned) {
        openTitle = _t("widget|unpin_to_view_right_panel");
    } else if (isMaximised) {
        openTitle = _t("widget|close_to_view_right_panel");
    }

    const classes = classNames("mx_BaseCard_Button mx_ExtensionsCard_Button", {
        mx_ExtensionsCard_Button_pinned: isPinned,
    });

    return (
        <div className={classes} ref={handle}>
            <AccessibleButton
                className="mx_ExtensionsCard_icon_app"
                onClick={onOpenWidgetClick}
                // only show a tooltip if the widget is pinned
                title={!(isPinned || isMaximised) ? undefined : openTitle}
                disabled={isPinned || isMaximised}
            >
                <WidgetAvatar app={app} size="24px" />
                <Text size="md" weight="medium" className="mx_lineClamp">
                    {name}
                </Text>
            </AccessibleButton>

            {canModifyWidget && (
                <ContextMenuTooltipButton
                    className="mx_ExtensionsCard_app_options"
                    isExpanded={menuDisplayed}
                    onClick={openMenu}
                    title={_t("common|options")}
                />
            )}

            <AccessibleButton
                className="mx_ExtensionsCard_app_pinToggle"
                onClick={togglePin}
                title={pinTitle}
                disabled={cannotPin}
            />

            {contextMenu}
        </div>
    );
};

/**
 * A right panel card displaying a list of widgets in the room and allowing the user to manage them.
 * @param room the room to manage widgets for
 * @param onClose callback when the card is closed
 */
const ExtensionsCard: React.FC<Props> = ({ room, onClose }) => {
    const apps = useWidgets(room);
    // Filter out virtual widgets
    const realApps = useMemo(() => apps.filter((app) => app.eventId !== undefined), [apps]);

    const onManageIntegrations = (): void => {
        const managers = IntegrationManagers.sharedInstance();
        if (!managers.hasManager()) {
            managers.openNoManagerDialog();
        } else {
            // noinspection JSIgnoredPromiseFromCall
            managers.getPrimaryManager()?.open(room);
        }
    };

    let body: JSX.Element;
    if (realApps.length < 1) {
        body = (
            <EmptyState
                Icon={ExtensionsIcon}
                title={_t("right_panel|extensions_empty_title")}
                description={_t("right_panel|extensions_empty_description", {
                    addIntegrations: _t("right_panel|add_integrations"),
                })}
            />
        );
    } else {
        let copyLayoutBtn: JSX.Element | null = null;
        if (WidgetLayoutStore.instance.canCopyLayoutToRoom(room)) {
            copyLayoutBtn = (
                <Link onClick={() => WidgetLayoutStore.instance.copyLayoutToRoom(room)}>
                    {_t("widget|set_room_layout")}
                </Link>
            );
        }

        body = (
            <>
                <Separator />
                {realApps.map((app) => (
                    <AppRow key={app.id} app={app} room={room} />
                ))}
                {copyLayoutBtn}
            </>
        );
    }

    return (
        <BaseCard header={_t("right_panel|extensions_button")} className="mx_ExtensionsCard" onClose={onClose}>
            <Button size="sm" onClick={onManageIntegrations} kind="secondary" Icon={PlusIcon}>
                {_t("right_panel|add_integrations")}
            </Button>
            {body}
        </BaseCard>
    );
};

export default ExtensionsCard;
