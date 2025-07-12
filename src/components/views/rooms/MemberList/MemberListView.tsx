/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { useCallback, useRef, type JSX } from "react";
import { type ListRange, Virtuoso, type VirtuosoHandle } from "react-virtuoso";

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
    const virtusoHandleRef = useRef<VirtuosoHandle | null>(null);
    const virtusoDomRef = useRef<HTMLElement | Window | null>(null);
    const [focusedIndex, setFocusedIndex] = React.useState(-1);
    const [lastFocusedIndex, setLastFocusedIndex] = React.useState(-1);
    const [visibleRange, setVisibleRange] = React.useState<ListRange | undefined>(undefined);

    const getRowComponent = (item: MemberWithSeparator, index: number, focusedIndex: number): JSX.Element => {
        const focused = index == focusedIndex;
        const onBlur = (): void => {
            if (focusedIndex == index) {
                setFocusedIndex(-1);
                setLastFocusedIndex(index);
            }
        };

        if (item === SEPARATOR) {
            return <hr className="mx_MemberListView_separator" />;
        } else if (item.member) {
            return (
                <RoomMemberTileView
                    member={item.member}
                    showPresence={vm.isPresenceEnabled}
                    focused={index == focusedIndex}
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
    };

    const scrollToIndex = useCallback(
        (index: number, align?: "center" | "end" | "start"): void => {
            virtusoHandleRef?.current?.scrollIntoView({
                index: index,
                align: align,
                behavior: "auto",
                done: () => {
                    setFocusedIndex(index);
                },
            });
        },
        [virtusoHandleRef],
    );

    const scrollToMember = useCallback(
        (index: number, isDirectionDown: boolean, align?: "center" | "end" | "start"): void => {
            const nextItemIsSeparator = isDirectionDown
                ? focusedIndex < totalRows - 1 && vm.members[index] === SEPARATOR
                : focusedIndex > 1 && vm.members[index] === SEPARATOR;
            const nextMemberOffset = nextItemIsSeparator ? 1 : 0;
            const nextIndex = isDirectionDown
                ? Math.min(totalRows - 1, index + nextMemberOffset)
                : Math.max(0, index - nextMemberOffset);
            scrollToIndex(nextIndex, align);
        },
        [focusedIndex, totalRows, scrollToIndex, vm.members],
    );

    const keyDownCallback = useCallback(
        (e: any) => {
            let handled = false;
            if (e.code === "ArrowUp") {
                scrollToMember(focusedIndex - 1, false);
                handled = true;
            } else if (e.code === "ArrowDown") {
                scrollToMember(focusedIndex + 1, true);
                handled = true;
            } else if ((e.code === "Enter" || e.code === "Space") && focusedIndex >= 0) {
                const item = vm.members[focusedIndex];
                if (item !== SEPARATOR) {
                    const member = item.member ?? item.threePidInvite;
                    vm.onClickMember(member);
                    handled = true;
                }
            } else if (e.code === "Home") {
                scrollToIndex(0);
                handled = true;
            } else if (e.code === "End") {
                scrollToIndex(vm.members.length - 1);
                handled = true;
            } else if (e.code === "PageDown" && visibleRange) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                scrollToMember(focusedIndex + numberDisplayed, false, `start`);
                handled = true;
            } else if (e.code === "PageUp" && visibleRange) {
                const numberDisplayed = visibleRange.endIndex - visibleRange.startIndex;
                scrollToMember(focusedIndex - numberDisplayed, false, `start`);
                handled = true;
            }

            if (handled) {
                e.stopPropagation();
                e.preventDefault();
            }
        },
        [scrollToIndex, scrollToMember, focusedIndex, vm, visibleRange],
    );

    const onFocus = (e?: React.FocusEvent): void => {
        if (e?.currentTarget !== virtusoDomRef.current || focusedIndex > -1) {
            return;
        }
        const nextIndex = lastFocusedIndex == -1 ? 0 : lastFocusedIndex;
        scrollToIndex(nextIndex);
        e.stopPropagation();
        e.preventDefault();
    };

    function footer(): React.ReactNode {
        return <div style={{ height: "32px" }} />;
    }

    const scrollerRef = React.useCallback(
        (element: HTMLElement | Window | null) => {
            if (element) {
                virtusoDomRef.current = element;
            }
        },
        [keyDownCallback],
    );

    return (
        <BaseCard
            id="memberlist-panel"
            className="mx_MemberListView"
            ariaLabelledBy="memberlist-panel-tab"
            role="tabpanel"
            header={_t("common|people")}
            onClose={props.onClose}
            onKeyDown={keyDownCallback}
        >
            <Flex align="stretch" direction="column" className="mx_MemberListView_container">
                <Form.Root>
                    <MemberListHeaderView vm={vm} />
                </Form.Root>
                <Virtuoso
                    aria-label={_t("member_list|list_title")}
                    role="grid"
                    aria-rowcount={vm.members.length}
                    aria-colcount={1}
                    scrollerRef={scrollerRef}
                    ref={virtusoHandleRef}
                    style={{ height: "100%" }}
                    context={{ focusedIndex }}
                    rangeChanged={setVisibleRange}
                    data={vm.members}
                    onFocus={onFocus}
                    itemContent={(index, member, context) => getRowComponent(member, index, context.focusedIndex)}
                    components={{ Footer: () => footer() }}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
