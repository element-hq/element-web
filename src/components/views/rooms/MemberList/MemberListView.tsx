/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React from "react";
import { List, ListRowProps } from "react-virtualized/dist/commonjs/List";
import { AutoSizer } from "react-virtualized";

import { Flex } from "../../../utils/Flex";
import { useMemberListViewModel } from "../../../viewmodels/memberlist/MemberListViewModel";
import { RoomMemberTileView } from "./tiles/RoomMemberTileView";
import { ThreePidInviteTileView } from "./tiles/ThreePidInviteTileView";
import { MemberListHeaderView } from "./MemberListHeaderView";
import BaseCard from "../../right_panel/BaseCard";
import { _t } from "../../../../languageHandler";
import { RovingTabIndexProvider } from "../../../../accessibility/RovingTabIndex";

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
            <RovingTabIndexProvider handleUpDown scrollIntoView>
                {({ onKeyDownHandler }) => (
                    <Flex
                        tabIndex={0}
                        onKeyDown={onKeyDownHandler}
                        align="stretch"
                        direction="column"
                        className="mx_MemberListView_container"
                    >
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
                )}
            </RovingTabIndexProvider>
        </BaseCard>
    );
};

export default MemberListView;
