import React, { JSX } from "react";
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

export function LargeImage({
    image,
    imageOnClick,
    imageSize,
}: {
    image: string;
    imageOnClick?: () => void;
    imageSize: ImageSize;
}): JSX.Element {
    let classes = [styles.largeImage];
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

export function LargeVideo({
    video,
    videoOnClick,
    videoSize,
}: {
    video: string;
    videoOnClick?: () => void;
    videoSize: ImageSize;
}): JSX.Element {
    let classes = [styles.largeVideo];
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
