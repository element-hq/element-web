# Vector Docker builder

The main purpose of this Docker image is build Vector web without install
any dependency. This is useful in most production environments where you
have fixed versions of packages.

## Build Vector

To build Vector simply run.

```
docker run -t -i --rm -v /host/dir/to/deploy:/deploy vector-im/vector-web
```

This command lets you a fresh build in `/host/dir/to/deploy` directory that
you can use with you favorite web server.

## Environment variables

You can set some environment variables to Docker to modify `config.json`
file. These are the following.

* default_hs_url
* default_is_url
* brand
* integrations_ui_url
* integrations_rest_url

Simply run Docker with `-e variable=value` as following sample.

```
docker run -t -i --rm -e default_hs_url=https://my.home.server.com -e brand='Vector Rocks!' -v /host/dir/to/deploy:/deploy vector-im/vector-web
```
