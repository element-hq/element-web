/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import classNames from "classnames";
import React, { type JSX, type Ref, useId, useState } from "react";
import { Button, CheckboxInput, Heading, RadioInput, Separator, Text, TextInput } from "@vector-im/compound-web";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    AttachmentIcon,
    CalendarIcon,
    CheckIcon,
    CloseIcon,
    DeleteIcon,
    DownloadIcon,
    EditIcon,
    EmailIcon,
    ErrorIcon,
    FavouriteIcon,
    FavouriteSolidIcon,
    FolderIcon,
    ForwardIcon,
    HelpIcon,
    HomeIcon,
    ImageIcon,
    InfoIcon,
    LocationPinIcon,
    LockIcon,
    LockOffIcon,
    MenuIcon,
    NotificationsIcon,
    NotificationsOffIcon,
    OverflowHorizontalIcon,
    OverflowVerticalIcon,
    PauseIcon,
    PlayIcon,
    PlusIcon,
    RestartIcon,
    SearchIcon,
    SendIcon,
    SettingsIcon,
    ShareIcon,
    StopIcon,
    TakePhotoIcon,
    UnknownIcon,
    UserIcon,
    UserProfileIcon,
    VisibilityOffIcon,
    VisibilityOnIcon,
    VoiceCallIcon,
    VolumeOffIcon,
    VolumeOnIcon,
    WarningIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { type ViewModel, useViewModel } from "../../core/viewmodel";
import { useI18n } from "../../core/i18n/i18nContext";
import { Flex } from "../../core/utils/Flex";
import { HiddenMediaPlaceholder } from "../../room/timeline/event-tile/body/HiddenMediaPlaceholder";
import { Box } from "../../core/utils/Box";
import {
    type A2UIButtonRenderNode,
    type A2UIContainerRenderNode,
    type A2UIIconRenderNode,
    type A2UIRenderNode,
    type A2UIRenderSurface,
    type A2UISliderRenderNode,
    type A2UITabsRenderNode,
    type A2UITextRenderNode,
} from "../A2UIRenderNode";
import { type A2UIJsonValue } from "../A2UITypes";
import styles from "./A2UISurfaceView.module.css";

export interface A2UISurfaceViewSnapshot {
    /** The resolved surfaces to render, in creation order. */
    surfaces: A2UIRenderSurface[];
    /** True while a user action is being reported to the agent. Inputs stay editable, buttons are disabled. */
    sending: boolean;
    /** Localised description of why the last action could not be sent, if it failed. */
    error?: string;
    /** Whether images and videos may be shown, following the same media preview rules as timeline media. */
    mediaVisible: boolean;
}

export interface A2UISurfaceViewActions {
    /**
     * Record a user edit to an input node.
     * @param surfaceId - The surface the input belongs to.
     * @param key - The render node key of the input.
     * @param path - The absolute data model path the input is bound to, or undefined for an unbound input.
     * @param value - The new value.
     */
    setInputValue: (surfaceId: string, key: string, path: string | undefined, value: A2UIJsonValue) => void;
    /**
     * Run the action attached to a node, typically a button.
     * @param surfaceId - The surface the node belongs to.
     * @param key - The render node key.
     */
    triggerAction: (surfaceId: string, key: string) => void;
    /** Reveal hidden images and videos for this message. */
    showMedia: () => void;
    /**
     * Open an image at full size.
     * @param url - The image URL as rendered.
     * @param description - The image's description, used as its title.
     */
    openImage: (url: string, description?: string) => void;
}

export type A2UISurfaceViewModel = ViewModel<A2UISurfaceViewSnapshot, A2UISurfaceViewActions>;

interface A2UISurfaceViewProps {
    /** View model providing the resolved surfaces and the input and action callbacks. */
    vm: A2UISurfaceViewModel;
    /** Optional CSS class names applied to the root element. */
    className?: string;
    /** Optional ref forwarded to the root element. */
    ref?: Ref<HTMLDivElement>;
}

/**
 * Renders A2UI surfaces as native controls.
 *
 * The view walks the resolved {@link A2UIRenderNode} tree of each surface and maps every component of the basic
 * catalog onto Compound controls. Edits and button presses are passed straight to the view model.
 */
export function A2UISurfaceView({ vm, className, ref }: Readonly<A2UISurfaceViewProps>): JSX.Element {
    const { surfaces, sending, error, mediaVisible } = useViewModel(vm);
    const _t = useI18n().translate;

    return (
        <div className={classNames(styles.surfaces, className)} ref={ref}>
            {surfaces.length === 0 && (
                <Text size="sm" className={styles.notice}>
                    {_t("a2ui|no_content")}
                </Text>
            )}
            {surfaces.map((surface) => (
                <div key={surface.surfaceId} className={styles.surface} data-surface-id={surface.surfaceId}>
                    {surface.root ? (
                        <A2UINodeView
                            node={surface.root}
                            surfaceId={surface.surfaceId}
                            vm={vm}
                            sending={sending}
                            mediaVisible={mediaVisible}
                        />
                    ) : (
                        <Text size="sm" className={styles.notice}>
                            {_t("a2ui|waiting_for_content")}
                        </Text>
                    )}
                </div>
            ))}
            {error && (
                <Text size="sm" className={styles.error} role="alert">
                    {error}
                </Text>
            )}
        </div>
    );
}

interface NodeProps {
    node: A2UIRenderNode;
    surfaceId: string;
    vm: A2UISurfaceViewModel;
    sending: boolean;
    mediaVisible: boolean;
    /** True when rendered inside a button, where block elements are not allowed. */
    inline?: boolean;
}

function A2UINodeView(props: NodeProps): JSX.Element | null {
    const { node, surfaceId, vm } = props;
    const _t = useI18n().translate;
    const setValue = (value: A2UIJsonValue, path?: string): void => vm.setInputValue(surfaceId, node.key, path, value);

    switch (node.component) {
        case "Text":
            return <A2UITextView node={node} inline={props.inline} />;
        case "Image": {
            if (!node.url) {
                return (
                    <span className={styles.imagePlaceholder} role="img" aria-label={node.description}>
                        {node.description}
                    </span>
                );
            }
            if (!props.mediaVisible) {
                return (
                    <HiddenMediaPlaceholder className={styles.hiddenMedia} onClick={() => vm.showMedia()}>
                        {_t("a2ui|show_image")}
                    </HiddenMediaPlaceholder>
                );
            }
            const image = (
                <img
                    className={styles.image}
                    src={node.url}
                    alt={node.description ?? ""}
                    data-fit={node.fit}
                    data-variant={node.variant}
                />
            );
            // Decorative sizes are not worth enlarging.
            if (node.variant === "icon" || node.variant === "avatar") return image;
            return (
                <button
                    type="button"
                    className={styles.imageButton}
                    onClick={() => vm.openImage(node.url!, node.description)}
                >
                    {image}
                </button>
            );
        }
        case "Video":
            if (!node.url) {
                return <span className={styles.imagePlaceholder}>{_t("a2ui|media_unavailable")}</span>;
            }
            if (!props.mediaVisible) {
                return (
                    <HiddenMediaPlaceholder className={styles.hiddenMedia} onClick={() => vm.showMedia()}>
                        {_t("a2ui|show_video")}
                    </HiddenMediaPlaceholder>
                );
            }
            return <video className={styles.video} src={node.url} controls preload="metadata" />;
        case "Icon":
            return <A2UIIconView node={node} />;
        case "Row":
        case "Column":
        case "List":
            return <A2UIContainerView {...props} node={node} />;
        case "Card":
            return <div className={styles.card}>{node.child && <A2UINodeView {...props} node={node.child} />}</div>;
        case "Tabs":
            return <A2UITabsView {...props} node={node} />;
        case "Divider":
            return <Separator orientation={node.axis} className={styles.divider} />;
        case "Button":
            return <A2UIButtonView {...props} node={node} />;
        case "TextField": {
            const inputType = { shortText: "text", longText: "text", number: "number", obscured: "password" }[
                node.variant
            ];
            return (
                <label className={styles.field}>
                    <span className={styles.label}>{node.label}</span>
                    {node.variant === "longText" ? (
                        <textarea
                            className={styles.textarea}
                            value={node.value}
                            onChange={(e) => setValue(e.target.value, node.path)}
                        />
                    ) : (
                        <TextInput
                            type={inputType}
                            value={node.value}
                            onChange={(e) => setValue(e.target.value, node.path)}
                        />
                    )}
                </label>
            );
        }
        case "CheckBox":
            return (
                <label className={styles.inlineField}>
                    <CheckboxInput checked={node.value} onChange={(e) => setValue(e.target.checked, node.path)} />
                    <span>{node.label}</span>
                </label>
            );
        case "ChoicePicker": {
            const exclusive = node.variant === "mutuallyExclusive";
            const toggle = (value: string, checked: boolean): void => {
                if (exclusive) {
                    setValue([value], node.path);
                } else {
                    const next = node.value.filter((v) => v !== value);
                    if (checked) next.push(value);
                    setValue(next, node.path);
                }
            };
            return (
                <fieldset className={styles.field}>
                    {node.label && <legend className={styles.label}>{node.label}</legend>}
                    {node.options.map((option) => {
                        const checked = node.value.includes(option.value);
                        const Input = exclusive ? RadioInput : CheckboxInput;
                        return (
                            <label key={option.value} className={styles.inlineField}>
                                <Input
                                    name={node.key}
                                    value={option.value}
                                    checked={checked}
                                    onChange={(e) => toggle(option.value, e.target.checked)}
                                />
                                <span>{option.label}</span>
                            </label>
                        );
                    })}
                </fieldset>
            );
        }
        case "Slider":
            return <A2UISliderView node={node} onChange={(value) => setValue(value, node.path)} />;
        case "DateTimeInput": {
            const type = node.enableDate && node.enableTime ? "datetime-local" : node.enableTime ? "time" : "date";
            return (
                <label className={styles.field}>
                    {node.label && <span className={styles.label}>{node.label}</span>}
                    <TextInput type={type} value={node.value} onChange={(e) => setValue(e.target.value, node.path)} />
                </label>
            );
        }
        case "Unsupported":
            return (
                <Text size="sm" className={styles.notice} as={props.inline ? "span" : "p"}>
                    {_t("a2ui|unsupported_component", { type: node.type })}
                </Text>
            );
        default:
            return null;
    }
}

type IconComponent = React.ComponentType<React.SVGAttributes<SVGElement>>;

/** Catalog icon names mapped onto the closest Compound icon. Names without a match render a generic icon. */
const CATALOG_ICONS: Record<string, IconComponent> = {
    accountCircle: UserProfileIcon,
    add: PlusIcon,
    arrowBack: ArrowLeftIcon,
    arrowForward: ArrowRightIcon,
    attachFile: AttachmentIcon,
    calendarToday: CalendarIcon,
    call: VoiceCallIcon,
    camera: TakePhotoIcon,
    check: CheckIcon,
    close: CloseIcon,
    delete: DeleteIcon,
    download: DownloadIcon,
    edit: EditIcon,
    event: CalendarIcon,
    error: ErrorIcon,
    fastForward: ForwardIcon,
    favorite: FavouriteSolidIcon,
    favoriteOff: FavouriteIcon,
    folder: FolderIcon,
    help: HelpIcon,
    home: HomeIcon,
    info: InfoIcon,
    locationOn: LocationPinIcon,
    lock: LockIcon,
    lockOpen: LockOffIcon,
    mail: EmailIcon,
    menu: MenuIcon,
    moreVert: OverflowVerticalIcon,
    moreHoriz: OverflowHorizontalIcon,
    notificationsOff: NotificationsOffIcon,
    notifications: NotificationsIcon,
    pause: PauseIcon,
    person: UserIcon,
    phone: VoiceCallIcon,
    photo: ImageIcon,
    play: PlayIcon,
    refresh: RestartIcon,
    search: SearchIcon,
    send: SendIcon,
    settings: SettingsIcon,
    share: ShareIcon,
    star: FavouriteSolidIcon,
    starHalf: FavouriteIcon,
    starOff: FavouriteIcon,
    stop: StopIcon,
    upload: ArrowUpIcon,
    visibility: VisibilityOnIcon,
    visibilityOff: VisibilityOffIcon,
    volumeDown: VolumeOnIcon,
    volumeMute: VolumeOffIcon,
    volumeOff: VolumeOffIcon,
    volumeUp: VolumeOnIcon,
    warning: WarningIcon,
};

function A2UIIconView({ node }: { node: A2UIIconRenderNode }): JSX.Element {
    if (node.svgPath !== undefined) {
        return (
            <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true" data-icon="custom">
                <path d={node.svgPath} fill="currentColor" />
            </svg>
        );
    }
    const Icon = (node.name && CATALOG_ICONS[node.name]) || UnknownIcon;
    return <Icon className={styles.icon} aria-hidden="true" data-icon={node.name} />;
}

function A2UISliderView({
    node,
    onChange,
}: {
    node: A2UISliderRenderNode;
    onChange: (value: number) => void;
}): JSX.Element {
    // The value readout sits outside the label so it does not become part of the slider's accessible name.
    const id = useId();
    return (
        <div className={styles.field}>
            {node.label && (
                <label htmlFor={id} className={styles.label}>
                    {node.label}
                </label>
            )}
            <span className={styles.sliderRow}>
                <input
                    id={id}
                    type="range"
                    className={styles.slider}
                    min={node.min}
                    max={node.max}
                    value={node.value}
                    onChange={(e) => onChange(Number(e.target.value))}
                />
                <output htmlFor={id} className={styles.sliderValue}>
                    {node.value}
                </output>
            </span>
        </div>
    );
}

function A2UITextView({ node, inline }: { node: A2UITextRenderNode; inline?: boolean }): JSX.Element {
    if (inline) {
        return <span className={styles.text}>{node.text}</span>;
    }
    switch (node.variant) {
        case "h1":
            return (
                <Heading as="h2" size="lg" className={styles.text}>
                    {node.text}
                </Heading>
            );
        case "h2":
            return (
                <Heading as="h3" size="md" className={styles.text}>
                    {node.text}
                </Heading>
            );
        case "h3":
            return (
                <Heading as="h4" size="sm" className={styles.text}>
                    {node.text}
                </Heading>
            );
        case "h4":
        case "h5":
            return (
                <Text as="p" size="md" weight="semibold" className={styles.text}>
                    {node.text}
                </Text>
            );
        case "caption":
            return (
                <Text as="p" size="sm" className={classNames(styles.text, styles.caption)}>
                    {node.text}
                </Text>
            );
        default:
            return (
                <Text as="p" size="md" className={styles.text}>
                    {node.text}
                </Text>
            );
    }
}

// The Flex helper does not know every A2UI distribution, so the remaining ones fall back to the closest match.
const JUSTIFY: Record<A2UIContainerRenderNode["justify"], "start" | "center" | "end" | "space-between"> = {
    start: "start",
    center: "center",
    end: "end",
    spaceBetween: "space-between",
    spaceAround: "space-between",
    spaceEvenly: "space-between",
    stretch: "start",
};

function A2UIContainerView(props: NodeProps & { node: A2UIContainerRenderNode }): JSX.Element {
    const { node } = props;
    return (
        <Flex
            direction={node.direction}
            justify={JUSTIFY[node.justify]}
            align={node.align}
            gap="var(--cpd-space-2x)"
            className={classNames(styles.container, { [styles.list]: node.component === "List" })}
        >
            {node.children.map((child) =>
                child.weight === undefined ? (
                    <A2UINodeView key={child.key} {...props} node={child} />
                ) : (
                    <Box key={child.key} flex={String(child.weight)}>
                        <A2UINodeView {...props} node={child} />
                    </Box>
                ),
            )}
        </Flex>
    );
}

function A2UITabsView(props: NodeProps & { node: A2UITabsRenderNode }): JSX.Element {
    const { node } = props;
    const [selected, setSelected] = useState(0);
    const current = node.tabs[selected] ?? node.tabs[0];
    return (
        <div className={styles.tabs}>
            <div role="tablist" className={styles.tabList}>
                {node.tabs.map((tab, index) => (
                    <button
                        key={tab.child?.key ?? tab.title}
                        type="button"
                        role="tab"
                        aria-selected={index === selected}
                        className={styles.tab}
                        onClick={() => setSelected(index)}
                    >
                        {tab.title}
                    </button>
                ))}
            </div>
            <div role="tabpanel">{current?.child && <A2UINodeView {...props} node={current.child} />}</div>
        </div>
    );
}

const BUTTON_KIND: Record<A2UIButtonRenderNode["variant"], "primary" | "secondary" | "tertiary"> = {
    primary: "primary",
    default: "secondary",
    borderless: "tertiary",
};

function A2UIButtonView(props: NodeProps & { node: A2UIButtonRenderNode }): JSX.Element {
    const { node, surfaceId, vm, sending } = props;
    return (
        <Button
            kind={BUTTON_KIND[node.variant]}
            size="md"
            disabled={!node.enabled || sending}
            onClick={() => vm.triggerAction(surfaceId, node.key)}
        >
            {node.child && <A2UINodeView {...props} node={node.child} inline />}
        </Button>
    );
}
