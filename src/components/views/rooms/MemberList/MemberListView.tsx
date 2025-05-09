/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { useCallback, useRef, type JSX } from "react";
import { Virtualizer, VirtualizerHandle } from "virtua";
// import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

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

interface IProps {
    roomId: string;
    onClose: () => void;
}

const MemberListView: React.FC<IProps> = (props: IProps) => {
    const vm = useMemberListViewModel(props.roomId);
    const totalRows = vm.members.length;
    const ref = useRef<VirtualizerHandle | null>(null);
    const scrollRef = useRef<HTMLDivElement | null>(null);
    const [focusedIndex, setFocusedIndex] = React.useState(-1);

    const getRowComponent = (item: MemberWithSeparator, focused: boolean): JSX.Element => {
        if (item === SEPARATOR) {
            return <hr className="mx_MemberListView_separator" />;
        } else if (item.member) {
            return <RoomMemberTileView member={item.member} showPresence={vm.isPresenceEnabled} focused={focused} />;
        } else {
            return <ThreePidInviteTileView threePidInvite={item.threePidInvite} focused={focused} />;
        }
    };

    const scrollToIndex = useCallback(
        (index: number): void => {
            ref?.current?.scrollToIndex(index, {
                align: "nearest",
            });
            setFocusedIndex(index);
        },
        [ref],
    );

    const keyDownCallback = useCallback(
        (e: any) => {
            if (e.code === "ArrowUp") {
                const nextItemIsSeparator = focusedIndex > 1 && vm.members[focusedIndex - 1] === SEPARATOR;
                const nextMemberOffset = nextItemIsSeparator ? 2 : 1;
                scrollToIndex(Math.max(0, focusedIndex - nextMemberOffset));
                e.preventDefault();
            } else if (e.code === "ArrowDown") {
                const nextItemIsSeparator = focusedIndex < totalRows - 1 && vm.members[focusedIndex + 1] === SEPARATOR;
                const nextMemberOffset = nextItemIsSeparator ? 2 : 1;
                scrollToIndex(Math.min(totalRows - 1, focusedIndex + nextMemberOffset));
                e.preventDefault();
            } else if ((e.code === "Enter" || e.code === "Space") && focusedIndex >= 0) {
                const item = vm.members[focusedIndex];
                if (item !== SEPARATOR) {
                    const member = item.member ?? item.threePidInvite;
                    vm.onClickMember(member);
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        },
        [scrollToIndex, focusedIndex, setFocusedIndex, vm, totalRows],
    );

    const onFocus = (e: React.FocusEvent): void => {
        const nextIndex = focusedIndex == -1 ? 0 : focusedIndex;
        scrollToIndex(nextIndex);
        e.preventDefault();
    };

    function footer(): React.ReactNode {
        return <div style={{ height: "32px" }} />;
    }

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
                <div
                    style={{
                        overflowY: "auto",
                        // opt out browser's scroll anchoring on header/footer because it will conflict to scroll anchoring of virtualizer
                        overflowAnchor: "none",
                    }}
                    aria-label={_t("room_list|list_title")}
                    role="grid"
                    ref={scrollRef}
                    onFocus={onFocus}
                    onKeyDown={keyDownCallback}
                    tabIndex={0}
                >
                    <Virtualizer ref={ref} scrollRef={scrollRef}>
                        {vm.members.map((member, index) => getRowComponent(member, index === focusedIndex))}
                    </Virtualizer>
                    {footer()}
                </div>
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
