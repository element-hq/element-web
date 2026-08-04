/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import React from "react";
import { render, screen, waitFor } from "test-utils-rtl";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type IEvent, type MatrixClient, type MatrixEvent, type Room } from "matrix-js-sdk/src/matrix";

import { SDKContext } from "../../../contexts/SDKContext";
import { type SDKContextClass } from "../../../contexts/SDKContextClass";

// @vitest-environment happy-dom

/**
 * Stand-ins for the object URLs the card creates. happy-dom tries to navigate the iframe to
 * whatever ends up in `src`, and only the `about:` scheme is a no-op for it, so these use that
 * rather than the `blob:` URLs a browser would hand out.
 */
const OBJECT_URL = "about:blank?pdf";
const OTHER_OBJECT_URL = "about:blank?other-pdf";

const { MediaEventHelperMock } = vi.hoisted(() => {
    /** Stands in for the real helper, which would otherwise download and decrypt the file. */
    class MediaEventHelperMock {
        public static isEligible = vi.fn<(event: MatrixEvent) => boolean>();
        /** `sourceBlob` of the next constructed instance; a pending promise models a download in flight. */
        public static nextBlob: Promise<Blob> = Promise.resolve(new Blob(["%PDF-1.7"]));
        public static instances: MediaEventHelperMock[] = [];

        public readonly sourceBlob: { value: Promise<Blob> };
        public readonly destroy = vi.fn();

        public constructor(public readonly event: MatrixEvent) {
            this.sourceBlob = { value: MediaEventHelperMock.nextBlob };
            MediaEventHelperMock.instances.push(this);
        }
    }

    return { MediaEventHelperMock };
});

vi.mock("../../../utils/MediaEventHelper", () => ({
    MediaEventHelper: MediaEventHelperMock,
}));

// Imported after the mock is declared so the component picks up the mocked helper.
const { PdfViewerCard } = await import("./PdfViewerCard");

const ROOM_ID = "!room:example.org";
const EVENT_ID = "$event";

/** A file event as it would come back from `/rooms/{roomId}/event/{eventId}`. */
function mkPdfEventJson(eventId = EVENT_ID): Partial<IEvent> {
    return {
        event_id: eventId,
        room_id: ROOM_ID,
        type: "m.room.message",
        sender: "@alice:example.org",
        origin_server_ts: 0,
        content: {
            msgtype: "m.file",
            body: "document.pdf",
            url: "mxc://example.org/document",
            info: { mimetype: "application/pdf" },
        },
    };
}

describe("<PdfViewerCard />", () => {
    let client: MatrixClient;
    let room: Room;
    let onClose: () => void;

    function renderCard(eventId = EVENT_ID): ReturnType<typeof render> {
        onClose = vi.fn();
        return render(<PdfViewerCard eventId={eventId} room={room} onClose={onClose} />, {
            wrapper: ({ children }) => (
                <SDKContext.Provider
                    value={
                        {
                            rightPanelStore: {
                                roomPhaseHistory: [],
                                popCard: vi.fn(),
                            },
                        } as unknown as SDKContextClass
                    }
                >
                    {children}
                </SDKContext.Provider>
            ),
        });
    }

    beforeEach(() => {
        MediaEventHelperMock.isEligible.mockReturnValue(true);
        MediaEventHelperMock.nextBlob = Promise.resolve(new Blob(["%PDF-1.7"]));
        MediaEventHelperMock.instances = [];

        client = {
            fetchRoomEvent: vi.fn<MatrixClient["fetchRoomEvent"]>().mockResolvedValue(mkPdfEventJson()),
            decryptEventIfNeeded: vi.fn<MatrixClient["decryptEventIfNeeded"]>().mockResolvedValue(undefined),
        } as unknown as MatrixClient;
        room = { client, roomId: ROOM_ID } as unknown as Room;

        // Not implemented by happy-dom; the component branches on it.
        Object.defineProperty(navigator, "pdfViewerEnabled", {
            value: true,
            configurable: true,
        });
        vi.spyOn(URL, "createObjectURL").mockReturnValue(OBJECT_URL);
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    afterEach(() => {
        // @ts-expect-error the property only exists because we defined it above
        delete navigator.pdfViewerEnabled;
        vi.restoreAllMocks();
    });

    test("renders the PDF in a sandboxed iframe once it has been downloaded", async () => {
        renderCard();

        const iframe = await screen.findByTitle("PDF viewer");
        expect(iframe).toHaveAttribute("src", OBJECT_URL);
        // Untrusted content: the iframe must stay fully sandboxed.
        expect(iframe).toHaveAttribute("sandbox", "");
        expect(screen.getByRole("heading")).toHaveTextContent("PDF viewer");
    });

    test("fetches and decrypts the requested event", async () => {
        renderCard();

        await screen.findByTitle("PDF viewer");
        expect(client.fetchRoomEvent).toHaveBeenCalledWith(ROOM_ID, EVENT_ID);
        expect(client.decryptEventIfNeeded).toHaveBeenCalledWith(
            expect.objectContaining({
                event: expect.objectContaining({ event_id: EVENT_ID }),
            }),
            { emit: false },
        );
    });

    test("forces the application/pdf mime type on the downloaded blob", async () => {
        MediaEventHelperMock.nextBlob = Promise.resolve(new Blob(["%PDF-1.7"], { type: "application/octet-stream" }));
        renderCard();

        await screen.findByTitle("PDF viewer");
        expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
        const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
        expect(blob.type).toBe("application/pdf");
    });

    test("shows a spinner while the event is being fetched", async () => {
        // Leave the fetch hanging so the card never gets an event.
        client.fetchRoomEvent = vi.fn<MatrixClient["fetchRoomEvent"]>().mockReturnValue(new Promise(() => {}));
        renderCard();

        expect(await screen.findByTestId("spinner")).toBeInTheDocument();
        expect(screen.queryByTitle("PDF viewer")).not.toBeInTheDocument();
    });

    test("shows a spinner while the file is being downloaded", async () => {
        MediaEventHelperMock.nextBlob = new Promise(() => {});
        renderCard();

        await waitFor(() => expect(MediaEventHelperMock.instances).toHaveLength(1));
        expect(screen.getByTestId("spinner")).toBeInTheDocument();
        expect(screen.queryByTitle("PDF viewer")).not.toBeInTheDocument();
    });

    test("keeps showing a spinner for an event which carries no media", async () => {
        MediaEventHelperMock.isEligible.mockReturnValue(false);
        renderCard();

        await waitFor(() => expect(client.fetchRoomEvent).toHaveBeenCalled());
        expect(MediaEventHelperMock.instances).toHaveLength(0);
        expect(screen.getByTestId("spinner")).toBeInTheDocument();
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });

    test("shows an error instead of the viewer when the browser cannot display PDFs", async () => {
        Object.defineProperty(navigator, "pdfViewerEnabled", {
            value: false,
            configurable: true,
        });
        renderCard();

        expect(
            screen.getByText(
                "This browser does not support viewing PDFs. You might have disabled it in browser settings.",
            ),
        ).toBeInTheDocument();
        // The download still happens; wait for it so the error is asserted against a settled card.
        await waitFor(() => expect(URL.createObjectURL).toHaveBeenCalled());
        expect(screen.queryByTitle("PDF viewer")).not.toBeInTheDocument();
        expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
        expect(screen.getByRole("heading")).toHaveTextContent("PDF viewer");
    });

    test("revokes the object URL and destroys the helper when unmounted", async () => {
        const { unmount } = renderCard();

        await screen.findByTitle("PDF viewer");
        const helper = MediaEventHelperMock.instances[0];
        const destroyCallsBeforeUnmount = helper.destroy.mock.calls.length;

        unmount();

        expect(URL.revokeObjectURL).toHaveBeenCalledWith(OBJECT_URL);
        expect(helper.destroy.mock.calls.length).toBeGreaterThan(destroyCallsBeforeUnmount);
    });

    test("re-fetches and re-renders when the event id changes", async () => {
        const { rerender } = renderCard();
        await screen.findByTitle("PDF viewer");

        const otherEventId = "$other-event";
        vi.mocked(client.fetchRoomEvent).mockResolvedValue(mkPdfEventJson(otherEventId));
        vi.mocked(URL.createObjectURL).mockReturnValue(OTHER_OBJECT_URL);
        rerender(<PdfViewerCard eventId={otherEventId} room={room} onClose={onClose} />);

        await waitFor(() => expect(screen.getByTitle("PDF viewer")).toHaveAttribute("src", OTHER_OBJECT_URL));
        expect(client.fetchRoomEvent).toHaveBeenCalledWith(ROOM_ID, otherEventId);
        expect(MediaEventHelperMock.instances).toHaveLength(2);
        // The superseded helper is cleaned up rather than leaked.
        expect(MediaEventHelperMock.instances[0].destroy).toHaveBeenCalled();
    });

    test("calls onClose when the close button is clicked", async () => {
        renderCard();
        await screen.findByTitle("PDF viewer");

        await userEvent.click(screen.getByTestId("base-card-close-button"));

        expect(onClose).toHaveBeenCalled();
    });
});
