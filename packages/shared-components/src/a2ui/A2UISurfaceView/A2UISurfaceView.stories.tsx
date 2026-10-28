/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React, { type JSX, useMemo } from "react";
import { fn } from "storybook/test";

import type { Meta, StoryObj } from "@storybook/react-vite";
import { BaseViewModel } from "../../core/viewmodel";
import { withViewDocs } from "../../../.storybook/withViewDocs";
import { A2UISurfaceSet } from "../A2UISurface";
import { type A2UIJsonValue, type A2UIServerMessage } from "../A2UITypes";
import {
    A2UISurfaceView,
    type A2UISurfaceViewActions,
    type A2UISurfaceViewModel,
    type A2UISurfaceViewSnapshot,
} from "./A2UISurfaceView";

interface StoryProps {
    /** The A2UI server messages that build the surfaces. */
    messages: A2UIServerMessage[];
    /** Called with the resolved action when a button is pressed. */
    onAction: (name: string, sourceComponentId: string, context: Record<string, A2UIJsonValue>) => void;
    sending: boolean;
    error?: string;
    /** Initial media visibility; the story reveals media when the placeholder is pressed. */
    mediaVisible: boolean;
    onOpenImage: (url: string, description?: string) => void;
}

/** A self-contained view model so stories stay interactive without a Matrix backend. */
class StoryViewModel
    extends BaseViewModel<A2UISurfaceViewSnapshot, StoryProps>
    implements A2UISurfaceViewActions, A2UISurfaceViewModel
{
    private readonly surfaces = new A2UISurfaceSet();

    public constructor(props: StoryProps) {
        super(props, { surfaces: [], sending: props.sending, error: props.error, mediaVisible: props.mediaVisible });
        for (const message of props.messages) this.surfaces.apply(message);
        this.refresh();
    }

    private refresh(): void {
        this.snapshot.merge({ surfaces: this.surfaces.all().map((surface) => surface.resolve()) });
    }

    public setInputValue = (surfaceId: string, key: string, path: string | undefined, value: A2UIJsonValue): void => {
        this.surfaces.get(surfaceId)?.setInputValue(key, path, value);
        this.refresh();
    };

    public triggerAction = (surfaceId: string, key: string): void => {
        const action = this.surfaces.get(surfaceId)?.resolveAction(key);
        if (action) this.props.onAction(action.name, action.sourceComponentId, action.context);
    };

    public showMedia = (): void => {
        this.snapshot.merge({ mediaVisible: true });
    };

    public openImage = (url: string, description?: string): void => {
        this.props.onOpenImage(url, description);
    };
}

const A2UISurfaceViewWrapperImpl = ({
    messages,
    onAction,
    sending,
    error,
    mediaVisible,
    onOpenImage,
}: StoryProps): JSX.Element => {
    const vm = useMemo(
        () => new StoryViewModel({ messages, onAction, sending, error, mediaVisible, onOpenImage }),
        [messages, onAction, sending, error, mediaVisible, onOpenImage],
    );
    return <A2UISurfaceView vm={vm} />;
};

const A2UISurfaceViewWrapper = withViewDocs(A2UISurfaceViewWrapperImpl, A2UISurfaceView);

const contactForm: A2UIServerMessage[] = [
    { version: "v0.9", createSurface: { surfaceId: "main" } },
    {
        version: "v0.9",
        updateComponents: {
            surfaceId: "main",
            components: [
                { id: "root", component: "Card", child: "form" },
                {
                    id: "form",
                    component: "Column",
                    children: ["title", "intro", "name", "email", "plan", "subscribe", "actions"],
                },
                { id: "title", component: "Text", text: "Contact us", variant: "h2" },
                { id: "intro", component: "Text", text: { path: "/intro" }, variant: "caption" },
                { id: "name", component: "TextField", label: "Name", value: { path: "/contact/name" } },
                { id: "email", component: "TextField", label: "Email", value: { path: "/contact/email" } },
                {
                    id: "plan",
                    component: "ChoicePicker",
                    label: "Plan",
                    options: [
                        { label: "Free", value: "free" },
                        { label: "Pro", value: "pro" },
                    ],
                    value: { path: "/contact/plan" },
                },
                {
                    id: "subscribe",
                    component: "CheckBox",
                    label: "Subscribe to the newsletter",
                    value: { path: "/contact/subscribe" },
                },
                { id: "actions", component: "Row", justify: "end", children: ["cancel", "submit"] },
                {
                    id: "cancel",
                    component: "Button",
                    child: "cancelLabel",
                    variant: "borderless",
                    action: { event: { name: "cancel" } },
                },
                { id: "cancelLabel", component: "Text", text: "Cancel" },
                {
                    id: "submit",
                    component: "Button",
                    child: "submitLabel",
                    variant: "primary",
                    action: {
                        event: {
                            name: "submitContactForm",
                            context: { formId: "contact_form_1", contact: { path: "/contact" } },
                        },
                    },
                },
                { id: "submitLabel", component: "Text", text: "Send" },
            ],
        },
    },
    {
        version: "v0.9",
        updateDataModel: {
            surfaceId: "main",
            path: "/",
            value: {
                intro: "Tell us how to reach you.",
                contact: { name: "Alice", email: "", plan: ["free"], subscribe: true },
            },
        },
    },
];

const meta = {
    title: "A2UI/A2UISurfaceView",
    component: A2UISurfaceViewWrapper,
    tags: ["autodocs"],
    args: {
        messages: contactForm,
        // Typed as the plain callback so tests can pass their own handlers.
        onAction: fn() as StoryProps["onAction"],
        sending: false,
        error: undefined,
        mediaVisible: true,
        onOpenImage: fn() as StoryProps["onOpenImage"],
    },
} satisfies Meta<typeof A2UISurfaceViewWrapper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ContactForm: Story = {};

export const Sending: Story = {
    args: { sending: true },
};

export const SendFailed: Story = {
    args: { error: "Your response could not be sent. Please try again." },
};

export const TemplateList: Story = {
    args: {
        messages: [
            {
                version: "v0.9",
                updateComponents: {
                    surfaceId: "main",
                    components: [
                        { id: "root", component: "Column", children: ["heading", "list", "divider", "rating", "when"] },
                        { id: "heading", component: "Text", text: "Pick a restaurant", variant: "h3" },
                        { id: "list", component: "List", children: { componentId: "item", path: "/restaurants" } },
                        {
                            id: "item",
                            component: "Row",
                            justify: "spaceBetween",
                            align: "center",
                            children: ["itemIcon", "itemText", "itemPick"],
                        },
                        { id: "itemIcon", component: "Icon", name: { path: "/icon" } },
                        { id: "itemText", component: "Text", text: { path: "/name" }, weight: 1 },
                        {
                            id: "itemPick",
                            component: "Button",
                            child: "pickLabel",
                            action: { event: { name: "pick", context: { id: { path: "/id" } } } },
                        },
                        { id: "pickLabel", component: "Text", text: "Choose" },
                        { id: "divider", component: "Divider" },
                        {
                            id: "rating",
                            component: "Slider",
                            label: "Minimum rating",
                            min: 1,
                            max: 5,
                            value: { path: "/minRating" },
                        },
                        {
                            id: "when",
                            component: "DateTimeInput",
                            label: "When",
                            enableDate: true,
                            enableTime: true,
                            value: { path: "/when" },
                        },
                    ],
                },
            },
            {
                version: "v0.9",
                updateDataModel: {
                    surfaceId: "main",
                    value: {
                        restaurants: [
                            { id: "r1", name: "The Green Fork", icon: "favorite" },
                            { id: "r2", name: "Nonna's Kitchen", icon: "home" },
                            { id: "r3", name: "Sakura", icon: "star" },
                        ],
                        minRating: 3,
                        when: "2026-10-24T19:30",
                    },
                },
            },
        ],
    },
};

export const Tabs: Story = {
    args: {
        messages: [
            {
                version: "v0.9",
                updateComponents: {
                    surfaceId: "main",
                    components: [
                        {
                            id: "root",
                            component: "Tabs",
                            tabs: [
                                { title: "Overview", child: "overview" },
                                { title: "Details", child: "details" },
                            ],
                        },
                        { id: "overview", component: "Text", text: "An overview." },
                        { id: "details", component: "Column", children: ["detailText", "gauge"] },
                        {
                            id: "detailText",
                            component: "Text",
                            text: "Some details, and a component this client does not support:",
                        },
                        { id: "gauge", component: "Gauge", value: 42 },
                    ],
                },
            },
        ],
    },
};

export const Media: Story = {
    args: {
        messages: [
            {
                version: "v0.9",
                updateComponents: {
                    surfaceId: "main",
                    components: [
                        { id: "root", component: "Column", children: ["caption", "picture", "clip", "blocked"] },
                        {
                            id: "caption",
                            component: "Text",
                            text: "An image, a video, and a video whose URL the client refused.",
                            variant: "caption",
                        },
                        {
                            id: "picture",
                            component: "Image",
                            url: "https://example.org/picture.png",
                            description: "A picture",
                            variant: "smallFeature",
                        },
                        { id: "clip", component: "Video", url: "https://example.org/clip.mp4" },
                        { id: "blocked", component: "Video", url: "ftp://example.org/clip.mp4" },
                    ],
                },
            },
        ],
    },
};

export const HiddenMedia: Story = {
    args: { ...Media.args, mediaVisible: false },
};

export const NoRootYet: Story = {
    args: {
        messages: [{ version: "v0.9", createSurface: { surfaceId: "main" } }],
    },
};

export const NoSurfaces: Story = {
    args: { messages: [] },
};
