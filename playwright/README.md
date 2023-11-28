To update snapshots you will need to run Playwright on a Linux machine.
If you have access to docker then you can use the following:

```shell
docker build playwright -t matrix-react-sdk-playwright
docker run \
    --rm \
    --network host \
    -v $(pwd)/../:/work/ \
    -v /var/run/docker.sock:/var/run/docker.sock \
    -v /tmp/:/tmp/ \
    -it matrix-react-sdk-playwright
```
