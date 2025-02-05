/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ChangeEvent, type ReactNode, useContext, useMemo, useRef, useState } from "react";
import { type IContent, type MatrixEvent, type TimelineEvents } from "matrix-js-sdk/src/matrix";

import { _t, _td, type TranslationKey } from "../../../../languageHandler";
import Field from "../../elements/Field";
import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import withValidation from "../../elements/Validation";
import SyntaxHighlight from "../../elements/SyntaxHighlight";

export const stringify = (object: object): string => {
    return JSON.stringify(object, null, 2);
};

interface IEventEditorProps extends Pick<IDevtoolsProps, "onBack"> {
    fieldDefs: IFieldDef[]; // immutable
    defaultContent?: string;
    onSend(fields: string[], content: IContent): Promise<unknown>;
}

interface IFieldDef {
    id: string;
    label: TranslationKey;
    default?: string;
}

export const eventTypeField = (defaultValue?: string): IFieldDef => ({
    id: "eventType",
    label: _td("devtools|event_type"),
    default: defaultValue,
});

export const stateKeyField = (defaultValue?: string): IFieldDef => ({
    id: "stateKey",
    label: _td("devtools|state_key"),
    default: defaultValue,
});

const validateEventContent = withValidation<any, Error | undefined>({
    async deriveData({ value }) {
        try {
            JSON.parse(value!);
        } catch (e) {
            return e as Error;
        }
        return undefined;
    },
    rules: [
        {
            key: "validJson",
            test: ({ value }, error) => {
                if (!value) return true;
                return !error;
            },
            invalid: (error) => _t("devtools|invalid_json") + " " + error,
        },
    ],
});

export const EventEditor: React.FC<IEventEditorProps> = ({ fieldDefs, defaultContent = "{\n\n}", onSend, onBack }) => {
    const [fieldData, setFieldData] = useState<string[]>(fieldDefs.map((def) => def.default ?? ""));
    const [content, setContent] = useState<string>(defaultContent);
    const contentField = useRef<Field>(null);

    const fields = fieldDefs.map((def, i) => (
        <Field
            key={def.id}
            id={def.id}
            label={_t(def.label)}
            size={42}
            autoFocus={defaultContent === undefined && i === 0}
            type="text"
            autoComplete="on"
            value={fieldData[i]}
            onChange={(ev: ChangeEvent<HTMLInputElement>) =>
                setFieldData((data) => {
                    data[i] = ev.target.value;
                    return [...data];
                })
            }
        />
    ));

    const onAction = async (): Promise<string | undefined> => {
        const valid = contentField.current ? await contentField.current.validate({}) : false;

        if (!valid) {
            contentField.current?.focus();
            contentField.current?.validate({ focused: true });
            return;
        }

        try {
            const json = JSON.parse(content);
            await onSend(fieldData, json);
        } catch (e) {
            return _t("devtools|failed_to_send") + (e instanceof Error ? ` (${e.message})` : "");
        }
        return _t("devtools|event_sent");
    };

    return (
        <BaseTool actionLabel={_td("forward|send_label")} onAction={onAction} onBack={onBack}>
            <div className="mx_DevTools_eventTypeStateKeyGroup">{fields}</div>

            <Field
                id="evContent"
                label={_t("devtools|event_content")}
                type="text"
                className="mx_DevTools_textarea"
                autoComplete="off"
                value={content}
                onChange={(ev) => setContent(ev.target.value)}
                element="textarea"
                onValidate={validateEventContent}
                ref={contentField}
                autoFocus={!!defaultContent}
            />
        </BaseTool>
    );
};

export interface IEditorProps extends Pick<IDevtoolsProps, "onBack"> {
    mxEvent?: MatrixEvent;
}

interface IViewerProps extends Required<IEditorProps> {
    Editor: React.FC<IEditorProps>;
    extraButton?: ReactNode;
}

export const EventViewer: React.FC<IViewerProps> = ({ mxEvent, onBack, Editor, extraButton }) => {
    const [editing, setEditing] = useState(false);

    if (editing) {
        const onBack = (): void => {
            setEditing(false);
        };
        return <Editor mxEvent={mxEvent} onBack={onBack} />;
    }

    const onAction = async (): Promise<void> => {
        setEditing(true);
    };

    return (
        <BaseTool onBack={onBack} actionLabel={_td("action|edit")} onAction={onAction} extraButton={extraButton}>
            <SyntaxHighlight language="json">{stringify(mxEvent.event)}</SyntaxHighlight>
        </BaseTool>
    );
};

// returns the id of the initial message, not the id of the previous edit
const getBaseEventId = (baseEvent: MatrixEvent): string => {
    // show the replacing event, not the original, if it is an edit
    const mxEvent = baseEvent.replacingEvent() ?? baseEvent;
    return mxEvent.getWireContent()["m.relates_to"]?.event_id ?? baseEvent.getId()!;
};

export const TimelineEventEditor: React.FC<IEditorProps> = ({ mxEvent, onBack }) => {
    const context = useContext(DevtoolsContext);
    const cli = useContext(MatrixClientContext);

    const fields = useMemo(() => [eventTypeField(mxEvent?.getType())], [mxEvent]);

    const onSend = ([eventType]: string[], content: TimelineEvents[keyof TimelineEvents]): Promise<unknown> => {
        return cli.sendEvent(context.room.roomId, eventType as keyof TimelineEvents, content);
    };

    let defaultContent: string | undefined;

    if (mxEvent) {
        const originalContent = mxEvent.getContent();
        // prefill an edit-message event, keep only the `body` and `msgtype` fields of originalContent
        const bodyToStartFrom = originalContent["m.new_content"]?.body ?? originalContent.body; // prefill the last edit body, to start editing from there
        const newContent = {
            "body": ` * ${bodyToStartFrom}`,
            "msgtype": originalContent.msgtype,
            "m.new_content": {
                body: bodyToStartFrom,
                msgtype: originalContent.msgtype,
            },
            "m.relates_to": {
                rel_type: "m.replace",
                event_id: getBaseEventId(mxEvent),
            },
        };

        defaultContent = stringify(newContent);
    } else if (context.threadRootId) {
        defaultContent = stringify({
            "m.relates_to": {
                rel_type: "m.thread",
                event_id: context.threadRootId,
            },
        });
    }

    return <EventEditor fieldDefs={fields} defaultContent={defaultContent} onSend={onSend} onBack={onBack} />;
};
