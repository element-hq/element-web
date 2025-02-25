/*
 * Copyright 2025 New Vector Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import ExploreIcon from "@vector-im/compound-design-tokens/assets/web/icons/explore";
import SearchIcon from "@vector-im/compound-design-tokens/assets/web/icons/search";
import DialPadIcon from "@vector-im/compound-design-tokens/assets/web/icons/dial-pad";

import { IS_MAC, Key } from "../../../../Keyboard";
import { _t } from "../../../../languageHandler";
import { ALTERNATE_KEY_NAME } from "../../../../accessibility/KeyboardShortcuts";
import { shouldShowComponent } from "../../../../customisations/helpers/UIComponents";
import { UIComponent } from "../../../../settings/UIFeature";
import { MetaSpace } from "../../../../stores/spaces";
import { Action } from "../../../../dispatcher/actions";
import PosthogTrackers from "../../../../PosthogTrackers";
import defaultDispatcher from "../../../../dispatcher/dispatcher";
import { Flex } from "../../../utils/Flex";
import { useTypedEventEmitterState } from "../../../../hooks/useEventEmitter";
import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../../LegacyCallHandler";

type RoomListSearchProps = {
    /**
     * Current active space
     * The explore button is only displayed in the Home meta space
     */
    activeSpace: string;
};

/**
 * A search component to be displayed at the top of the room list
 * The `Explore` button is displayed only in the Home meta space and when UIComponent.ExploreRooms is enabled.
 */
export function RoomListSearch({ activeSpace }: RoomListSearchProps): JSX.Element {
    const displayExploreButton = activeSpace === MetaSpace.Home && shouldShowComponent(UIComponent.ExploreRooms);
    // We only display the dial button if the user is can make PSTN calls
    const displayDialButton = useTypedEventEmitterState(
        LegacyCallHandler.instance,
        LegacyCallHandlerEvent.ProtocolSupport,
        () => LegacyCallHandler.instance.getSupportsPstnProtocol(),
    );

    return (
        <Flex className="mx_RoomListSearch" role="search" gap="var(--cpd-space-2x)" align="center">
            <Button
                className="mx_RoomListSearch_search"
                kind="secondary"
                size="sm"
                Icon={SearchIcon}
                onClick={() => defaultDispatcher.fire(Action.OpenSpotlight)}
            >
                <Flex as="span" justify="space-between">
                    {_t("action|search")}
                    <kbd>{IS_MAC ? "⌘ K" : _t(ALTERNATE_KEY_NAME[Key.CONTROL]) + " K"}</kbd>
                </Flex>
            </Button>
            {displayDialButton && (
                <Button
                    className="mx_RoomListSearch_button"
                    kind="secondary"
                    size="sm"
                    Icon={DialPadIcon}
                    iconOnly={true}
                    aria-label={_t("left_panel|open_dial_pad")}
                    onClick={(ev) => {
                        defaultDispatcher.fire(Action.OpenDialPad);
                    }}
                />
            )}
            {displayExploreButton && (
                <Button
                    className="mx_RoomListSearch_button"
                    kind="secondary"
                    size="sm"
                    Icon={ExploreIcon}
                    iconOnly={true}
                    aria-label={_t("action|explore_rooms")}
                    onClick={(ev) => {
                        defaultDispatcher.fire(Action.ViewRoomDirectory);
                        PosthogTrackers.trackInteraction("WebLeftPanelExploreRoomsButton", ev);
                    }}
                />
            )}
        </Flex>
    );
}
