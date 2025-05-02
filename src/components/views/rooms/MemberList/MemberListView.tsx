/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { Form } from "@vector-im/compound-web";
import React, { useRef, type JSX } from "react";

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
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";

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
    const ref = useRef<VirtuosoHandle | null>(null);
    const [currentItemIndex, setCurrentItemIndex] = React.useState(-1)
    const listRef = useRef<HTMLButtonElement | null>(null);

    const keyDownCallback = React.useCallback(
        (e: any) => {
            let nextIndex = null
            console.log("keydown")
            console.log(e.code)
            if (e.code === 'ArrowUp') {
                nextIndex = Math.max(0, currentItemIndex - 1)
            } else if (e.code === 'ArrowDown') {
                nextIndex = Math.min(totalRows, currentItemIndex + 1)
            } else if (e.code === 'enter') {
                nextIndex = Math.min(totalRows, currentItemIndex + 1)
            }

            if (nextIndex !== null) {
                ref?.current?.scrollIntoView({
                    index: nextIndex,
                    behavior: 'auto',
                    done: () => {
                        setCurrentItemIndex(nextIndex)
                    },
                })
                e.preventDefault()
            }
        },
        [currentItemIndex, ref, setCurrentItemIndex]
    )

    const scrollerRef = React.useCallback(
        (element: any) => {
            if (element) {
                element.addEventListener('keydown', keyDownCallback)
                listRef.current = element
            } else {
                listRef?.current?.removeEventListener('keydown', keyDownCallback)
            }
        },
        [keyDownCallback]
    )
    return (
        <BaseCard
            id="memberlist-panel"
            className="mx_MemberListView"
            ariaLabelledBy="memberlist-panel-tab"
            role="tabpanel"
            header={_t("common|people")}
            onClose={props.onClose}
        >
            <Flex
                align="stretch"
                direction="column"
                className="mx_MemberListView_container"
            >
                <Form.Root>
                    <MemberListHeaderView vm={vm} />
                </Form.Root>

                <Virtuoso
                    ref={ref}
                    style={{ height: '100%' }}
                    scrollerRef={scrollerRef}
                    context={{ currentItemIndex }}
                    data={vm.members}
                    itemContent={(index, member) => (
                        <div
                            style={{
                                borderColor: index === currentItemIndex ? 'var(--border)' : 'transparent',
                                borderWidth: '1px',
                                borderStyle: 'solid',
                            }}
                        >
                            {getRowComponent(member)}
                        </div>

                    )}
                />
            </Flex>
        </BaseCard>
    );
};

export default MemberListView;
