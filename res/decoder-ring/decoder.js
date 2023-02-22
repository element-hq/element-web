class StartupError extends Error {}

/*
 * We need to know the bundle path before we can fetch the sourcemap files.  In a production environment, we can guess
 * it using this.
 */
async function getBundleName(baseUrl) {
    const res = await fetch(new URL("index.html", baseUrl).toString());
    if (!res.ok) {
        throw new StartupError(`Couldn't fetch index.html to prefill bundle; ${res.status} ${res.statusText}`);
    }
    const index = await res.text();
    return index
        .split("\n")
        .map((line) => line.match(/<script src="bundles\/([^/]+)\/bundle.js"/))
        .filter((result) => result)
        .map((result) => result[1])[0];
}

function validateBundle(value) {
    return value.match(/^[0-9a-f]{20}$/) ? Some.of(value) : None;
}

/* A custom fetcher that abandons immediately upon getting a response.
 * The purpose of this is just to validate that the user entered a real bundle, and provide feedback.
 */
const bundleCache = new Map();
function bundleSubject(baseUrl, bundle) {
    if (!bundle.match(/^[0-9a-f]{20}$/)) throw new Error("Bad input");
    if (bundleCache.has(bundle)) {
        return bundleCache.get(bundle);
    }
    const fetcher = new rxjs.BehaviorSubject(Pending.of());
    bundleCache.set(bundle, fetcher);

    fetch(new URL(`bundles/${bundle}/bundle.js.map`, baseUrl).toString()).then((res) => {
        res.body.cancel(); /* Bail on the download immediately - it could be big! */
        const status = res.ok;
        if (status) {
            fetcher.next(Success.of());
        } else {
            fetcher.next(FetchError.of(`Failed to fetch: ${res.status} ${res.statusText}`));
        }
    });

    return fetcher;
}

/*
 * Convert a ReadableStream of bytes into an Observable of a string
 * The observable will emit a stream of Pending objects and will concatenate
 * the number of bytes received with whatever pendingContext has been supplied.
 * Finally, it will emit a Success containing the result.
 * You'd use this on a Response.body.
 */
function observeReadableStream(readableStream, pendingContext = {}) {
    let bytesReceived = 0;
    let buffer = "";
    const pendingSubject = new rxjs.BehaviorSubject(Pending.of({ ...pendingContext, bytesReceived }));
    const throttledPending = pendingSubject.pipe(rxjs.operators.throttleTime(100));
    const resultObservable = new rxjs.Subject();
    const reader = readableStream.getReader();
    const utf8Decoder = new TextDecoder("utf-8");
    function readNextChunk() {
        reader.read().then(({ done, value }) => {
            if (done) {
                pendingSubject.complete();
                resultObservable.next(Success.of(buffer));
                return;
            }
            bytesReceived += value.length;
            pendingSubject.next(Pending.of({ ...pendingContext, bytesReceived }));
            /* string concatenation is apparently the most performant way to do this */
            buffer += utf8Decoder.decode(value);
            readNextChunk();
        });
    }
    readNextChunk();
    return rxjs.concat(throttledPending, resultObservable);
}

/*
 * A wrapper which converts the browser's `fetch()` mechanism into an Observable.  The Observable then provides us with
 * a stream of datatype values: first, a sequence of Pending objects that keep us up to date with the download progress,
 * finally followed by either a Success or Failure object.  React then just has to render each of these appropriately.
 */
const fetchCache = new Map();
function fetchAsSubject(endpoint) {
    if (fetchCache.has(endpoint)) {
        // TODO: expiry/retry logic here?
        return fetchCache.get(endpoint);
    }
    const fetcher = new rxjs.BehaviorSubject(Pending.of());
    fetchCache.set(endpoint, fetcher);

    fetch(endpoint).then((res) => {
        if (!res.ok) {
            fetcher.next(FetchError.of(`Failed to fetch endpoint ${endpoint}: ${res.status} ${res.statusText}`));
            return;
        }

        const contentLength = res.headers.get("content-length");
        const context = contentLength ? { length: parseInt(contentLength) } : {};

        const streamer = observeReadableStream(res.body, context);
        streamer.subscribe((value) => {
            fetcher.next(value);
        });
    });
    return fetcher;
}

/* ===================== */
/* ==== React stuff ==== */
/* ===================== */
/* Rather than importing an entire build infrastructure, for now we just use React without JSX */
const e = React.createElement;

/*
 * Provides user feedback given a FetchStatus object.
 */
function ProgressBar({ fetchStatus }) {
    return e(
        "span",
        { className: "progress " },
        fetchStatus.fold({
            pending: ({ bytesReceived, length }) => {
                if (!bytesReceived) {
                    return e("span", { className: "spinner" }, "\u29b5");
                }
                const kB = Math.floor((10 * bytesReceived) / 1024) / 10;
                if (!length) {
                    return e("span", null, `Fetching (${kB}kB)`);
                }
                const percent = Math.floor((100 * bytesReceived) / length);
                return e("span", null, `Fetching (${kB}kB) ${percent}%`);
            },
            success: () => e("span", null, "\u2713"),
            error: (reason) => {
                return e("span", { className: "error" }, `\u2717 ${reason}`);
            },
        }),
    );
}

/*
 * The main component.
 */
function BundlePicker() {
    const [baseUrl, setBaseUrl] = React.useState(new URL("..", window.location).toString());
    const [bundle, setBundle] = React.useState("");
    const [file, setFile] = React.useState("");
    const [line, setLine] = React.useState("1");
    const [column, setColumn] = React.useState("");
    const [result, setResult] = React.useState(None);
    const [bundleFetchStatus, setBundleFetchStatus] = React.useState(None);
    const [fileFetchStatus, setFileFetchStatus] = React.useState(None);

    /* On baseUrl change, try to fill in the bundle name for the user */
    React.useEffect(() => {
        console.log("DEBUG", baseUrl);
        getBundleName(baseUrl).then((name) => {
            console.log("DEBUG", name);
            if (bundle === "" && validateBundle(name) !== None) {
                setBundle(name);
            }
        }, console.log.bind(console));
    }, [baseUrl]);

    /* ------------------------- */
    /* Follow user state changes */
    /* ------------------------- */
    const onBaseUrlChange = React.useCallback((event) => {
        const value = event.target.value;
        setBaseUrl(value);
    }, []);

    const onBundleChange = React.useCallback((event) => {
        const value = event.target.value;
        setBundle(value);
    }, []);

    const onFileChange = React.useCallback((event) => {
        const value = event.target.value;
        setFile(value);
    }, []);

    const onLineChange = React.useCallback((event) => {
        const value = event.target.value;
        setLine(value);
    }, []);

    const onColumnChange = React.useCallback((event) => {
        const value = event.target.value;
        setColumn(value);
    }, []);

    /* ------------------------------------------------ */
    /* Plumb data-fetching observables through to React */
    /* ------------------------------------------------ */

    /* Whenever a valid bundle name is input, go see if it's a real bundle on the server */
    React.useEffect(
        () =>
            validateBundle(bundle).fold({
                some: (value) => {
                    const subscription = bundleSubject(baseUrl, value)
                        .pipe(rxjs.operators.map(Some.of))
                        .subscribe(setBundleFetchStatus);
                    return () => subscription.unsubscribe();
                },
                none: () => setBundleFetchStatus(None),
            }),
        [baseUrl, bundle],
    );

    /* Whenever a valid javascript file is input, see if it corresponds to a sourcemap file and initiate a fetch
     * if so. */
    React.useEffect(() => {
        if (!file.match(/.\.js$/) || validateBundle(bundle) === None) {
            setFileFetchStatus(None);
            return;
        }
        const observable = fetchAsSubject(new URL(`bundles/${bundle}/${file}.map`, baseUrl).toString()).pipe(
            rxjs.operators.map((fetchStatus) =>
                fetchStatus.flatMap((value) => {
                    try {
                        return Success.of(JSON.parse(value));
                    } catch (e) {
                        return FetchError.of(e);
                    }
                }),
            ),
            rxjs.operators.map(Some.of),
        );
        const subscription = observable.subscribe(setFileFetchStatus);
        return () => subscription.unsubscribe();
    }, [baseUrl, bundle, file]);

    /*
     * Whenever we have a valid fetched sourcemap, and a valid line, attempt to find the original position from the
     * sourcemap.
     */
    React.useEffect(() => {
        // `fold` dispatches on the datatype, like a switch statement
        fileFetchStatus.fold({
            some: (fetchStatus) =>
                // `fold` just returns null for all of the cases that aren't `Success` objects here
                fetchStatus.fold({
                    success: (value) => {
                        if (!line) return setResult(None);
                        const pLine = parseInt(line);
                        const pCol = parseInt(column);
                        sourceMap.SourceMapConsumer.with(value, undefined, (consumer) =>
                            consumer.originalPositionFor({ line: pLine, column: pCol }),
                        ).then((result) => setResult(Some.of(JSON.stringify(result))));
                    },
                }),
            none: () => setResult(None),
        });
    }, [fileFetchStatus, line, column]);

    /* ------ */
    /* Render */
    /* ------ */
    return e(
        "div",
        {},
        e(
            "div",
            { className: "inputs" },
            e(
                "div",
                { className: "baseUrl" },
                e("label", { htmlFor: "baseUrl" }, "Base URL"),
                e("input", {
                    name: "baseUrl",
                    required: true,
                    pattern: ".+",
                    onChange: onBaseUrlChange,
                    value: baseUrl,
                }),
            ),
            e(
                "div",
                { className: "bundle" },
                e("label", { htmlFor: "bundle" }, "Bundle"),
                e("input", {
                    name: "bundle",
                    required: true,
                    pattern: "[0-9a-f]{20}",
                    onChange: onBundleChange,
                    value: bundle,
                }),
                bundleFetchStatus.fold({
                    some: (fetchStatus) => e(ProgressBar, { fetchStatus }),
                    none: () => null,
                }),
            ),
            e(
                "div",
                { className: "file" },
                e("label", { htmlFor: "file" }, "File"),
                e("input", {
                    name: "file",
                    required: true,
                    pattern: ".+\\.js",
                    onChange: onFileChange,
                    value: file,
                }),
                fileFetchStatus.fold({
                    some: (fetchStatus) => e(ProgressBar, { fetchStatus }),
                    none: () => null,
                }),
            ),
            e(
                "div",
                { className: "line" },
                e("label", { htmlFor: "line" }, "Line"),
                e("input", {
                    name: "line",
                    required: true,
                    pattern: "[0-9]+",
                    onChange: onLineChange,
                    value: line,
                }),
            ),
            e(
                "div",
                { className: "column" },
                e("label", { htmlFor: "column" }, "Column"),
                e("input", {
                    name: "column",
                    required: true,
                    pattern: "[0-9]+",
                    onChange: onColumnChange,
                    value: column,
                }),
            ),
        ),
        e(
            "div",
            null,
            result.fold({
                none: () => "Select a bundle, file and line",
                some: (value) => e("pre", null, value),
            }),
        ),
    );
}

/* Global stuff */
window.Decoder = {
    BundlePicker,
};
