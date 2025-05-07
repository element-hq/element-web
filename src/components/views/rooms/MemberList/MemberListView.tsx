/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { type JSX } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

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

    const getRowComponent = (item: MemberWithSeparator): JSX.Element => {
        if (item === SEPARATOR) {
            return <hr className="mx_MemberListView_separator" />;
        } else if (item.member) {
            return <RoomMemberTileView member={item.member} showPresence={vm.isPresenceEnabled} />;
        } else {
            return <ThreePidInviteTileView threePidInvite={item.threePidInvite} />;
        }
    };

    const getRowHeight = (index: number): number => {
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

    const scrollContainer = React.useRef<HTMLDivElement | null>(null);
    const virtualizer = useVirtualizer({
        count: totalRows,
        getScrollElement: () => scrollContainer.current,
        estimateSize: (i) => getRowHeight(i),
        overscan: 15,
    });
    const items = virtualizer.getVirtualItems();

    return (
        <BaseCard
            id="memberlist-panel"
            className="mx_MemberListView"
            ariaLabelledBy="memberlist-panel-tab"
            role="tabpanel"
            header={_t("common|people")}
            onClose={props.onClose}
        >
            {/* <RovingTabIndexProvider handleUpDown scrollIntoView> */}
            {/* {({ onKeyDownHandler }) => ( */}
            <Flex
                align="stretch"
                direction="column"
                className="mx_MemberListView_container"
                // onKeyDown={onKeyDownHandler}
            >
                <Form.Root>
                    <MemberListHeaderView vm={vm} />
                </Form.Root>
                <div
                    ref={scrollContainer}
                    style={{
                        height: "100%",
                        width: "100%",
                        overflowY: "auto",
                        contain: "strict",
                    }}
                >
                    <div
                        style={{
                            height: virtualizer.getTotalSize(),
                            width: "100%",
                            position: "relative",
                        }}
                    >
                        <div
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                transform: `translateY(${items[0]?.start ?? 0}px)`,
                            }}
                        >
                            {items.map((virtualRow: any) => {
                                const member = vm.members[virtualRow.index];
                                return (
                                    <div
                                        key={virtualRow.key}
                                        data-index={virtualRow.index}
                                        ref={virtualizer.measureElement}
                                    >
                                        {getRowComponent(member)}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </Flex>
            {/* )} */}
            {/* </RovingTabIndexProvider> */}
        </BaseCard>
    );
};

export default MemberListView;
