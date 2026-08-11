import React, { JSX, useEffect, useState } from "react";
import styles from "./MediaPreviewComponents.module.css";
import classNames from "classnames";
import { ImageSize, MediaPreviewEntryButton } from "../MediaPreviewGroupView";

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

export function Footer({ footer }: { footer: string }): JSX.Element {
    return <div className={styles.footer}>{footer}</div>;
}

export function TextContent(props: { header: string; headerUrl?: string; body: string; footer?: string }): JSX.Element {
    return (
        <div className={styles.textContent}>
            <Header {...props} />
            <Body {...props} />
            {props.footer !== undefined && <Footer footer={props.footer} />}
        </div>
    );
}

export function Icon({ icon, iconOnClick, color }: { icon: JSX.Element; iconOnClick?: () => void; color: string }) {
    icon = React.cloneElement(icon, { style: { color } });

    if (iconOnClick) {
        return (
            <div className={classNames(styles.icon, styles.iconClickable)}>
                <button onClick={iconOnClick}>{icon}</button>
            </div>
        );
    } else {
        return <div className={styles.icon}>{icon}</div>;
    }
}

export function Buttons({ buttons }: { buttons: Array<MediaPreviewEntryButton> }): JSX.Element {
    return (
        <div className={styles.buttonGroup}>
            {buttons.map(({ icon, onClick }) => (
                <button className={styles.button} onClick={onClick}>
                    {icon}
                </button>
            ))}
        </div>
    );
}

export function LeftGroup({ children }: { children: React.ReactNode }): JSX.Element {
    return <div className={styles.leftGroup}>{children}</div>;
}

interface ValidityState { valid: boolean, src: string };

function useIsValid(check: (src: string) => Promise<boolean>, src: string): ValidityState {
    let [state, setState]: [ValidityState, React.Dispatch<React.SetStateAction<ValidityState>>] = useState({ valid: false, src } as ValidityState);

    useEffect(() => {
        let cancelled = false;
        check(src).then((value) => {
            if (!cancelled)
                setState({ valid: value, src });
        });

        return () => { cancelled = true; }
    }, [src]);

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
    let classes = [styles.image];

    let { valid, src } = useIsValid((src) => new Promise(res => {
        const img = new window.Image();
        img.onload = () => res(img.naturalWidth > 0 && img.naturalHeight > 0);
        img.onerror = (e) => {
            console.error(`Failed to display image ${src}`, e);
            res(false)
        };
        img.src = src;
    }), image);

    if (!valid || src !== image) return null;

    switch (imageSize) {
        case "full":
            classes.push(styles.fullImage);
            break;
        case "banner":
            classes.push(styles.bannerImage);
            break;
    }

    if (imageOnClick) {
        return (
            <div className={classNames(classes)}>
                <button onClick={imageOnClick}>
                    <img src={image} />
                </button>
            </div>
        );
    } else {
        return (
            <div className={classNames(classes)}>
                <img src={image} />
            </div>
        );
    }
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
    let classes = [styles.video];

    let { valid, src } = useIsValid((src) => new Promise(res => {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => res(vid.videoWidth > 0 && vid.videoHeight > 0);
        vid.onerror = (e) => {
            console.error(`Failed to display video ${src}`, e);
            res(false)
        };
        vid.src = src;
    }), video);

    if (!valid || src !== video) return null;

    switch (videoSize) {
        case "full":
            classes.push(styles.fullVideo);
            break;
        case "banner":
            classes.push(styles.bannerVideo);
            break;
    }

    if (videoOnClick) {
        return (
            <div className={classNames(classes)}>
                <button onClick={videoOnClick}>
                    <video src={video} controls />
                </button>
            </div>
        );
    } else {
        return (
            <div className={classNames(classes)}>
                <video src={video} controls />
            </div>
        );
    }
}

export function Audio({ audio, audioOnClick }: { audio: string; audioOnClick?: () => void }): JSX.Element | null {
    let { valid, src } = useIsValid((src) => new Promise(res => {
        const aud = document.createElement("audio");
        aud.preload = "metadata";
        aud.onloadedmetadata = () => res(true);
        aud.onerror = (e) => {
            console.error(`Failed to display audio ${src}`, e);
            res(false)
        };
        aud.src = src;
    }), audio);

    if (!valid || src !== audio) return null;

    if (audioOnClick) {
        return (
            <div className={styles.audio}>
                <button onClick={audioOnClick}>
                    <audio src={audio} controls />
                </button>
            </div>
        );
    } else {
        return (
            <div className={styles.audio}>
                <audio src={audio} controls />
            </div>
        );
    }
}
