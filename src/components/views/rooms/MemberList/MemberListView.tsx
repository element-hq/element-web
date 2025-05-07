/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { useRef, type JSX } from "react";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

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
    const ref = useRef<VirtuosoHandle | null>(null);
    const [focusedIndex, setFocusedIndex] = React.useState(-1);
    const listRef = useRef<HTMLButtonElement | null>(null);

    const getRowComponent = (item: MemberWithSeparator, focused: boolean): JSX.Element => {
        if (item === SEPARATOR) {
            return <hr className="mx_MemberListView_separator" />;
        } else if (item.member) {
            return <RoomMemberTileView member={item.member} showPresence={vm.isPresenceEnabled} focused={focused} />;
        } else {
            return <ThreePidInviteTileView threePidInvite={item.threePidInvite} />;
        }
    };

    const scrollToIndex = (index: number): void => {
        ref?.current?.scrollIntoView({
            index: index,
            behavior: "auto",
            done: () => {
                setFocusedIndex(index);
            },
        });
    };

    const keyDownCallback = React.useCallback(
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
                    let member = item.member ?? item.threePidInvite;
                    vm.onClickMember(member);
                    e.stopPropagation();
                    e.preventDefault();
                }
            }
        },
        [focusedIndex, ref, setFocusedIndex, vm, totalRows],
    );

    const scrollerRef = React.useCallback(
        (element: any) => {
            if (element) {
                element.addEventListener("keydown", keyDownCallback);
                listRef.current = element;
            } else {
                listRef?.current?.removeEventListener("keydown", keyDownCallback);
            }
        },
        [keyDownCallback],
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
                <Virtuoso
                    ref={ref}
                    style={{ height: "100%" }}
                    scrollerRef={scrollerRef}
                    context={{ focusedIndex }}
                    data={vm.members}
                    onFocus={onFocus}
                    itemContent={(index, member) => getRowComponent(member, index === focusedIndex)}
                    components={{ Footer: () => footer() }}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
