/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useEffect, useState } from "react";
import styles from "./MediaPreviewComponents.module.css";
import classNames from "classnames";
import { type ImageSize, type MediaPreviewEntryButton } from "../MediaPreviewGroupView";
import { useI18n } from "../../../../../core/i18n/i18nContext";

export function Header({ header, headerUrl }: { header: string; headerUrl?: string }): JSX.Element {
    if (headerUrl === undefined) return <div className={classNames(styles.textHeader, styles.header)}>{header}</div>;
    else
        return (
            <div className={classNames(styles.linkHeader, styles.header)}>
                <a href={headerUrl} target="_blank">
                    {header}
                </a>
            </div>
        );
}

export function Body({ body }: { body: string }): JSX.Element {
    return <div className={styles.body}>{body}</div>;
}

export function TextContent(props: { header: string; headerUrl?: string; body: string }): JSX.Element {
    return (
        <div className={styles.textContent}>
            <Header {...props} />
            <Body {...props} />
        </div>
    );
}

export function Icon({
    icon,
    iconOnClick,
    color,
}: {
    icon: JSX.Element;
    iconOnClick?: () => void;
    color: string;
}): JSX.Element {
    const { translate: _t } = useI18n();

    icon = React.cloneElement(icon, { style: { color } });

    if (iconOnClick) {
        return (
            <div className={classNames(styles.icon, styles.iconClickable)}>
                <button onClick={iconOnClick} type="button" aria-label={_t("timeline|url_preview|view_file")}>
                    {icon}
                </button>
            </div>
        );
    } else {
        return <div className={styles.icon}>{icon}</div>;
    }
}

export function Buttons({ buttons }: { buttons: Array<MediaPreviewEntryButton> }): JSX.Element {
    return (
        <div className={styles.buttonGroup}>
            {buttons.map(({ icon, onClick, label }) => (
                <button key={label} aria-label={label} type="button" className={styles.button} onClick={onClick}>
                    {icon}
                </button>
            ))}
        </div>
    );
}

export function LeftGroup({ children }: { children: React.ReactNode }): JSX.Element {
    return <div className={styles.leftGroup}>{children}</div>;
}

interface ValidityState {
    valid: boolean;
    src: string;
}

/**
 * Media checks are defined at module scope so that their identity is stable: passing a fresh
 * closure on every render would re-run the effect in {@link useIsValid} after each state update,
 * leaving the component re-rendering in a loop.
 */
function checkImage(src: string): Promise<boolean> {
    return new Promise((res) => {
        const img = new window.Image();
        img.onload = () => res(img.naturalWidth > 0 && img.naturalHeight > 0);
        img.onerror = (e) => {
            console.error(`Failed to display image ${src}`, e);
            res(false);
        };
        img.src = src;
    });
}

function checkVideo(src: string): Promise<boolean> {
    return new Promise((res) => {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => res(vid.videoWidth > 0 && vid.videoHeight > 0);
        vid.onerror = (e) => {
            console.error(`Failed to display video ${src}`, e);
            res(false);
        };
        vid.src = src;
    });
}

function checkAudio(src: string): Promise<boolean> {
    return new Promise((res) => {
        const aud = document.createElement("audio");
        aud.preload = "metadata";
        aud.onloadedmetadata = () => res(true);
        aud.onerror = (e) => {
            console.error(`Failed to display audio ${src}`, e);
            res(false);
        };
        aud.src = src;
    });
}

function useIsValid(check: (src: string) => Promise<boolean>, src: string): ValidityState {
    const [state, setState]: [ValidityState, React.Dispatch<React.SetStateAction<ValidityState>>] = useState({
        valid: true,
        src,
    } as ValidityState);

    useEffect(() => {
        let cancelled = false;
        check(src).then((value) => {
            if (!cancelled) setState({ valid: value, src });
        });

        return () => {
            cancelled = true;
        };
    }, [src, check]);

    return state;
}

export function Image({
    image,
    imageOnClick,
    imageSize,
}: {
    image: string;
    imageOnClick?: () => void;
    imageSize: ImageSize;
}): JSX.Element | null {
    const { translate: _t } = useI18n();
    const classes = [styles.image, imageSize === "full" ? styles.fullImage : styles.bannerImage];

    const { valid, src } = useIsValid(checkImage, image);

    if (!valid || src !== image) return null;

    const imageElem = <img src={image} alt="" />;
    return (
        <div className={classNames(classes)}>
            {imageOnClick ? (
                <button onClick={imageOnClick} type="button" aria-label={_t("timeline|url_preview|view_image")}>
                    {imageElem}
                </button>
            ) : (
                imageElem
            )}
        </div>
    );
}

export function Video({
    video,
    videoOnClick,
    videoSize,
}: {
    video: string;
    videoOnClick?: () => void;
    videoSize: ImageSize;
}): JSX.Element | null {
    const { translate: _t } = useI18n();
    const classes = [styles.video, videoSize === "full" ? styles.fullVideo : styles.bannenrVideo];

    const { valid, src } = useIsValid(checkVideo, video);

    if (!valid || src !== video) return null;

    const videoElem = <video src={video} controls />;

    return (
        <div className={classNames(classes)}>
            {videoOnClick ? (
                <button onClick={videoOnClick} type="button" aria-label={_t("timeline|url_preview|view_video")}>
                    {videoElem}
                </button>
            ) : (
                videoElem
            )}
        </div>
    );
}

export function Audio({ audio, audioOnClick }: { audio: string; audioOnClick?: () => void }): JSX.Element | null {
    const { translate: _t } = useI18n();
    const { valid, src } = useIsValid(checkAudio, audio);

    if (!valid || src !== audio) return null;

    const audioElem = <audio src={audio} controls />;
    return (
        <div className={styles.audio}>
            {audioOnClick ? (
                <button onClick={audioOnClick} type="button" aria-label={_t("timeline|url_preview|view_audio")}>
                    {audioElem}
                </button>
            ) : (
                audioElem
            )}
        </div>
    );
}
