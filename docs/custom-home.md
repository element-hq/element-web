# Custom Home View

The home view is shown whenever the user is logged in, but no room is selected.
A custom `home.html` replacing the default home view can be configured either in `.well-known/matrix/client` or `config.json`.
Such a custom home view can be used to communicate helpful information and important rules to the users.

## Configuration

To provide a custom home view for all element-web/desktop users of a homeserver, include the following in `.well-known/matrix/client`:

```
{
    "io.element.embedded_pages": {
        "home_url": "https://example.org/home.html"
    }
}
```

In case the `.well-known/matrix/client` contains no `home_url`, element-web falls back to the value provided in its `config.json`:

```
{
    "embeddedPages": {
        "homeUrl": "https://example.org/home.html"
    }
}
```


## `home.html` Example

The following is a simple example for a custom `home.html`:

```
<style type="text/css">
	.tos {
		width: auto;
		color: black;
		background : #ffcccb;
		font-weight: bold;
	}
</style>

<h1>The example.org Matrix Server</h1>

<div class="tos">
	<p>Behave appropriately.</p>
</div>

<h2>Start Chatting</h2>
<ul>
	<li><a href="#/dm">Send a Direct Message</a></li>
	<li><a href="#/directory">Explore Public Rooms</a></li>
	<li><a href="#/new">Create a Group Chat</a></li>
</ul>
```

When choosing colors, be aware that the home view may be displayed in either light or dark mode.

It may be needed to set CORS headers for the `home.html` to enable element-desktop to fetch it, with e.g., the following nginx config:

```
add_header Access-Control-Allow-Origin *;
```

