/*
Copyright 2019 New Vector Ltd

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

import React, { ContextType } from 'react';
import { _t } from "../../../../../languageHandler";
import RoomProfileSettings from "../../../room_settings/RoomProfileSettings";
import AccessibleButton from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import { replaceableComponent } from "../../../../../utils/replaceableComponent";
import UrlPreviewSettings from "../../../room_settings/UrlPreviewSettings";
import RelatedGroupSettings from "../../../room_settings/RelatedGroupSettings";
import AliasSettings from "../../../room_settings/AliasSettings";

interface IProps {
    roomId: string;
}

interface IState {
    isRoomPublished: boolean;
}

@replaceableComponent("views.settings.tabs.room.GeneralRoomSettingsTab")
export default class GeneralRoomSettingsTab extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    context: ContextType<typeof MatrixClientContext>;

    constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            isRoomPublished: false, // loaded async
        };
    }

    private onLeaveClick = (): void => {
        dis.dispatch({
            action: 'leave_room',
            room_id: this.props.roomId,
        });
    };

    public render(): JSX.Element {
        const client = this.context;
        const room = client.getRoom(this.props.roomId);

        const canSetAliases = true; // Previously, we arbitrarily only allowed admins to do this
        const canSetCanonical = room.currentState.mayClientSendStateEvent("m.room.canonical_alias", client);
        const canonicalAliasEv = room.currentState.getStateEvents("m.room.canonical_alias", '');

        const canChangeGroups = room.currentState.mayClientSendStateEvent("m.room.related_groups", client);
        const groupsEvent = room.currentState.getStateEvents("m.room.related_groups", "");

        let urlPreviewSettings = <>
            <span className='mx_SettingsTab_subheading'>{ _t("URL Previews") }</span>
            <div className='mx_SettingsTab_section'>
                <UrlPreviewSettings room={room} />
            </div>
        </>;
        if (!SettingsStore.getValue(UIFeature.URLPreviews)) {
            urlPreviewSettings = null;
        }

        let flairSection;
        if (SettingsStore.getValue(UIFeature.Flair)) {
            flairSection = <>
                <span className='mx_SettingsTab_subheading'>{ _t("Flair") }</span>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <RelatedGroupSettings
                        roomId={room.roomId}
                        canSetRelatedGroups={canChangeGroups}
                        relatedGroupsEvent={groupsEvent}
                    />
                </div>
            </>;
        }

        let leaveSection;
        if (room.getMyMembership() === "join") {
            leaveSection = <>
                <span className='mx_SettingsTab_subheading'>{ _t("Leave room") }</span>
                <div className='mx_SettingsTab_section'>
                    <AccessibleButton kind='danger' onClick={this.onLeaveClick}>
                        { _t('Leave room') }
                    </AccessibleButton>
                </div>
            </>;
        }

        return (
            <div className="mx_SettingsTab mx_GeneralRoomSettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("General") }</div>
                <div className='mx_SettingsTab_section mx_GeneralRoomSettingsTab_profileSection'>
                    <RoomProfileSettings roomId={this.props.roomId} />
                </div>

                <div className="mx_SettingsTab_heading">{ _t("Room Addresses") }</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <AliasSettings
                        roomId={this.props.roomId}
                        canSetCanonicalAlias={canSetCanonical}
                        canSetAliases={canSetAliases}
                        canonicalAliasEvent={canonicalAliasEv}
                    />
                </div>
                <div className="mx_SettingsTab_heading">{ _t("Other") }</div>
                { flairSection }
                { urlPreviewSettings }
                { leaveSection }
            </div>
        );
    }
}
