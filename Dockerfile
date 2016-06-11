# Vector docker (A glossy Matrix collaboration client for the web)

# use alpine base docker
FROM alpine
MAINTAINER ogarcia@connectical.com

# update alpine and install necessary packages
RUN apk -U --no-progress upgrade && \
  apk -U --no-progress add nodejs git

# add software to /vector
COPY . /vector
WORKDIR /vector

# install prerequisites
RUN npm install

# configure container and run
VOLUME ["/deploy"]
ENTRYPOINT ["/bin/sh"]
CMD ["docker/build.sh"]
