ARG ARCH="amd64"
ARG OS="linux"
FROM quay.io/prometheus/busybox:latest
LABEL maintainer="Jacob Colvin (MacroPower) <me@jacobcolvin.com>"

ARG ARCH="amd64"
ARG OS="linux"
COPY .build/${OS}-${ARCH}/macropower_analytics_panel_server /bin/macropower_analytics_panel_server

USER nobody
ENTRYPOINT ["/bin/macropower_analytics_panel_server"]
EXPOSE 8080
