/*
Copyright 2024 The Matrix.org Foundation C.I.C.

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

import { Form } from "@vector-im/compound-web";
import React from "react";
import { List, ListRowProps } from "react-virtualized/dist/commonjs/List";
import { AutoSizer } from "react-virtualized";

import { Flex } from "../../utils/Flex";
import { useMemberListViewModel } from "../../viewmodels/MemberListViewModel";
import { RoomMemberTileView, ThreePidInviteTileView } from "./MemberTileView";
import MemberListHeaderView from "./MemberListHeaderView";
import BaseCard from "../right_panel/BaseCard";
import { _t } from "../../../languageHandler";

interface IProps {
    roomId: string;
    onClose: () => void;
}

const MemberListView: React.FC<IProps> = (props: IProps) => {
    const vm = useMemberListViewModel(props.roomId);

    const memberCount = vm.members.length;

    const rowRenderer = ({ key, index, style }: ListRowProps): React.JSX.Element => {
        if (index === memberCount) {
            // We've rendered all the members,
            // now we render an empty div to add some space to the end of the list.
            return <div key={key} style={style} />;
        }
        const item = vm.members[index];
        return (
            <div key={key} style={style}>
                {item.member ? (
                    <RoomMemberTileView member={item.member} showPresence={vm.isPresenceEnabled} />
                ) : (
                    <ThreePidInviteTileView threePidInvite={item.threePidInvite} />
                )}
            </div>
        );
    };

    return (
        <BaseCard
            id="memberlist-panel"
            className="mx_MemberListView"
            ariaLabelledBy="memberlist-panel-tab"
            role="tabpanel"
            header={_t("common|people")}
            onClose={props.onClose}
        >
            <Flex align="stretch" direction="column" className="mx_MemberListView_container">
                <Form.Root>
                    <MemberListHeaderView vm={vm} />
                </Form.Root>
                <AutoSizer>
                    {({ height, width }) => (
                        <List
                            rowRenderer={rowRenderer}
                            // All the member tiles will have a height of 56px.
                            // The additional empty div at the end of the list should have a height of 32px.
                            rowHeight={({ index }) => (index === memberCount ? 32 : 56)}
                            // The +1 refers to the additional empty div that we render at the end of the list.
                            rowCount={memberCount + 1}
                            // Subtract the height of MemberlistHeaderView so that the parent div does not overflow.
                            height={height - 113}
                            width={width}
                        />
                    )}
                </AutoSizer>
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
