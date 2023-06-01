/*
Copyright 2021 - 2023 The Matrix.org Foundation C.I.C.

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

import React, { ChangeEvent } from "react";

import { Icon as HomeIcon } from "../../../../../../res/img/element-icons/home.svg";
import { Icon as FavoriteIcon } from "../../../../../../res/img/element-icons/roomlist/favorite.svg";
import { Icon as MembersIcon } from "../../../../../../res/img/element-icons/room/members.svg";
import { Icon as HashCircleIcon } from "../../../../../../res/img/element-icons/roomlist/hash-circle.svg";
import { _t } from "../../../../../languageHandler";
import SettingsStore from "../../../../../settings/SettingsStore";
import { SettingLevel } from "../../../../../settings/SettingLevel";
import StyledCheckbox from "../../../elements/StyledCheckbox";
import { useSettingValue } from "../../../../../hooks/useSettings";
import { MetaSpace } from "../../../../../stores/spaces";
import PosthogTrackers from "../../../../../PosthogTrackers";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection, { SettingsSubsectionText } from "../../shared/SettingsSubsection";

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
            [MetaSpace.Home, null, MetaSpace.Favourites, MetaSpace.People, MetaSpace.Orphans].indexOf(metaSpace),
        );
    };

const SidebarUserSettingsTab: React.FC = () => {
    const {
        [MetaSpace.Home]: homeEnabled,
        [MetaSpace.Favourites]: favouritesEnabled,
        [MetaSpace.People]: peopleEnabled,
        [MetaSpace.Orphans]: orphansEnabled,
    } = useSettingValue<Record<MetaSpace, boolean>>("Spaces.enabledMetaSpaces");
    const allRoomsInHome = useSettingValue<boolean>("Spaces.allRoomsInHome");

    const onAllRoomsInHomeToggle = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
        await SettingsStore.setValue("Spaces.allRoomsInHome", null, SettingLevel.ACCOUNT, event.target.checked);
        PosthogTrackers.trackInteraction("WebSettingsSidebarTabSpacesCheckbox", event, 1);
    };

    return (
        <SettingsTab>
            <SettingsSection heading={_t("Sidebar")}>
                <SettingsSubsection
                    heading={_t("Spaces to show")}
                    description={_t(
                        "Spaces are ways to group rooms and people. " +
                            "Alongside the spaces you're in, you can use some pre-built ones too.",
                    )}
                >
                    <StyledCheckbox
                        checked={!!homeEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.Home, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                        disabled={homeEnabled}
                    >
                        <SettingsSubsectionText>
                            <HomeIcon />
                            {_t("Home")}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t("Home is useful for getting an overview of everything.")}
                        </SettingsSubsectionText>
                    </StyledCheckbox>

                    <StyledCheckbox
                        checked={allRoomsInHome}
                        disabled={!homeEnabled}
                        onChange={onAllRoomsInHomeToggle}
                        className="mx_SidebarUserSettingsTab_checkbox mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"
                        data-testid="mx_SidebarUserSettingsTab_homeAllRoomsCheckbox"
                    >
                        <SettingsSubsectionText>{_t("Show all rooms")}</SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t("Show all your rooms in Home, even if they're in a space.")}
                        </SettingsSubsectionText>
                    </StyledCheckbox>

                    <StyledCheckbox
                        checked={!!favouritesEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.Favourites, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                    >
                        <SettingsSubsectionText>
                            <FavoriteIcon />
                            {_t("Favourites")}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t("Group all your favourite rooms and people in one place.")}
                        </SettingsSubsectionText>
                    </StyledCheckbox>

                    <StyledCheckbox
                        checked={!!peopleEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.People, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                    >
                        <SettingsSubsectionText>
                            <MembersIcon />
                            {_t("People")}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>{_t("Group all your people in one place.")}</SettingsSubsectionText>
                    </StyledCheckbox>

                    <StyledCheckbox
                        checked={!!orphansEnabled}
                        onChange={onMetaSpaceChangeFactory(MetaSpace.Orphans, "WebSettingsSidebarTabSpacesCheckbox")}
                        className="mx_SidebarUserSettingsTab_checkbox"
                    >
                        <SettingsSubsectionText>
                            <HashCircleIcon />
                            {_t("Rooms outside of a space")}
                        </SettingsSubsectionText>
                        <SettingsSubsectionText>
                            {_t("Group all your rooms that aren't part of a space in one place.")}
                        </SettingsSubsectionText>
                    </StyledCheckbox>
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};

export default SidebarUserSettingsTab;
