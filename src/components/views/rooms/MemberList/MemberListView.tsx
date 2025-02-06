/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React from "react";
import { List, type ListRowProps } from "react-virtualized/dist/commonjs/List";
import { AutoSizer } from "react-virtualized";

import { Flex } from "../../../utils/Flex";
import {
    type MemberWithSeparator,
    SEPARATOR,
    useMemberListViewModel,
} from "../../../viewmodels/memberlist/MemberListViewModel";
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

    const totalRows = vm.members.length;

    const getRowComponent = (item: MemberWithSeparator): React.JSX.Element => {
        if (item === SEPARATOR) {
            return <hr className="mx_MemberListView_separator" />;
        } else if (item.member) {
            return <RoomMemberTileView member={item.member} showPresence={vm.isPresenceEnabled} />;
        } else {
            return <ThreePidInviteTileView threePidInvite={item.threePidInvite} />;
        }
    };

    const getRowHeight = ({ index }: { index: number }): number => {
        if (vm.members[index] === SEPARATOR) {
            /**
             * This is a separator of 2px height rendered between
             * joined and invited members.
             */
            return 2;
        } else if (totalRows && index === totalRows) {
            /**
             * The empty spacer div rendered at the bottom should
             * have a height of 32px.
             */
            return 32;
        } else {
            /**
             * The actual member tiles have a height of 56px.
             */
            return 56;
        }
    };

    const rowRenderer = ({ key, index, style }: ListRowProps): React.JSX.Element => {
        if (index === totalRows) {
            // We've rendered all the members,
            // now we render an empty div to add some space to the end of the list.
            return <div key={key} style={style} />;
        }
        const item = vm.members[index];
        return (
            <div key={key} style={style}>
                {getRowComponent(item)}
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
                        align="stretch"
                        direction="column"
                        className="mx_MemberListView_container"
                        onKeyDown={onKeyDownHandler}
                    >
                        <Form.Root>
                            <MemberListHeaderView vm={vm} />
                        </Form.Root>
                        <AutoSizer>
                            {({ height, width }) => (
                                <List
                                    rowRenderer={rowRenderer}
                                    rowHeight={getRowHeight}
                                    // The +1 refers to the additional empty div that we render at the end of the list.
                                    rowCount={totalRows + 1}
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
