/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { type JSX, useCallback } from "react";

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
import { type ListContext, ListView } from "../../../utils/ListView";

interface IProps {
    roomId: string;
    onClose: () => void;
}

const MemberListView: React.FC<IProps> = (props: IProps) => {
    const vm = useMemberListViewModel(props.roomId);
    const { isPresenceEnabled, onClickMember } = vm;

    const getItemComponent = useCallback(
        (index: number, item: MemberWithSeparator, context: ListContext<any>, onBlur: () => void): JSX.Element => {
            const focused = index === context.focusedIndex;
            if (item === SEPARATOR) {
                return <hr className="mx_MemberListView_separator" />;
            } else if (item.member) {
                return (
                    <RoomMemberTileView
                        member={item.member}
                        showPresence={isPresenceEnabled}
                        focused={focused}
                        index={index}
                        onBlur={onBlur}
                    />
                );
            } else {
                return (
                    <ThreePidInviteTileView
                        threePidInvite={item.threePidInvite}
                        focused={focused}
                        index={index}
                        onBlur={onBlur}
                    />
                );
            }
        },
        [isPresenceEnabled],
    );

    const handleSelectItem = useCallback(
        (item: MemberWithSeparator): void => {
            if (item !== SEPARATOR) {
                if (item.member) {
                    onClickMember(item.member);
                } else {
                    onClickMember(item.threePidInvite);
                }
            }
        },
        [onClickMember],
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
                    onSelectItem={handleSelectItem}
                    getItemComponent={getItemComponent}
                    isItemFocusable={isItemFocusable}
                    overscan={15 * 56}
                    aria-label={_t("member_list|list_title")}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
