/*
Copyright 2024,2025 New Vector Ltd.
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, useMemo } from "react";
import {
    VideoCallSolidIcon,
    HomeSolidIcon,
    UserProfileSolidIcon,
    FavouriteSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { _t } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import StyledCheckbox from "../../../elements/StyledCheckbox";
import { useSettingValue } from "../../../../../hooks/useSettings";
import { MetaSpace } from "../../../../../stores/spaces";
import PosthogTrackers from "../../../../../PosthogTrackers";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SdkConfig from "../../../../../SdkConfig";

type InteractionName = "WebSettingsSidebarTabSpacesCheckbox" | "WebQuickSettingsPinToSidebarCheckbox";

export const onMetaSpaceChangeFactory =
    (metaSpace: MetaSpace, interactionName: InteractionName) => async (e: ChangeEvent<HTMLInputElement>) => {
        const currentValue = SettingsStore.getValue("Spaces.enabledMetaSpaces");
        await SettingsStore.setValue("Spaces.enabledMetaSpaces", null, SettingLevel.ACCOUNT, {
            ...currentValue,
            [metaSpace]: e.target.checked,
        });

        PosthogTrackers.trackInteraction(
            interactionName,
            e,
            [
                MetaSpace.Home,
                null,
                MetaSpace.Favourites,
                MetaSpace.People,
                MetaSpace.Orphans,
                MetaSpace.VideoRooms,
            ].indexOf(metaSpace),
        );
    };

const SidebarUserSettingsTab: React.FC = () => {
    const {
        [MetaSpace.Home]: homeEnabled,
        [MetaSpace.Favourites]: favouritesEnabled,
        [MetaSpace.People]: peopleEnabled,
        [MetaSpace.Orphans]: orphansEnabled,
        [MetaSpace.VideoRooms]: videoRoomsEnabled,
    } = useSettingValue("Spaces.enabledMetaSpaces");
    const allRoomsInHome = useSettingValue("Spaces.allRoomsInHome");
    const guestSpaUrl = useMemo(() => {
        return SdkConfig.get("element_call").guest_spa_url;
    }, []);
    const conferenceSubsectionText =
        _t("settings|sidebar|metaspaces_video_rooms_description") +
        (guestSpaUrl ? " " + _t("settings|sidebar|metaspaces_video_rooms_description_invite_extension") : "");

    const onAllRoomsInHomeToggle = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        await SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.ACCOUNT, event.target.checked);
        PosthogTrackers.trackInteraction("WebSettingsSidebarTabSpacesCheckbox", event, 1);
    };

    // "Favourites" and "People" meta spaces are not available in the new room list
    const newRoomListEnabled = useSettingValue("feature_new_room_list");

    return (
        <SettingsTab>
            <SettingsSection>
                <SettingsSubsection
                    heading={_t("settings|sidebar|metaspaces_subsection")}
                    description={_t("settings|sidebar|spaces_explainer")}
                >
                    <StyledCheckbox
                        checked={!!homeEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.Home, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                        disabled={homeEnabled}
                        description={_t("settings|sidebar|metaspaces_home_description")}
                    >
                        <HomeSolidIcon className="mx_SidebarUserSettingsTab_icon" />
                        {_t("common|home")}
                    </StyledCheckbox>

                    <StyledCheckbox
                        checked={allRoomsInHome}
                        disabled={!homeEnabled}
                        onChange={onAllRoomsInHomeToggle}
                        className="mx_SidebarUserSettingsTab_checkbox mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"
                        data-testid="mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"
                        description={_t("settings|sidebar|metaspaces_home_all_rooms_description")}
                    >
                        {_t("settings|sidebar|metaspaces_home_all_rooms")}
                    </StyledCheckbox>

                    {!newRoomListEnabled && (
                        <>
                            <StyledCheckbox
                                checked={!!favouritesEnabled}
                                onChange={onMetaSpaceChangeFactory(
                                    MetaSpace.Favourites,
                                    "WebSettingsSidebarTabSpacesCheckbox",
                                )}
                                className="mx_SidebarUserSettingsTab_checkbox"
                                description={_t("settings|sidebar|metaspaces_favourites_description")}
                            >
                                <FavouriteSolidIcon className="mx_SidebarUserSettingsTab_icon" />
                                {_t("common|favourites")}
                            </StyledCheckbox>

                            <StyledCheckbox
                                checked={!!peopleEnabled}
                                onChange={onMetaSpaceChangeFactory(
                                    MetaSpace.People,
                                    "WebSettingsSidebarTabSpacesCheckbox",
                                )}
                                className="mx_SidebarUserSettingsTab_checkbox"
                                description={_t("settings|sidebar|metaspaces_people_description")}
                            >
                                <UserProfileSolidIcon className="mx_SidebarUserSettingsTab_icon" />
                                {_t("common|people")}
                            </StyledCheckbox>
                        </>
                    )}

                    <StyledCheckbox
                        checked={!!orphansEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.Orphans, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                        description={_t("settings|sidebar|metaspaces_orphans_description")}
                    >
                        {_t("settings|sidebar|metaspaces_orphans")}
                    </StyledCheckbox>
                    {SettingsStore.getValue("feature_video_rooms") && (
                        <StyledCheckbox
                            checked={!!videoRoomsEnabled}
                            onChange={onMetaSpaceChangeFactory(
                                MetaSpace.VideoRooms,
                                "WebSettingsSidebarTabSpacesCheckbox",
                            )}
                            className="mx_SidebarUserSettingsTab_checkbox"
                            description={conferenceSubsectionText}
                        >
                            <VideoCallSolidIcon className="mx_SidebarUserSettingsTab_icon" />
                            {_t("settings|sidebar|metaspaces_video_rooms")}
                        </StyledCheckbox>
                    )}
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};

export default SidebarUserSettingsTab;
