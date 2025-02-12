/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.
Copyright 2018 New Vector Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX, useMemo, useRef, useState } from "react";
import { Room, RoomMember, MatrixEvent, User } from "matrix-js-sdk/src/matrix";
import { Checkbox, Button } from "@vector-im/compound-web";
import LinkIcon from "@vector-im/compound-design-tokens/assets/web/icons/link";
import CheckIcon from "@vector-im/compound-design-tokens/assets/web/icons/check";

import { _t } from "../../../languageHandler";
import QRCode from "../elements/QRCode";
import { RoomPermalinkCreator, makeUserPermalink } from "../../../utils/permalinks/Permalinks";
import { copyPlaintext } from "../../../utils/strings";
import { UIFeature } from "../../../settings/UIFeature";
import BaseDialog from "./BaseDialog";
import { type XOR } from "../../../@types/common";
import { useSettingValue } from "../../../hooks/useSettings.ts";

/* eslint-disable @typescript-eslint/no-require-imports */
const SOCIALS = [
    {
        name: "Facebook",
        img: require("../../../../res/img/social/facebook.png"),
        url: (url: string) => `https://www.facebook.com/sharer/sharer.php?u=${url}`,
    },
    {
        name: "Twitter",
        img: require("../../../../res/img/social/twitter-2.png"),
        url: (url: string) => `https://twitter.com/home?status=${url}`,
    },
    {
        name: "LinkedIn",
        img: require("../../../../res/img/social/linkedin.png"),
        url: (url: string) => `https://www.linkedin.com/shareArticle?mini=true&url=${url}`,
    },
    {
        name: "Reddit",
        img: require("../../../../res/img/social/reddit.png"),
        url: (url: string) => `https://www.reddit.com/submit?url=${url}`,
    },
    {
        name: "email",
        img: require("../../../../res/img/social/email-1.png"),
        url: (url: string) => `mailto:?body=${url}`,
    },
];
/* eslint-enable @typescript-eslint/no-require-imports */

interface BaseProps {
    /**
     * A function that is called when the dialog is dismissed
     */
    onFinished(): void;
    /**
     * An optional string to use as the dialog title.
     * If not provided, an appropriate title for the target type will be used.
     */
    customTitle?: string;
    /**
     * An optional string to use as the dialog subtitle
     */
    subtitle?: string;
}

interface Props extends BaseProps {
    /**
     * The target to link to.
     * This can be a Room, User, RoomMember, or MatrixEvent or an already computed URL.
     * A <u>matrix.to</u> link will be generated out of it if it's not already a url.
     */
    target: Room | User | RoomMember | URL;
    /**
     * Optional when the target is a Room, User, RoomMember or a URL.
     * Mandatory when the target is a MatrixEvent.
     */
    permalinkCreator?: RoomPermalinkCreator;
}

interface EventProps extends BaseProps {
    /**
     * The target to link to.
     */
    target: MatrixEvent;
    /**
     * Optional when the target is a Room, User, RoomMember or a URL.
     * Mandatory when the target is a MatrixEvent.
     */
    permalinkCreator: RoomPermalinkCreator;
}

type ShareDialogProps = XOR<Props, EventProps>;

/**
 * A dialog to share a link to a room, user, room member or a matrix event.
 */
export function ShareDialog({ target, customTitle, onFinished, permalinkCreator }: ShareDialogProps): JSX.Element {
    const showQrCode = useSettingValue(UIFeature.ShareQRCode);
    const showSocials = useSettingValue(UIFeature.ShareSocial);

    const timeoutIdRef = useRef<number>();
    const [isCopied, setIsCopied] = useState(false);

    const [linkToSpecificEvent, setLinkToSpecificEvent] = useState(target instanceof MatrixEvent);
    const { title, url, checkboxLabel } = useTargetValues(target, linkToSpecificEvent, permalinkCreator);
    const newTitle = customTitle ?? title;

    return (
        <BaseDialog
            title={newTitle}
            className="mx_ShareDialog"
            contentId="mx_Dialog_content"
            onFinished={onFinished}
            fixedWidth={false}
        >
            <div className="mx_ShareDialog_content">
                <div className="mx_ShareDialog_top">
                    {showQrCode && <QRCode data={url} width={200} />}
                    <span>{url}</span>
                </div>
                {checkboxLabel && (
                    <label>
                        <Checkbox
                            defaultChecked={linkToSpecificEvent}
                            onChange={(evt) => setLinkToSpecificEvent(evt.target.checked)}
                        />
                        {checkboxLabel}
                    </label>
                )}
                <Button
                    Icon={isCopied ? CheckIcon : LinkIcon}
                    onClick={async () => {
                        clearTimeout(timeoutIdRef.current);
                        await copyPlaintext(url);
                        setIsCopied(true);
                        timeoutIdRef.current = setTimeout(() => setIsCopied(false), 2000);
                    }}
                >
                    {isCopied ? _t("share|link_copied") : _t("action|copy_link")}
                </Button>
                {showSocials && <SocialLinks url={url} />}
            </div>
        </BaseDialog>
    );
}

/**
 * Social links to share the link on different platforms.
 */
interface SocialLinksProps {
    /**
     * The URL to share.
     */
    url: string;
}

/**
 * The socials to share the link on.
 */
function SocialLinks({ url }: SocialLinksProps): JSX.Element {
    return (
        <div className="mx_ShareDialog_social">
            {SOCIALS.map((social) => (
                <a
                    key={social.name}
                    href={social.url(url)}
                    target="_blank"
                    rel="noreferrer noopener"
                    title={social.name}
                >
                    <img src={social.img} alt={social.name} />
                </a>
            ))}
        </div>
    );
}

/**
 * Get the title, url and checkbox label for the dialog based on the target.
 * @param target
 * @param linkToSpecificEvent
 * @param permalinkCreator
 */
function useTargetValues(
    target: ShareDialogProps["target"],
    linkToSpecificEvent: boolean,
    permalinkCreator?: RoomPermalinkCreator,
): { title: string; url: string; checkboxLabel?: string } {
    return useMemo(() => {
        if (target instanceof URL) return { title: _t("share|title_link"), url: target.toString() };
        if (target instanceof User || target instanceof RoomMember)
            return {
                title: _t("share|title_user"),
                url: makeUserPermalink(target.userId),
            };

        if (target instanceof Room) {
            const title = _t("share|title_room");
            const newPermalinkCreator = new RoomPermalinkCreator(target);
            newPermalinkCreator.load();

            const events = target.getLiveTimeline().getEvents();
            return {
                title,
                url: linkToSpecificEvent
                    ? newPermalinkCreator.forEvent(events[events.length - 1].getId()!)
                    : newPermalinkCreator.forShareableRoom(),
                ...(events.length > 0 && { checkboxLabel: _t("share|permalink_most_recent") }),
            };
        }

        // MatrixEvent is remaining and should have a permalinkCreator
        const url = linkToSpecificEvent
            ? permalinkCreator!.forEvent(target.getId()!)
            : permalinkCreator!.forShareableRoom();
        return {
            title: _t("share|title_message"),
            url,
            checkboxLabel: _t("share|permalink_message"),
        };
    }, [target, linkToSpecificEvent, permalinkCreator]);
}
