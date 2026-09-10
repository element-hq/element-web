/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { type JSX, useCallback, useMemo } from "react";
import { Flex, type VirtualizedListContext, FlatVirtualizedList } from "@element-hq/web-shared-components";

import {
    isMemberListSeparator,
    type MemberWithSeparator,
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

/**
 * Height of a single member list item
 */
const MEMBER_LIST_ITEM_HEIGHT = 56;
/**
 * Amount to extend the top and bottom of the viewport by.
 * From manual testing 15 items seems to be enough to never really see the blank space when scrolling.
 */
const EXTENDED_VIEWPORT_HEIGHT = 15 * MEMBER_LIST_ITEM_HEIGHT;

const MemberListView: React.FC<IProps> = (props: IProps) => {
    const vm = useMemberListViewModel(props.roomId);
    const { isPresenceEnabled, memberCount } = vm;

    const separatorIndexes = useMemo(
        () => vm.members.flatMap((item, index) => (isMemberListSeparator(item) ? [index] : [])),
        [vm.members],
    );
    const getFocusableMemberIndex = useCallback(
        (index: number): number => index - separatorIndexes.filter((separatorIndex) => separatorIndex < index).length,
        [separatorIndexes],
    );

    const getItemKey = useCallback((item: MemberWithSeparator): string => {
        if (isMemberListSeparator(item)) {
            return item.key;
        } else if (item.member) {
            return `member-${item.member.userId}`;
        } else {
            return `threePidInvite-${item.threePidInvite.event.getStateKey()}`;
        }
    }, []);

    const getItemComponent = useCallback(
        (
            index: number,
            item: MemberWithSeparator,
            context: VirtualizedListContext<any>,
            onFocus: (item: MemberWithSeparator, e: React.FocusEvent) => void,
        ): JSX.Element => {
            const itemKey = getItemKey(item);
            const isRovingItem = itemKey === context.tabIndexKey;
            const focused = isRovingItem && context.focused;
            if (isMemberListSeparator(item)) {
                return <hr className="mx_MemberListView_separator" />;
            } else if (item.member) {
                return (
                    <RoomMemberTileView
                        item={item}
                        member={item.member}
                        isCallParticipant={item.isCallParticipant}
                        showPresence={isPresenceEnabled}
                        focused={focused}
                        tabIndex={isRovingItem ? 0 : -1}
                        memberIndex={getFocusableMemberIndex(index)}
                        memberCount={memberCount}
                        onFocus={onFocus}
                    />
                );
            } else {
                return (
                    <ThreePidInviteTileView
                        item={item}
                        threePidInvite={item.threePidInvite}
                        focused={focused}
                        tabIndex={isRovingItem ? 0 : -1}
                        memberIndex={getFocusableMemberIndex(index)}
                        memberCount={memberCount}
                        onFocus={onFocus}
                    />
                );
            }
        },
        [getItemKey, getFocusableMemberIndex, isPresenceEnabled, memberCount],
    );

    const isItemFocusable = useCallback((item: MemberWithSeparator): boolean => {
        return !isMemberListSeparator(item);
    }, []);

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
                <Form.Root onSubmit={(e) => e.preventDefault()}>
                    <MemberListHeaderView vm={vm} />
                </Form.Root>
                <FlatVirtualizedList
                    items={vm.members}
                    getItemComponent={getItemComponent}
                    getItemKey={getItemKey}
                    isItemFocusable={isItemFocusable}
                    role="listbox"
                    aria-label={_t("member_list|list_title")}
                    fixedItemHeight={MEMBER_LIST_ITEM_HEIGHT}
                    increaseViewportBy={{
                        bottom: EXTENDED_VIEWPORT_HEIGHT,
                        top: EXTENDED_VIEWPORT_HEIGHT,
                    }}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
