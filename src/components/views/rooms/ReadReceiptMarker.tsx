/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef, RefObject } from "react";
import { RoomMember } from "matrix-js-sdk/src/models/room-member";
import { logger } from "matrix-js-sdk/src/logger";

import NodeAnimator from "../../../NodeAnimator";
import { toPx } from "../../../utils/units";
import { LegacyMemberAvatar as MemberAvatar } from "../avatars/MemberAvatar";
import { READ_AVATAR_SIZE } from "./ReadReceiptGroup";

export interface IReadReceiptInfo {
    top?: number;
    right?: number;
    parent?: Element;
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
    readReceiptInfo?: IReadReceiptInfo;

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
    private avatar: React.RefObject<HTMLDivElement | HTMLImageElement | HTMLSpanElement> = createRef();

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
        const rrInfo = this.props.readReceiptInfo;
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

    private buildReadReceiptInfo(target: IReadReceiptInfo = {}): IReadReceiptInfo {
        const element = this.avatar.current;
        // this is the mx_ReadReceiptsGroup_container
        const horizontalContainer = element?.offsetParent;
        if (!horizontalContainer || !(horizontalContainer instanceof HTMLElement)) {
            // this seems to happen sometimes for reasons I don't understand
            // the docs for `offsetParent` say it may be null if `display` is
            // `none`, but I can't see why that would happen.
            logger.warn(`ReadReceiptMarker for ${this.props.fallbackUserId} has no valid horizontalContainer`);

            target.top = 0;
            target.right = 0;
            target.parent = undefined;
            return target;
        }
        // this is the mx_ReadReceiptsGroup
        const verticalContainer = horizontalContainer.offsetParent;
        if (!verticalContainer || !(verticalContainer instanceof HTMLElement)) {
            // this seems to happen sometimes for reasons I don't understand
            // the docs for `offsetParent` say it may be null if `display` is
            // `none`, but I can't see why that would happen.
            logger.warn(`ReadReceiptMarker for ${this.props.fallbackUserId} has no valid verticalContainer`);

            target.top = 0;
            target.right = 0;
            target.parent = undefined;
            return target;
        }

        target.top = element.offsetTop;
        target.right = element.getBoundingClientRect().right - horizontalContainer.getBoundingClientRect().right;
        target.parent = verticalContainer;
        return target;
    }

    private readReceiptPosition(info: IReadReceiptInfo): number {
        if (!info.parent) {
            // this seems to happen sometimes for reasons I don't understand
            // the docs for `offsetParent` say it may be null if `display` is
            // `none`, but I can't see why that would happen.
            logger.warn(`ReadReceiptMarker for ${this.props.fallbackUserId} has no offsetParent`);
            return 0;
        }

        return (info.top ?? 0) + info.parent.getBoundingClientRect().top;
    }

    private animateMarker(): void {
        const oldInfo = this.props.readReceiptInfo;
        const newInfo = this.buildReadReceiptInfo();

        const newPosition = this.readReceiptPosition(newInfo);
        const oldPosition = oldInfo
            ? // start at the old height and in the old h pos
              this.readReceiptPosition(oldInfo)
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
            return <div ref={this.avatar as RefObject<HTMLDivElement>} />;
        }

        const style = {
            right: toPx(this.props.offset),
            top: "0px",
        };

        return (
            <NodeAnimator startStyles={this.state.startStyles}>
                <MemberAvatar
                    member={this.props.member ?? null}
                    fallbackUserId={this.props.fallbackUserId}
                    aria-hidden="true"
                    aria-live="off"
                    width={14}
                    height={14}
                    resizeMethod="crop"
                    style={style}
                    inputRef={this.avatar as RefObject<HTMLImageElement>}
                    hideTitle
                    tabIndex={-1}
                />
            </NodeAnimator>
        );
    }
}
