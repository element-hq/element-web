/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { createRef } from "react";
import { type RoomMember } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import NodeAnimator from "../../../NodeAnimator";
import { toPx } from "../../../utils/units";
import MemberAvatar from "../avatars/MemberAvatar";
import { READ_AVATAR_SIZE } from "./ReadReceiptGroup";

// The top & right from the bounding client rect of each read receipt
export interface IReadReceiptPosition {
    top?: number;
    right?: number;
}

interface IProps {
    // the RoomMember to show the RR for
    member?: RoomMember | null;
    // userId to fallback the avatar to
    // if the member hasn't been loaded yet
    fallbackUserId: string;

    // number of pixels to offset the avatar from the right of its parent;
    // typically a negative value.
    offset: number;

    // true to hide the avatar (it will still be animated)
    hidden?: boolean;

    // don't animate this RR into position
    suppressAnimation?: boolean;

    // an opaque object for storing information about this user's RR in this room
    readReceiptPosition?: IReadReceiptPosition;

    // A function which is used to check if the parent panel is being
    // unmounted, to avoid unnecessary work. Should return true if we
    // are being unmounted.
    checkUnmounting?: () => boolean;

    // Timestamp when the receipt was read
    timestamp?: number;

    // True to show twelve hour format, false otherwise
    showTwelveHour?: boolean;
}

interface IState {
    suppressDisplay: boolean;
    startStyles?: IReadReceiptMarkerStyle[];
}

interface IReadReceiptMarkerStyle {
    top: number;
    right: number;
}

export default class ReadReceiptMarker extends React.PureComponent<IProps, IState> {
    private avatar = createRef<HTMLDivElement>();

    public constructor(props: IProps) {
        super(props);

        this.state = {
            // if we are going to animate the RR, we don't show it on first render,
            // and instead just add a placeholder to the DOM; once we've been
            // mounted, we start an animation which moves the RR from its old
            // position.
            suppressDisplay: !this.props.suppressAnimation,
        };
    }

    public componentWillUnmount(): void {
        // before we remove the rr, store its location in the map, so that if
        // it reappears, it can be animated from the right place.
        const rrInfo = this.props.readReceiptPosition;
        if (!rrInfo) {
            return;
        }

        // checking the DOM properties can force a re-layout, which can be
        // quite expensive; so if the parent messagepanel is being unmounted,
        // then don't bother with this.
        if (this.props.checkUnmounting && this.props.checkUnmounting()) {
            return;
        }

        this.buildReadReceiptInfo(rrInfo);
    }

    public componentDidMount(): void {
        if (!this.state.suppressDisplay) {
            // we've already done our display - nothing more to do.
            return;
        }
        this.animateMarker();
    }

    public componentDidUpdate(prevProps: IProps): void {
        const differentOffset = prevProps.offset !== this.props.offset;
        const visibilityChanged = prevProps.hidden !== this.props.hidden;
        if (differentOffset || visibilityChanged) {
            this.animateMarker();
        }
    }

    private buildReadReceiptInfo(target: IReadReceiptPosition = {}): IReadReceiptPosition {
        const element = this.avatar.current;
        // this is the mx_ReadReceiptsGroup_container
        const horizontalContainer = element?.offsetParent;
        if (!horizontalContainer || !horizontalContainer.getBoundingClientRect) {
            // this seems to happen sometimes for reasons I don't understand
            // the docs for `offsetParent` say it may be null if `display` is
            // `none`, but I can't see why that would happen.
            logger.warn(`ReadReceiptMarker for ${this.props.fallbackUserId} has no valid horizontalContainer`);

            target.top = 0;
            target.right = 0;
            return target;
        }

        const elementRect = element.getBoundingClientRect();

        target.top = elementRect.top;
        target.right = elementRect.right - horizontalContainer.getBoundingClientRect().right;
        return target;
    }

    private animateMarker(): void {
        const oldInfo = this.props.readReceiptPosition;
        const newInfo = this.buildReadReceiptInfo();

        const newPosition = newInfo.top ?? 0;
        const oldPosition =
            oldInfo && oldInfo.top !== undefined
                ? // start at the old height and in the old h pos
                  oldInfo.top
                : // treat new RRs as though they were off the top of the screen
                  -READ_AVATAR_SIZE;

        const startStyles: IReadReceiptMarkerStyle[] = [];
        if (oldInfo?.right) {
            startStyles.push({
                top: oldPosition - newPosition,
                right: oldInfo.right,
            });
        }
        startStyles.push({
            top: oldPosition - newPosition,
            right: 0,
        });

        this.setState({
            suppressDisplay: false,
            startStyles,
        });
    }

    public render(): React.ReactNode {
        if (this.state.suppressDisplay) {
            return <div ref={this.avatar} />;
        }

        const style = {
            right: toPx(this.props.offset),
            top: "0px",
        };

        return (
            <NodeAnimator startStyles={this.state.startStyles} innerRef={this.avatar}>
                <MemberAvatar
                    member={this.props.member ?? null}
                    fallbackUserId={this.props.fallbackUserId}
                    aria-hidden="true"
                    aria-live="off"
                    size="14px"
                    style={style}
                    hideTitle
                    tabIndex={-1}
                />
            </NodeAnimator>
        );
    }
}
