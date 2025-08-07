/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { type JSX, useCallback } from "react";

import { Flex } from "../../../../shared-components/utils/Flex";
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
import { type ListContext, ListView } from "../../../utils/ListView";

interface IProps {
    roomId: string;
    onClose: () => void;
}

const MemberListView: React.FC<IProps> = (props: IProps) => {
    const vm = useMemberListViewModel(props.roomId);
    const { isPresenceEnabled, memberCount } = vm;

    const getItemKey = useCallback((item: MemberWithSeparator): string => {
        if (item === SEPARATOR) {
            return "separator";
        } else if (item.member) {
            return `member-${item.member.userId}`;
        } else {
            return `threePidInvite-${item.threePidInvite.event.getContent().public_key}`;
        }
    }, []);

    const getItemComponent = useCallback(
        (
            index: number,
            item: MemberWithSeparator,
            context: ListContext<any>,
            onFocus: (e: React.FocusEvent) => void,
        ): JSX.Element => {
            const itemKey = getItemKey(item);
            const isRovingItem = itemKey === context.tabIndexKey;
            const focused = isRovingItem && context.focused;
            if (item === SEPARATOR) {
                return <hr className="mx_MemberListView_separator" />;
            } else if (item.member) {
                return (
                    <RoomMemberTileView
                        member={item.member}
                        showPresence={isPresenceEnabled}
                        focused={focused}
                        tabIndex={isRovingItem ? 0 : -1}
                        index={index}
                        memberCount={memberCount}
                        onFocus={onFocus}
                    />
                );
            } else {
                return (
                    <ThreePidInviteTileView
                        threePidInvite={item.threePidInvite}
                        focused={focused}
                        tabIndex={isRovingItem ? 0 : -1}
                        memberIndex={index - 1} // Adjust as invites are below the separator
                        memberCount={memberCount}
                        onFocus={onFocus}
                    />
                );
            }
        },
        [isPresenceEnabled, getItemKey, memberCount],
    );

    const isItemFocusable = useCallback((item: MemberWithSeparator): boolean => {
        return item !== SEPARATOR;
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
                <ListView
                    items={vm.members}
                    getItemComponent={getItemComponent}
                    getItemKey={getItemKey}
                    isItemFocusable={isItemFocusable}
                    role="listbox"
                    aria-label={_t("member_list|list_title")}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
