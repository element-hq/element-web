import React, { JSX } from "react";
import styles from "./MediaPreviewComponents.module.css";
import classNames from "classnames";
import { MediaPreviewEntryButton } from "../MediaPreviewGroupView";

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
    largeImage,
    largeImageOnClick,
}: {
    largeImage: string;
    largeImageOnClick?: () => void;
}): JSX.Element {
    if (largeImageOnClick) {
        return (
            <div className={styles.largeImage}>
                <button onClick={largeImageOnClick}>
                    <img src={largeImage} />
                </button>
            </div>
        );
    } else {
        return (
            <div className={styles.largeImage}>
                <img src={largeImage} />
            </div>
        );
    }
}
